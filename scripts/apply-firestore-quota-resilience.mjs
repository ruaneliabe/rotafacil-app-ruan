import fs from 'node:fs';

const FIREBASE = 'src/lib/firebase.ts';
const APP = 'src/App.tsx';
const LEGACY = 'src/components/StoreDashboardLegacy.tsx';
const SYNC = 'api/sync-cardapio-web.ts';

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`[quota-resilience] ${label} anchors missing`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let firebase = fs.readFileSync(FIREBASE, 'utf8');
if (!firebase.includes('  query,\n')) {
  firebase = firebase.replace('  deleteDoc,\n', '  deleteDoc,\n  query,\n  where,\n');
}

if (!firebase.includes('function warnFirestoreThrottled')) {
  const anchor = "const FRESH_INSTALL_VERSION = 'zeroed_company_setup_2026_08_17_v10';\n";
  const helper = `\nlet lastFirestoreWarningAt = 0;\nfunction warnFirestoreThrottled(scope: string, err: any) {\n  const now = Date.now();\n  if (now - lastFirestoreWarningAt < 30000) return;\n  lastFirestoreWarningAt = now;\n  console.warn(\`Firestore temporarily unavailable (\${scope}):\`, err?.code || err?.message || err);\n}\n`;
  if (!firebase.includes(anchor)) throw new Error('[quota-resilience] firebase helper anchor missing');
  firebase = firebase.replace(anchor, anchor + helper);
}

const subscriptions = `export function subscribeToOrders(callback: (orders: Order[]) => void, motoboyId?: string) {\n  const source = motoboyId\n    ? query(collection(db, 'orders'), where('assignedMotoboyId', '==', motoboyId))\n    : query(collection(db, 'orders'), where('operationalEpoch', '==', STORE_PILOT_RESET_VERSION));\n  return onSnapshot(source, (snapshot) => {\n    const list: Order[] = [];\n    snapshot.forEach((docSnap) => {\n      const order = { id: docSnap.id, ...docSnap.data() } as Order;\n      if (order.operationalEpoch !== STORE_PILOT_RESET_VERSION) return;\n      list.push(order);\n    });\n    list.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));\n    callback(list);\n  }, (err) => warnFirestoreThrottled('orders', err));\n}\n\nexport function subscribeToMotoboys(callback: (motoboys: Motoboy[]) => void) {\n  const source = query(collection(db, 'motoboys'), where('operationalEpoch', '==', STORE_PILOT_RESET_VERSION));\n  return onSnapshot(source, (snapshot) => {\n    const today = localDateKey();\n    const list: Motoboy[] = [];\n    snapshot.forEach((docSnap) => {\n      const raw = { id: docSnap.id, ...docSnap.data() } as Motoboy;\n      list.push(raw.statsDate === today ? raw : { ...raw, deliveriesCountToday: 0, totalEarnedToday: 0, statsDate: today });\n    });\n    if (typeof window !== 'undefined') {\n      try {\n        const saved = window.localStorage.getItem('rota_facil_session');\n        if (saved) {\n          const session = JSON.parse(saved) as { role?: string; motoboyId?: string };\n          if (session.role === 'motoboy' && session.motoboyId) {\n            const driver = list.find((m) => m.id === session.motoboyId);\n            if (!driver || driver.accessRevokedAt) { forceMotoboyLogout(); return; }\n          }\n        }\n      } catch (err) { console.warn('Could not validate motoboy session:', err); }\n    }\n    callback(list);\n  }, (err) => warnFirestoreThrottled('motoboys', err));\n}\n\n`;
firebase = replaceBlock(firebase, 'export function subscribeToOrders', 'export function subscribeToShift', subscriptions, 'subscriptions');
firebase = firebase.replace(
  "export function subscribeToShift(callback: (shift: StoreShift) => void) {\n  return onSnapshot(doc(db, 'shifts', 'current_shift'), (snap) => { if (snap.exists()) callback(snap.data() as StoreShift); }, (err) => console.warn('Firestore shift sync error:', err));\n}",
  "export function subscribeToShift(callback: (shift: StoreShift) => void) {\n  return onSnapshot(doc(db, 'shifts', 'current_shift'), (snap) => { if (snap.exists()) callback(snap.data() as StoreShift); }, (err) => warnFirestoreThrottled('shift', err));\n}"
);

