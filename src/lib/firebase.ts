import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Order, Motoboy, StoreShift } from '../types';
import { INITIAL_STORE_SHIFT } from '../data/initialData';
import { createScaleTestData } from '../data/scaleTestData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }
export interface FirestoreErrorInfo { error: string; operationType: OperationType; path: string | null; authInfo: { userId?: string | null; email?: string | null } }
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Firestore Security/Operation Error: ', JSON.stringify({ error: error instanceof Error ? error.message : String(error), authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email }, operationType, path }));
}

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const STORE_PILOT_RESET_VERSION = 'hope_store_pilot_2026_08_17_v5';
const SCALE_TEST_SEED_VERSION = 'scale_test_20_drivers_300_orders_v5';

function forceMotoboyLogout() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('rota_facil_session');
    window.localStorage.removeItem('rota_facil_active_motoboy_id');
    window.sessionStorage.removeItem('rota_facil_session');
    window.sessionStorage.removeItem('rota_facil_active_motoboy_id');
  } catch {}
  window.setTimeout(() => window.location.replace(`${window.location.origin}${window.location.pathname}?login=1&t=${Date.now()}`), 0);
}

function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

async function isolateHistoricalOrdersFromNewDriver(motoboy: Motoboy) {
  const normalizedName = (motoboy.name || '').trim().toLowerCase();
  if (!normalizedName) return;
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  const fixes = ordersSnapshot.docs
    .filter((orderDoc) => {
      const order = orderDoc.data() as Order;
      const oldAssignedName = (order.assignedMotoboyName || '').trim().toLowerCase();
      return Boolean(oldAssignedName && oldAssignedName === normalizedName && order.assignedMotoboyId && order.assignedMotoboyId !== motoboy.id);
    })
    .map((orderDoc) => {
      const order = orderDoc.data() as Order;
      return setDoc(orderDoc.ref, { historicalMotoboyName: order.assignedMotoboyName || null, assignedMotoboyName: null }, { merge: true });
    });
  if (fixes.length > 0) await Promise.all(fixes);
}

export function subscribeToOrders(callback: (orders: Order[]) => void) {
  return onSnapshot(collection(db, 'orders'), (snapshot) => {
    const today = localDateKey();
    const list: Order[] = [];
    snapshot.forEach((docSnap) => {
      let order = { id: docSnap.id, ...docSnap.data() } as Order;
      if (order.operationalEpoch !== STORE_PILOT_RESET_VERSION) return;
      if (order.status === 'delivered' && !order.deliveredDate) {
        order = { ...order, deliveredDate: today, deliveredTimestamp: order.deliveredTimestamp || Date.now() };
        setDoc(docSnap.ref, { deliveredDate: today, deliveredTimestamp: order.deliveredTimestamp }, { merge: true }).catch(() => {});
      }
      list.push(order);
    });
    list.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));
    callback(list);
  }, (err) => console.warn('Firestore orders sync error:', err));
}

export function subscribeToMotoboys(callback: (motoboys: Motoboy[]) => void) {
  return onSnapshot(collection(db, 'motoboys'), (snapshot) => {
    const today = localDateKey();
    const list: Motoboy[] = [];
    snapshot.forEach((docSnap) => {
      const raw = { id: docSnap.id, ...docSnap.data() } as Motoboy;
      if (raw.operationalEpoch !== STORE_PILOT_RESET_VERSION) return;
      if (raw.statsDate !== today) {
        const reset = { ...raw, deliveriesCountToday: 0, totalEarnedToday: 0, statsDate: today } as Motoboy;
        list.push(reset);
        setDoc(docSnap.ref, cleanForFirestore(reset), { merge: true }).catch(() => {});
      } else list.push(raw);
    });
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('rota_facil_session');
        if (saved) {
          const session = JSON.parse(saved) as { role?: string; motoboyId?: string };
          if (session.role === 'motoboy' && session.motoboyId) {
            const driver = list.find((m) => m.id === session.motoboyId);
            if (!driver || driver.accessRevokedAt) { forceMotoboyLogout(); return; }
          }
        }
      } catch (err) { console.warn('Could not validate motoboy session:', err); }
    }
    callback(list);
  }, (err) => console.warn('Firestore motoboys sync error:', err));
}

export function subscribeToShift(callback: (shift: StoreShift) => void) {
  return onSnapshot(doc(db, 'shifts', 'current_shift'), (snap) => { if (snap.exists()) callback(snap.data() as StoreShift); }, (err) => console.warn('Firestore shift sync error:', err));
}

