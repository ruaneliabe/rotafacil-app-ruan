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

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: { userId?: string | null; email?: string | null };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: auth.currentUser?.uid, email: auth.currentUser?.email },
    operationType,
    path,
  };
  console.error('Firestore Security/Operation Error: ', JSON.stringify(errInfo));
}

const localDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function forceMotoboyLogout() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('rota_facil_session');
    window.localStorage.removeItem('rota_facil_active_motoboy_id');
    window.sessionStorage.removeItem('rota_facil_session');
    window.sessionStorage.removeItem('rota_facil_active_motoboy_id');
  } catch {
    // ignore storage errors
  }
  window.setTimeout(() => {
    window.location.replace(`${window.location.origin}${window.location.pathname}?login=1&t=${Date.now()}`);
  }, 0);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function subscribeToOrders(callback: (orders: Order[]) => void) {
  const colRef = collection(db, 'orders');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const today = localDateKey();
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        const order = { id: docSnap.id, ...docSnap.data() } as Order;
        // Operational screens are daily: delivered orders from previous days stay in Firestore,
        // but do not inflate "Entregas Hoje" / revenue cards on a new day.
        if (order.status === 'delivered' && order.deliveredDate && order.deliveredDate !== today) return;
        list.push(order);
      });
      list.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));
      callback(list);
    },
    (err) => console.warn('Firestore orders sync error (falling back):', err)
  );
}

export function subscribeToMotoboys(callback: (motoboys: Motoboy[]) => void) {
  const colRef = collection(db, 'motoboys');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const today = localDateKey();
      const list: Motoboy[] = [];
      snapshot.forEach((docSnap) => {
        const motoboy = { id: docSnap.id, ...docSnap.data() } as Motoboy;
        if (motoboy.statsDate !== today) {
          const reset: Motoboy = {
            ...motoboy,
            deliveriesCountToday: 0,
            totalEarnedToday: 0,
            statsDate: today,
          };
          list.push(reset);
          setDoc(docSnap.ref, cleanForFirestore(reset), { merge: true }).catch((err) =>
            console.warn('Could not reset daily motoboy counters:', err)
          );
        } else {
          list.push(motoboy);
        }
      });

      if (typeof window !== 'undefined') {
        try {
          const savedSession = window.localStorage.getItem('rota_facil_session');
          if (savedSession) {
            const parsedSession = JSON.parse(savedSession) as { role?: string; motoboyId?: string };
            if (parsedSession.role === 'motoboy' && parsedSession.motoboyId) {
              const currentDriver = list.find((m) => m.id === parsedSession.motoboyId);
              if (!currentDriver || currentDriver.accessRevokedAt) {
                forceMotoboyLogout();
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Could not validate local motoboy session:', err);
        }
      }

      callback(list);
    },
    (err) => console.warn('Firestore motoboys sync error:', err)
  );
}

export function subscribeToShift(callback: (shift: StoreShift) => void) {
  const docRef = doc(db, 'shifts', 'current_shift');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) callback(docSnap.data() as StoreShift);
    },
    (err) => console.warn('Firestore shift sync error:', err)
  );
}

function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

export async function saveOrderToCloud(order: Order) {
  try {
    const today = localDateKey();
    const now = Date.now();
    const payload: Order = {
      ...order,
      createdDate: order.createdDate || today,
      ...(order.status === 'delivered'
        ? {
            deliveredDate: order.deliveredDate || today,
            deliveredTimestamp: order.deliveredTimestamp || now,
          }
        : {}),
    };

    const docRef = doc(db, 'orders', payload.id);
    await setDoc(docRef, cleanForFirestore(payload), { merge: true });

    // Cloud-level safety rule: after the LAST delivery, the driver is RETURNING,
    // never immediately back in the queue. Queue entry only happens after "Cheguei à Loja".
    if (payload.status === 'delivered' && payload.assignedMotoboyId) {
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const hasRemainingActive = ordersSnapshot.docs.some((snap) => {
        if (snap.id === payload.id) return false;
        const other = snap.data() as Order;
        return (
          other.assignedMotoboyId === payload.assignedMotoboyId &&
          other.status !== 'delivered' &&
          other.status !== 'cancelled'
        );
      });

      if (!hasRemainingActive) {
        const driverRef = doc(db, 'motoboys', payload.assignedMotoboyId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
          await setDoc(
            driverRef,
            {
              status: 'returning_to_store',
              activeOrdersCount: 0,
              joinedQueueAt: null,
              callingToCounterAt: null,
              statsDate: today,
            },
            { merge: true }
          );
        }
      }
    }
  } catch (err) {
    console.error('Error saving order to cloud:', err);
  }
}

