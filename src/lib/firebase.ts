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
import { Order, Motoboy, StoreShift } from '../types';
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

// A driver's operational identity is its immutable document ID, never the display name/username.
// When a new account reuses an old name (e.g. "Ruan"), detach the old display-name fallback
// from historical orders so the new account cannot inherit old deliveries or earnings.
async function isolateHistoricalOrdersFromNewDriver(motoboy: Motoboy) {
  const normalizedName = (motoboy.name || '').trim().toLowerCase();
  if (!normalizedName) return;

  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  const fixes = ordersSnapshot.docs
    .filter((orderDoc) => {
      const order = orderDoc.data() as Order;
      const oldAssignedName = (order.assignedMotoboyName || '').trim().toLowerCase();
      return Boolean(
        oldAssignedName &&
        oldAssignedName === normalizedName &&
        order.assignedMotoboyId &&
        order.assignedMotoboyId !== motoboy.id
      );
    })
    .map((orderDoc) => {
      const order = orderDoc.data() as Order;
      return setDoc(
        orderDoc.ref,
        {
          // Keep the old name for audits/history, but remove it from the live matching field.
          historicalMotoboyName: order.assignedMotoboyName || null,
          assignedMotoboyName: null,
        },
        { merge: true }
      );
    });

  if (fixes.length > 0) await Promise.all(fixes);
}

export function subscribeToOrders(callback: (orders: Order[]) => void) {
  return onSnapshot(collection(db, 'orders'), (snapshot) => {
    const today = localDateKey();
    const list: Order[] = [];
    snapshot.forEach((docSnap) => {
      let order = { id: docSnap.id, ...docSnap.data() } as Order;

      // One-time migration for deliveries created before deliveredDate existed.
      // They are considered delivered today now; from tomorrow on they leave "Hoje" automatically.
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
    const payload: Order = {
      ...order,
      createdDate: order.createdDate || today,
      ...(order.status === 'delivered' ? { deliveredDate: order.deliveredDate || today, deliveredTimestamp: order.deliveredTimestamp || Date.now() } : {}),
    };
    await setDoc(doc(db, 'orders', payload.id), cleanForFirestore(payload), { merge: true });

    // Last delivery finished => driver returns to store, never directly to queue.
    if (payload.status === 'delivered' && payload.assignedMotoboyId) {
      const allOrders = await getDocs(collection(db, 'orders'));
      const hasRemaining = allOrders.docs.some((snap) => {
        if (snap.id === payload.id) return false;
        const other = snap.data() as Order;
        return other.assignedMotoboyId === payload.assignedMotoboyId && other.status !== 'delivered' && other.status !== 'cancelled';
      });
      if (!hasRemaining) {
        const driverRef = doc(db, 'motoboys', payload.assignedMotoboyId);
        if ((await getDoc(driverRef)).exists()) {
          await setDoc(driverRef, { status: 'returning_to_store', activeOrdersCount: 0, joinedQueueAt: null, callingToCounterAt: null, statsDate: today }, { merge: true });
        }
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

    // returning_to_store is a protected operational state. Several realtime effects may still
    // hold an older copy of the driver and try to write `available`/`delivering` after the
    // last delivery. Those stale writes must never put the driver back in the queue.
    // The only valid exit is an explicit "Cheguei à Loja", which creates a brand-new
    // joinedQueueAt timestamp at the moment of confirmation.
    if (existingData?.status === 'returning_to_store' && payload.status !== 'returning_to_store') {
      const queueTimestamp = Number(payload.joinedQueueAt || 0);
      const isFreshArrivalConfirmation =
        payload.status === 'available' &&
        payload.activeOrdersCount === 0 &&
        queueTimestamp > 0 &&
        Math.abs(Date.now() - queueTimestamp) <= 15000;

      if (!isFreshArrivalConfirmation) {
        payload = {
          ...payload,
          status: 'returning_to_store',
          activeOrdersCount: 0,
          joinedQueueAt: undefined,
          callingToCounterAt: undefined,
        };
      }
    }

    // New account with a reused name must start from an isolated identity.
    // Run before publishing it so the first realtime render already sees clean history.
    if (isNewDriver) {
      await isolateHistoricalOrdersFromNewDriver(payload);
    }

    await setDoc(ref, cleanForFirestore(payload), { merge: true });
  } catch (err) { console.error('Error saving motoboy to cloud:', err); }
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
  await wait(1500);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

export async function deleteAllOrdersFromCloud() {
  const snapshot = await getDocs(collection(db, 'orders'));
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}

export async function clearAllDatabaseData() { await Promise.all([deleteAllOrdersFromCloud(), deleteAllMotoboysFromCloud()]); }
export async function saveShiftToCloud(shift: StoreShift) { await setDoc(doc(db, 'shifts', 'current_shift'), shift, { merge: true }); }

async function resetOperationalDataOnceForCleanTest() {
  const markerRef = doc(db, 'system_flags', 'clean_test_reset_2026_08_10_v1');
  if ((await getDoc(markerRef)).exists()) return;
  const shiftRef = doc(db, 'shifts', 'current_shift');
  const snap = await getDoc(shiftRef);
  const current = snap.exists() ? (snap.data() as StoreShift) : null;
  const preservedPassword = current?.adminPassword || INITIAL_STORE_SHIFT.adminPassword || 'hope2026';
  await clearAllDatabaseData();
  await setDoc(shiftRef, { isOpen: false, openedAt: '', initialCash: 0, storeName: 'Hope Burger', storePhone: '(47) 99153-9855', storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313', storeLat: -26.91530418395996, storeLng: -49.1146354675293, adminPassword: preservedPassword });
  await setDoc(markerRef, { completed: true, resetAt: Date.now(), preservedStoreAccess: true });
}

export async function seedInitialDataIfEmpty() {
  try {
    const ref = doc(db, 'shifts', 'current_shift');
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, { ...INITIAL_STORE_SHIFT, storeName: 'Hope Burger', storePhone: '(47) 99153-9855', storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313', storeLat: -26.91530418395996, storeLng: -49.1146354675293, adminPassword: 'hope2026' });
    }
  } catch (err) { console.warn('Could not seed initial data:', err); }
}
