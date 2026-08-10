import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Order, Motoboy, StoreShift } from '../types';
import {
  INITIAL_STORE_SHIFT,
} from '../data/initialData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Error Handling helper
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
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Security/Operation Error: ', JSON.stringify(errInfo));
}

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

// Realtime listeners
export function subscribeToOrders(callback: (orders: Order[]) => void) {
  const colRef = collection(db, 'orders');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Order);
      });
      list.sort((a, b) => (b.codeNumber || 0) - (a.codeNumber || 0));
      callback(list);
    },
    (err) => {
      console.warn('Firestore orders sync error (falling back):', err);
    }
  );
}

export function subscribeToMotoboys(callback: (motoboys: Motoboy[]) => void) {
  const colRef = collection(db, 'motoboys');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Motoboy[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Motoboy);
      });

      // A deleted or explicitly revoked driver must lose access immediately.
      if (typeof window !== 'undefined') {
        try {
          const savedSession = window.localStorage.getItem('rota_facil_session');
          if (savedSession) {
            const parsedSession = JSON.parse(savedSession) as {
              role?: string;
              motoboyId?: string;
            };

            if (parsedSession.role === 'motoboy' && parsedSession.motoboyId) {
              const currentDriver = list.find((m) => m.id === parsedSession.motoboyId) as (Motoboy & { accessRevokedAt?: number }) | undefined;
              const accessRevoked = Boolean(currentDriver?.accessRevokedAt);

              if (!currentDriver || accessRevoked) {
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
    (err) => {
      console.warn('Firestore motoboys sync error:', err);
    }
  );
}

export function subscribeToShift(callback: (shift: StoreShift) => void) {
  const docRef = doc(db, 'shifts', 'current_shift');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as StoreShift);
      }
    },
    (err) => {
      console.warn('Firestore shift sync error:', err);
    }
  );
}

function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

export async function saveOrderToCloud(order: Order) {
  try {
    const docRef = doc(db, 'orders', order.id);
    await setDoc(docRef, cleanForFirestore(order), { merge: true });
  } catch (err) {
    console.error('Error saving order to cloud:', err);
  }
}

export async function saveMotoboyToCloud(motoboy: Motoboy) {
  try {
    const docRef = doc(db, 'motoboys', motoboy.id);
    const existing = await getDoc(docRef);

    // Registration and queue participation are separate actions.
    // A brand-new driver always starts offline and with zero daily earnings.
    // Only a later explicit action from the driver's app may set status='available'.
    const payload: Motoboy = !existing.exists()
      ? {
          ...motoboy,
          status: 'offline',
          activeOrdersCount: 0,
          totalEarnedToday: 0,
          deliveriesCountToday: 0,
          joinedQueueAt: undefined,
          callingToCounterAt: undefined,
        }
      : motoboy;

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

    // Revoke first so a logged-in phone receives an explicit access-loss event.
    await setDoc(
      docRef,
      {
        status: 'offline',
        accessRevokedAt: Date.now(),
        joinedQueueAt: null,
        callingToCounterAt: null,
      },
      { merge: true }
    );

    await wait(1200);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting motoboy from cloud:', err);
  }
}

export async function deleteAllMotoboysFromCloud() {
  try {
    const colRef = collection(db, 'motoboys');
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return;

    const revokedAt = Date.now();

    // First revoke every access. Logged-in phones react to this snapshot and return to login.
    await Promise.all(
      snapshot.docs.map((docSnap) =>
        setDoc(
          docSnap.ref,
          {
            status: 'offline',
            accessRevokedAt: revokedAt,
            joinedQueueAt: null,
            callingToCounterAt: null,
          },
          { merge: true }
        )
      )
    );

    // Give realtime listeners enough time to receive the revocation before documents disappear.
    await wait(1500);

    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.error('Error deleting all motoboys from cloud:', err);
    throw err;
  }
}

export async function deleteAllOrdersFromCloud() {
  try {
    const colRef = collection(db, 'orders');
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
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
    const docRef = doc(db, 'shifts', 'current_shift');
    await setDoc(docRef, shift, { merge: true });
  } catch (err) {
    console.error('Error saving shift to cloud:', err);
  }
}

// One-time clean slate requested for the real store test.
// This removes all operational data but preserves the store password.
// The Firestore marker prevents a future device/browser from clearing test data again.
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
  await setDoc(resetMarkerRef, {
    completed: true,
    resetAt: Date.now(),
    preservedStoreAccess: true,
  });
}

// Ensure store configuration exists and perform the requested one-time clean reset.
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
