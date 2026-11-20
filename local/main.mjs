import { app, shell } from 'electron';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createChatGPT } from '@siwc/local';
import { credentialEncryption } from './encryption.mjs';
import { startLocalServer } from './server.mjs';
import { HubStore } from './store.mjs';

app.setName('Personal Hub Connection Test');
app.setPath('userData', join(app.getPath('appData'), 'Personal Hub Connection Test'));
app.whenReady().then(async () => {
  if (!credentialEncryption.isAvailable()) throw new Error('encryption_unavailable');
  const storageDir = join(app.getPath('userData'), 'connection');
  await mkdir(storageDir, { recursive: true });
  const ownerPath = join(storageDir, 'owner.bin');
  const evidencePath = join(storageDir, 'verification.json');
  const store = new HubStore(join(app.getPath('userData'), 'education.sqlite'));
  const uploadsDir = join(app.getPath('userData'), 'uploads');
  const runtime = createChatGPT({
    appName: 'Personal Hub', appId: 'personal-hub-local', redirectPort: 0,
    storageDir, credentialEncryption, sendHostId: true,
    openBrowser: async url => {
      const target = new URL(url);
      if (target.origin !== 'https://auth.openai.com') throw new Error('unexpected_authorization_origin');
      await shell.openExternal(url);
    },
  });
  const ownerStore = {
    async read() {
      let bytes;
      try { bytes = await readFile(ownerPath); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      const owner = JSON.parse(credentialEncryption.decrypt(bytes));
      if (typeof owner.profileId !== 'string' || !owner.profileId) throw new Error('invalid_owner_state');
      return owner;
    },
    async write(owner) {
      await writeFile(`${ownerPath}.tmp`, credentialEncryption.encrypt(JSON.stringify(owner)));
      await rename(`${ownerPath}.tmp`, ownerPath);
    },
  };
  const application = await startLocalServer({
    runtime, ownerStore, store, uploadsDir, root: fileURLToPath(new URL('../', import.meta.url)),
    onVerified: async result => {
      await writeFile(evidencePath, JSON.stringify(result, null, 2));
      console.log('Verified: response.completed received; application save confirmed.');
    },
    onFailure: async result => {
      if (['unauthorized', 'forbidden'].includes(result.code)) return;
      await writeFile(join(storageDir, 'last-error.json'), JSON.stringify(result, null, 2));
    },
  });
  console.log(`Personal Hub is running locally at ${application.origin}`);
  console.log('Credentials use Windows DPAPI outside the project. No API-key fallback exists.');
  await shell.openExternal(application.launchUrl);
  app.on('before-quit', () => {
    runtime.cancelSignIn();
    application.server.closeAllConnections();
    application.server.close();
    store.close();
  });
}).catch(() => {
  console.error('Local startup failed. No credentials or raw exception details were logged.');
  app.exit(1);
});