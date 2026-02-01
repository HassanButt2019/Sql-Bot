const crypto = require('crypto');
const { getDb } = require('../db/sqliteStore.cjs');

function getKey() {
  const key = process.env.SECRETS_MASTER_KEY;
  if (!key) {
    throw new Error('SECRETS_MASTER_KEY is required');
  }
  const buffer = Buffer.from(key, 'hex');
  if (buffer.length !== 32) {
    throw new Error('SECRETS_MASTER_KEY must be 32 bytes hex');
  }
  return buffer;
}

function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(payload) {
  const key = getKey();
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function storeSecret({ id, orgId, kind, value }) {
  const conn = getDb();
  const ciphertext = encrypt(JSON.stringify(value));
  const now = Date.now();
  conn.prepare('INSERT INTO secrets (id, org_id, kind, ciphertext, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, orgId, kind, ciphertext, now);
  return id;
}

function getSecret(secretId, orgId) {
  const conn = getDb();
  const row = conn.prepare('SELECT * FROM secrets WHERE id = ? AND org_id = ?').get(secretId, orgId);
  if (!row) return null;
  const payload = decrypt(row.ciphertext);
  return JSON.parse(payload);
}

module.exports = {
  storeSecret,
  getSecret
};
