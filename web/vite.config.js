import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// Run from the repo root (npm run dev). mkcert certs enable https for Production OAuth.
const cert = 'certs/localhost.pem', key = 'certs/localhost-key.pem';
const https = fs.existsSync(cert) ? { cert: fs.readFileSync(cert), key: fs.readFileSync(key) } : undefined;

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true, https, proxy: { '/api': 'http://127.0.0.1:4000' } },
});