export async function saveOrderToCloud(order: Order) {
  try {
    const today = localDateKey();
    const payload: Order = { ...order, operationalEpoch: STORE_PILOT_RESET_VERSION, createdDate: order.createdDate || today, ...(order.status === 'delivered' ? { deliveredDate: order.deliveredDate || today, deliveredTimestamp: order.deliveredTimestamp || Date.now() } : {}) };
    await setDoc(doc(db, 'orders', payload.id), cleanForFirestore(payload), { merge: true });
    if (payload.status === 'delivered' && payload.assignedMotoboyId) {
      const allOrders = await getDocs(collection(db, 'orders'));
      const hasRemaining = allOrders.docs.some((snap) => {
        if (snap.id === payload.id) return false;
        const other = snap.data() as Order;
        return other.assignedMotoboyId === payload.assignedMotoboyId && other.status !== 'delivered' && other.status !== 'cancelled';
      });
      if (!hasRemaining) {
        const driverRef = doc(db, 'motoboys', payload.assignedMotoboyId);
        if ((await getDoc(driverRef)).exists()) await setDoc(driverRef, { status: 'returning_to_store', activeOrdersCount: 0, joinedQueueAt: null, callingToCounterAt: null, statsDate: today }, { merge: true });
      }
    }
  } catch (err) { console.error('Error saving order to cloud:', err); }
}

export async function saveMotoboyToCloud(motoboy: Motoboy) {
  try {
    const today = localDateKey();
    const ref = doc(db, 'motoboys', motoboy.id);
    const existing = await getDoc(ref);
    const isNewDriver = !existing.exists();
    const existingData = existing.exists() ? ({ id: existing.id, ...existing.data() } as Motoboy) : null;
    const dailyBase = motoboy.statsDate === today ? motoboy : { ...motoboy, deliveriesCountToday: 0, totalEarnedToday: 0, statsDate: today };
    let payload: Motoboy = isNewDriver
      ? { ...dailyBase, status: 'offline', activeOrdersCount: 0, totalEarnedToday: 0, deliveriesCountToday: 0, statsDate: today, joinedQueueAt: undefined, callingToCounterAt: undefined }
      : dailyBase;
    payload = { ...payload, operationalEpoch: STORE_PILOT_RESET_VERSION };
    if (existingData?.status === 'returning_to_store' && payload.status !== 'returning_to_store') {
      const queueTimestamp = Number(payload.joinedQueueAt || 0);
      const isFreshArrivalConfirmation = payload.status === 'available' && payload.activeOrdersCount === 0 && queueTimestamp > 0 && Math.abs(Date.now() - queueTimestamp) <= 15000;
      if (!isFreshArrivalConfirmation) payload = { ...payload, status: 'returning_to_store', activeOrdersCount: 0, joinedQueueAt: undefined, callingToCounterAt: undefined };
    }
    await setDoc(ref, cleanForFirestore(payload), { merge: true });
  } catch (err) { console.error('Error saving motoboy to cloud:', err); }
}

export async function saveMotoboyLocationToCloud(
  motoboyId: string,
  currentLat: number,
  currentLng: number,
  locationUpdatedAt = Date.now()
) {
  try {
    await setDoc(
      doc(db, 'motoboys', motoboyId),
      { currentLat, currentLng, locationUpdatedAt },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving motoboy location:', err);
  }
}

export async function deleteMotoboyFromCloud(motoboyId: string) {
  try {
    const ref = doc(db, 'motoboys', motoboyId);
    if (!(await getDoc(ref)).exists()) return;
    await setDoc(ref, { status: 'offline', accessRevokedAt: Date.now(), joinedQueueAt: null, callingToCounterAt: null }, { merge: true });
    await wait(1200);
    await deleteDoc(ref);
  } catch (err) { console.error('Error deleting motoboy:', err); }
}

export async function deleteAllMotoboysFromCloud() {
  const snapshot = await getDocs(collection(db, 'motoboys'));
  if (snapshot.empty) return;
  const revokedAt = Date.now();
  await Promise.all(snapshot.docs.map((d) => setDoc(d.ref, { status: 'offline', accessRevokedAt: revokedAt, joinedQueueAt: null, callingToCounterAt: null }, { merge: true })));
  await wait(400);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

export async function deleteAllOrdersFromCloud() {
  const snapshot = await getDocs(collection(db, 'orders'));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

export async function clearAllDatabaseData() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await Promise.all([deleteAllOrdersFromCloud(), deleteAllMotoboysFromCloud()]);
    await wait(250);
    const [ordersLeft, motoboysLeft] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'motoboys')),
    ]);
    if (ordersLeft.empty && motoboysLeft.empty) return;
  }
  throw new Error('RESET_FAILED: ainda existem pedidos ou motoboys no Firestore após 3 tentativas.');
}

export async function saveShiftToCloud(shift: StoreShift) { await setDoc(doc(db, 'shifts', 'current_shift'), shift, { merge: true }); }

