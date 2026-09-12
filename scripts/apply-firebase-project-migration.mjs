import fs from 'node:fs';

const WEBHOOK = 'api/webhook-cardapio-web.ts';
const SYNC = 'api/sync-cardapio-web.ts';

const defaultProject = 'rotafacil-app-oficial';
const defaultConfig = {
  projectId: defaultProject,
  appId: '1:846726683671:web:d0b5ddc701815609be9052',
  apiKey: 'AIzaSyD-XkOCjvoGt3VZRfLQyH5Dg1S7P2Ex2-8',
  authDomain: 'rotafacil-app-oficial.firebaseapp.com',
  storageBucket: 'rotafacil-app-oficial.firebasestorage.app',
  messagingSenderId: '846726683671',
};

function patchWebhook() {
  let source = fs.readFileSync(WEBHOOK, 'utf8');
  source = source.replace(/const FIREBASE_CONFIG = \{[\s\S]*?\n\};/, `const FIREBASE_CONFIG = {\n  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ${JSON.stringify(defaultConfig.projectId)},\n  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || ${JSON.stringify(defaultConfig.appId)},\n  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ${JSON.stringify(defaultConfig.apiKey)},\n  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || ${JSON.stringify(defaultConfig.authDomain)},\n  firestoreDatabaseId: process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)',\n  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || ${JSON.stringify(defaultConfig.storageBucket)},\n  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || ${JSON.stringify(defaultConfig.messagingSenderId)},\n};`);
  if (!source.includes("firestoreDatabaseId: process.env.VITE_FIRESTORE_DATABASE_ID")) {
    throw new Error('[firebase-migration] webhook config patch failed');
  }
  fs.writeFileSync(WEBHOOK, source);
}

function patchSync() {
  let source = fs.readFileSync(SYNC, 'utf8');
  source = source.replace("projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafcildelivery',", "projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'rotafacil-app-oficial',");
  source = source.replace(
    /const dbId = process\.env\.VITE_FIRESTORE_DATABASE_ID \|\| process\.env\.FIRESTORE_DATABASE_ID \|\| '[^']+';\n  return getFirestore\(app, dbId\);/,
    "const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || '(default)';\n  return dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);"
  );
  if (!source.includes("dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app)")) {
    throw new Error('[firebase-migration] sync default database patch failed');
  }
  fs.writeFileSync(SYNC, source);
}

patchWebhook();
patchSync();
console.log('[firebase-migration] frontend, webhook and sync aligned with rotafacil-app-oficial');
