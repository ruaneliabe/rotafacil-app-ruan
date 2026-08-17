import { Motoboy, Order } from '../types';

const DRIVER_NAMES = [
  'Ruan', 'Carlos', 'Diego', 'Felipe', 'Bruno', 'Marcos', 'João', 'Lucas', 'Rafael', 'André',
  'Gustavo', 'Mateus', 'Vinícius', 'Tiago', 'Eduardo', 'Henrique', 'Leandro', 'Paulo', 'Rodrigo', 'Alex',
];

const DESTINATIONS = [
  ['Velha', 'Rua João Pessoa', -26.9141, -49.1038],
  ['Água Verde', 'Rua dos Caçadores', -26.9202, -49.1112],
  ['Vila Nova', 'Rua Almirante Barroso', -26.9027, -49.0914],
  ['Garcia', 'Rua Amazonas', -26.9365, -49.0791],
  ['Centro', 'Rua XV de Novembro', -26.9185, -49.0661],
  ['Itoupava Norte', 'Rua Dois de Setembro', -26.8796, -49.0788],
  ['Escola Agrícola', 'Rua Benjamin Constant', -26.9078, -49.1055],
  ['Fortaleza', 'Rua Francisco Vahldieck', -26.8829, -49.0639],
  ['Salto', 'Rua Bahia', -26.8952, -49.1158],
  ['Victor Konder', 'Rua São Paulo', -26.9107, -49.0735],
] as const;

// Pontos reais sobre corredores viários de Blumenau. A massa anterior distribuía
// os entregadores em um círculo matemático e acabava colocando motos em morros,
// rios e áreas sem rua, o que parecia um salto de GPS no mapa.
const DRIVER_ROAD_POSITIONS = [
  [-26.9078, -49.1055], // Rua Benjamin Constant
  [-26.9141, -49.1038], // Rua João Pessoa
  [-26.9202, -49.1112], // Rua dos Caçadores
  [-26.8952, -49.1158], // Rua Bahia
  [-26.9027, -49.0914], // Rua Almirante Barroso
  [-26.9107, -49.0735], // Rua São Paulo
  [-26.9185, -49.0661], // Rua XV de Novembro
  [-26.9365, -49.0791], // Rua Amazonas
  [-26.9169, -49.1105], // Retorno pela Rua dos Caçadores
  [-26.9139, -49.1052], // Retorno pela Rua João Pessoa
  [-26.9091, -49.1064], // Retorno pela Rua Benjamin Constant
] as const;