async function deleteOperationalDocuments(includeCurrentEpoch: boolean) {
  const [ordersSnapshot, motoboysSnapshot] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  const documents = [...ordersSnapshot.docs, ...motoboysSnapshot.docs].filter(
    (item) => includeCurrentEpoch || item.data().operationalEpoch !== STORE_PILOT_RESET_VERSION
  );
  for (let start = 0; start < documents.length; start += 400) {
    const batch = writeBatch(db);
    documents.slice(start, start + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

async function resetOperationalDataOnceForStorePilot() {
  const shiftRef = doc(db, 'shifts', 'current_shift');
  const snap = await getDoc(shiftRef);
  const current = snap.exists() ? (snap.data() as StoreShift) : null;
  const preservedPassword = current?.adminPassword || INITIAL_STORE_SHIFT.adminPassword || 'hope2026';
  const needsFullReset = current?.operationalResetVersion !== STORE_PILOT_RESET_VERSION;

  await deleteOperationalDocuments(needsFullReset);
  if (needsFullReset) {
    await wait(750);
    await deleteOperationalDocuments(true);
  }
  const resetShift: StoreShift = {
    isOpen: needsFullReset ? false : Boolean(current?.isOpen),
    openedAt: needsFullReset ? '' : (current?.openedAt || ''),
    initialCash: needsFullReset ? 0 : (current?.initialCash || 0),
    storeName: 'Hope Burger',
    storePhone: '(47) 99153-9855',
    storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313',
    storeLat: -26.91530418395996,
    storeLng: -49.1146354675293,
    adminPassword: preservedPassword,
    integrations: current?.integrations || INITIAL_STORE_SHIFT.integrations,
    operationalResetVersion: STORE_PILOT_RESET_VERSION,
    operationalResetAt: needsFullReset ? Date.now() : (current?.operationalResetAt || Date.now()),
  };

  const [ordersAfter, motoboysAfter] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  const staleOrders = ordersAfter.docs.filter((item) => item.data().operationalEpoch !== STORE_PILOT_RESET_VERSION);
  const staleMotoboys = motoboysAfter.docs.filter((item) => item.data().operationalEpoch !== STORE_PILOT_RESET_VERSION);
  if (needsFullReset && (!ordersAfter.empty || !motoboysAfter.empty)) {
    throw new Error(`Store pilot reset verification failed: orders=${ordersAfter.size}, motoboys=${motoboysAfter.size}`);
  }
  if (staleOrders.length || staleMotoboys.length) {
    throw new Error(`Legacy operational cleanup failed: orders=${staleOrders.length}, motoboys=${staleMotoboys.length}`);
  }
  // The completion marker is stored only after the destructive operation was
  // read back successfully. A failed/raced reset is retried on the next load.
  await setDoc(shiftRef, resetShift);
}

async function seedScaleTestDataOnce() {
  const shiftRef = doc(db, 'shifts', 'current_shift');
  const seedingMarker = `${SCALE_TEST_SEED_VERSION}:seeding`;
  const now = Date.now();
  const acquired = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(shiftRef);
    const current = snapshot.exists() ? (snapshot.data() as StoreShift) : INITIAL_STORE_SHIFT;
    if (current.scaleTestSeedVersion === SCALE_TEST_SEED_VERSION) return false;
    const hasFreshLock = current.scaleTestSeedVersion === seedingMarker && now - Number(current.scaleTestSeedStartedAt || 0) < 120000;
    if (hasFreshLock) return false;
    transaction.set(shiftRef, { scaleTestSeedVersion: seedingMarker, scaleTestSeedStartedAt: now }, { merge: true });
    return true;
  });
  if (!acquired) return;

  try {
    const shiftSnapshot = await getDoc(shiftRef);
    const currentShift = shiftSnapshot.exists() ? (shiftSnapshot.data() as StoreShift) : INITIAL_STORE_SHIFT;
    const { motoboys, orders } = createScaleTestData(STORE_PILOT_RESET_VERSION);
    const documents = [
      ...motoboys.map((motoboy) => ({ ref: doc(db, 'motoboys', motoboy.id), value: motoboy })),
      ...orders.map((order) => ({ ref: doc(db, 'orders', order.id), value: order })),
    ];

    for (let start = 0; start < documents.length; start += 400) {
      const batch = writeBatch(db);
      documents.slice(start, start + 400).forEach((item) => batch.set(item.ref, cleanForFirestore(item.value)));
      await batch.commit();
    }

    const [ordersAfter, motoboysAfter] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'motoboys')),
    ]);
    if (ordersAfter.size !== 300 || motoboysAfter.size !== 20) {
      throw new Error(`SCALE_TEST_SEED_FAILED: orders=${ordersAfter.size}, motoboys=${motoboysAfter.size}`);
    }

    await setDoc(shiftRef, {
      ...currentShift,
      isOpen: true,
      openedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      scaleTestSeedVersion: SCALE_TEST_SEED_VERSION,
      scaleTestSeedStartedAt: null,
    }, { merge: true });
  } catch (error) {
    await setDoc(shiftRef, { scaleTestSeedVersion: null, scaleTestSeedStartedAt: null }, { merge: true });
    throw error;
  }
}

export async function seedInitialDataIfEmpty() {
  try {
    await resetOperationalDataOnceForStorePilot();
    await seedScaleTestDataOnce();
    const ref = doc(db, 'shifts', 'current_shift');
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, { ...INITIAL_STORE_SHIFT, storeName: 'Hope Burger', storePhone: '(47) 99153-9855', storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313', storeLat: -26.91530418395996, storeLng: -49.1146354675293, adminPassword: 'hope2026' });
    }
  } catch (err) {
    console.error('RESET OPERACIONAL FALHOU:', err);
    throw err;
  }
}
