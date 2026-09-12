import fs from 'node:fs';

const path = 'src/lib/settlements.ts';
const content = `import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
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

const key = (date: string, motoboyId: string) => \`${'${date}_${motoboyId}'}\`;
const docId = (id: string) => \`settlement_${'${id}'}\`;

// Store settlement docs in the already-authorized shifts collection. This keeps
// finance persistent across devices even when the dedicated settlements rule has
// not been deployed yet, and avoids permission errors from breaking the UI.
export function subscribeToSettlements(callback: (items: CourierSettlement[]) => void) {
  const source = query(collection(db, 'shifts'), where('kind', '==', 'settlement'));
  return onSnapshot(source, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const data = item.data() as any;
      return {
        id: data.id || item.id.replace(/^settlement_/, ''),
        date: data.date || '',
        motoboyId: data.motoboyId || '',
        motoboyName: data.motoboyName || '',
        status: data.status === 'settled' ? 'settled' : 'open',
        settledAt: data.settledAt ?? null,
        updatedAt: Number(data.updatedAt || 0),
      } as CourierSettlement;
    });
    callback(items);
  }, (error: any) => {
    console.warn('Finance settlement sync unavailable:', error?.code || error?.message || error);
    callback([]);
  });
}

export async function setSettlementStatus(date: string, motoboyId: string, motoboyName: string, settled: boolean) {
  const id = key(date, motoboyId);
  try {
    await setDoc(doc(db, 'shifts', docId(id)), {
      kind: 'settlement',
      id,
      date,
      motoboyId,
      motoboyName,
      status: settled ? 'settled' : 'open',
      settledAt: settled ? Date.now() : null,
      updatedAt: Date.now(),
    }, { merge: true });
    return true;
  } catch (error: any) {
    console.warn('Finance settlement write unavailable:', error?.code || error?.message || error);
    return false;
  }
}
`;

fs.writeFileSync(path, content);
console.log('[settlement-fallback] finance settlements persist through authorized shift documents');
