import { app, safeStorage } from 'electron';

export const credentialEncryption = {
  id: 'personal-hub-windows-dpapi-v1',
  isAvailable() {
    return process.platform === 'win32' && app.isReady() && safeStorage.isEncryptionAvailable();
  },
  encrypt(plaintext) {
    if (!this.isAvailable()) throw new Error('Windows credential encryption unavailable.');
    return safeStorage.encryptString(plaintext);
  },
  decrypt(ciphertext) {
    if (!this.isAvailable()) throw new Error('Windows credential encryption unavailable.');
    return safeStorage.decryptString(Buffer.from(ciphertext));
  },
};