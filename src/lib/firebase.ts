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
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Order, Motoboy, StoreShift, StoreAccount } from '../types';
import { INITIAL_STORE_SHIFT } from '../data/initialData';

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
const STORE_PILOT_RESET_VERSION = 'zeroed_store_pilot_2026_08_17_v10';
const FRESH_INSTALL_VERSION = 'zeroed_company_setup_2026_08_17_v10';

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

export function subscribeToStoreAccounts(callback: (accounts: StoreAccount[]) => void) {
  return onSnapshot(collection(db, 'stores'), (snapshot) => {
    const list: StoreAccount[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as StoreAccount);
    });
    callback(list);
  }, (err) => console.warn('Firestore stores sync error:', err));
}

export async function saveStoreAccountToCloud(account: StoreAccount) {
  try {
    const normalizedUsername = account.username.trim().toLowerCase();
    const payload = {
      ...account,
      id: normalizedUsername,
      username: normalizedUsername,
    };
    await setDoc(doc(db, 'stores', normalizedUsername), cleanForFirestore(payload), { merge: true });
    
    // Also update the active shift with this store's real credentials and data
    const shiftRef = doc(db, 'shifts', 'current_shift');
    await setDoc(
      shiftRef,
      cleanForFirestore({
        storeName: account.storeName,
        storePhone: account.storePhone || '',
        storeAddress: account.storeAddress || '',
        storeLat: account.storeLat || -26.9194,
        storeLng: account.storeLng || -49.0661,
        storeUsername: normalizedUsername,
        adminPassword: account.password || '',
        setupRequired: false,
        pilotMode: true,
        demoDataDisabled: true,
      }),
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving store account to cloud:', err);
    throw err;
  }
}

export async function getStoreAccountFromCloud(username: string): Promise<StoreAccount | null> {
  try {
    const normalized = username.trim().toLowerCase();
    const ref = doc(db, 'stores', normalized);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as StoreAccount;
    }
    return null;
  } catch (err) {
    console.error('Error getting store account:', err);
    return null;
  }
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
      ? { ...dailyBase, status: motoboy.status || 'available', activeOrdersCount: 0, totalEarnedToday: 0, deliveriesCountToday: 0, statsDate: today, joinedQueueAt: Date.now(), callingToCounterAt: undefined }
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

export async function saveShiftToCloud(shift: StoreShift) {
  await setDoc(doc(db, 'shifts', 'current_shift'), cleanForFirestore(shift), { merge: true });
  // If shift has storeUsername, also keep the store document synced
  if (shift.storeUsername) {
    const normalizedUsername = shift.storeUsername.trim().toLowerCase();
    await setDoc(
      doc(db, 'stores', normalizedUsername),
      cleanForFirestore({
        id: normalizedUsername,
        username: normalizedUsername,
        password: shift.adminPassword || '',
        storeName: shift.storeName,
        storePhone: shift.storePhone || '',
        storeAddress: shift.storeAddress,
        storeLat: shift.storeLat,
        storeLng: shift.storeLng,
        createdAt: Date.now(),
      }),
      { merge: true }
    );
  }
}

export async function activateRealPilotMode() {
  const shiftRef = doc(db, 'shifts', 'current_shift');
  await clearAllDatabaseData();
  const currentSnapshot = await getDoc(shiftRef);
  const current = currentSnapshot.exists() ? (currentSnapshot.data() as StoreShift) : INITIAL_STORE_SHIFT;
  const pilotShift: StoreShift = {
    ...current,
    isOpen: false,
    openedAt: '',
    initialCash: 0,
    pilotMode: true,
    pilotActivatedAt: Date.now(),
    demoDataDisabled: true,
    scaleTestSeedVersion: 'disabled_for_real_pilot',
    scaleTestSeedStartedAt: undefined,
  };
  await setDoc(shiftRef, cleanForFirestore(pilotShift), { merge: true });

  const [ordersAfter, motoboysAfter] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  if (!ordersAfter.empty || !motoboysAfter.empty) {
    throw new Error(`PILOT_ACTIVATION_FAILED: orders=${ordersAfter.size}, motoboys=${motoboysAfter.size}`);
  }
  return pilotShift;
}

async function removeSyntheticScaleData() {
  const [ordersSnapshot, motoboysSnapshot] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  const syntheticDocs = [
    ...ordersSnapshot.docs.filter((item) => item.id.startsWith('scale-order-') || String(item.data().trackingCode || '').startsWith('ESCALA-')),
    ...motoboysSnapshot.docs.filter((item) => item.id.startsWith('scale-driver-') || String(item.data().plate || '').startsWith('TST-')),
  ];
  if (syntheticDocs.length === 0) return;
  await Promise.all(syntheticDocs.map((item) => deleteDoc(item.ref)));
  await wait(300);
  const [ordersAfter, motoboysAfter] = await Promise.all([
    getDocs(collection(db, 'orders')),
    getDocs(collection(db, 'motoboys')),
  ]);
  const leftovers = [
    ...ordersAfter.docs.filter((item) => item.id.startsWith('scale-order-') || String(item.data().trackingCode || '').startsWith('ESCALA-')),
    ...motoboysAfter.docs.filter((item) => item.id.startsWith('scale-driver-') || String(item.data().plate || '').startsWith('TST-')),
  ];
  if (leftovers.length > 0) throw new Error(`SYNTHETIC_CLEANUP_FAILED: ${leftovers.length} registros restantes.`);
}

export async function seedInitialDataIfEmpty() {
  try {
    const ref = doc(db, 'shifts', 'current_shift');
    const snapshot = await getDoc(ref);
    const current = snapshot.exists() ? (snapshot.data() as StoreShift) : null;
    if (current?.installationVersion === FRESH_INSTALL_VERSION) {
      await removeSyntheticScaleData();
      return;
    }
    if (current?.installationVersion === `${FRESH_INSTALL_VERSION}:resetting`) {
      await wait(1200);
      return;
    }

    await setDoc(ref, { installationVersion: `${FRESH_INSTALL_VERSION}:resetting`, isOpen: false }, { merge: true });
    await clearAllDatabaseData();
    await removeSyntheticScaleData();
    
    // Preserve existing custom credentials if any
    const baseShift: StoreShift = {
      ...INITIAL_STORE_SHIFT,
      storeName: current?.storeName || INITIAL_STORE_SHIFT.storeName,
      storePhone: current?.storePhone || INITIAL_STORE_SHIFT.storePhone,
      storeAddress: current?.storeAddress || INITIAL_STORE_SHIFT.storeAddress,
      storeLat: current?.storeLat || INITIAL_STORE_SHIFT.storeLat,
      storeLng: current?.storeLng || INITIAL_STORE_SHIFT.storeLng,
      storeUsername: current?.storeUsername || '',
      adminPassword: current?.adminPassword || '',
      masterUsername: current?.masterUsername || 'ruan',
      masterPassword: current?.masterPassword || 'ruan123',
      setupRequired: current?.setupRequired ?? (current?.storeUsername ? false : true),
      installationVersion: FRESH_INSTALL_VERSION,
      operationalResetVersion: STORE_PILOT_RESET_VERSION,
      operationalResetAt: Date.now(),
      pilotActivatedAt: Date.now(),
    };

    await setDoc(ref, cleanForFirestore(baseShift));
  } catch (err) {
    console.error('INICIALIZAÇÃO DO PILOTO FALHOU:', err);
    throw err;
  }
}
