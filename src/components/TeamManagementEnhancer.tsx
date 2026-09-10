import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Eye,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import { Motoboy, Order, StoreShift } from '../types';
import { playNewOrderSound } from '../utils/soundUtils';
import { saveMotoboyToCloud } from '../lib/firebase';

interface TeamManagementEnhancerProps {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onAssignOrderToMotoboy: (orderId: string, motoboyId: string) => void;
  onAssignBatchToMotoboy?: (orderIds: string[], motoboyId: string) => void;
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onOpenNewOrderModal: () => void;
  onOpenMotoboyModal: () => void;
  onDeleteMotoboy?: (motoboyId: string) => void;
  onResetMotoboyPassword?: (motoboyId: string) => void;
}

type SortMode = 'name' | 'status' | 'earnings';

const currency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const orderTime = (order: Order) => {
  if (typeof order.createdTimestamp === 'number') return order.createdTimestamp;
  if (typeof order.createdAt === 'number') return order.createdAt;
  const parsed = Date.parse(String(order.createdAt || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAgo = (timestamp?: number) => {
  if (!timestamp) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MB';

export const TeamManagementEnhancer: React.FC<TeamManagementEnhancerProps> = ({
  shift,
  orders,
  motoboys,
  onAssignOrderToMotoboy,
  onAssignBatchToMotoboy,
  onConfirmArrivalAtStore,
  onOpenNewOrderModal,
  onOpenMotoboyModal,
  onDeleteMotoboy,
  onResetMotoboyPassword,
}) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const activeRootRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const restoreRoot = () => {
      const root = activeRootRef.current;
      if (!root) return;
      Array.from(root.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element.dataset.rotaFacilTeamPortal === 'true') return;
        if (element.dataset.rotaFacilPreviousDisplay !== undefined) {
          element.style.display = element.dataset.rotaFacilPreviousDisplay || '';
          delete element.dataset.rotaFacilPreviousDisplay;
        }
      });
      const host = root.querySelector<HTMLElement>('[data-rota-facil-team-portal="true"]');
      host?.remove();
      activeRootRef.current = null;
    };

    const syncPortal = () => {
      const heading = Array.from(document.querySelectorAll('h3')).find((node) =>
        node.textContent?.includes('Gestão da Equipe de Motoboys')
      ) as HTMLElement | undefined;

      if (!heading) {
        if (activeRootRef.current && !activeRootRef.current.isConnected) {
          activeRootRef.current = null;
        }
        setPortalTarget(null);
        return;
      }

      const root = heading.closest('.bg-slate-100') as HTMLElement | null;
      if (!root) return;

      if (activeRootRef.current && activeRootRef.current !== root) restoreRoot();
      activeRootRef.current = root;

      let host = root.querySelector<HTMLElement>('[data-rota-facil-team-portal="true"]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.rotaFacilTeamPortal = 'true';
        host.className = 'w-full';
        root.appendChild(host);
      }

      Array.from(root.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element === host) return;
        if (element.dataset.rotaFacilPreviousDisplay === undefined) {
          element.dataset.rotaFacilPreviousDisplay = element.style.display || '';
        }
        element.style.display = 'none';
      });

      if (portalTarget !== host) setPortalTarget(host);
    };

    syncPortal();
    const observer = new MutationObserver(syncPortal);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      restoreRoot();
    };
  }, [portalTarget]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, storeFilter, sortMode]);

  useEffect(() => {
    if (selectedId && !motoboys.some((m) => m.id === selectedId)) setSelectedId(null);
  }, [motoboys, selectedId]);

  const activeOrders = useMemo(
    () => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))),
    [orders]
  );

  const motoboyOrderMap = useMemo(() => {
    const map = new Map<string, { active: Order[]; last?: Order }>();
    motoboys.forEach((m) => {
      const related = orders
        .filter((o) => o.assignedMotoboyId === m.id)
        .sort((a, b) => orderTime(b) - orderTime(a));
      map.set(m.id, {
        active: related.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))),
        last: related[0],
      });
    });
    return map;
  }, [motoboys, orders]);

  const queue = useMemo(
    () =>
      motoboys
        .filter((m) => m.status === 'available')
        .sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0)),
    [motoboys]
  );

  const getViewStatus = (m: Motoboy) => {
    const linkedCount = motoboyOrderMap.get(m.id)?.active.length || 0;
    if (m.status === 'available' && linkedCount > 0) {
      return { key: 'queue', label: 'Na fila', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (m.status === 'available') {
      return { key: 'available', label: 'Disponível', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (m.status === 'delivering') {
      return { key: 'delivering', label: 'Em rota', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (m.status === 'returning_to_store') {
      return { key: 'returning', label: 'Voltando à loja', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' };
    }
    if (m.status === 'offline') {
      return { key: 'offline', label: 'Offline', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    return { key: 'paused', label: 'Pausado', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' };
  };

  const stats = useMemo(() => {
    const views = motoboys.map(getViewStatus);
    return {
      total: motoboys.length,
      available: views.filter((s) => s.key === 'available').length,
      delivering: views.filter((s) => s.key === 'delivering').length,
      queue: views.filter((s) => s.key === 'queue').length,
      returning: views.filter((s) => s.key === 'returning').length,
      offline: views.filter((s) => s.key === 'offline').length,
    };
  }, [motoboys, motoboyOrderMap]);

  const stores = useMemo(() => {
    const names = new Set<string>();
    if (shift.storeName) names.add(shift.storeName);
    shift.branches?.forEach((b) => b.name && names.add(b.name));
    orders.forEach((o) => o.storeName && names.add(o.storeName));
    return Array.from(names);
  }, [orders, shift]);

  const getMotoboyStore = (m: Motoboy) => {
    const data = motoboyOrderMap.get(m.id);
    return data?.active[0]?.storeName || data?.last?.storeName || shift.storeName || 'Loja principal';
  };

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = motoboys.filter((m) => {
      const viewStatus = getViewStatus(m);
      const last = motoboyOrderMap.get(m.id)?.last;
      const haystack = [m.name, m.plate, m.vehicleModel, m.model, m.username, last?.displayCode, last?.codeNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (normalized && !haystack.includes(normalized)) return false;
      if (statusFilter !== 'all' && viewStatus.key !== statusFilter) return false;
      if (storeFilter !== 'all' && getMotoboyStore(m) !== storeFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'earnings') return (b.totalEarnedToday || 0) - (a.totalEarnedToday || 0);
      if (sortMode === 'status') return getViewStatus(a).label.localeCompare(getViewStatus(b).label, 'pt-BR');
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [motoboys, search, statusFilter, storeFilter, sortMode, motoboyOrderMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = motoboys.find((m) => m.id === selectedId) || null;
  const selectedOrders = selected ? motoboyOrderMap.get(selected.id) : undefined;
  const selectedStatus = selected ? getViewStatus(selected) : null;

  const notify = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2800);
  };

  const callCounter = async (m: Motoboy) => {
    try {
      playNewOrderSound();
      await saveMotoboyToCloud({ ...m, callingToCounterAt: Date.now() });
      notify(`${m.name.split(' ')[0]} foi chamado para o balcão.`);
    } catch {
      notify('Não foi possível chamar o motoboy agora.');
    }
  };

  const assignNextOrder = (m: Motoboy) => {
    const unassigned = activeOrders.find((o) => !o.assignedMotoboyId);
    if (!unassigned) {
      onOpenNewOrderModal();
      return;
    }
    onAssignOrderToMotoboy(unassigned.id, m.id);
    notify(`Pedido ${unassigned.displayCode || `#${unassigned.codeNumber}`} atribuído para ${m.name.split(' ')[0]}.`);
  };

  const sendWhatsApp = (m: Motoboy) => {
    const number = (m.phone || '').replace(/\D/g, '');
    if (!number) return notify('Esse motoboy não possui WhatsApp cadastrado.');
    const brNumber = number.startsWith('55') ? number : `55${number}`;
    window.open(`https://wa.me/${brNumber}`, '_blank', 'noopener,noreferrer');
  };

  const openMap = (m: Motoboy) => {
    if (typeof m.currentLat !== 'number' || typeof m.currentLng !== 'number') {
      return notify('Localização atual ainda não disponível.');
    }
    window.open(`https://www.google.com/maps?q=${m.currentLat},${m.currentLng}`, '_blank', 'noopener,noreferrer');
  };

  const removeMotoboy = (m: Motoboy) => {
    if (!onDeleteMotoboy) return;
    if (window.confirm(`Remover ${m.name} da equipe?`)) {
      onDeleteMotoboy(m.id);
      setSelectedId(null);
    }
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const togglePageRows = () => {
    const ids = pageItems.map((m) => m.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedRows.includes(id));
    setSelectedRows((prev) => (allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
  };

  const callSelected = async () => {
    const targets = motoboys.filter((m) => selectedRows.includes(m.id));
    if (!targets.length) return;
    await Promise.all(targets.map((m) => saveMotoboyToCloud({ ...m, callingToCounterAt: Date.now() })));
    playNewOrderSound();
    notify(`${targets.length} motoboy${targets.length > 1 ? 's' : ''} chamado${targets.length > 1 ? 's' : ''} para o balcão.`);
  };

  if (!portalTarget) return null;

  const summaryCards = [
    { label: 'Total', value: stats.total, helper: 'entregadores', icon: UsersRound, iconClass: 'text-violet-600 bg-violet-50' },
    { label: 'Disponíveis', value: stats.available, helper: 'prontos para receber', icon: CheckCircle2, iconClass: 'text-emerald-600 bg-emerald-50' },
    { label: 'Em rota', value: stats.delivering, helper: 'em entregas', icon: Bike, iconClass: 'text-blue-600 bg-blue-50' },
    { label: 'Na fila', value: stats.queue, helper: 'com pedido vinculado', icon: Clock3, iconClass: 'text-amber-600 bg-amber-50' },
    { label: 'Voltando', value: stats.returning, helper: 'retornando à loja', icon: ChevronLeft, iconClass: 'text-orange-600 bg-orange-50' },
    { label: 'Offline', value: stats.offline, helper: 'sem conexão', icon: UserRound, iconClass: 'text-slate-500 bg-slate-100' },
  ];

  const content = (
    <div className="relative -m-1 rounded-2xl bg-white text-slate-900">
      {feedback && (
        <div className="fixed top-5 right-5 z-[100] rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">
          {feedback}
        </div>
      )}

      <div className="space-y-4 p-1">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-950">Gestão da Equipe de Motoboys</h3>
            <p className="mt-1 text-sm text-slate-500">Acompanhe em tempo real os entregadores da sua loja.</p>
          </div>
          <button
            type="button"
            onClick={onOpenMotoboyModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" /> Cadastrar Motoboy
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map(({ label, value, helper, icon: Icon, iconClass }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClass}`}><Icon className="h-4 w-4" /></span>
                <span className="text-xs font-extrabold text-slate-600">{label}</span>
              </div>
              <div className="mt-2 text-2xl font-black leading-none text-slate-950">{value}</div>
              <div className="mt-1 text-[11px] text-slate-500">{helper}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, placa ou pedido..."
              className="w-full bg-transparent text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none">
            <option value="all">Todos os status</option>
            <option value="available">Disponíveis</option>
            <option value="delivering">Em rota</option>
            <option value="queue">Na fila</option>
            <option value="returning">Voltando</option>
            <option value="offline">Offline</option>
            <option value="paused">Pausado</option>
          </select>
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none">
            <option value="all">Todas as lojas</option>
            {stores.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none">
            <option value="name">Nome (A-Z)</option>
            <option value="status">Status</option>
            <option value="earnings">Maior ganho</option>
          </select>
          {selectedRows.length > 0 && (
            <button type="button" onClick={callSelected} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-100">
              <Zap className="h-3.5 w-3.5" /> Chamar ({selectedRows.length})
            </button>
          )}
        </div>

        <div className={`grid gap-4 ${selected ? '2xl:grid-cols-[minmax(0,1fr)_330px]' : 'grid-cols-1'}`}>
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-12 px-4 py-3"><input type="checkbox" checked={pageItems.length > 0 && pageItems.every((m) => selectedRows.includes(m.id))} onChange={togglePageRows} /></th>
                    <th className="w-[18%] px-2 py-3">Entregador</th>
                    <th className="w-[14%] px-2 py-3">Veículo / Placa</th>
                    <th className="w-[14%] px-2 py-3">Status</th>
                    <th className="w-[7%] px-2 py-3">Fila</th>
                    <th className="w-[23%] px-2 py-3">Corrida atual / Último pedido</th>
                    <th className="w-[12%] px-2 py-3">Ganho do dia</th>
                    <th className="w-[12%] px-2 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((m) => {
                    const data = motoboyOrderMap.get(m.id);
                    const currentOrder = data?.active[0];
                    const lastOrder = currentOrder || data?.last;
                    const status = getViewStatus(m);
                    const queueIndex = queue.findIndex((item) => item.id === m.id);
                    const isSelected = selectedId === m.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedId(m.id)}
                        className={`cursor-pointer transition ${isSelected ? 'bg-violet-50/70' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedRows.includes(m.id)} onChange={() => toggleRow(m.id)} /></td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[11px] font-black text-violet-700">{initials(m.name)}</span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-slate-900">{m.name}</div>
                              <div className="truncate text-[10px] font-medium text-slate-500">{getMotoboyStore(m)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="text-xs font-bold text-slate-700">{m.vehicleModel || m.model || 'Moto'}</div>
                          <div className="mt-0.5 text-[10px] font-medium text-slate-500">{m.plate || 'Sem placa'}</div>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-black ${status.badge}`}>
                            <span className={`h-2 w-2 rounded-full ${status.dot}`} /> {status.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs font-black text-slate-800">{queueIndex >= 0 ? queueIndex + 1 : '—'}</td>
                        <td className="px-2 py-3">
                          {lastOrder ? (
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-slate-800">{lastOrder.displayCode || `#${lastOrder.codeNumber}`}</div>
                              <div className="mt-0.5 truncate text-[10px] text-slate-500">{lastOrder.address || lastOrder.neighborhood || lastOrder.clientName}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Aguardando pedido</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs font-black text-violet-700">{currency(m.totalEarnedToday)}</td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {m.phone && <a href={`tel:${m.phone.replace(/\D/g, '')}`} title="Ligar" className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Phone className="h-4 w-4" /></a>}
                            <button type="button" onClick={() => sendWhatsApp(m)} title="WhatsApp" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" /></button>
                            <button type="button" onClick={() => openMap(m)} title="Ver no mapa" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><MapPin className="h-4 w-4" /></button>
                            <button type="button" onClick={() => setSelectedId(m.id)} title="Detalhes" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-14 text-center text-sm font-semibold text-slate-400">Nenhum entregador encontrado com esses filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] font-medium text-slate-500">
                Mostrando {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} a {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} entregadores
              </span>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-violet-600 px-2 text-xs font-black text-white">{currentPage}</span>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {selected && selectedStatus && (
            <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="border-b border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-black text-violet-700">{initials(selected.name)}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black text-slate-950">{selected.name}</h4>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black ${selectedStatus.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedStatus.dot}`} />{selectedStatus.label}</span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">{selected.vehicleModel || selected.model || 'Moto'} · {selected.plate || 'Sem placa'}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <a href={selected.phone ? `tel:${selected.phone.replace(/\D/g, '')}` : undefined} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-black text-violet-700 hover:bg-violet-50"><Phone className="h-3.5 w-3.5" /> Ligar</a>
                  <button type="button" onClick={() => sendWhatsApp(selected)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-50"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                  <button type="button" onClick={() => openMap(selected)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50"><MapPin className="h-3.5 w-3.5" /> Mapa</button>
                </div>
              </div>

              <div className="space-y-2 border-b border-slate-200 p-4">
                <button type="button" onClick={() => callCounter(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-black text-white hover:bg-violet-500"><Zap className="h-4 w-4" /> Chamar para o balcão</button>
                <button type="button" onClick={() => assignNextOrder(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-100"><Plus className="h-4 w-4" /> Lançar pedido para {selected.name.split(' ')[0]}</button>
                {selected.status === 'returning_to_store' && onConfirmArrivalAtStore && (
                  <button type="button" onClick={() => { onConfirmArrivalAtStore(selected.id); notify(`Chegada de ${selected.name.split(' ')[0]} confirmada.`); }} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-4 w-4" /> Confirmar chegada</button>
                )}
              </div>

              <div className="space-y-3 border-b border-slate-200 p-4 text-xs">
                <h5 className="font-black text-slate-900">Informações</h5>
                <div className="grid grid-cols-[18px_1fr_auto] items-center gap-x-2 gap-y-3 text-slate-500">
                  <UserRound className="h-4 w-4" /><span>Usuário no app</span><strong className="text-slate-800">{selected.username || selected.name.toLowerCase().split(' ')[0]}</strong>
                  <Eye className="h-4 w-4" /><span>Senha</span><strong className="flex items-center gap-1 text-slate-800">{showPassword ? (selected.password || 'Protegida') : '••••••'} <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-violet-600"><Eye className="h-3.5 w-3.5" /></button></strong>
                  <Bike className="h-4 w-4" /><span>Veículo</span><strong className="text-slate-800">{selected.vehicleModel || selected.model || 'Moto'}</strong>
                  <MapPin className="h-4 w-4" /><span>Placa</span><strong className="text-slate-800">{selected.plate || '—'}</strong>
                  <UsersRound className="h-4 w-4" /><span>Loja</span><strong className="max-w-[125px] truncate text-right text-slate-800">{getMotoboyStore(selected)}</strong>
                </div>
                {onResetMotoboyPassword && (
                  <button type="button" onClick={() => onResetMotoboyPassword(selected.id)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-100">Gerar nova senha</button>
                )}
              </div>

              <div className="space-y-3 border-b border-slate-200 p-4 text-xs">
                <h5 className="font-black text-slate-900">Desempenho hoje</h5>
                <div className="grid grid-cols-[18px_1fr_auto] items-center gap-x-2 gap-y-3 text-slate-500">
                  <Bike className="h-4 w-4" /><span>Entregas realizadas</span><strong className="text-slate-800">{selected.deliveriesCountToday || 0}</strong>
                  <CircleDollarSign className="h-4 w-4" /><span>Ganho do dia</span><strong className="text-slate-800">{currency(selected.totalEarnedToday)}</strong>
                  <Clock3 className="h-4 w-4" /><span>Pedidos ativos</span><strong className="text-slate-800">{selectedOrders?.active.length || 0}</strong>
                  <Clock3 className="h-4 w-4" /><span>Última atividade</span><strong className="text-slate-800">{formatAgo(selected.locationUpdatedAt || selected.callingToCounterAt || selected.joinedQueueAt)}</strong>
                </div>
              </div>

              {onDeleteMotoboy && (
                <div className="p-4">
                  <button type="button" onClick={() => removeMotoboy(selected)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Remover da equipe</button>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
};
