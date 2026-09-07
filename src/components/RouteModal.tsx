import React, { useState, useEffect } from 'react';
import { X, MapPin, ExternalLink, Store, Package, Loader2 } from 'lucide-react';
import { Order, Motoboy, StoreShift } from '../types';
import { RouteMap } from './RouteMap';
import { geocodeAddress } from '../utils/geoUtils';
import { saveOrderToCloud } from '../lib/firebase';

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  motoboys?: Motoboy[];
  shift: StoreShift;
  selectedStoreFilter?: string;
  onSelectOrderForTracking?: (order: Order) => void;
  onAssignOrderToMotoboy?: (orderId: string, motoboyId: string) => void;
}

export const RouteModal: React.FC<RouteModalProps> = ({
  isOpen,
  onClose,
  orders,
  shift,
  selectedStoreFilter = 'all',
  onSelectOrderForTracking,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'delivering'>('all');
  const [localStoreFilter, setLocalStoreFilter] = useState<string>(selectedStoreFilter);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geocodingInProgress, setGeocodingInProgress] = useState<boolean>(false);

  if (!isOpen) return null;

  // Filter orders by store if selected
  const storeFilteredOrders = orders.filter((ord) => {
    if (localStoreFilter === 'all') return true;
    if (ord.storeBranch === localStoreFilter) return true;
    if (ord.storeId === localStoreFilter) return true;
    if (ord.storeName) {
      if (localStoreFilter === 'hope_burger' && ord.storeName.toLowerCase().includes('burger')) return true;
      if (localStoreFilter === 'hope_pizza' && (ord.storeName.toLowerCase().includes('pizz') || ord.storeName.toLowerCase().includes('pizza'))) return true;
    }
    return false;
  });

  // Filter active orders (excluding completed/cancelled)
  const activeOrders = storeFilteredOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  );

  const displayedOrders = activeOrders.filter((ord) => {
    if (activeTab === 'unassigned') {
      return !ord.assignedMotoboyId;
    }
    if (activeTab === 'delivering') {
      return ord.status === 'in_transit' || Boolean(ord.assignedMotoboyId);
    }
    return true;
  });

  // Auto-geocode orders that have fallback or missing coordinates
  useEffect(() => {
    let isCancelled = false;

    async function geocodeOrdersMissingCoords() {
      const needsGeocode = displayedOrders.filter((ord) => {
        if (resolvedCoords[ord.id]) return false;
        if (!ord.address || ord.address.toLowerCase().includes('retirada no balcão')) return false;
        const isDefaultHopePizza = Math.abs(ord.lat - (-26.9240)) < 0.0001 && Math.abs(ord.lng - (-49.0630)) < 0.0001;
        const isDefaultHopeBurger = Math.abs(ord.lat - (-26.9194)) < 0.0001 && Math.abs(ord.lng - (-49.0661)) < 0.0001;
        const isMissing = !ord.lat || !ord.lng || ord.lat === 0;
        return isDefaultHopePizza || isDefaultHopeBurger || isMissing;
      });

      if (needsGeocode.length === 0) return;

      setGeocodingInProgress(true);
      for (const ord of needsGeocode) {
        if (isCancelled) break;
        try {
          const point = await geocodeAddress(ord.address);
          if (point && !isCancelled) {
            setResolvedCoords((prev) => ({
              ...prev,
              [ord.id]: { lat: point.lat, lng: point.lng },
            }));
            // Persist the precise coordinates so map shows real location
            saveOrderToCloud({
              ...ord,
              lat: point.lat,
              lng: point.lng,
            });
          }
        } catch (err) {
          console.warn(`[RouteModal] Falha ao geolocalizar pedido #${ord.codeNumber}:`, err);
        }
      }
      if (!isCancelled) setGeocodingInProgress(false);
    }

    geocodeOrdersMissingCoords();

    return () => {
      isCancelled = true;
    };
  }, [displayedOrders, resolvedCoords]);

  // Convert strictly orders to map stops with real geocoded coordinates & order number
  const stops = displayedOrders.map((ord, idx) => {
    const coords = resolvedCoords[ord.id] || { lat: ord.lat, lng: ord.lng };
    return {
      id: ord.id,
      orderIndex: idx + 1,
      codeNumber: ord.codeNumber,
      title: `#${ord.codeNumber} - ${ord.clientName}`,
      address: ord.address,
      neighborhood: ord.neighborhood,
      lat: coords.lat,
      lng: coords.lng,
      status:
        ord.status === 'delivered'
          ? ('delivered' as const)
          : ord.status === 'in_transit'
          ? ('in_transit' as const)
          : ('pending' as const),
      priority: 'medium' as const,
      recipientName: ord.clientName,
      phone: ord.clientPhone,
      valueToReceive: ord.total,
      motoboyId: ord.assignedMotoboyId || undefined,
      motoboyName: ord.assignedMotoboyName || undefined,
    };
  });

  const branches = shift.branches || [
    { id: 'hope_burger', name: 'Hope Burger', icon: '🍔', tag: 'HB' },
    { id: 'hope_pizza', name: 'Hope Pizza', icon: '🍕', tag: 'HP' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-lg shadow-inner">
              🗺️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-tight">
                  Mapa de Pedidos e Entregas
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  {displayedOrders.length} {displayedOrders.length === 1 ? 'Pedido' : 'Pedidos'} no Mapa
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Visualize exclusivamente a localização dos endereços e rotas dos pedidos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700"
              title="Fechar mapa de pedidos"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Store Branches Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 px-2 flex items-center gap-1">
              <Store className="w-3 h-3 text-indigo-400" /> Loja:
            </span>
            <button
              type="button"
              onClick={() => setLocalStoreFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                localStoreFilter === 'all'
                  ? 'bg-slate-200 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              🏢 Ambas Lojas
            </button>
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setLocalStoreFilter(b.id)}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  localStoreFilter === b.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{b.icon || '🏪'}</span>
                <span>{b.name}</span>
              </button>
            ))}
          </div>

          {/* Delivery Status Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-700 text-white shadow-xs font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({activeOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unassigned')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'unassigned'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aguardando Despacho ({activeOrders.filter((o) => !o.assignedMotoboyId).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('delivering')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'delivering'
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Em Trânsito / Vinculados ({activeOrders.filter((o) => o.status === 'in_transit' || o.assignedMotoboyId).length})
            </button>
          </div>
        </div>

        {/* Content Area: Map + Orders Sidebar */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Map View (8 cols) - STRICTLY ORDERS ONLY */}
          <div className="lg:col-span-8 h-full relative overflow-hidden bg-slate-950">
            <RouteMap
              origin={{
                name: shift.storeName || 'Minha Loja',
                address: shift.storeAddress || 'Rua XV de Novembro, 1500 - Centro, Blumenau - SC',
                lat: shift.storeLat || -26.9194,
                lng: shift.storeLng || -49.0661,
              }}
              stops={stops}
              selectedStopId={selectedOrderId}
              onSelectStop={(stop) => setSelectedOrderId(stop.id)}
              showMotoboyMarker={false}
            />
          </div>

          {/* Side List: Orders (4 cols) */}
          <div className="lg:col-span-4 h-full bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col min-h-0">
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-400" />
                Endereços dos Pedidos ({displayedOrders.length})
              </span>
              <div className="flex items-center gap-2">
                {geocodingInProgress && (
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Mapeando...
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-bold">
                  {activeOrders.filter((o) => !o.assignedMotoboyId).length} pendentes
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
              {displayedOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <span className="text-3xl block">📍</span>
                  <p className="font-bold text-sm text-slate-200">Nenhum pedido neste filtro</p>
                  <p className="text-xs text-slate-500">
                    Os pedidos abertos aparecerão aqui e no mapa com seus endereços geolocalizados.
                  </p>
                </div>
              ) : (
                displayedOrders.map((ord) => {
                  const isAssigned = Boolean(ord.assignedMotoboyId);
                  const isHopePizza = ord.storeBranch === 'hope_pizza' || ord.storeId === 'hope_pizza' || ord.storeName?.toLowerCase().includes('pizz');
                  const isSelected = selectedOrderId === ord.id;
                  
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3 rounded-2xl border transition-all space-y-2 cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-indigo-400 bg-slate-800/90 border-indigo-500'
                          : ord.status === 'in_transit'
                          ? 'bg-blue-950/40 border-blue-500/40 hover:border-blue-400'
                          : isAssigned
                          ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                          : 'bg-slate-950 border-amber-500/30 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}>
                            #{ord.codeNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs text-white">
                                #{ord.codeNumber} · {ord.clientName}
                              </span>
                              {/* Store Badge */}
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                isHopePizza
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}>
                                {isHopePizza ? '🍕 Hope Pizza' : '🍔 Hope Burger'}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-400 font-bold block">
                              R$ {ord.total.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          ord.status === 'in_transit'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : isAssigned
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {ord.status === 'in_transit' ? 'Em Rota' : isAssigned ? 'Vinculado' : 'Pendente'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 space-y-0.5 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                        <p className="font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{ord.address}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 pl-4.5">
                          Bairro: <strong className="text-slate-200">{ord.neighborhood}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {ord.assignedMotoboyName ? `🛵 ${ord.assignedMotoboyName}` : 'Sem entregador'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {onSelectOrderForTracking && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectOrderForTracking(ord);
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                              title="Abrir detalhes e rastreio"
                            >
                              <span>Rastrear</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
