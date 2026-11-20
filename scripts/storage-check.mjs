import { app } from 'electron';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { credentialEncryption } from '../local/encryption.mjs';

app.setName('Personal Hub Connection Test');
app.whenReady().then(async () => {
  assert.ok(credentialEncryption.isAvailable());
  const directory = join(app.getPath('userData'), 'storage-probe');
  const path = join(directory, 'synthetic.bin');
  const sample = 'SYNTHETIC-ONLY-personal-hub-storage-probe';
  if (process.argv.includes('write')) {
    await mkdir(directory, { recursive: true });
    const encrypted = credentialEncryption.encrypt(sample);
    assert.equal(encrypted.includes(Buffer.from(sample)), false);
    await writeFile(path, encrypted);
    console.log('PASS: Windows DPAPI encrypted synthetic data outside the workspace.');
  } else {
    const encrypted = await readFile(path);
    assert.equal(credentialEncryption.decrypt(encrypted), sample);
    assert.throws(() => credentialEncryption.decrypt(Buffer.from('invalid ciphertext')));
    await rm(directory, { recursive: true });
    console.log('PASS: Separate process decrypted synthetic data; invalid ciphertext rejected.');
  }
  app.exit(0);
}).catch(() => {
  console.error('FAIL: Windows OS-backed storage probe failed. No real credentials were used.');
  app.exit(1);
});