export async function saveMotoboyToCloud(motoboy: Motoboy) {
  try {
    const today = localDateKey();
    const docRef = doc(db, 'motoboys', motoboy.id);
    const existing = await getDoc(docRef);

    const dailyBase = motoboy.statsDate === today
      ? motoboy
      : { ...motoboy, deliveriesCountToday: 0, totalEarnedToday: 0, statsDate: today };

    const payload: Motoboy = !existing.exists()
      ? {
          ...dailyBase,
          status: 'offline',
          activeOrdersCount: 0,
          totalEarnedToday: 0,
          deliveriesCountToday: 0,
          statsDate: today,
          joinedQueueAt: undefined,
          callingToCounterAt: undefined,
        }
      : dailyBase;

    await setDoc(docRef, cleanForFirestore(payload), { merge: true });
  } catch (err) {
    console.error('Error saving motoboy to cloud:', err);
  }
}

export async function deleteMotoboyFromCloud(motoboyId: string) {
  try {
    const docRef = doc(db, 'motoboys', motoboyId);
    const existing = await getDoc(docRef);
    if (!existing.exists()) return;
    await setDoc(docRef, { status: 'offline', accessRevokedAt: Date.now(), joinedQueueAt: null, callingToCounterAt: null }, { merge: true });
    await wait(1200);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting motoboy from cloud:', err);
  }
}

export async function deleteAllMotoboysFromCloud() {
  try {
    const snapshot = await getDocs(collection(db, 'motoboys'));
    if (snapshot.empty) return;
    const revokedAt = Date.now();
    await Promise.all(snapshot.docs.map((docSnap) => setDoc(docSnap.ref, { status: 'offline', accessRevokedAt: revokedAt, joinedQueueAt: null, callingToCounterAt: null }, { merge: true })));
    await wait(1500);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.error('Error deleting all motoboys from cloud:', err);
    throw err;
  }
}

export async function deleteAllOrdersFromCloud() {
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.error('Error deleting all orders from cloud:', err);
    throw err;
  }
}

export async function clearAllDatabaseData() {
  try {
    await Promise.all([deleteAllOrdersFromCloud(), deleteAllMotoboysFromCloud()]);
  } catch (err) {
    console.error('Error clearing all database data:', err);
    throw err;
  }
}

export async function saveShiftToCloud(shift: StoreShift) {
  try {
    await setDoc(doc(db, 'shifts', 'current_shift'), shift, { merge: true });
  } catch (err) {
    console.error('Error saving shift to cloud:', err);
  }
}

async function resetOperationalDataOnceForCleanTest() {
  const resetMarkerRef = doc(db, 'system_flags', 'clean_test_reset_2026_08_10_v1');
  const marker = await getDoc(resetMarkerRef);
  if (marker.exists()) return;

  const shiftRef = doc(db, 'shifts', 'current_shift');
  const currentShiftSnap = await getDoc(shiftRef);
  const currentShift = currentShiftSnap.exists() ? (currentShiftSnap.data() as StoreShift) : null;
  const preservedPassword = currentShift?.adminPassword || INITIAL_STORE_SHIFT.adminPassword || 'hope2026';

  await clearAllDatabaseData();

  const cleanShift: StoreShift = {
    isOpen: false,
    openedAt: '',
    initialCash: 0,
    storeName: 'Hope Burger',
    storePhone: '(47) 99153-9855',
    storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313',
    storeLat: -26.91530418395996,
    storeLng: -49.1146354675293,
    adminPassword: preservedPassword,
  };

  await setDoc(shiftRef, cleanShift);
  await setDoc(resetMarkerRef, { completed: true, resetAt: Date.now(), preservedStoreAccess: true });
}

export async function seedInitialDataIfEmpty() {
  try {
    await resetOperationalDataOnceForCleanTest();
    const shiftDoc = await getDoc(doc(db, 'shifts', 'current_shift'));
    if (!shiftDoc.exists()) {
      const hopeShift: StoreShift = {
        ...INITIAL_STORE_SHIFT,
        storeName: 'Hope Burger',
        storePhone: '(47) 99153-9855',
        storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313',
        storeLat: -26.91530418395996,
        storeLng: -49.1146354675293,
        adminPassword: 'hope2026',
      };
      await setDoc(doc(db, 'shifts', 'current_shift'), hopeShift);
    }
  } catch (err) {
    console.warn('Could not seed/reset initial shift data:', err);
  }
}
