import React, { useEffect, useMemo, useState } from 'react';
import { Bike, CheckCircle2, Clock3, MapPin, PackageOpen, Play, Plus, Route, Sparkles, X, Zap } from 'lucide-react';
import { Motoboy, Order } from '../types';

type RouteSuggestion = {
  id: string;
  orderIds: string[];
  orders: Order[];
  corridorName: string;
  confidenceScore: number;
};

type PreparedRoute = {
  id: string;
  orderIds: string[];
  corridorName: string;
  confidenceScore: number;
  createdAt: number;
};

interface Props {
  suggestions: RouteSuggestion[];
  activeOrders: Order[];
  queueDrivers: Motoboy[];
  onSelectOrders: (ids: string[]) => void;
  onCallNextDriver?: (motoboyId: string, motoboyName: string) => void;
  triggerActionToast: (message: string) => void;
}

const STORAGE_KEY = 'rotafacil_prepared_routes_preview_v2';
const code = (order: Order) => order.displayCode || `#${order.codeNumber}`;
const stamp = (order: Order) => Number(order.createdTimestamp) || Date.now();
const minsSince = (value?: number) => Math.max(0, Math.floor((Date.now() - (Number(value) || Date.now())) / 60000));
const isReady = (order: Order) => order.status === 'ready_at_counter';
const isRoute = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);
const confidenceLabel = (score: number) => score >= 95 ? 'Excelente combinação' : score >= 80 ? 'Boa combinação' : 'Combinação razoável';

