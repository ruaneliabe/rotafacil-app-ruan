export type OrderStatus = 'pending' | 'preparing' | 'ready_at_counter' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
export type PaymentMethod = 'pix' | 'cartao_maquininha' | 'dinheiro';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  observations?: string;
}

export interface Order {
  id: string;
  codeNumber: number;
  clientName: string;
  clientPhone: string;
  address: string;
  street?: string;
  houseNumber?: string;
  complement?: string;
  neighborhood: string;
  lat: number;
  lng: number;
  items?: OrderItem[];
  itemsSummary: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeFor?: number;
  status: OrderStatus;
  createdAt: string;
  createdDate?: string; // YYYY-MM-DD local date
  estimatedMinutes: number;
  assignedMotoboyId?: string | null;
  assignedMotoboyName?: string | null;
  deliveredAt?: string;
  deliveredDate?: string; // YYYY-MM-DD local date
  deliveredTimestamp?: number;
  notes?: string;
  trackingCode: string;
  routeSequence?: number;
  originChannel?: 'ifood' | 'cardapio_web' | 'whatsapp' | 'pdv' | 'manual';
  kitchenReadyInMin?: number;
  promisedTime?: string;
  operationalEpoch?: string;
}

export interface Motoboy {
  id: string;
  name: string;
  phone: string;
  username?: string;
  password?: string;
  vehicleModel: string;
  plate: string;
  status: 'available' | 'delivering' | 'returning_to_store' | 'offline' | 'busy';
  activeOrdersCount: number;
  currentLat: number;
  currentLng: number;
  locationUpdatedAt?: number;
  avatarUrl?: string;
  fixedFee: number;
  perDeliveryFee: number;
  totalEarnedToday: number;
  deliveriesCountToday?: number;
  statsDate?: string; // YYYY-MM-DD local date for daily counters
  joinedQueueAt?: number;
  callingToCounterAt?: number;
  accessRevokedAt?: number;
  operationalEpoch?: string;
}

export type UserRole = 'store_admin' | 'motoboy' | 'customer';

export interface UserSession {
  role: UserRole;
  storeName?: string;
  motoboyId?: string;
  motoboyName?: string;
  username?: string;
}

export interface StoreIntegrationConfig {
  enabled: boolean;
  accountId: string;
  webhookUrl: string;
  updatedAt?: number;
}

export interface StoreIntegrations {
  ifood: StoreIntegrationConfig;
  cardapioWeb: StoreIntegrationConfig;
}

export interface StoreShift {
  isOpen: boolean;
  openedAt: string;
  initialCash: number;
  storeName: string;
  storePhone?: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  adminPassword?: string;
  integrations?: StoreIntegrations;
  operationalResetVersion?: string;
  operationalResetAt?: number;
  scaleTestSeedVersion?: string;
  scaleTestSeedStartedAt?: number;
  pilotMode?: boolean;
  pilotActivatedAt?: number;
  demoDataDisabled?: boolean;
}

export interface OperationalMetrics {
  activeOrdersCount: number;
  readyAtCounterCount: number;
  deliveredTodayCount: number;
  totalRevenueToday: number;
  motoboysInQueueCount: number;
  totalMotoboysCount: number;
  delayedOrdersCount: number;
}

export type PriorityLevel = 'high' | 'medium' | 'low';
export type StopStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';
export type TransportMode = 'motorcycle' | 'bicycle' | 'car' | 'moto' | 'truck';

export interface LocationPoint {
  name: string;
  address: string;
  lat: number;
  lng: number;
  cep?: string;
}

export interface Stop {
  id: string;
  orderIndex: number;
  title: string;
  address: string;
  neighborhood?: string;
  lat: number;
  lng: number;
  status: StopStatus;
  priority: PriorityLevel;
  recipientName?: string;
  phone?: string;
  valueToReceive?: number;
  cep?: string;
  notes?: string;
  deliveryWindow?: string;
  motoboyId?: string;
  motoboyName?: string;
}

export interface RouteConfig {
  optimizeFor?: 'time' | 'distance';
  maxStopsPerTrip?: number;
  origin?: LocationPoint;
  transportMode?: TransportMode | string;
  fuelConsumptionKmL?: number;
  fuelPricePerLiter?: number;
  pricePerDelivery?: number;
  fixedDailyCost?: number;
}

export interface RouteSummary {
  totalDistanceKm: number;
  estimatedTimeMin?: number;
  stopsCount?: number;
  totalDurationMinutes?: number;
  estimatedFuelLiters?: number;
  estimatedFuelCost?: number;
  totalRevenue?: number;
  netProfit?: number;
  completedStopsCount?: number;
  totalStopsCount?: number;
}

export interface SavedRoute {
  id: string;
  createdAt: string;
  motoboyName?: string;
  stops: Stop[];
  title?: string;
  config?: RouteConfig;
  summary?: RouteSummary;
}
