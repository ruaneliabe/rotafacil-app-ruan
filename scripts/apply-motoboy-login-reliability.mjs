import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[motoboy-login] ${path}: no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[motoboy-login] ${path}: updated`);
};

// 1) Firebase: fallback de busca direta para login, sem depender do snapshot já ter atualizado.
patch('src/lib/firebase.ts', (input) => {
  let s = input;
  if (!s.includes('export async function findMotoboyForLogin')) {
    const anchor = 'export async function saveMotoboyToCloud(motoboy: Motoboy) {';
    const fn = `export async function findMotoboyForLogin(term: string): Promise<Motoboy | null> {\n  try {\n    const normalized = term.trim().toLowerCase();\n    if (!normalized) return null;\n    const snapshot = await getDocs(collection(db, 'motoboys'));\n    for (const snap of snapshot.docs) {\n      const raw = { id: snap.id, ...snap.data() } as Motoboy;\n      if (raw.operationalEpoch !== STORE_PILOT_RESET_VERSION) continue;\n      const username = (raw.username || '').trim().toLowerCase();\n      const name = (raw.name || '').trim().toLowerCase();\n      const id = raw.id.trim().toLowerCase();\n      if (username === normalized || name === normalized || id === normalized) return raw;\n    }\n    return null;\n  } catch (err) {\n    console.warn('Error finding motoboy for login:', err);\n    return null;\n  }\n}\n\n`;
    s = s.replace(anchor, fn + anchor);
  }
  return s;
});

// 2) Login: tenta snapshot em memória; se não encontrar, consulta Firestore diretamente.
patch('src/components/LoginModal.tsx', (input) => {
  let s = input;
  s = s.replace(
    "import { saveStoreAccountToCloud, getStoreAccountFromCloud, upgradeStoreCredentialsToHash, upgradeMotoboyPasswordToHash } from '../lib/firebase';",
    "import { saveStoreAccountToCloud, getStoreAccountFromCloud, upgradeStoreCredentialsToHash, upgradeMotoboyPasswordToHash, findMotoboyForLogin } from '../lib/firebase';"
  );

  const oldBlock = `    const term = motoboyUser.trim().toLowerCase();\n    const targetMotoboy = motoboys.find(\n      (m) =>\n        (m.username && m.username.trim().toLowerCase() === term) ||\n        m.name.trim().toLowerCase() === term ||\n        m.id.trim().toLowerCase() === term\n    );\n\n    if (!targetMotoboy) {\n      setErrorMsg('Entregador não encontrado. Verifique o usuário informado.');\n      return;\n    }`;
  const newBlock = `    const term = motoboyUser.trim().toLowerCase();\n    if (!term) {\n      setErrorMsg('Informe o usuário do entregador.');\n      return;\n    }\n\n    let targetMotoboy = motoboys.find(\n      (m) =>\n        (m.username && m.username.trim().toLowerCase() === term) ||\n        m.name.trim().toLowerCase() === term ||\n        m.id.trim().toLowerCase() === term\n    );\n\n    // Cadastro recém-criado pode ainda não ter chegado no snapshot deste aparelho.\n    // Busca direto no Firestore para o login funcionar imediatamente em outro celular.\n    if (!targetMotoboy) targetMotoboy = await findMotoboyForLogin(term) || undefined;\n\n    if (!targetMotoboy) {\n      setErrorMsg('Entregador não encontrado. Verifique o usuário informado.');\n      return;\n    }`;
  s = s.replace(oldBlock, newBlock);
  return s;
});

// 3) Modal de cadastro: só fecha depois do Firestore confirmar o salvamento.
patch('src/components/AddMotoboyModal.tsx', (input) => {
  let s = input;
  s = s.replace(
    "  onAddMotoboy: (motoboy: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'>) => void;",
    "  onAddMotoboy: (motoboy: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'>) => Promise<void> | void;"
  );
  s = s.replace('  const handleSubmit = (e: React.FormEvent) => {', '  const handleSubmit = async (e: React.FormEvent) => {');
  s = s.replace('      onAddMotoboy({', '      await onAddMotoboy({');
  s = s.replace(
    '<button type="submit" className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black rounded-xl transition-all shadow-md text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2">\n            <span>🛵</span><span>Salvar Motoboy</span>\n          </button>',
    '<button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black rounded-xl transition-all shadow-md text-xs uppercase tracking-wide cursor-pointer flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60">\n            <span>🛵</span><span>{isSubmitting ? \'Salvando...\' : \'Salvar Motoboy\'}</span>\n          </button>'
  );
  return s;
});

// 4) App: espera o save real terminar antes de considerar cadastro concluído.
patch('src/App.tsx', (input) => {
  let s = input;
  s = s.replace(
    "  const handleAddMotoboy = (newMotoboyData: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'> | Motoboy) => {",
    "  const handleAddMotoboy = async (newMotoboyData: Omit<Motoboy, 'id' | 'status' | 'activeOrdersCount' | 'totalEarnedToday'> | Motoboy) => {"
  );
  s = s.replace(
    '    saveMotoboyToCloud(completeMotoboy);\n    showToast(`Entregador ${completeMotoboy.name} cadastrado com sucesso! 🛵`);',
    '    await saveMotoboyToCloud(completeMotoboy);\n    showToast(`Entregador ${completeMotoboy.name} cadastrado com sucesso! Já pode entrar no app. 🛵`);'
  );
  return s;
});

// Validação de build: se algum patch anterior mudar as âncoras, falha em vez de publicar cadastro/login quebrado.
const firebase = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const login = fs.readFileSync('src/components/LoginModal.tsx', 'utf8');
const modal = fs.readFileSync('src/components/AddMotoboyModal.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const checks = [
  ['findMotoboyForLogin', firebase.includes('export async function findMotoboyForLogin')],
  ['login cloud fallback', login.includes('await findMotoboyForLogin(term)')],
  ['await cadastro modal', modal.includes('await onAddMotoboy({')],
  ['await firebase save', app.includes('await saveMotoboyToCloud(completeMotoboy)')],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Motoboy login reliability validation failed: ${failed.join(', ')}`);
console.log('[motoboy-login] critical registration/login flow validated');
