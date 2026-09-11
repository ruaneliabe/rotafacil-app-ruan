import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log(`[parallel-safety] ${path}: updated`);
  } else {
    console.log(`[parallel-safety] ${path}: no-op`);
  }
  return after;
};

patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  // Cardápio Web já despachado = somente leitura no Rota Fácil, a menos que o Rota Fácil já tivesse assumido antes.
  if (!s.includes('const isCardapioWebReadOnly =')) {
    s = s.replace(
      "const isRoute = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);",
      `const isRoute = (order: Order) => ['picked_up', 'in_transit', 'dispatched'].includes(order.status);\nconst isCardapioWebReadOnly = (order: Order) => {\n  const anyOrder = order as any;\n  if (anyOrder.originChannel !== 'cardapio_web') return false;\n  const rotaFacilOwns = Boolean(anyOrder.rotaFacilMotoboyId || anyOrder.assignmentSource === 'rota_facil' || anyOrder.dispatchSource === 'rota_facil');\n  if (rotaFacilOwns) return false;\n  const cwStatus = String(anyOrder.cardapioWebStatus || '').trim().toLowerCase();\n  return Boolean(anyOrder.cardapioWebDispatchDetected || anyOrder.dispatchSource === 'cardapio_web' || ['released', 'dispatched', 'saiu_para_entrega', 'out_for_delivery'].includes(cwStatus));\n};`
    );
  }

  // F5: restaura rota antes do primeiro render e usa backup não-vazio para sobreviver a qualquer gravação vazia acidental.
  const oldLazy = `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const primary = window.localStorage.getItem(STORAGE_KEY);\n      const backup = window.localStorage.getItem(STORAGE_KEY + '_backup');\n      const raw = primary || backup;\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });`;
  const robustLazy = `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const parse = (raw: string | null) => { if (!raw) return [] as PreparedRoute[]; const value = JSON.parse(raw); return Array.isArray(value) ? value : []; };\n      const primary = parse(window.localStorage.getItem(STORAGE_KEY));\n      const backup = parse(window.localStorage.getItem(STORAGE_KEY + '_backup'));\n      return primary.length ? primary : backup;\n    } catch {\n      return [];\n    }\n  });`;
  if (s.includes(oldLazy)) s = s.replace(oldLazy, robustLazy);

  const oldWriter = `  useEffect(() => {\n    try {\n      const serialized = JSON.stringify(preparedRoutes);\n      window.localStorage.setItem(STORAGE_KEY, serialized);\n      window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n    } catch {}\n  }, [preparedRoutes]);`;
  const robustWriter = `  useEffect(() => {\n    try {\n      const serialized = JSON.stringify(preparedRoutes);\n      window.localStorage.setItem(STORAGE_KEY, serialized);\n      if (preparedRoutes.length > 0) window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n    } catch {}\n  }, [preparedRoutes]);`;
  s = s.replace(oldWriter, robustWriter);

  // Ao excluir manualmente a última rota, limpa também o backup para não ressuscitar rota removida de propósito.
  s = s.replace(
    "  const removeRoute = (id: string) => setPreparedRoutes((current) => current.filter((route) => route.id !== id));",
    `  const removeRoute = (id: string) => setPreparedRoutes((current) => {\n    const next = current.filter((route) => route.id !== id);\n    if (!next.length && typeof window !== 'undefined') { try { window.localStorage.removeItem(STORAGE_KEY + '_backup'); } catch {} }\n    return next;\n  });`
  );

  // Rotas do Cardápio Web já despachadas não podem entrar em pedidos soltos / rota montada local.
  s = s.replace(
    ".filter((order) => !order.assignedMotoboyId && !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))",
    ".filter((order) => !isCardapioWebReadOnly(order) && !order.assignedMotoboyId && !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))"
  );
  s = s.replace(
    ".filter((order) => !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))",
    ".filter((order) => !isCardapioWebReadOnly(order) && !preparedIds.has(order.id) && !isRoute(order) && !['delivered', 'cancelled'].includes(order.status))"
  );
  s = s.replace(
    ".filter((route) => route.orders.length > 0 && route.orders.every((order) => !order.assignedMotoboyId)), [preparedRoutes, activeById]);",
    ".filter((route) => route.orders.length > 0 && route.orders.every((order) => !order.assignedMotoboyId && !isCardapioWebReadOnly(order))), [preparedRoutes, activeById]);"
  );
  s = s.replace(
    "const orderIds = suggestion.orderIds.filter((id) => !preparedIds.has(id));",
    "const orderIds = suggestion.orderIds.filter((id) => { const order = activeById.get(id); return !preparedIds.has(id) && Boolean(order) && !isCardapioWebReadOnly(order!); });"
  );

  // Visão Em entrega deve considerar despacho do Cardápio Web mesmo sem motoboy cadastrado no Rota Fácil.
  if (!s.includes('const deliveryVisibleOrders = useMemo')) {
    const routeDecl = /  const routeOrders = useMemo\([^\n]+\n?/;
    const match = s.match(routeDecl);
    if (match) {
      const helper = `  const deliveryVisibleOrders = useMemo(() => activeOrders.filter((order) => {\n    const anyOrder = order as any;\n    return !['delivered', 'cancelled'].includes(order.status) && (isRoute(order) || Boolean(anyOrder.cardapioWebDispatchDetected) || anyOrder.dispatchSource === 'cardapio_web');\n  }).sort((a, b) => stamp(a) - stamp(b)), [activeOrders]);\n`;
      s = s.replace(match[0], match[0] + helper);
    }
  }

  // Troca somente a visão secundária Em entrega para a fonte completa.
  const secondaryStart = s.indexOf('data-in-transit-secondary="true"');
  const gridStart = secondaryStart >= 0 ? s.indexOf('<div className="grid min-w-0', secondaryStart) : -1;
  if (secondaryStart >= 0 && gridStart > secondaryStart) {
    const before = s.slice(0, secondaryStart);
    let block = s.slice(secondaryStart, gridStart).replaceAll('routeOrders', 'deliveryVisibleOrders');
    // No card simples de Em entrega, mostra explicitamente quem está levando e a origem.
    block = block.replace(
      '<p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p></div><span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span>',
      `<p className="mt-1 text-[10px] font-semibold text-slate-600">{order.clientName}</p><p className="mt-1 text-[9px] font-bold text-slate-500">Motoboy: {(order as any).rotaFacilMotoboyName || order.assignedMotoboyName || (order as any).cardapioWebMotoboyName || (order as any).externalMotoboyName || 'Não informado'}</p></div><div className="flex flex-col items-end gap-1"><span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-black text-sky-700">Em rota</span><span className={\`rounded-full px-2 py-0.5 text-[7px] font-black \${(order as any).assignmentSource === 'rota_facil' || (order as any).dispatchSource === 'rota_facil' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}\`}>{(order as any).assignmentSource === 'rota_facil' || (order as any).dispatchSource === 'rota_facil' ? 'ROTA FÁCIL' : 'CARDÁPIO WEB'}</span></div>`
    );
    s = before + block + s.slice(gridStart);
  }

  // A seção detalhada criada pelo patch de origem também deve usar todos os despachos visíveis.
  const detailsStart = s.indexOf('data-delivery-owner-details="predispatch"');
  const detailsEnd = detailsStart >= 0 ? s.indexOf('<aside className=', detailsStart) : -1;
  if (detailsStart >= 0 && detailsEnd > detailsStart) {
    const before = s.slice(0, detailsStart);
    const block = s.slice(detailsStart, detailsEnd).replaceAll('routeOrders', 'deliveryVisibleOrders');
    s = before + block + s.slice(detailsEnd);
  }

  return s;
});