export const PredispatchRoutesPanel: React.FC<Props> = ({
  suggestions,
  activeOrders,
  queueDrivers,
  onSelectOrders,
  onCallNextDriver,
  triggerActionToast,
}) => {
  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);
  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPreparedRoutes(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}
  }, [preparedRoutes]);

  const activeById = useMemo(() => new Map(activeOrders.map((order) => [order.id, order])), [activeOrders]);
  const prepared = useMemo(() => preparedRoutes
    .map((route) => ({ ...route, orders: route.orderIds.map((id) => activeById.get(id)).filter(Boolean) as Order[] }))
    .filter((route) => route.orders.length > 0), [preparedRoutes, activeById]);

  const preparedIds = useMemo(() => new Set(prepared.flatMap((route) => route.orderIds)), [prepared]);
  const looseOrders = useMemo(() => activeOrders
    .filter((order) => !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))
    .sort((a, b) => stamp(a) - stamp(b)), [activeOrders, preparedIds]);
  const routeOrders = useMemo(() => activeOrders.filter(isRoute).sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);
  const visibleSuggestions = suggestions.filter((suggestion) => suggestion.orderIds.filter((id) => !preparedIds.has(id)).length >= 2);
  const nextDriver = queueDrivers[0];
  const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every(isReady));
  const nextRoute = readyPrepared[0];
  const oldestLoose = looseOrders[0] ? minsSince(stamp(looseOrders[0])) : 0;

  useEffect(() => {
    const valid = new Set(looseOrders.map((order) => order.id));
    setSelectedLoose((current) => current.filter((id) => valid.has(id)));
  }, [looseOrders]);

  const prepareRoute = (suggestion: RouteSuggestion) => {
    const orderIds = suggestion.orderIds.filter((id) => !preparedIds.has(id));
    if (orderIds.length < 2) return;
    setPreparedRoutes((current) => [...current, {
      id: `prepared_${Date.now()}_${suggestion.id}`,
      orderIds,
      corridorName: suggestion.corridorName,
      confidenceScore: suggestion.confidenceScore,
      createdAt: Date.now(),
    }]);
    setSelectedLoose([]);
    triggerActionToast(`Rota montada com ${orderIds.length} pedidos.`);
  };

  const toggleLoose = (id: string) => {
    setSelectedLoose((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const createManualRoute = () => {
    if (!selectedLoose.length) {
      triggerActionToast('Selecione pelo menos um pedido para montar a rota.');
      return;
    }
    const orders = selectedLoose.map((id) => activeById.get(id)).filter(Boolean) as Order[];
    if (!orders.length) return;
    const neighborhoods = Array.from(new Set(orders.map((order) => order.neighborhood).filter(Boolean) as string[]));
    const corridorName = neighborhoods.length
      ? neighborhoods.slice(0, 2).join(' / ')
      : orders.map((order) => code(order)).slice(0, 2).join(' + ');
    setPreparedRoutes((current) => [...current, {
      id: `manual_${Date.now()}`,
      orderIds: orders.map((order) => order.id),
      corridorName,
      confidenceScore: 80,
      createdAt: Date.now(),
    }]);
    triggerActionToast(`Rota montada manualmente com ${orders.length} pedido${orders.length === 1 ? '' : 's'}.`);
    setSelectedLoose([]);
  };

  const removeRoute = (id: string) => setPreparedRoutes((current) => current.filter((route) => route.id !== id));

  return (
    <section className="space-y-3">
      {(looseOrders.length > 0 || prepared.length > 0) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Zap className="h-4 w-4" /></span>
            <div>
              <div className="text-xs font-black text-slate-900">Pico de pedidos: <span className="text-amber-700">{looseOrders.length} soltos</span> • {prepared.length} rotas montadas • {queueDrivers.length} motoboy{queueDrivers.length === 1 ? '' : 's'} livre{queueDrivers.length === 1 ? '' : 's'}</div>
              <p className="mt-0.5 text-[10px] text-slate-500">Monte as cargas com antecedência e libere conforme cozinha e fila de motoboys.</p>
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-500">Mais antigo há <span className={oldestLoose >= 20 ? 'text-rose-600' : 'text-slate-800'}>{oldestLoose} min</span></div>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1.25fr_1.05fr_.78fr]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
            <div><h3 className="text-sm font-black text-slate-900">Pedidos soltos</h3><p className="text-[10px] text-slate-400">Clique nos pedidos para montar uma rota</p></div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{looseOrders.length}</span>
              <button type="button" onClick={createManualRoute} disabled={!selectedLoose.length} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"><Plus className="h-3 w-3" />{selectedLoose.length ? `Montar rota (${selectedLoose.length})` : 'Nova rota'}</button>
            </div>
          </div>
          {selectedLoose.length > 0 && <div className="border-b border-violet-100 bg-violet-50/50 px-3 py-2 text-[9px] font-bold text-violet-700">{selectedLoose.length} pedido{selectedLoose.length === 1 ? '' : 's'} selecionado{selectedLoose.length === 1 ? '' : 's'} • clique em “Montar rota”</div>}
          <div className="max-h-[760px] min-h-[620px] space-y-2 overflow-y-auto p-2.5">
            {looseOrders.length ? looseOrders.map((order) => {
              const wait = minsSince(stamp(order));
              const selected = selectedLoose.includes(order.id);
              return <button type="button" key={order.id} onClick={() => toggleLoose(order.id)} className={`w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-violet-500 ring-2 ring-violet-500/15' : wait >= 20 ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-1.5"><span className={`grid h-4 w-4 place-items-center rounded border ${selected ? 'border-violet-600 bg-violet-600' : 'border-slate-300'}`}>{selected && <CheckCircle2 className="h-3 w-3 text-white" />}</span><b className="text-xs text-slate-950">{code(order)}</b>{wait >= 20 && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[8px] font-black text-rose-600">ATENÇÃO</span>}</div><p className="mt-1 text-[11px] font-semibold text-slate-700">{order.clientName}</p></div><span className={`text-[9px] font-black ${wait >= 20 ? 'text-rose-600' : 'text-slate-400'}`}>Há {wait} min</span></div>
                <p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{order.address}</p>
                <div className="mt-2 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[8px] font-black ${isReady(order) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{isReady(order) ? 'Pronto' : 'Preparando'}</span>{selected && <span className="text-[8px] font-black text-violet-600">SELECIONADO</span>}</div>
              </button>;
            }) : <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><PackageOpen className="h-6 w-6 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-600">Nenhum pedido solto</p></div>}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Route className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-slate-900">Rotas montadas</h3><p className="text-[10px] text-slate-400">Cargas penduradas aguardando liberação</p></div></div><span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">{prepared.length}</span></div>
          <div className="max-h-[760px] min-h-[620px] space-y-2 overflow-y-auto p-2.5">
            {prepared.map((route, index) => {
              const ready = route.orders.filter(isReady).length;
              const allReady = ready === route.orders.length && ready > 0;
              const oldest = route.orders.reduce((min, order) => Math.min(min, stamp(order)), Date.now());
              return <article key={route.id} className={`rounded-xl border p-3 ${allReady ? 'border-emerald-300 bg-emerald-50/40' : 'border-violet-200 bg-violet-50/25'}`}>
                <div className="flex items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-1.5"><b className="text-xs text-slate-950">Rota {String(index + 1).padStart(2, '0')} · {route.corridorName}</b>{allReady ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[8px] font-black text-white">PRONTA PARA SAIR</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-black text-amber-700">Aguardando cozinha</span>}</div><p className="mt-1 text-[9px] text-slate-400">{confidenceLabel(route.confidenceScore)} · mais antigo há {minsSince(oldest)} min</p></div><button onClick={() => removeRoute(route.id)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white"><X className="h-3.5 w-3.5" /></button></div>
                <div className="mt-3 space-y-1.5">{route.orders.map((order) => <div key={order.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[9px]"><b className="text-slate-800">{code(order)}</b><span className="min-w-0 flex-1 truncate text-slate-500">{order.clientName}</span><span className={`rounded-full px-1.5 py-0.5 font-black ${isReady(order) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{isReady(order) ? 'Pronto' : 'Preparando'}</span></div>)}</div>
                <div className="mt-3 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${route.orders.length ? Math.round((ready / route.orders.length) * 100) : 0}%` }} /></div><span className="text-[9px] font-black text-slate-600">{ready}/{route.orders.length} prontos</span></div>
                <div className="mt-3 flex gap-2"><button onClick={() => onSelectOrders(route.orderIds)} className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-[9px] font-black text-slate-700">Ver pedidos</button>{allReady && <button disabled={!nextDriver} onClick={() => { if (!nextDriver) return; onSelectOrders(route.orderIds); onCallNextDriver?.(nextDriver.id, nextDriver.name); triggerActionToast(`${nextDriver.name.split(' ')[0]} chamado para a rota ${String(index + 1).padStart(2, '0')}.`); }} className="h-8 flex-1 rounded-lg bg-violet-600 px-2 text-[9px] font-black text-white disabled:bg-slate-300"><Play className="mr-1 inline h-3 w-3" />{nextDriver ? `Chamar ${nextDriver.name.split(' ')[0]}` : 'Aguardando motoboy'}</button>}</div>
              </article>;
            })}
            {visibleSuggestions.slice(0, 3).map((suggestion) => <article key={suggestion.id} className="rounded-xl border border-dashed border-violet-200 bg-violet-50/20 p-3"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-1.5 text-[10px] font-black text-violet-700"><Sparkles className="h-3 w-3" />Sugestão de rota</div><p className="mt-1 text-[10px] font-bold text-slate-800">{suggestion.orders.map(code).join(' + ')}</p><p className="mt-1 text-[9px] text-slate-400">{suggestion.corridorName} · {confidenceLabel(suggestion.confidenceScore)}</p></div><button onClick={() => prepareRoute(suggestion)} className="h-8 rounded-lg bg-violet-600 px-2.5 text-[9px] font-black text-white">Montar rota</button></div></article>)}
            {!prepared.length && !visibleSuggestions.length && <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><Route className="h-6 w-6 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-600">Nenhuma rota montada</p><p className="mt-1 text-[9px] text-slate-400">Selecione pedidos na coluna ao lado e clique em “Nova rota”.</p></div>}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-50 text-sky-600"><Bike className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-slate-900">Em entrega</h3><p className="text-[10px] text-slate-400">Rotas retiradas pelos motoboys</p></div></div><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">{routeOrders.length}</span></div><div className="max-h-[760px] min-h-[620px] space-y-2 overflow-y-auto p-2.5">{routeOrders.length ? routeOrders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between"><div><b className="text-xs text-slate-900">{code(order)}</b><p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p></div><span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span></div><p className="mt-2 flex gap-1.5 text-[9px] text-slate-500"><MapPin className="h-3 w-3" />{order.neighborhood || order.address}</p></article>) : <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><Bike className="h-6 w-6 text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-600">Nenhuma entrega na rua</p></div>}</div></section>

        <aside className="space-y-3"><section className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Zap className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-slate-900">Próximo a sair</h3><p className="text-[10px] text-slate-400">Chamar o motoboy no balcão</p></div></div>{nextRoute ? <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/35 p-3"><div className="text-[10px] font-black text-violet-700">ROTA PRONTA</div><div className="mt-1 text-sm font-black text-slate-950">{nextRoute.corridorName}</div><div className="mt-3 space-y-1">{nextRoute.orders.map((order) => <div key={order.id} className="flex items-center gap-2 text-[9px]"><CheckCircle2 className="h-3 w-3 text-emerald-500" /><b>{code(order)}</b><span className="truncate text-slate-500">{order.clientName}</span></div>)}</div><div className="mt-3 rounded-lg bg-white px-2.5 py-2 text-[9px] text-slate-500">{nextDriver ? <><b className="text-slate-900">1º da fila:</b> {nextDriver.name}</> : 'Nenhum motoboy disponível na fila'}</div><button disabled={!nextDriver} onClick={() => { if (!nextDriver) return; onSelectOrders(nextRoute.orderIds); onCallNextDriver?.(nextDriver.id, nextDriver.name); }} className="mt-3 h-9 w-full rounded-lg bg-emerald-600 text-[10px] font-black text-white disabled:bg-slate-300"><Play className="mr-1 inline h-3 w-3" />{nextDriver ? `Chamar ${nextDriver.name.split(' ')[0]} no balcão` : 'Aguardando motoboy'}</button></div> : <div className="mt-3 rounded-xl bg-slate-50 p-4 text-center"><Clock3 className="mx-auto h-5 w-5 text-slate-300" /><p className="mt-2 text-[10px] font-bold text-slate-500">Nenhuma rota 100% pronta ainda</p></div>}</section><section className="rounded-2xl border border-violet-100 bg-violet-50/45 p-3"><div className="text-[10px] font-black text-violet-700">Dica de operação</div><p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">Monte as rotas antes do motoboy voltar. Quando todos os pedidos ficarem prontos, a próxima saída já fica definida.</p></section></aside>
      </div>
    </section>
  );
};
