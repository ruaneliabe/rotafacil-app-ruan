import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, MapPin, MessageCircle, MoreVertical, Phone, Plus, Search, Trash2, UserRound, UsersRound, X, Zap } from 'lucide-react';
import { Motoboy, Order, StoreShift } from '../types';
import { playNewOrderSound } from '../utils/soundUtils';
import { saveMotoboyToCloud } from '../lib/firebase';

interface Props {
  shift: StoreShift;
  orders: Order[];
  motoboys: Motoboy[];
  onConfirmArrivalAtStore?: (motoboyId: string) => void;
  onOpenMotoboyModal: () => void;
  onDeleteMotoboy?: (motoboyId: string) => void;
  onResetMotoboyPassword?: (motoboyId: string) => void;
}

type SortMode = 'name' | 'status' | 'earnings';

const money = (v = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'MB';
const orderStamp = (o: Order) => Number(o.createdTimestamp || Date.parse(String(o.createdAt || '')) || 0);
const ago = (ts?: number) => {
  if (!ts) return '—';
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
};

export const TeamManagementPanel: React.FC<Props> = ({
  shift,
  orders,
  motoboys,
  onConfirmArrivalAtStore,
  onOpenMotoboyModal,
  onDeleteMotoboy,
  onResetMotoboyPassword,
}) => {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const legacyRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [sort, setSort] = useState<SortMode>('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (legacyRef.current) legacyRef.current.style.display = '';
      document.querySelector<HTMLElement>('[data-team-panel-host="true"]')?.remove();
      legacyRef.current = null;
      setHost(null);
    };
    const sync = () => {
      const heading = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.trim() === 'Gestão da Equipe de Motoboys' && !el.closest('[data-team-panel-root="true"]')) as HTMLElement | undefined;
      if (!heading) return;
      const legacy = heading.closest('div.bg-slate-100') as HTMLElement | null;
      const parent = legacy?.parentElement;
      if (!legacy || !parent) return;
      if (legacyRef.current && legacyRef.current !== legacy) cleanup();
      legacyRef.current = legacy;
      legacy.style.display = 'none';
      let portal = parent.querySelector<HTMLElement>(':scope > [data-team-panel-host="true"]');
      if (!portal) {
        portal = document.createElement('div');
        portal.dataset.teamPanelHost = 'true';
        portal.className = 'w-full';
        parent.insertBefore(portal, legacy);
      }
      setHost(portal);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanup(); };
  }, []);

  const activeOrders = useMemo(() => orders.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), [orders]);
  const byDriver = useMemo(() => {
    const map = new Map<string, { active: Order[]; last?: Order }>();
    motoboys.forEach((m) => {
      const related = orders.filter((o) => o.assignedMotoboyId === m.id).sort((a, b) => orderStamp(b) - orderStamp(a));
      map.set(m.id, { active: related.filter((o) => !['delivered', 'cancelled', 'failed'].includes(String(o.status))), last: related[0] });
    });
    return map;
  }, [motoboys, orders]);

  const viewStatus = (m: Motoboy) => {
    const linked = byDriver.get(m.id)?.active.length || 0;
    if (m.status === 'returning_to_store') return { key: 'returning', label: 'Voltando à loja', dot: 'bg-orange-500', cls: 'bg-orange-50 border-orange-200 text-orange-700' };
    if (m.status === 'delivering') return { key: 'delivering', label: 'Em rota', dot: 'bg-blue-500', cls: 'bg-blue-50 border-blue-200 text-blue-700' };
    if (m.status === 'offline') return { key: 'offline', label: 'Offline', dot: 'bg-slate-400', cls: 'bg-slate-100 border-slate-200 text-slate-600' };
    if (m.status === 'available' && linked > 0) return { key: 'queue', label: 'Na fila', dot: 'bg-amber-500', cls: 'bg-amber-50 border-amber-200 text-amber-700' };
    if (m.status === 'available') return { key: 'available', label: 'Disponível', dot: 'bg-emerald-500', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
    return { key: 'paused', label: 'Pausado', dot: 'bg-violet-500', cls: 'bg-violet-50 border-violet-200 text-violet-700' };
  };

  const queue = useMemo(() => motoboys.filter((m) => m.status === 'available').sort((a, b) => (a.joinedQueueAt || 0) - (b.joinedQueueAt || 0)), [motoboys]);
  const stores = useMemo(() => Array.from(new Set([shift.storeName, ...(shift.branches || []).map((b) => b.name), ...orders.map((o) => o.storeName)].filter(Boolean) as string[])), [shift, orders]);
  const driverStore = (m: Motoboy) => byDriver.get(m.id)?.active[0]?.storeName || byDriver.get(m.id)?.last?.storeName || shift.storeName || 'Loja principal';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = motoboys.filter((m) => {
      const last = byDriver.get(m.id)?.last;
      const hay = [m.name, m.plate, m.vehicleModel, m.model, m.username, last?.displayCode, last?.codeNumber].filter(Boolean).join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (statusFilter === 'all' || viewStatus(m).key === statusFilter) && (storeFilter === 'all' || driverStore(m) === storeFilter);
    });
    return [...list].sort((a, b) => sort === 'earnings' ? (b.totalEarnedToday || 0) - (a.totalEarnedToday || 0) : sort === 'status' ? viewStatus(a).label.localeCompare(viewStatus(b).label, 'pt-BR') : a.name.localeCompare(b.name, 'pt-BR'));
  }, [motoboys, search, statusFilter, storeFilter, sort, byDriver]);

  useEffect(() => setPage(1), [search, statusFilter, storeFilter, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const selected = motoboys.find((m) => m.id === selectedId) || null;
  const selectedStatus = selected ? viewStatus(selected) : null;
  const selectedData = selected ? byDriver.get(selected.id) : undefined;

  const notify = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2600); };
  const whatsapp = (m: Motoboy) => {
    const n = (m.phone || '').replace(/\D/g, '');
    if (!n) return notify('Motoboy sem WhatsApp cadastrado.');
    window.open(`https://wa.me/${n.startsWith('55') ? n : `55${n}`}`, '_blank', 'noopener,noreferrer');
  };
  const openMap = (m: Motoboy) => {
    if (typeof m.currentLat !== 'number' || typeof m.currentLng !== 'number') return notify('Localização atual ainda não disponível.');
    window.open(`https://www.google.com/maps?q=${m.currentLat},${m.currentLng}`, '_blank', 'noopener,noreferrer');
  };
  const callCounter = async (m: Motoboy) => {
    playNewOrderSound();
    await saveMotoboyToCloud({ ...m, callingToCounterAt: Date.now() });
    notify(`${m.name.split(' ')[0]} foi chamado para o balcão.`);
  };

  if (!host) return null;

  const stats = {
    total: motoboys.length,
    available: motoboys.filter((m) => viewStatus(m).key === 'available').length,
    delivering: motoboys.filter((m) => viewStatus(m).key === 'delivering').length,
    queue: motoboys.filter((m) => viewStatus(m).key === 'queue').length,
    returning: motoboys.filter((m) => viewStatus(m).key === 'returning').length,
    offline: motoboys.filter((m) => viewStatus(m).key === 'offline').length,
  };

  return createPortal(
    <section data-team-panel-root="true" className="space-y-4 rounded-2xl bg-[#FAF9F6]">
      {toast && <div className="fixed right-5 top-5 z-[100] rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-2xl">{toast}</div>}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div><h3 className="text-xl font-black text-slate-950">Gestão da Equipe de Motoboys</h3><p className="mt-1 text-sm text-slate-500">Acompanhe em tempo real os entregadores da sua loja.</p></div>
        <button onClick={onOpenMotoboyModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-500"><Plus className="h-4 w-4" />Cadastrar Motoboy</button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total', stats.total, 'entregadores', UsersRound, 'text-violet-600 bg-violet-50'],
          ['Disponíveis', stats.available, 'prontos para receber', CheckCircle2, 'text-emerald-600 bg-emerald-50'],
          ['Em rota', stats.delivering, 'em entregas', Bike, 'text-blue-600 bg-blue-50'],
          ['Na fila', stats.queue, 'com pedido vinculado', Clock3, 'text-amber-600 bg-amber-50'],
          ['Voltando', stats.returning, 'retornando à loja', ChevronLeft, 'text-orange-600 bg-orange-50'],
          ['Offline', stats.offline, 'sem conexão', UserRound, 'text-slate-500 bg-slate-100'],
        ].map(([label, value, helper, Icon, iconCls]: any) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconCls}`}><Icon className="h-4 w-4" /></span><span className="text-xs font-extrabold text-slate-600">{label}</span></div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-[11px] text-slate-500">{helper}</div></div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 lg:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, placa ou pedido..." className="w-full bg-transparent text-xs outline-none" /></label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="all">Todos os status</option><option value="available">Disponíveis</option><option value="delivering">Em rota</option><option value="queue">Na fila</option><option value="returning">Voltando</option><option value="offline">Offline</option><option value="paused">Pausado</option></select>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="all">Todas as lojas</option>{stores.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"><option value="name">Nome (A-Z)</option><option value="status">Status</option><option value="earnings">Maior ganho</option></select>
      </div>

      <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_330px]' : 'grid-cols-1'}`}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500"><tr><th className="w-[20%] px-4 py-3">Entregador</th><th className="w-[14%] px-3 py-3">Veículo / Placa</th><th className="w-[14%] px-3 py-3">Status</th><th className="w-[7%] px-3 py-3">Fila</th><th className="w-[25%] px-3 py-3">Corrida atual / Último pedido</th><th className="w-[12%] px-3 py-3">Ganho do dia</th><th className="w-[8%] px-3 py-3 text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const s = viewStatus(m); const data = byDriver.get(m.id); const last = data?.active[0] || data?.last; const qi = queue.findIndex((x) => x.id === m.id);
                  return <tr key={m.id} onClick={() => setSelectedId(m.id)} className={`cursor-pointer ${selectedId === m.id ? 'bg-violet-50/70' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-[11px] font-black text-violet-700">{initials(m.name)}</span><div><div className="text-xs font-black text-slate-900">{m.name}</div><div className="text-[10px] text-slate-500">{driverStore(m)}</div></div></div></td>
                    <td className="px-3 py-3"><div className="text-xs font-bold text-slate-700">{m.vehicleModel || m.model || 'Moto'}</div><div className="text-[10px] text-slate-500">{m.plate || 'Sem placa'}</div></td>
                    <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black ${s.cls}`}><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span></td>
                    <td className="px-3 py-3 text-xs font-black">{qi >= 0 ? qi + 1 : '—'}</td>
                    <td className="px-3 py-3">{last ? <><div className="text-xs font-black">{last.displayCode || `#${last.codeNumber}`}</div><div className="truncate text-[10px] text-slate-500">{last.address || last.neighborhood || last.clientName}</div></> : <span className="text-xs text-slate-400">Aguardando pedido</span>}</td>
                    <td className="px-3 py-3 text-xs font-black text-violet-700">{money(m.totalEarnedToday)}</td>
                    <td className="px-3 py-3"><div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>{m.phone && <a href={`tel:${m.phone.replace(/\D/g, '')}`} className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"><Phone className="h-4 w-4" /></a>}<button onClick={() => whatsapp(m)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" /></button><button onClick={() => openMap(m)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><MapPin className="h-4 w-4" /></button><button onClick={() => setSelectedId(m.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><span className="text-[11px] text-slate-500">Mostrando {filtered.length ? (currentPage - 1) * 10 + 1 : 0} a {Math.min(currentPage * 10, filtered.length)} de {filtered.length} entregadores</span><div className="flex gap-1.5"><button disabled={currentPage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-violet-600 px-2 text-xs font-black text-white">{currentPage}</span><button disabled={currentPage >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div></div>
        </div>

        {selected && selectedStatus && <aside className="sticky top-4 self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-sm font-black text-violet-700">{initials(selected.name)}</span><div><div className="flex items-center gap-2"><h4 className="text-base font-black">{selected.name}</h4><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black ${selectedStatus.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedStatus.dot}`} />{selectedStatus.label}</span></div><p className="mt-1 text-xs text-slate-500">{selected.vehicleModel || selected.model || 'Moto'} · {selected.plate || 'Sem placa'}</p></div></div><button onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{selected.phone ? <a href={`tel:${selected.phone.replace(/\D/g, '')}`} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-black text-violet-700"><Phone className="h-3.5 w-3.5" />Ligar</a> : <button disabled className="h-9 rounded-lg border border-slate-200 px-2 text-[10px] text-slate-400">Ligar</button>}<button onClick={() => whatsapp(selected)} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-black text-emerald-700"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button><button onClick={() => openMap(selected)} className="flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-black"><MapPin className="h-3.5 w-3.5" />Ver no mapa</button></div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => callCounter(selected)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-black text-violet-700 hover:bg-violet-100"><Zap className="h-3.5 w-3.5" />Chamar balcão</button>
              {selected.status === 'returning_to_store' && onConfirmArrivalAtStore && <button onClick={() => { onConfirmArrivalAtStore(selected.id); notify(`Chegada de ${selected.name.split(' ')[0]} confirmada.`); }} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" />Confirmar chegada</button>}
            </div>
          </div>

          <div className="border-b border-slate-200 p-4 text-xs"><h5 className="mb-3 font-black">Informações</h5><div className="grid grid-cols-[1fr_auto] gap-y-3 text-slate-500"><span>Usuário no app</span><strong className="text-slate-800">{selected.username || selected.name.toLowerCase().split(' ')[0]}</strong><span>Senha</span><strong className="flex items-center gap-1 text-slate-800">{showPassword ? (selected.password || 'Protegida') : '••••••'}<button onClick={() => setShowPassword((v) => !v)} className="text-violet-600"><Eye className="h-3.5 w-3.5" /></button></strong><span>Veículo</span><strong className="text-slate-800">{selected.vehicleModel || selected.model || 'Moto'}</strong><span>Placa</span><strong className="text-slate-800">{selected.plate || '—'}</strong><span>Loja</span><strong className="max-w-[150px] truncate text-slate-800">{driverStore(selected)}</strong></div>{onResetMotoboyPassword && <button onClick={() => onResetMotoboyPassword(selected.id)} className="mt-3 h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[10px] font-black text-slate-600">Gerar nova senha</button>}</div>
          <div className="border-b border-slate-200 p-4 text-xs"><h5 className="mb-3 font-black">Desempenho hoje</h5><div className="grid grid-cols-[1fr_auto] gap-y-3 text-slate-500"><span>Entregas realizadas</span><strong className="text-slate-800">{selected.deliveriesCountToday || 0}</strong><span>Ganho do dia</span><strong className="text-slate-800">{money(selected.totalEarnedToday)}</strong><span>Pedidos ativos</span><strong className="text-slate-800">{selectedData?.active.length || 0}</strong><span>Última atividade</span><strong className="text-slate-800">{ago(selected.locationUpdatedAt || selected.callingToCounterAt || selected.joinedQueueAt)}</strong></div></div>
          {onDeleteMotoboy && <div className="p-4"><button onClick={() => { if (window.confirm(`Remover ${selected.name} da equipe?`)) { onDeleteMotoboy(selected.id); setSelectedId(null); } }} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-600"><Trash2 className="h-3.5 w-3.5" />Remover da equipe</button></div>}
        </aside>}
      </div>
    </section>, host
  );
};