patch('src/App.tsx', (input) => {
  let s = input;
  if (!s.includes('const isCardapioWebParallelReadOnly =')) {
    s = s.replace('export default function App() {', `const isCardapioWebParallelReadOnly = (order: any) => {\n  if (!order || order.originChannel !== 'cardapio_web') return false;\n  const rotaFacilOwns = Boolean(order.rotaFacilMotoboyId || order.assignmentSource === 'rota_facil' || order.dispatchSource === 'rota_facil');\n  if (rotaFacilOwns) return false;\n  const cwStatus = String(order.cardapioWebStatus || '').trim().toLowerCase();\n  return Boolean(order.cardapioWebDispatchDetected || order.dispatchSource === 'cardapio_web' || ['released', 'dispatched', 'saiu_para_entrega', 'out_for_delivery'].includes(cwStatus));\n};\n\nexport default function App() {`);
  }

  s = s.replace(
    `    const target = orders.find((o) => o.id === orderId);\n    if (!target) return;`,
    `    const target = orders.find((o) => o.id === orderId);\n    if (!target) return;\n    if (isCardapioWebParallelReadOnly(target)) { showToast('Pedido já despachado pelo Cardápio Web: somente leitura no Rota Fácil durante o teste paralelo.'); return; }`
  );

  s = s.replace(
    `    const targetOrder = orders.find((o) => o.id === orderId);\n    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);\n    if (!targetOrder || !targetMotoboy) return;`,
    `    const targetOrder = orders.find((o) => o.id === orderId);\n    const targetMotoboy = motoboys.find((m) => m.id === motoboyId);\n    if (!targetOrder || !targetMotoboy) return;\n    if (isCardapioWebParallelReadOnly(targetOrder)) { showToast('Esse pedido já foi despachado pelo Cardápio Web e está bloqueado para alteração no Rota Fácil.'); return; }`
  );

  s = s.replace(
    `    const safeOrderIds = orderIds.filter((id) => {\n      const order = orders.find((o) => o.id === id);\n      if (!order) return false;`,
    `    const safeOrderIds = orderIds.filter((id) => {\n      const order = orders.find((o) => o.id === id);\n      if (!order || isCardapioWebParallelReadOnly(order)) return false;`
  );

  return s;
});