const saveOrderReplacement = `export async function saveOrderToCloud(order: Order): Promise<boolean> {\n  try {\n    const today = localDateKey();\n    const payload: Order = {\n      ...order,\n      operationalEpoch: STORE_PILOT_RESET_VERSION,\n      createdDate: order.createdDate || today,\n      ...(order.status === 'delivered' ? { deliveredDate: order.deliveredDate || today, deliveredTimestamp: order.deliveredTimestamp || Date.now() } : {}),\n    };\n    await setDoc(doc(db, 'orders', payload.id), cleanForFirestore(payload), { merge: true });\n    return true;\n  } catch (err) {\n    warnFirestoreThrottled('save-order', err);\n    return false;\n  }\n}\n\n`;
firebase = replaceBlock(firebase, 'export async function saveOrderToCloud', 'export async function saveMotoboyToCloud', saveOrderReplacement, 'saveOrderToCloud');

// The earlier motoboy-login build patch inserts findMotoboyForLogin immediately before
// saveMotoboyToCloud. Replacing the saveOrder block used to delete that helper. Restore it
// here, but in a quota-friendly way: direct document lookup + two equality queries instead
// of scanning the entire motoboys collection on every cross-device login.
if (!firebase.includes('export async function findMotoboyForLogin')) {
  const anchor = 'export async function saveMotoboyToCloud(motoboy: Motoboy) {';
  const helper = `export async function findMotoboyForLogin(term: string): Promise<Motoboy | null> {\n  try {\n    const normalized = term.trim().toLowerCase();\n    if (!normalized) return null;\n\n    const direct = await getDoc(doc(db, 'motoboys', term.trim()));\n    if (direct.exists()) {\n      const raw = { id: direct.id, ...direct.data() } as Motoboy;\n      if (raw.operationalEpoch === STORE_PILOT_RESET_VERSION) return raw;\n    }\n\n    for (const field of ['username', 'name'] as const) {\n      const snap = await getDocs(query(collection(db, 'motoboys'), where(field, '==', term.trim())));\n      const found = snap.docs.find((row) => (row.data() as any).operationalEpoch === STORE_PILOT_RESET_VERSION);\n      if (found) return { id: found.id, ...found.data() } as Motoboy;\n    }\n\n    // Usernames created by this app are normally lowercase. Try normalized username once.\n    if (normalized !== term.trim()) {\n      const snap = await getDocs(query(collection(db, 'motoboys'), where('username', '==', normalized)));\n      const found = snap.docs.find((row) => (row.data() as any).operationalEpoch === STORE_PILOT_RESET_VERSION);\n      if (found) return { id: found.id, ...found.data() } as Motoboy;\n    }\n    return null;\n  } catch (err) {\n    warnFirestoreThrottled('motoboy-login', err);\n    return null;\n  }\n}\n\n`;
  if (!firebase.includes(anchor)) throw new Error('[quota-resilience] motoboy login anchor missing');
  firebase = firebase.replace(anchor, helper + anchor);
}
fs.writeFileSync(FIREBASE, firebase);

let app = fs.readFileSync(APP, 'utf8');
if (!app.includes('const warnOnce =')) {
  const stateAnchor = "  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);\n";
  const warnHelper = `\n  const warnOnce = (() => {\n    let last = 0;\n    return (scope: string, err: any) => {\n      const now = Date.now();\n      if (now - last < 30000) return;\n      last = now;\n      console.warn(\`Rota Fácil degraded mode (\${scope}):\`, err?.code || err?.message || err);\n    };\n  })();\n`;
  if (!app.includes(stateAnchor)) throw new Error('[quota-resilience] App state anchor missing');
  app = app.replace(stateAnchor, stateAnchor + warnHelper);
}

const appRealtime = `  // 1. Initial Firestore Setup & Realtime Subscriptions\n  useEffect(() => {\n    seedInitialDataIfEmpty().catch((err) => warnOnce('seed', err));\n  }, []);\n\n  useEffect(() => {\n    let unsubOrders: (() => void) | null = null;\n    if (session) {\n      const motoboyScope = session.role === 'motoboy' ? session.motoboyId : undefined;\n      unsubOrders = subscribeToOrders((cloudOrders) => {\n        setOrders((prev) => {\n          if (prev.length > 0 && cloudOrders.length > prev.length) {\n            const prevIds = new Set(prev.map((o) => o.id));\n            if (cloudOrders.some((o) => !prevIds.has(o.id))) playNewOrderSound();\n          }\n          return cloudOrders;\n        });\n        setCloudSynced(true);\n      }, motoboyScope);\n    } else {\n      setOrders([]);\n    }\n    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {\n      setMotoboys(cloudMotoboys);\n      setCloudSynced(true);\n    });\n    const unsubShift = subscribeToShift((cloudShift) => {\n      setShift(cloudShift);\n      setCloudSynced(true);\n    });\n    return () => {\n      unsubOrders?.();\n      unsubMotoboys();\n      unsubShift();\n    };\n  }, [session?.role, session?.motoboyId]);\n\n`;
app = replaceBlock(app, '  // 1. Initial Firestore Setup & Realtime Subscriptions', '  // 2. Realtime Watchdog', appRealtime, 'App realtime');

