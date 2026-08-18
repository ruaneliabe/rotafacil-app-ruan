export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready_at_counter'
  | 'picked_up'
  | 'in_transit'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

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
  dispatchedAt?: string;
  trackingCode: string;
  routeSequence?: number;
  estimatedArrivalMinutes?: number;
  arrivedAtClient?: boolean;
  arrivedAtClientTimestamp?: number;
  isReturn?: boolean;
  operationalEpoch?: string;
  originChannel?: 'manual' | 'cardapio_web' | 'ifood' | 'whatsapp' | 'pdv';
  kitchenReadyInMin?: number;
  storeId?: string;
  storeName?: string;
}

export type MotoboyStatus = 'available' | 'delivering' | 'returning_to_store' | 'paused' | 'offline' | 'busy';

export interface Motoboy {
  id: string;
  name: string;
  phone: string;
  plate: string;
  model?: string;
  vehicleModel?: string;
  pixKey?: string;
  password?: string;
  username?: string;
  status: MotoboyStatus;
  currentLat?: number;
  currentLng?: number;
  locationUpdatedAt?: number;
  activeOrdersCount: number;
  deliveriesCountToday: number;
  totalEarnedToday: number;
  statsDate?: string; // YYYY-MM-DD local date
  joinedQueueAt?: number;
  callingToCounterAt?: number;
  accessRevokedAt?: number;
  operationalEpoch?: string;
}

export interface StoreAccount {
  id: string;
  username: string;
  password?: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  storeLat?: number;
  storeLng?: number;
  createdAt?: number;
}

export interface CardapioWebIntegration {
  enabled?: boolean;
  merchantToken?: string;
  apiUrl?: string;
  lastSyncAt?: string;
  autoAcceptOrders?: boolean;
  accountId?: string;
  webhookUrl?: string;
}

export interface IFoodIntegration {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  merchantId?: string;
  lastSyncAt?: string;
  autoAcceptOrders?: boolean;
  accountId?: string;
  webhookUrl?: string;
}

export interface StoreIntegrationConfig {
  enabled?: boolean;
  accountId?: string;
  webhookUrl?: string;
  lastSyncAt?: string;
  autoAcceptOrders?: boolean;
  merchantToken?: string;
  clientId?: string;
  clientSecret?: string;
  merchantId?: string;
}

export interface StoreIntegrations {
  enabled?: boolean;
  accountId?: string;
  webhookUrl?: string;
  cardapioWeb?: StoreIntegrationConfig;
  ifood?: StoreIntegrationConfig;
}

export interface StoreBranch {
  id: string;
  name: string;
  tag: string;
  icon?: string;
  phone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  integrations?: StoreIntegrations;
}

export interface StoreShift {
  id: string;
  isOpen: boolean;
  openedAt: string;
  initialCash: number;
  currentCash: number;
  totalOrdersCount: number;
  totalDeliveriesValue: number;
  storeName: string;
  storePhone?: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  adminPassword?: string;
  storeUsername?: string;
  masterUsername?: string;
  masterPassword?: string;
  installationVersion?: string;
  operationalResetVersion?: string;
  operationalResetAt?: number;
  pilotMode?: boolean;
  pilotActivatedAt?: number;
  demoDataDisabled?: boolean;
  setupRequired?: boolean;
  scaleTestSeedVersion?: string;
  scaleTestSeedStartedAt?: number;
  integrations?: StoreIntegrations;
  branches?: StoreBranch[];
  activeBranchId?: string;
}

export type UserRole = 'store_admin' | 'master_admin' | 'motoboy' | 'customer';

export interface UserSession {
  role: UserRole;
  storeName?: string;
  motoboyId?: string;
  motoboyName?: string;
  username?: string;
  isMaster?: boolean;
}

// Supplementary types for route and stop calculations
export type PriorityLevel = 'low' | 'normal' | 'medium' | 'high' | 'urgent';
export type StopStatus = 'pending' | 'completed' | 'delivered' | 'failed' | 'in_transit';
export type TransportMode = 'driving' | 'motorcycle' | 'moto' | 'car' | 'truck' | 'bicycling' | 'walking';

export interface LocationPoint {
  id?: string;
  name?: string;
  address: string;
  lat: number;
  lng: number;
  cep?: string;
}

export interface Stop extends LocationPoint {
  order?: number;
  orderIndex?: number;
  title?: string;
  contactName?: string;
  contactPhone?: string;
  recipientName?: string;
  phone?: string;
  notes?: string;
  timeWindow?: {
    start: string;
    end: string;
  };
  deliveryWindow?: string | {
    start: string;
    end: string;
  };
  status: StopStatus;
  priority: PriorityLevel;
  deliveryItems?: string;
  packagesCount?: number;
  completedAt?: string;
  signature?: string;
  photoUrl?: string;
  failureReason?: string;
  distanceFromPrev?: number; // km
  durationFromPrev?: number; // min
  valueToReceive?: number;
}

export interface RouteConfig {
  startLocation?: LocationPoint;
  origin?: LocationPoint;
  endLocation?: LocationPoint;
  roundTrip?: boolean;
  mode?: TransportMode;
  transportMode?: TransportMode;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  trafficOptimized?: boolean;
  speedMultiplier?: number;
  fuelConsumptionKmL?: number;
  fuelPricePerLiter?: number;
  pricePerDelivery?: number;
  fixedDailyCost?: number;
}

export interface RouteSummary {
  totalDistanceKm: number;
  totalDurationMin?: number;
  totalDurationMinutes?: number;
  stopsCount?: number;
  totalStopsCount?: number;
  completedStopsCount?: number;
  fuelEstimatedLiters?: number;
  estimatedFuelLiters?: number;
  costEstimated?: number;
  estimatedFuelCost?: number;
  totalRevenue?: number;
  netProfit?: number;
  geometryPolyline?: string;
}

export interface SavedRoute {
  id: string;
  name?: string;
  title?: string;
  createdAt: string;
  config?: RouteConfig;
  stops?: Stop[];
  summary?: RouteSummary;
}
