import crypto from 'node:crypto';
import { config } from './config.js';

const key = () => {
  const k = Buffer.from(config().ENCRYPTION_KEY || '', 'hex');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes of hex');
  return k;
};

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('hex')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, enc] = payload.split('.').map((h) => Buffer.from(h, 'hex'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
