import fs from 'node:fs';

const FIREBASE = 'src/lib/firebase.ts';
const APP = 'src/App.tsx';
const LEGACY = 'src/components/StoreDashboardLegacy.tsx';
const SETTLEMENTS = 'src/lib/settlements.ts';
const SYNC = 'api/sync-cardapio-web.ts';

function replaceBlock(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`[quota-resilience] ${label} anchors missing`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// 1) Firestore client listeners: stop listening to whole historical collections and stop writes from snapshots.
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

const subscriptions = `export function subscribeToOrders(callback: (orders: Order[]) => void, motoboyId?: string) {\n  const source = motoboyId\n    ? query(collection(db, 'orders'), where('assignedMotoboyId', '==', motoboyId))\n    : query(collection(db, 'orders'), where('operationalEpoch', '==', STORE_PILOT_RESET_VERSION));\n\n  return onSnapshot(source, (snapshot) => {\n    const list: Order[] = [];\n    snapshot.forEach((docSnap) => {\n      const order = { id: docSnap.id, ...docSnap.data() } as Order;\n      if (order.operationalEpoch !== STORE_PILOT_RESET_VERSION) return;\n      list.push(order);\n    });\n    list.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));\n    callback(list);\n  }, (err) => warnFirestoreThrottled('orders', err));\n}\n\nexport function subscribeToMotoboys(callback: (motoboys: Motoboy[]) => void) {\n  const source = query(collection(db, 'motoboys'), where('operationalEpoch', '==', STORE_PILOT_RESET_VERSION));\n  return onSnapshot(source, (snapshot) => {\n    const today = localDateKey();\n    const list: Motoboy[] = [];\n    snapshot.forEach((docSnap) => {\n      const raw = { id: docSnap.id, ...docSnap.data() } as Motoboy;\n      // Daily totals are reset only in memory here. Persisting from an onSnapshot callback\n      // caused write cascades across every open store/motoboy tab. The next real save persists it.\n      list.push(raw.statsDate === today ? raw : { ...raw, deliveriesCountToday: 0, totalEarnedToday: 0, statsDate: today });\n    });\n    if (typeof window !== 'undefined') {\n      try {\n        const saved = window.localStorage.getItem('rota_facil_session');\n        if (saved) {\n          const session = JSON.parse(saved) as { role?: string; motoboyId?: string };\n          if (session.role === 'motoboy' && session.motoboyId) {\n            const driver = list.find((m) => m.id === session.motoboyId);\n            if (!driver || driver.accessRevokedAt) { forceMotoboyLogout(); return; }\n          }\n        }\n      } catch (err) { console.warn('Could not validate motoboy session:', err); }\n    }\n    callback(list);\n  }, (err) => warnFirestoreThrottled('motoboys', err));\n}\n\n`;
firebase = replaceBlock(firebase, 'export function subscribeToOrders', 'export function subscribeToShift', subscriptions, 'subscriptions');
firebase = firebase.replace("export function subscribeToShift(callback: (shift: StoreShift) => void) {\n  return onSnapshot(doc(db, 'shifts', 'current_shift'), (snap) => { if (snap.exists()) callback(snap.data() as StoreShift); }, (err) => console.warn('Firestore shift sync error:', err));\n}", "export function subscribeToShift(callback: (shift: StoreShift) => void) {\n  return onSnapshot(doc(db, 'shifts', 'current_shift'), (snap) => { if (snap.exists()) callback(snap.data() as StoreShift); }, (err) => warnFirestoreThrottled('shift', err));\n}");

const saveOrderReplacement = `export async function saveOrderToCloud(order: Order): Promise<boolean> {\n  try {\n    const today = localDateKey();\n    const payload: Order = {\n      ...order,\n      operationalEpoch: STORE_PILOT_RESET_VERSION,\n      createdDate: order.createdDate || today,\n      ...(order.status === 'delivered' ? { deliveredDate: order.deliveredDate || today, deliveredTimestamp: order.deliveredTimestamp || Date.now() } : {}),\n    };\n    await setDoc(doc(db, 'orders', payload.id), cleanForFirestore(payload), { merge: true });\n    return true;\n  } catch (err) {\n    warnFirestoreThrottled('save-order', err);\n    return false;\n  }\n}\n\n`;
firebase = replaceBlock(firebase, 'export async function saveOrderToCloud', 'export async function saveMotoboyToCloud', saveOrderReplacement, 'saveOrderToCloud');
fs.writeFileSync(FIREBASE, firebase);

// 2) App subscriptions: login screen does not subscribe to all orders; motoboy tabs only receive their own orders.
let app = fs.readFileSync(APP, 'utf8');
const appRealtime = `  // 1. Initial Firestore Setup & Realtime Subscriptions\n  useEffect(() => {\n    seedInitialDataIfEmpty().catch((err) => warnOnce('seed', err));\n  }, []);\n\n  useEffect(() => {\n    let unsubOrders: (() => void) | null = null;\n\n    if (session) {\n      const motoboyScope = session.role === 'motoboy' ? session.motoboyId : undefined;\n      unsubOrders = subscribeToOrders((cloudOrders) => {\n        setOrders((prev) => {\n          if (prev.length > 0 && cloudOrders.length > prev.length) {\n            const prevIds = new Set(prev.map((o) => o.id));\n            if (cloudOrders.some((o) => !prevIds.has(o.id))) playNewOrderSound();\n          }\n          return cloudOrders;\n        });\n        setCloudSynced(true);\n      }, motoboyScope);\n    } else {\n      setOrders([]);\n    }\n\n    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {\n      setMotoboys(cloudMotoboys);\n      setCloudSynced(true);\n    });\n\n    const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'runtime-configured';\n    const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'runtime-configured';\n    const unsubShift = subscribeToShift((cloudShift) => {\n      setShift(cloudShift);\n      setCloudSynced(true);\n    });\n\n    return () => {\n      unsubOrders?.();\n      unsubMotoboys();\n      unsubShift();\n    };\n  }, [session?.role, session?.motoboyId]);\n\n`;
// Keep API credentials out of the client entirely. The server owns Cardapio Web integration now.
if (!app.includes('const warnOnce =')) {
  const stateAnchor = "  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);\n";
  const warnHelper = `\n  const warnOnce = (() => {\n    let last = 0;\n    return (scope: string, err: any) => {\n      const now = Date.now();\n      if (now - last < 30000) return;\n      last = now;\n      console.warn(\`Rota Fácil degraded mode (\${scope}):\`, err?.code || err?.message || err);\n    };\n  })();\n`;
  if (!app.includes(stateAnchor)) throw new Error('[quota-resilience] App state anchor missing');
  app = app.replace(stateAnchor, stateAnchor + warnHelper);
}
app = replaceBlock(app, '  // 1. Initial Firestore Setup & Realtime Subscriptions', '  // 2. Realtime Watchdog', appRealtime, 'App realtime');
// The temporary literals above are intentionally not used; remove them before compilation.
app = app.replace("    const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'runtime-configured';\n    const CARDAPIO_WEB_HOPE_BURGER_TOKEN = 'runtime-configured';\n", '');

const watchdogStart = app.indexOf('  // 2. Realtime Watchdog');
const orderHandlers = app.indexOf('  // Order Handlers', watchdogStart);
if (watchdogStart < 0 || orderHandlers < 0) throw new Error('[quota-resilience] watchdog anchors missing');
const watchdog = `  // 2. Realtime Watchdog - store admin only, low frequency.\n  useEffect(() => {\n    if (!session || (session.role !== 'store_admin' && session.role !== 'master_admin')) return;\n    const interval = window.setInterval(() => {\n      const now = Date.now();\n      motoboys.forEach((m) => {\n        if (m.callingToCounterAt && now - m.callingToCounterAt > 30000 && m.status === 'available') {\n          void saveMotoboyToCloud({ ...m, callingToCounterAt: undefined });\n        }\n      });\n    }, 30000);\n    return () => window.clearInterval(interval);\n  }, [session?.role, motoboys]);\n\n`;
app = app.slice(0, watchdogStart) + watchdog + app.slice(orderHandlers);

// Optimistic manual order creation: UI remains responsive during transient Firestore failures.
const saveLine = '    saveOrderToCloud(completeOrder);\n    playNewOrderSound();\n    showToast(`Pedido #${completeOrder.codeNumber} cadastrado com sucesso! 📦`);';
const optimistic = `    setOrders((current) => current.some((o) => o.id === completeOrder.id) ? current : [completeOrder, ...current]);\n    void saveOrderToCloud(completeOrder).then((saved) => {\n      if (!saved) {\n        setOrders((current) => current.filter((o) => o.id !== completeOrder.id));\n        showToast('Banco temporariamente indisponível. O pedido não foi confirmado; tente novamente em instantes.');\n      }\n    });\n    playNewOrderSound();\n    showToast(\`Pedido #\${completeOrder.codeNumber} cadastrado com sucesso! 📦\`);`;
if (app.includes(saveLine)) app = app.replace(saveLine, optimistic);
fs.writeFileSync(APP, app);

// 3) Cardapio Web dashboard sync: no 15s hammering, no overlap, pause in background.
let legacy = fs.readFileSync(LEGACY, 'utf8');
const oldInterval = `  // Auto-sync a cada 15 segundos para manter o mapa e balcão 100% sincronizados com o Cardápio Web\n  useEffect(() => {\n    handleSyncCardapioWeb(false);\n    const interval = setInterval(() => {\n      handleSyncCardapioWeb(false);\n    }, 15000);\n    return () => clearInterval(interval);\n  }, []);`;
const newInterval = `  // Sync leve: uma execução por minuto, sem sobreposição e pausada em aba oculta.\n  useEffect(() => {\n    let running = false;\n    const run = async () => {\n      if (running || document.visibilityState !== 'visible') return;\n      running = true;\n      try { await handleSyncCardapioWeb(false); } finally { running = false; }\n    };\n    const initial = window.setTimeout(run, 3000);\n    const interval = window.setInterval(run, 60000);\n    return () => { window.clearTimeout(initial); window.clearInterval(interval); };\n  }, []);`;
if (legacy.includes(oldInterval)) legacy = legacy.replace(oldInterval, newInterval);
else legacy = legacy.replace(/}, 15000\);/g, '}, 60000);');
fs.writeFileSync(LEGACY, legacy);

