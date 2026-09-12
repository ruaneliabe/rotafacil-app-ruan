import fs from 'node:fs';

const target = 'api/sync-cardapio-web.ts';
if (!fs.existsSync(target)) throw new Error(`[cw-runtime-firebase-fix] missing ${target}`);

let source = fs.readFileSync(target, 'utf8');

source = source
  .replace("import { initializeApp, getApps, getApp } from 'firebase/app';", "import { initializeApp, getApps } from 'firebase/app';")
  .replace(
    "apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,",
    "apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyD-XkOCjvoGt3VZRfLQyH5Dg1S7P2Ex2-8',",
  )
  .replace(
    "authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,",
    "authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || 'rotafacil-app-oficial.firebaseapp.com',",
  )
  .replace(
    "storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,",
    "storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'rotafacil-app-oficial.firebasestorage.app',",
  )
  .replace(
    "messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,",
    "messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '846726683671',",
  )
  .replace(
    "appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,",
    "appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '1:846726683671:web:d0b5ddc701815609be9052',",
  )
  .replace(
    "const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);",
    "const app = getApps().find((candidate) => candidate.name === 'rotafacil-cardapio-sync') || initializeApp(firebaseConfig, 'rotafacil-cardapio-sync');",
  );

const required = [
  "rotafacil-app-oficial",
  "rotafacil-cardapio-sync",
  "AIzaSyD-XkOCjvoGt3VZRfLQyH5Dg1S7P2Ex2-8",
  "1:846726683671:web:d0b5ddc701815609be9052",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`[cw-runtime-firebase-fix] expected marker missing: ${marker}`);
}
if (source.includes('getApp()')) {
  throw new Error('[cw-runtime-firebase-fix] unsafe default getApp() remained in generated sync endpoint');
}

fs.writeFileSync(target, source);
console.log('[cw-runtime-firebase-fix] final Cardapio sync uses official named Firebase app and verified web config');