const watchdogStart = app.indexOf('  // 2. Realtime Watchdog');
const orderHandlers = app.indexOf('  // Order Handlers', watchdogStart);
if (watchdogStart < 0 || orderHandlers < 0) throw new Error('[quota-resilience] watchdog anchors missing');
const watchdog = `  // 2. Realtime Watchdog - store admin only, low frequency.\n  useEffect(() => {\n    if (!session || (session.role !== 'store_admin' && session.role !== 'master_admin')) return;\n    const interval = window.setInterval(() => {\n      const now = Date.now();\n      motoboys.forEach((m) => {\n        if (m.callingToCounterAt && now - m.callingToCounterAt > 30000 && m.status === 'available') {\n          void saveMotoboyToCloud({ ...m, callingToCounterAt: undefined });\n        }\n      });\n    }, 30000);\n    return () => window.clearInterval(interval);\n  }, [session?.role, motoboys]);\n\n`;
app = app.slice(0, watchdogStart) + watchdog + app.slice(orderHandlers);

const saveLine = '    saveOrderToCloud(completeOrder);\n    playNewOrderSound();\n    showToast(`Pedido #${completeOrder.codeNumber} cadastrado com sucesso! 📦`);';
const optimistic = `    setOrders((current) => current.some((o) => o.id === completeOrder.id) ? current : [completeOrder, ...current]);\n    void saveOrderToCloud(completeOrder).then((saved) => {\n      if (!saved) {\n        setOrders((current) => current.filter((o) => o.id !== completeOrder.id));\n        showToast('Banco temporariamente indisponível. O pedido não foi confirmado; tente novamente em instantes.');\n      }\n    });\n    playNewOrderSound();\n    showToast(\`Pedido #\${completeOrder.codeNumber} cadastrado com sucesso! 📦\`);`;
if (app.includes(saveLine)) app = app.replace(saveLine, optimistic);
fs.writeFileSync(APP, app);

let legacy = fs.readFileSync(LEGACY, 'utf8');
legacy = legacy.replace(/}, 15000\);/g, '}, 60000);');
legacy = legacy.replace(/}, 30000\);/g, '}, 60000);');
fs.writeFileSync(LEGACY, legacy);

let sync = fs.readFileSync(SYNC, 'utf8');
if (!sync.includes('query, where')) {
  sync = sync.replace(
    "import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';",
    "import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';"
  );
}
sync = sync.replace(
  "const snap = await getDocs(collection(db, 'orders'));",
  "const snap = await getDocs(query(collection(db, 'orders'), where('originChannel', '==', 'cardapio_web')));"
);
sync = sync.replace(
  "      await setDoc(doc(db, 'orders', d.id), patch, { merge: true });",
  `      const changedPatch: any = {};\n      for (const [key, value] of Object.entries(patch)) {\n        const current = (data as any)[key];\n        if (JSON.stringify(current ?? null) !== JSON.stringify(value ?? null)) changedPatch[key] = value;\n      }\n      if (Object.keys(changedPatch).length > 0) {\n        await setDoc(doc(db, 'orders', d.id), changedPatch, { merge: true });\n      }`
);
fs.writeFileSync(SYNC, sync);

for (const [file, marker] of [
  [FIREBASE, "where('operationalEpoch', '==', STORE_PILOT_RESET_VERSION)"],
  [FIREBASE, 'export async function findMotoboyForLogin'],
  [APP, "session.role === 'motoboy' ? session.motoboyId : undefined"],
  [SYNC, "where('originChannel', '==', 'cardapio_web')"],
]) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(marker)) throw new Error(`[quota-resilience] validation failed in ${file}: ${marker}`);
}

console.log('[quota-resilience] scoped listeners, optimized motoboy login, low-frequency watchdog, lean CW sync and degraded-mode UI validated');