// 4) Finance must degrade gracefully when rules/quota are unavailable, never block navigation.
let settlements = fs.readFileSync(SETTLEMENTS, 'utf8');
settlements = settlements.replace(
  "  }, (error) => console.warn('Settlement sync error:', error));",
  "  }, (error) => { console.warn('Settlement unavailable; finance continues in degraded mode:', (error as any)?.code || (error as any)?.message || error); callback([]); });"
);
settlements = settlements.replace(
  /export async function setSettlementStatus([\s\S]*?\n}\n$/,
  `export async function setSettlementStatus(date: string, motoboyId: string, motoboyName: string, settled: boolean) {\n  const id = key(date, motoboyId);\n  try {\n    await setDoc(doc(db, 'settlements', id), {\n      id, date, motoboyId, motoboyName, status: settled ? 'settled' : 'open',\n      settledAt: settled ? Date.now() : null, updatedAt: Date.now(),\n    }, { merge: true });\n    return true;\n  } catch (error: any) {\n    console.warn('Settlement write skipped; finance remains usable:', error?.code || error?.message || error);\n    return false;\n  }\n}\n`
);
fs.writeFileSync(SETTLEMENTS, settlements);

// 5) Server-side Cardapio Web sync: query only CW orders and write only material changes.
let sync = fs.readFileSync(SYNC, 'utf8');
if (!sync.includes('query, where')) {
  sync = sync.replace("import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';", "import { getFirestore, collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';");
}
const handlerStart = sync.indexOf('export default async function handler(req: any, res: any) {');
if (handlerStart < 0) throw new Error('[quota-resilience] sync handler anchor missing');
const leanHandler = `export default async function handler(req: any, res: any) {\n  res.setHeader('Access-Control-Allow-Origin', '*');\n  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');\n  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');\n  res.setHeader('Cache-Control', 'no-store');\n  if (req.method === 'OPTIONS') return res.status(200).end();\n\n  try {\n    const db = getDbInstance();\n    const [cwPizzaRes, cwBurgerRes] = await Promise.all([\n      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_PIZZA_TOKEN } }),\n      fetch('https://integracao.cardapioweb.com/api/partner/v1/orders', { headers: { 'X-API-KEY': CARDAPIO_WEB_HOPE_BURGER_TOKEN } }),\n    ]);\n    const pizzaList = cwPizzaRes.ok ? await cwPizzaRes.json() : [];\n    const burgerList = cwBurgerRes.ok ? await cwBurgerRes.json() : [];\n    const cwList = [\n      ...(Array.isArray(pizzaList) ? pizzaList.map((o: any) => ({ ...o, _branch: 'hope_pizza' })) : []),\n      ...(Array.isArray(burgerList) ? burgerList.map((o: any) => ({ ...o, _branch: 'hope_burger' })) : []),\n    ];\n    const cwMap = new Map<string, any>();\n    cwList.forEach((o: any) => {\n      cwMap.set(\`\${o._branch}:id:\${o.id}\`, o);\n      cwMap.set(\`\${o._branch}:doc:cw_\${o.id}\`, o);\n      if (o.display_id != null) cwMap.set(\`\${o._branch}:display:\${o.display_id}\`, o);\n    });\n\n    const snap = await getDocs(query(collection(db, 'orders'), where('originChannel', '==', 'cardapio_web')));\n    let updated = 0, scanned = 0, dispatchedCount = 0, deliveredCount = 0, cancelledCount = 0;\n    for (const d of snap.docs) {\n      scanned++;\n      const data = d.data() as any;\n      const branch = data.storeBranch || (data.storeName?.toLowerCase().includes('burger') ? 'hope_burger' : 'hope_pizza');\n      const externalId = String(data.externalOrderId || d.id.replace(/^cw_/, ''));\n      const cwOrder = cwMap.get(\`\${branch}:doc:\${d.id}\`) || cwMap.get(\`\${branch}:id:\${externalId}\`) || (data.codeNumber != null ? cwMap.get(\`\${branch}:display:\${data.codeNumber}\`) : null);\n      if (!cwOrder) continue;\n\n      const cwStatus = normalize(cwOrder.status);\n      const targetStatus = mapCwStatus(cwStatus);\n      const localPriority = hasRotaFacilOwnership(data);\n      const patch: any = {};\n\n      if (data.cardapioWebStatus !== cwStatus) patch.cardapioWebStatus = cwStatus;\n      const closed = targetStatus === 'delivered';\n      if (Boolean(data.closedInCardapioWeb) !== closed) patch.closedInCardapioWeb = closed;\n\n      if (targetStatus === 'dispatched') {\n        if (!data.cardapioWebDispatchDetected) patch.cardapioWebDispatchDetected = true;\n        if (!data.cardapioWebDispatchedAt) patch.cardapioWebDispatchedAt = Date.now();\n        if (!localPriority && data.status !== 'dispatched' && data.status !== 'in_transit' && data.status !== 'picked_up') {\n          patch.status = 'dispatched';\n          patch.dispatchSource = 'cardapio_web';\n          patch.dispatchedAt = data.dispatchedAt || new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });\n          dispatchedCount++;\n        }\n      } else if (targetStatus === 'delivered' && data.status !== 'delivered') {\n        patch.status = 'delivered';\n        patch.closedAt = data.closedAt || new Date().toISOString();\n        patch.routeCompletedAt = data.routeCompletedAt || Date.now();\n        deliveredCount++;\n      } else if (targetStatus === 'cancelled' && data.status !== 'cancelled') {\n        patch.status = 'cancelled';\n        cancelledCount++;\n      } else if (targetStatus && !localPriority && targetStatus !== data.status && !['dispatched','delivered','cancelled'].includes(targetStatus)) {\n        patch.status = targetStatus;\n      }\n\n      if (localPriority) {\n        if (data.assignmentSource !== 'rota_facil') patch.assignmentSource = 'rota_facil';\n        if (data.dispatchSource !== 'rota_facil') patch.dispatchSource = 'rota_facil';\n      }\n\n      if (Object.keys(patch).length > 0) {\n        await setDoc(doc(db, 'orders', d.id), patch, { merge: true });\n        updated++;\n      }\n    }\n\n    return res.status(200).json({ success: true, totalCwOrders: cwList.length, scanned, totalUpdated: updated, dispatchedCount, deliveredCount, cancelledCount, syncedAt: Date.now() });\n  } catch (err: any) {\n    const code = err?.code || '';\n    const status = String(code).includes('resource-exhausted') ? 429 : 500;\n    console.error('Cardapio Web sync degraded:', code || err?.message || err);\n    return res.status(status).json({ success: false, degraded: true, error: code || err?.message || String(err) });\n  }\n}\n`;
sync = sync.slice(0, handlerStart) + leanHandler;
fs.writeFileSync(SYNC, sync);

// Build guards.
const firebaseOut = fs.readFileSync(FIREBASE, 'utf8');
const appOut = fs.readFileSync(APP, 'utf8');
const syncOut = fs.readFileSync(SYNC, 'utf8');
if (firebaseOut.includes("onSnapshot(collection(db, 'orders')")) throw new Error('[quota-resilience] full orders listener still present');
if (firebaseOut.includes("const allOrders = await getDocs(collection(db, 'orders'))")) throw new Error('[quota-resilience] full delivered-order scan still present');
if (!appOut.includes("session.role === 'motoboy' ? session.motoboyId")) throw new Error('[quota-resilience] motoboy scoped subscription missing');
if (legacy.includes('15000') && legacy.includes('handleSyncCardapioWeb')) throw new Error('[quota-resilience] 15s CW sync still present');
if (!syncOut.includes("where('originChannel', '==', 'cardapio_web')")) throw new Error('[quota-resilience] CW Firestore query not scoped');
if (syncOut.includes('lastCardapioWebSyncAt: Date.now()')) throw new Error('[quota-resilience] per-order heartbeat writes still present');

console.log('[quota-resilience] Firestore reads/writes reduced, CW sync de-amplified, UI degradation hardened');
