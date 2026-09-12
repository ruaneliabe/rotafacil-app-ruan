import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, STORE_LOCATION } from './fixture';

let originalShift: Record<string, unknown> | null | undefined;

function brazilDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function prepareOperationalShiftForTest() {
  const ref = doc(db, 'shifts', 'current_shift');
  const snapshot = await getDoc(ref);
  originalShift = snapshot.exists() ? snapshot.data() : null;
  const now = Date.now();
  await setDoc(ref, {
    ...(originalShift || {}),
    isOpen: true,
    pilotMode: false,
    demoDataDisabled: true,
    setupRequired: false,
    shiftId: `pw_full_flow_${now}`,
    shiftDate: brazilDateKey(),
    openedTimestamp: now - 60_000,
    storeLat: STORE_LOCATION.latitude,
    storeLng: STORE_LOCATION.longitude,
  }, { merge: false });
}

export async function restoreOperationalShift() {
  if (originalShift === undefined) return;
  const ref = doc(db, 'shifts', 'current_shift');
  if (originalShift === null) await deleteDoc(ref);
  else await setDoc(ref, originalShift, { merge: false });
  originalShift = undefined;
}
