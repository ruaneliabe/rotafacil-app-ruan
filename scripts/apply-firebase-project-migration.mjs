import fs from 'node:fs';

const files = [
  'firebase-applet-config.json',
  'src/lib/firebase.ts',
  'api/webhook-cardapio-web.ts',
  'api/sync-cardapio-web.ts',
  'api/cardapio-web-shadow-sync.ts',
  'api/reconcile-cardapio-web-completed.ts',
  'api/reconcile-cardapio-web-couriers.ts',
];

const legacyMarkers = [
  'gentle-country',
  'rotafcildelivery',
  'ai-studio-rotafcildelivery',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const marker = legacyMarkers.find((item) => source.includes(item));
  if (marker) {
    throw new Error(`[firebase-migration] legacy Firebase marker "${marker}" found in ${file}`);
  }
}

const frontendConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
if (frontendConfig.projectId !== 'rotafacil-app-oficial') {
  throw new Error(`[firebase-migration] frontend projectId must be rotafacil-app-oficial, got ${frontendConfig.projectId}`);
}
if ((frontendConfig.firestoreDatabaseId || '(default)') !== '(default)') {
  throw new Error(`[firebase-migration] frontend Firestore database must be (default), got ${frontendConfig.firestoreDatabaseId}`);
}

const webhook = fs.readFileSync('api/webhook-cardapio-web.ts', 'utf8');
const sync = fs.readFileSync('api/sync-cardapio-web.ts', 'utf8');

for (const [label, source] of [['webhook', webhook], ['sync', sync]]) {
  if (!source.includes('rotafacil-app-oficial')) {
    throw new Error(`[firebase-migration] ${label} is not pinned to rotafacil-app-oficial`);
  }
  if (!source.includes("'(default)'")) {
    throw new Error(`[firebase-migration] ${label} is not configured for Firestore (default)`);
  }
}

console.log('[firebase-migration] validated: no legacy Firebase references; frontend/webhook/sync use rotafacil-app-oficial/(default)');