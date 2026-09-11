import React, { useMemo, useState } from 'react';
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { FlaskConical, Trash2 } from 'lucide-react';
import { db, saveOrderToCloud } from '../lib/firebase';
import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';
import { Order, StoreShift } from '../types';

type Props = {
  shift: StoreShift;
  orders: Order[];
};

const TEST_PREFIX = 'test_sim_';

const TEST_LOCATIONS = [
  { clientName: 'Ana Teste', street: 'Rua XV de Novembro', houseNumber: '1250', neighborhood: 'Centro', lat: -26.9194, lng: -49.0661 },
  { clientName: 'Bruno Teste', street: 'Rua Amazonas', houseNumber: '890', neighborhood: 'Garcia', lat: -26.9361, lng: -49.0574 },
  { clientName: 'Carla Teste', street: 'Rua dos Caçadores', houseNumber: '1550', neighborhood: 'Velha', lat: -26.9235, lng: -49.1036 },
  { clientName: 'Diego Teste', street: 'Rua General Osório', houseNumber: '980', neighborhood: 'Velha', lat: -26.9157, lng: -49.0948 },
  { clientName: 'Eduarda Teste', street: 'Rua São Paulo', houseNumber: '1750', neighborhood: 'Itoupava Seca', lat: -26.9058, lng: -49.0747 },
  { clientName: 'Felipe Teste', street: 'Rua 2 de Setembro', houseNumber: '1250', neighborhood: 'Itoupava Norte', lat: -26.8926, lng: -49.0702 },
  { clientName: 'Gabriela Teste', street: 'Rua República Argentina', houseNumber: '620', neighborhood: 'Ponta Aguda', lat: -26.9177, lng: -49.0528 },
  { clientName: 'Henrique Teste', street: 'Rua Almirante Barroso', houseNumber: '740', neighborhood: 'Vila Nova', lat: -26.9104, lng: -49.0829 },
  { clientName: 'Isabela Teste', street: 'Rua Benjamin Constant', houseNumber: '1420', neighborhood: 'Escola Agrícola', lat: -26.9009, lng: -49.0961 },
  { clientName: 'João Teste', street: 'Rua Bahia', houseNumber: '2200', neighborhood: 'Salto Weissbach', lat: -26.9038, lng: -49.1214 },
  { clientName: 'Karen Teste', street: 'Rua Engenheiro Udo Deeke', houseNumber: '1150', neighborhood: 'Salto do Norte', lat: -26.8754, lng: -49.1099 },
  { clientName: 'Lucas Teste', street: 'Rua Hermann Hering', houseNumber: '510', neighborhood: 'Bom Retiro', lat: -26.9170, lng: -49.0869 },
  { clientName: 'Mariana Teste', street: 'Rua Gustavo Zimmermann', houseNumber: '2800', neighborhood: 'Itoupava Central', lat: -26.8508, lng: -49.0856 },
  { clientName: 'Nicolas Teste', street: 'Rua Francisco Vahldieck', houseNumber: '1350', neighborhood: 'Fortaleza', lat: -26.8921, lng: -49.0414 },
  { clientName: 'Paula Teste', street: 'Rua Itajaí', houseNumber: '1850', neighborhood: 'Vorstadt', lat: -26.9310, lng: -49.0417 },
] as const;

const moneyValues = [42.9, 58.5, 73.9, 89.9, 51.4, 64.9, 97.5, 46.8, 82.3, 55.9, 68.7, 104.9, 39.9, 76.4, 92.8];

