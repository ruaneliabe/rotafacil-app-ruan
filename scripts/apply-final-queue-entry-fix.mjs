import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[queue-final] ${path}: updated`);
  } else {
    console.log(`[queue-final] ${path}: no-op`);
  }
  return after;
};

// 1) App do motoboy: entrar na fila deve gerar UMA única escrita de fila.
// Antes ele chamava onConfirmArrivalAtStore e logo depois onUpdateMotoboyStatus('available').
// A segunda escrita podia reutilizar um joinedQueueAt antigo vindo do snapshot e fazer quem entrou depois pular para 1º.
const motoboy = patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;

  s = s.replace(
`  const enterQueue = () => {
    if (driver) {
      onConfirmArrivalAtStore?.(driver.id);
      onUpdateMotoboyStatus?.(driver.id, 'available');
    }
    setTab('orders');
  };`,
`  const enterQueue = () => {
    if (driver) {
      if (onConfirmArrivalAtStore) onConfirmArrivalAtStore(driver.id);
      else onUpdateMotoboyStatus?.(driver.id, 'available');
    }
    setTab('orders');
  };`
  );

  // Mantém apenas o card canônico do pilot-flow-lock para "Fora da fila".
  // Remove cards legados que podem ter sobrado de recovery scripts e causavam dois botões "Entrar na fila".
  s = s.replace(/\s*\{!inQueue && !returning && driver\.status !== 'delivering' && preparing\.length === 0 && ready\.length === 0 && route\.length === 0 && \(\s*<section data-emergency-enter-queue="true"[\s\S]*?<\/section>\s*\)\}/g, '');
  s = s.replace(/\s*\{!inQueue && !returning && driver\.status !== 'delivering' && preparing\.length === 0 && ready\.length === 0 && route\.length === 0 && \(\s*<section data-motoboy-idle-recovery="true"[\s\S]*?<\/section>\s*\)\}/g, '');

  // Se por algum motivo houver mais de um bloco canônico, mantém somente o primeiro.
  const idleMarker = 'data-pilot-flow-lock="idle"';
  let first = s.indexOf(idleMarker);
  if (first >= 0) {
    let next = s.indexOf(idleMarker, first + idleMarker.length);
    while (next >= 0) {
      const open = s.lastIndexOf('{!inQueue', next);
      const close = s.indexOf('            )}', next);
      if (open >= 0 && close > next) s = s.slice(0, open) + s.slice(close + '            )}'.length);
      else break;
      next = s.indexOf(idleMarker, first + idleMarker.length);
    }
  }

  return s;
});

// 2) Cadastro novo NÃO entra automaticamente na fila.
// Assim joinedQueueAt só nasce quando o motoboy realmente toca em "Entrar na fila".
const firebase = patch('src/lib/firebase.ts', (input) => {
  let s = input;
  s = s.replace(
    "? { ...dailyBase, status: motoboy.status || 'available', activeOrdersCount: 0, totalEarnedToday: 0, deliveriesCountToday: 0, statsDate: today, joinedQueueAt: Date.now(), callingToCounterAt: undefined }",
    "? { ...dailyBase, status: motoboy.status || 'available', activeOrdersCount: 0, totalEarnedToday: 0, deliveriesCountToday: 0, statsDate: today, joinedQueueAt: undefined, callingToCounterAt: undefined }"
  );
  return s;
});

// 3) Confirmação de chegada é a fonte única da posição: timestamp novo sempre.
const app = patch('src/App.tsx', (input) => {
  let s = input;

  // handleConfirmArrivalAtStore já usa Date.now(); mantemos como fonte oficial.
  // Para mudanças genéricas de status, NÃO reaproveitar joinedQueueAt antigo ao entrar em available.
  s = s.replace(
    "      joinedQueueAt: newStatus === 'available' ? (target.joinedQueueAt || Date.now()) : undefined,",
    "      joinedQueueAt: newStatus === 'available' ? Date.now() : undefined,"
  );

  return s;
});

if (!motoboy.includes('if (onConfirmArrivalAtStore) onConfirmArrivalAtStore(driver.id);')) {
  throw new Error('[queue-final] entrada única na fila não aplicada');
}
if (motoboy.includes('data-emergency-enter-queue="true"') || motoboy.includes('data-motoboy-idle-recovery="true"')) {
  throw new Error('[queue-final] card duplicado de entrar na fila ainda presente');
}
if (!firebase.includes('joinedQueueAt: undefined, callingToCounterAt: undefined')) {
  throw new Error('[queue-final] cadastro novo ainda pode autoentrar na fila');
}

console.log('[queue-final] FIFO entre dispositivos e card único de entrada validados');
