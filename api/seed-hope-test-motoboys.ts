import { initializeApp, getApp, getApps } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { hashPassword } from '../src/lib/passwordSecurity';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const OPERATIONAL_EPOCH = 'zeroed_store_pilot_2026_08_17_v10';
const PASSWORD = 'Teste1234';

const drivers = [
  { id: 'test_lucas', username: 'teste_lucas', name: 'TESTE - Lucas', phone: '47990000001', plate: 'TST-0001' },
  { id: 'test_rafael', username: 'teste_rafael', name: 'TESTE - Rafael', phone: '47990000002', plate: 'TST-0002' },
  { id: 'test_bruno', username: 'teste_bruno', name: 'TESTE - Bruno', phone: '47990000003', plate: 'TST-0003' },
  { id: 'test_diego', username: 'teste_diego', name: 'TESTE - Diego', phone: '47990000004', plate: 'TST-0004' },
  { id: 'test_mateus', username: 'teste_mateus', name: 'TESTE - Mateus', phone: '47990000005', plate: 'TST-0005' },
];

const brazilDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

export default async function handler(_req: any, res: any) {
  try {
    const statsDate = brazilDateKey();
    const created: any[] = [];

    for (const driver of drivers) {
      const { hash, salt } = await hashPassword(PASSWORD);
      await setDoc(doc(db, 'motoboys', driver.id), {
        ...driver,
        model: 'Moto teste',
        vehicleModel: 'Moto teste',
        pixKey: '',
        password: null,
        passwordHash: hash,
        passwordSalt: salt,
        status: 'offline',
        activeOrdersCount: 0,
        deliveriesCountToday: 0,
        totalEarnedToday: 0,
        statsDate,
        joinedQueueAt: null,
        callingToCounterAt: null,
        accessRevokedAt: null,
        operationalEpoch: OPERATIONAL_EPOCH,
        testAccount: true,
        testStore: 'Hope',
        seededAt: Date.now(),
      }, { merge: true });
      created.push({ id: driver.id, username: driver.username, name: driver.name, phone: driver.phone });
    }

    return res.status(200).json({ success: true, created, password: PASSWORD });
  } catch (error: any) {
    console.error('Hope test motoboy seed failed:', error);
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
}