// F5: o wrapper só monta o dashboard legado depois de ~420ms. O restore antigo rodava em 120ms,
// quando os botões ainda nem existiam, então o React permanecia em Financeiro. Agora salvamos a aba
// real no clique e restauramos depois da hidratação com algumas tentativas seguras.
patch('src/components/DashboardUiBehaviorFixes.tsx', (input) => {
  let s = input;
  if (!s.includes("const RUNTIME_TAB_KEY = 'rotafacil_dashboard_runtime_tab_v1';")) {
    s = s.replace(
      "import React, { useEffect } from 'react';",
      "import React, { useEffect } from 'react';\n\nconst RUNTIME_TAB_KEY = 'rotafacil_dashboard_runtime_tab_v1';"
    );
  }

  if (!s.includes('const restoreRuntimeTab = () =>')) {
    s = s.replace(
      `const openPedidosTab = () => {\n  const pedidosButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>\n    (button.textContent?.trim() || '').includes('Pedidos e despacho')\n  );\n\n  if (pedidosButton) pedidosButton.click();\n};`,
      `const openPedidosTab = () => {\n  const pedidosButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>\n    (button.textContent?.trim() || '').includes('Pedidos e despacho')\n  );\n  if (pedidosButton) pedidosButton.click();\n};\n\nconst restoreRuntimeTab = () => {\n  let saved = 'operacao';\n  try { saved = window.localStorage.getItem(RUNTIME_TAB_KEY) || 'operacao'; } catch {}\n  const matches = (label: string) => {\n    if (saved === 'operacao') return label.includes('Pedidos e despacho');\n    if (saved === 'kanban') return label === 'Kanban';\n    if (saved === 'equipe') return label.startsWith('Entregadores');\n    if (saved === 'financeiro') return label === 'Financeiro';\n    if (saved === 'gestao') return label.includes('Gestão e fechamento');\n    return label.includes('Pedidos e despacho');\n  };\n  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => matches(candidate.textContent?.trim() || ''));\n  if (!button) return false;\n  button.click();\n  return true;\n};`
    );
  }

  s = s.replace(
    `      const label = button.textContent?.trim() || '';\n      const enhancedModal = button.closest('[data-operation-enhanced-modal="true"]');`,
    `      const label = button.textContent?.trim() || '';\n      const enhancedModal = button.closest('[data-operation-enhanced-modal="true"]');\n\n      try {\n        if (label.includes('Pedidos e despacho')) window.localStorage.setItem(RUNTIME_TAB_KEY, 'operacao');\n        else if (label === 'Kanban') window.localStorage.setItem(RUNTIME_TAB_KEY, 'kanban');\n        else if (label.startsWith('Entregadores')) window.localStorage.setItem(RUNTIME_TAB_KEY, 'equipe');\n        else if (label === 'Financeiro') window.localStorage.setItem(RUNTIME_TAB_KEY, 'financeiro');\n        else if (label.includes('Gestão e fechamento')) window.localStorage.setItem(RUNTIME_TAB_KEY, 'gestao');\n      } catch {}`
  );

  s = s.replace(
    `    // F5/reload deve sempre voltar para a operação principal, nunca para Financeiro.\n    const initialTabTimer = window.setTimeout(() => {\n      openPedidosTab();\n      sync();\n    }, 120);`,
    `    // Espera o StoreDashboard terminar a hidratação antes de restaurar a aba.\n    const restoreTimers = [560, 900, 1400].map((delay) => window.setTimeout(() => {\n      restoreRuntimeTab();\n      sync();\n    }, delay));`
  );

  s = s.replace(
    `      window.clearTimeout(initialTabTimer);`,
    `      restoreTimers.forEach((timer) => window.clearTimeout(timer));`
  );

  return s;
});

console.log('[parallel-safety] F5 tab restore + Cardápio Web read-only + courier visibility locked');
