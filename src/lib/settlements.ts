import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CourierSettlement {
  id: string;
  date: string;
  motoboyId: string;
  motoboyName: string;
  status: 'open' | 'settled';
  settledAt?: number | null;
  updatedAt: number;
}

const key = (date: string, motoboyId: string) => `${date}_${motoboyId}`;

export function subscribeToSettlements(callback: (items: CourierSettlement[]) => void) {
  return onSnapshot(collection(db, 'settlements'), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CourierSettlement)));
  }, (error) => console.warn('Settlement sync error:', error));
}

export async function setSettlementStatus(date: string, motoboyId: string, motoboyName: string, settled: boolean) {
  const id = key(date, motoboyId);
  await setDoc(doc(db, 'settlements', id), {
    id,
    date,
    motoboyId,
    motoboyName,
    status: settled ? 'settled' : 'open',
    settledAt: settled ? Date.now() : null,
    updatedAt: Date.now(),
  }, { merge: true });
}
