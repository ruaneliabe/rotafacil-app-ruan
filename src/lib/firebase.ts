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
  INITIAL_MOTOBOYS,
  INITIAL_ORDERS,
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
      // Sort by codeNumber desc
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

// Clean undefined values to prevent Firestore error
function cleanForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}

// Write functions
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
    await setDoc(docRef, cleanForFirestore(motoboy), { merge: true });
  } catch (err) {
    console.error('Error saving motoboy to cloud:', err);
  }
}

export async function deleteMotoboyFromCloud(motoboyId: string) {
  try {
    const docRef = doc(db, 'motoboys', motoboyId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting motoboy from cloud:', err);
  }
}

export async function deleteAllMotoboysFromCloud() {
  try {
    const colRef = collection(db, 'motoboys');
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.error('Error deleting all motoboys from cloud:', err);
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
  }
}

export async function clearAllDatabaseData() {
  try {
    await Promise.all([deleteAllOrdersFromCloud(), deleteAllMotoboysFromCloud()]);
  } catch (err) {
    console.error('Error clearing all database data:', err);
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

// Ensure store shift configuration exists if database is new
export async function seedInitialDataIfEmpty() {
  try {
    const shiftDoc = await getDoc(doc(db, 'shifts', 'current_shift'));
    if (!shiftDoc.exists()) {
      const hopeShift: StoreShift = {
        ...INITIAL_STORE_SHIFT,
        storeName: 'Hope Burger',
        storePhone: '(47) 99887-6655',
        storeAddress: 'R. dos Caçadores, 653 - Velha Central, Blumenau - SC, 89040-313',
        storeLat: -26.9228,
        storeLng: -49.1014,
        adminPassword: '123',
      };
      await setDoc(doc(db, 'shifts', 'current_shift'), hopeShift);
    }
  } catch (err) {
    console.warn('Could not seed initial shift data:', err);
  }
}
