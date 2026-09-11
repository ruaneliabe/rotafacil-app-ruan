import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Route, Sparkles, X } from 'lucide-react';
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

const STORAGE_KEY = 'rotafacil_prepared_routes_preview_v1';

const code = (order: Order) => order.displayCode || `#${order.codeNumber}`;
const orderStamp = (order: Order) => Number(order.createdTimestamp) || Date.now();
const isReady = (order: Order) => order.status === 'ready_at_counter';

const confidenceLabel = (score: number) =>
  score >= 95 ? 'Excelente combinação' : score >= 80 ? 'Boa combinação' : 'Combinação razoável';

export const PredispatchRoutesPanel: React.FC<Props> = ({
  suggestions,
  activeOrders,
  queueDrivers,
  onSelectOrders,
  onCallNextDriver,
  triggerActionToast,
}) => {
  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setPreparedRoutes(parsed);
    } catch {
      // Preview only: ignore invalid browser storage.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes));
    } catch {
      // Preview only: storage is optional.
    }
  }, [preparedRoutes]);

  const activeById = useMemo(() => new Map(activeOrders.map((order) => [order.id, order])), [activeOrders]);

  const prepared = useMemo(
    () => preparedRoutes
      .map((route) => ({
        ...route,
        orders: route.orderIds.map((id) => activeById.get(id)).filter(Boolean) as Order[],
      }))
      .filter((route) => route.orders.length > 0),
    [preparedRoutes, activeById]
  );

  const alreadyPrepared = useMemo(
    () => new Set(prepared.flatMap((route) => route.orderIds)),
    [prepared]
  );

  const visibleSuggestions = suggestions.filter((suggestion) =>
    suggestion.orderIds.some((id) => !alreadyPrepared.has(id))
  );

  const prepareRoute = (suggestion: RouteSuggestion) => {
    const orderIds = suggestion.orderIds.filter((id) => !alreadyPrepared.has(id));
    if (orderIds.length < 2) {
      triggerActionToast('Esses pedidos já estão em uma rota preparada.');
      return;
    }

    const route: PreparedRoute = {
      id: `prepared_${Date.now()}_${suggestion.id}`,
      orderIds,
      corridorName: suggestion.corridorName,
      confidenceScore: suggestion.confidenceScore,
      createdAt: Date.now(),
    };

    setPreparedRoutes((current) => [...current, route]);
    triggerActionToast(`Rota preparada com ${orderIds.length} pedidos.`);
  };

  const removeRoute = (id: string) => {
    setPreparedRoutes((current) => current.filter((route) => route.id !== id));
  };

  const nextDriver = queueDrivers[0];

  if (!visibleSuggestions.length && !prepared.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Route className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-black text-slate-900">Pré-despacho</h3>
            <p className="text-[10px] text-slate-400">Monte as rotas antes do motoboy ficar livre e acompanhe o que falta ficar pronto.</p>
          </div>
        </div>
        {prepared.length > 0 && (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-700">
            {prepared.length} rota{prepared.length === 1 ? '' : 's'} preparada{prepared.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {prepared.length > 0 && (
        <div className="mb-3 grid gap-2 xl:grid-cols-3">
          {prepared.map((route, index) => {
            const readyCount = route.orders.filter(isReady).length;
            const total = route.orders.length;
            const allReady = total > 0 && readyCount === total;
            const oldest = route.orders.reduce((min, order) => Math.min(min, orderStamp(order)), Date.now());
            const oldestMinutes = Math.max(0, Math.floor((Date.now() - oldest) / 60000));
            const missing = route.orders.filter((order) => !isReady(order));

            return (
              <article
                key={route.id}
                className={`rounded-xl border p-3 ${allReady ? 'border-emerald-200 bg-emerald-50/40' : 'border-violet-200 bg-violet-50/30'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-black text-slate-900">Rota #{String(index + 1).padStart(2, '0')}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${allReady ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                        {allReady ? 'PRONTA PARA SAÍDA' : 'AGUARDANDO COZINHA'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{route.corridorName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRoute(route.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                    title="Desfazer rota preparada"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {route.orders.map((order) => (
                    <span
                      key={order.id}
                      className={`rounded-lg border px-2 py-1 text-[9px] font-black ${isReady(order) ? 'border-emerald-200 bg-white text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      {code(order)} {isReady(order) ? '✓' : ''}
                    </span>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white px-2 py-2">
                    <div className="text-[8px] font-bold uppercase text-slate-400">Prontos</div>
                    <div className={`mt-0.5 text-xs font-black ${allReady ? 'text-emerald-700' : 'text-slate-900'}`}>{readyCount}/{total}</div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-2">
                    <div className="text-[8px] font-bold uppercase text-slate-400">Mais antigo</div>
                    <div className={`mt-0.5 text-xs font-black ${oldestMinutes >= 20 ? 'text-rose-600' : 'text-slate-900'}`}>{oldestMinutes} min</div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-2">
                    <div className="text-[8px] font-bold uppercase text-slate-400">Rota</div>
                    <div className="mt-0.5 truncate text-[9px] font-black text-violet-700">{confidenceLabel(route.confidenceScore)}</div>
                  </div>
                </div>

                {!allReady && missing.length > 0 && (
                  <p className="mt-2 text-[9px] text-slate-500">
                    Falta ficar pronto: <b>{missing.map(code).join(', ')}</b>
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectOrders(route.orderIds)}
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-black text-slate-700 hover:bg-slate-50"
                  >
                    Ver pedidos
                  </button>
                  {allReady && (
                    <button
                      type="button"
                      disabled={!nextDriver}
                      onClick={() => {
                        if (!nextDriver) return;
                        onSelectOrders(route.orderIds);
                        onCallNextDriver?.(nextDriver.id, nextDriver.name);
                        triggerActionToast(`${nextDriver.name.split(' ')[0]} é o próximo da fila para esta rota.`);
                      }}
                      className="h-8 flex-1 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {nextDriver ? `Chamar ${nextDriver.name.split(' ')[0]}` : 'Aguardando motoboy'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {visibleSuggestions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            Sugestões para preparar agora
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleSuggestions.map((suggestion) => {
              const readyCount = suggestion.orders.filter(isReady).length;
              return (
                <div key={suggestion.id} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-slate-900">{suggestion.orders.map(code).join(' + ')}</div>
                      <div className="mt-1 truncate text-[9px] text-slate-500">{suggestion.corridorName}</div>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[8px] font-black text-violet-700">
                      {confidenceLabel(suggestion.confidenceScore)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-500">
                      {readyCount === suggestion.orders.length ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock3 className="h-3 w-3 text-amber-500" />}
                      {readyCount}/{suggestion.orders.length} prontos
                    </span>
                    <button
                      type="button"
                      onClick={() => prepareRoute(suggestion)}
                      className="h-7 rounded-lg bg-violet-600 px-2.5 text-[9px] font-black text-white transition hover:bg-violet-500"
                    >
                      Preparar rota
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
