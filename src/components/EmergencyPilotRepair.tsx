import { useEffect } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order, StoreAccount, StoreShift } from '../types';

const RESET_VERSION = 'manual_orders_reset_2026_09_10_v2';

function getSessionUsername() {
  try {
    const raw = window.localStorage.getItem('rota_facil_session');
    if (!raw) return '';
    const session = JSON.parse(raw) as { username?: string };
    return (session.username || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function EmergencyPilotRepair() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const shiftRef = doc(db, 'shifts', 'current_shift');
        const shiftSnap = await getDoc(shiftRef);
        const shift = shiftSnap.exists() ? (shiftSnap.data() as StoreShift & Record<string, any>) : ({} as StoreShift & Record<string, any>);

        if (shift.manualOrderResetVersion !== RESET_VERSION) {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          const manualDocs = ordersSnap.docs.filter((orderDoc) => {
            const order = orderDoc.data() as Partial<Order>;
            return order.originChannel === 'manual';
          });

          if (manualDocs.length > 0) {
            await Promise.all(manualDocs.map((orderDoc) => deleteDoc(orderDoc.ref)));
          }

          await setDoc(
            shiftRef,
            {
              manualOrderResetVersion: RESET_VERSION,
              manualOrderResetAt: Date.now(),
              manualOrderResetCount: manualDocs.length,
            },
            { merge: true },
          );
        }

        const hasCoords =
          Number.isFinite(Number(shift.storeLat)) &&
          Number.isFinite(Number(shift.storeLng)) &&
          Number(shift.storeLat) !== 0 &&
          Number(shift.storeLng) !== 0;

        const needsStoreRecovery = !String(shift.storeAddress || '').trim() || !String(shift.storeName || '').trim() || !hasCoords;
        if (!needsStoreRecovery) return;

        const username = String(shift.storeUsername || getSessionUsername()).trim().toLowerCase();
        if (!username) return;

        const storeSnap = await getDoc(doc(db, 'stores', username));
        if (!storeSnap.exists()) return;
        const account = { id: storeSnap.id, ...storeSnap.data() } as StoreAccount;

        const recoveredLat = Number(account.storeLat ?? shift.storeLat);
        const recoveredLng = Number(account.storeLng ?? shift.storeLng);
        const recoveredAddress = String(account.storeAddress || shift.storeAddress || '').trim();
        const recoveredName = String(account.storeName || shift.storeName || '').trim();
        const recoveredHasCoords =
          Number.isFinite(recoveredLat) &&
          Number.isFinite(recoveredLng) &&
          recoveredLat !== 0 &&
          recoveredLng !== 0;

        if (!recoveredAddress || !recoveredName || !recoveredHasCoords || cancelled) return;

        await setDoc(
          shiftRef,
          {
            storeUsername: account.username || username,
            storeName: recoveredName,
            storePhone: account.storePhone || shift.storePhone || '',
            storeAddress: recoveredAddress,
            storeLat: recoveredLat,
            storeLng: recoveredLng,
            setupRequired: false,
            storeRecoveryVersion: RESET_VERSION,
            storeRecoveredAt: Date.now(),
          },
          { merge: true },
        );
      } catch (error) {
        console.warn('[Rota Fácil] Reparação segura do piloto falhou:', error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