const ITEMS = [
  ['Hope Smash Bacon', 32],
  ['Hope Double Cheese & Bacon', 38],
  ['Hope Chicken Crisp', 34],
  ['Hope Monster Triple Bacon', 44],
  ['Porção Batata Rústica', 22],
] as const;

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function createScaleTestData(operationalEpoch: string) {
  const now = new Date();
  const today = dateKey(now);
  const nowMs = now.getTime();

  const motoboys: Motoboy[] = DRIVER_NAMES.map((name, index) => {
    const status: Motoboy['status'] = index < 6
      ? 'available'
      : index < 14
        ? 'delivering'
        : index < 17
          ? 'returning_to_store'
          : index < 19
            ? 'busy'
            : 'offline';
    const angle = (index / DRIVER_NAMES.length) * Math.PI * 2;
    const isOnRoad = status === 'delivering' || status === 'returning_to_store';
    const roadPosition = isOnRoad ? DRIVER_ROAD_POSITIONS[index - 6] : null;
    const activeOrdersCount = status === 'delivering' ? 3 : 0;

    return {
      id: `scale-driver-${String(index + 1).padStart(2, '0')}`,
      name,
      phone: `(47) 999${String(10000 + index).slice(-5)}`,
      username: `teste${String(index + 1).padStart(2, '0')}`,
      password: '1234',
      vehicleModel: index % 3 === 0 ? 'Honda CG 160' : index % 3 === 1 ? 'Yamaha Factor 150' : 'Honda Biz 125',
      plate: `TST-${String(1000 + index)}`,
      status,
      activeOrdersCount,
      currentLat: roadPosition?.[0] ?? -26.91530418395996 + Math.cos(angle) * 0.00018,
      currentLng: roadPosition?.[1] ?? -49.1146354675293 + Math.sin(angle) * 0.00018,
      locationUpdatedAt: nowMs - (index % 4) * 7000,
      fixedFee: 35,
      perDeliveryFee: 7.99,
      totalEarnedToday: 12 * 7.99,
      deliveriesCountToday: 12,
      statsDate: today,
      joinedQueueAt: status === 'available' ? nowMs - (6 - index) * 8 * 60000 : undefined,
      operationalEpoch,
    };
  });

  const orders: Order[] = Array.from({ length: 300 }, (_, index) => {
    const number = index + 1;
    const destination = DESTINATIONS[index % DESTINATIONS.length];
    const item = ITEMS[index % ITEMS.length];
    const createdAtDate = new Date(nowMs - (index >= 246 ? (300 - index) * 1.1 : (300 - index) * 2.6) * 60000);
    const status: Order['status'] = index < 240
      ? 'delivered'
      : index < 246
        ? 'cancelled'
        : index < 256
          ? 'pending'
          : index < 264
            ? 'preparing'
            : index < 276
              ? 'ready_at_counter'
              : index < 280
                ? 'picked_up'
                : 'in_transit';
    const deliveryFee = 7.99;
    const quantity = index % 4 === 0 ? 2 : 1;
    const subtotal = item[1] * quantity;
    const historicalDriverIndex = index % motoboys.length;
    const routeDriverIndex = 6 + (index % 8);
    const assignedDriverIndex = status === 'in_transit' || status === 'picked_up'
      ? routeDriverIndex
      : status === 'delivered'
        ? historicalDriverIndex
        : null;
    const assignedDriver = assignedDriverIndex === null ? null : motoboys[assignedDriverIndex];

    return {
      id: `scale-order-${String(number).padStart(3, '0')}`,
      codeNumber: 1000 + number,
      clientName: `Cliente Teste ${String(number).padStart(3, '0')}`,
      clientPhone: `(47) 98888-${String(1000 + number).slice(-4)}`,
      address: `${destination[1]}, ${100 + (index * 17) % 1800} - ${destination[0]}, Blumenau - SC`,
      street: destination[1],
      houseNumber: String(100 + (index * 17) % 1800),
      neighborhood: destination[0],
      lat: destination[2] + ((index % 5) - 2) * 0.0007,
      lng: destination[3] + ((index % 7) - 3) * 0.0007,
      items: [{ id: `scale-item-${number}`, name: item[0], quantity, price: item[1] }],
      itemsSummary: `${quantity}x ${item[0]}`,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      paymentMethod: index % 3 === 0 ? 'pix' : index % 3 === 1 ? 'cartao_maquininha' : 'dinheiro',
      changeFor: index % 3 === 2 ? Math.ceil((subtotal + deliveryFee + 20) / 10) * 10 : undefined,
      status,
      createdAt: createdAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      createdDate: today,
      estimatedMinutes: 20 + (index % 25),
      assignedMotoboyId: assignedDriver?.id || null,
      assignedMotoboyName: assignedDriver?.name || null,
      deliveredAt: status === 'delivered' ? new Date(createdAtDate.getTime() + (25 + index % 20) * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined,
      deliveredDate: status === 'delivered' ? today : undefined,
      deliveredTimestamp: status === 'delivered' ? createdAtDate.getTime() + (25 + index % 20) * 60000 : undefined,
      trackingCode: `ESCALA-${String(number).padStart(3, '0')}`,
      routeSequence: status === 'in_transit' || status === 'picked_up' ? Math.floor((index - 276) / 8) + 1 : undefined,
      originChannel: index % 4 === 0 ? 'ifood' : index % 4 === 1 ? 'cardapio_web' : index % 4 === 2 ? 'whatsapp' : 'manual',
      kitchenReadyInMin: status === 'preparing' ? 5 + index % 10 : undefined,
      operationalEpoch,
    };
  });

  return { motoboys, orders, today };
}