export const TestOrdersControl: React.FC<Props> = ({ shift, orders }) => {
  const [busy, setBusy] = useState<'create' | 'delete' | null>(null);
  const testCount = useMemo(() => orders.filter((o: any) => o.id?.startsWith(TEST_PREFIX) || o.isTestOrder === true).length, [orders]);

  const createTestOrders = async () => {
    if (busy) return;
    if (testCount > 0 && !window.confirm(`Já existem ${testCount} pedidos de teste. Criar mais 15 mesmo assim?`)) return;

    setBusy('create');
    try {
      const today = getBrazilDateKey();
      const now = Date.now();
      const startCode = orders.reduce((max, o) => Math.max(max, Number(o.codeNumber) || 0), 100) + 1;

      const batch = TEST_LOCATIONS.map((loc, index) => {
        const id = `${TEST_PREFIX}${now}_${index + 1}`;
        const codeNumber = startCode + index;
        const total = moneyValues[index];
        const deliveryFee = 8 + (index % 4);
        const createdTs = now + index;
        const paymentMethod = index % 3 === 0 ? 'pix' : index % 3 === 1 ? 'card' : 'cash';

        return {
          id,
          codeNumber,
          clientName: loc.clientName,
          clientPhone: `4799999${String(1000 + index)}`,
          address: `${loc.street}, ${loc.houseNumber} - ${loc.neighborhood}, Blumenau - SC`,
          street: loc.street,
          houseNumber: loc.houseNumber,
          neighborhood: loc.neighborhood,
          lat: loc.lat,
          lng: loc.lng,
          items: [],
          itemsSummary: `Pedido de teste ${index + 1}`,
          subtotal: total - deliveryFee,
          deliveryFee,
          total,
          paymentMethod,
          status: 'pending',
          createdAt: getBrazilTimeString(),
          createdDate: today,
          createdTimestamp: createdTs,
          shiftId: shift.shiftId || `test_shift_${today}`,
          shiftDate: shift.shiftDate || today,
          estimatedMinutes: 20 + (index % 4) * 5,
          assignedMotoboyId: null,
          assignedMotoboyName: null,
          originChannel: 'manual',
          kitchenReadyInMin: 0,
          trackingCode: `TESTE-${codeNumber}-${String(index + 1).padStart(2, '0')}`,
          isTestOrder: true,
          testBatchId: String(now),
        } as Order & { isTestOrder: boolean; testBatchId: string };
      });

      await Promise.all(batch.map((order) => saveOrderToCloud(order)));
      window.alert('15 pedidos de teste criados em locais diferentes de Blumenau.');
    } catch (error) {
      console.error('Erro ao criar pedidos de teste:', error);
      window.alert('Não foi possível criar os pedidos de teste.');
    } finally {
      setBusy(null);
    }
  };

  const deleteTestOrders = async () => {
    if (busy) return;
    if (!testCount) {
      window.alert('Não há pedidos de teste para apagar.');
      return;
    }
    if (!window.confirm(`Apagar os ${testCount} pedidos de teste? Pedidos reais não serão afetados.`)) return;

    setBusy('delete');
    try {
      const snapshot = await getDocs(collection(db, 'orders'));
      const testDocs = snapshot.docs.filter((snap) => {
        const data = snap.data() as any;
        return snap.id.startsWith(TEST_PREFIX) || data.isTestOrder === true;
      });
      await Promise.all(testDocs.map((snap) => deleteDoc(snap.ref)));
      window.alert(`${testDocs.length} pedidos de teste apagados.`);
    } catch (error) {
      console.error('Erro ao apagar pedidos de teste:', error);
      window.alert('Não foi possível apagar os pedidos de teste.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[80] hidden items-center gap-2 rounded-2xl border border-violet-200 bg-white/95 p-2 shadow-xl backdrop-blur lg:flex">
      <span className="px-1 text-[9px] font-black uppercase tracking-wide text-violet-600">Teste {testCount ? `(${testCount})` : ''}</span>
      <button
        type="button"
        onClick={createTestOrders}
        disabled={busy !== null}
        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[10px] font-black text-white hover:bg-violet-500 disabled:opacity-50"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        {busy === 'create' ? 'CRIANDO...' : '+15 PEDIDOS'}
      </button>
      <button
        type="button"
        onClick={deleteTestOrders}
        disabled={busy !== null || testCount === 0}
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[10px] font-black text-rose-600 hover:bg-rose-100 disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        APAGAR TESTES
      </button>
    </div>
  );
};
