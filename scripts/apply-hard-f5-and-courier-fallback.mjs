import fs from 'node:fs';

// HARD F5 BRIDGE: persist the actual sidebar tab outside LegacyStoreDashboard state.
// StoreDashboard mounts the legacy dashboard only after cloud hydration, so this bridge
// seeds the legacy key BEFORE that mount and restores again from the rendered sidebar.
const storePath = 'src/components/StoreDashboard.tsx';
let store = fs.readFileSync(storePath, 'utf8');

const marker = 'const DASHBOARD_TAB_BRIDGE_KEY =';
if (!store.includes(marker)) {
  const insertAfter = "import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';\n";
  const helper = `\nconst DASHBOARD_TAB_BRIDGE_KEY = 'rotafacil_dashboard_actual_tab_v8';\nconst LEGACY_TAB_KEY = 'rotafacil_dashboard_active_tab_v7';\ntype DashboardTab = 'operacao' | 'kanban' | 'equipe' | 'financeiro' | 'gestao';\n\nconst dashboardTabFromLabel = (label: string): DashboardTab | null => {\n  const text = label.trim();\n  if (text.includes('Pedidos e despacho')) return 'operacao';\n  if (text === 'Kanban') return 'kanban';\n  if (text.startsWith('Entregadores')) return 'equipe';\n  if (text === 'Financeiro') return 'financeiro';\n  if (text.includes('Gestão e fechamento')) return 'gestao';\n  return null;\n};\n\nconst saveActualDashboardTab = (tab: DashboardTab) => {\n  try {\n    window.localStorage.setItem(DASHBOARD_TAB_BRIDGE_KEY, tab);\n    window.sessionStorage.setItem(DASHBOARD_TAB_BRIDGE_KEY, tab);\n    // Seed the legacy state key too, so the next mount starts on the same screen.\n    window.localStorage.setItem(LEGACY_TAB_KEY, tab);\n  } catch {}\n};\n\nconst readActualDashboardTab = (): DashboardTab => {\n  try {\n    const saved = window.sessionStorage.getItem(DASHBOARD_TAB_BRIDGE_KEY) || window.localStorage.getItem(DASHBOARD_TAB_BRIDGE_KEY);\n    if (saved === 'operacao' || saved === 'kanban' || saved === 'equipe' || saved === 'financeiro' || saved === 'gestao') return saved;\n  } catch {}\n  return 'operacao';\n};\n`;
  if (!store.includes(insertAfter)) throw new Error('[hard-f5] StoreDashboard import anchor missing');
  store = store.replace(insertAfter, insertAfter + helper);
}

const componentAnchor = `  const operationOpen = optimisticOpen ?? cloudOpen;\n`;
if (!store.includes('data-hard-f5-bridge')) {
  const bridge = `\n  // Persist tab clicks independently from the legacy dashboard state.\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    const initial = readActualDashboardTab();\n    saveActualDashboardTab(initial);\n\n    const onClick = (event: MouseEvent) => {\n      const button = (event.target as HTMLElement | null)?.closest('button');\n      if (!button) return;\n      const tab = dashboardTabFromLabel(button.textContent || '');\n      if (tab) saveActualDashboardTab(tab);\n    };\n\n    const onBeforeUnload = () => {\n      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));\n      const active = buttons.find((button) => {\n        const tab = dashboardTabFromLabel(button.textContent || '');\n        if (!tab) return false;\n        const cls = button.className || '';\n        return cls.includes('bg-violet-50') && cls.includes('text-violet-900');\n      });\n      const tab = active ? dashboardTabFromLabel(active.textContent || '') : null;\n      if (tab) saveActualDashboardTab(tab);\n    };\n\n    document.addEventListener('click', onClick, true);\n    window.addEventListener('beforeunload', onBeforeUnload);\n    return () => {\n      document.removeEventListener('click', onClick, true);\n      window.removeEventListener('beforeunload', onBeforeUnload);\n    };\n  }, []);\n\n  // After the real dashboard is mounted, force the saved tab through the real sidebar button.\n  useEffect(() => {\n    if (!cloudHydrated || typeof window === 'undefined') return;\n    const wanted = readActualDashboardTab();\n    saveActualDashboardTab(wanted);\n\n    const restore = () => {\n      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));\n      const target = buttons.find((button) => dashboardTabFromLabel(button.textContent || '') === wanted);\n      if (target) target.click();\n    };\n\n    const timers = [0, 80, 260, 700].map((ms) => window.setTimeout(restore, ms));\n    return () => timers.forEach((id) => window.clearTimeout(id));\n  }, [cloudHydrated]);\n\n  const hardF5Bridge = <span data-hard-f5-bridge=\"true\" className=\"hidden\" />;\n`;
  if (!store.includes(componentAnchor)) throw new Error('[hard-f5] component anchor missing');
  store = store.replace(componentAnchor, componentAnchor + bridge);
  store = store.replace('    <>\n      <LegacyStoreDashboard', '    <>\n      {hardF5Bridge}\n      <LegacyStoreDashboard');
}

if (!store.includes('rotafacil_dashboard_actual_tab_v8') || !store.includes('data-hard-f5-bridge')) {
  throw new Error('[hard-f5] bridge validation failed');
}
fs.writeFileSync(storePath, store);

// CARDAPIO WEB COURIER FALLBACK: if the API exposes only an assigned courier id,
// keep that identifier instead of showing "Não informado". No writes are sent to CW.
const syncPath = 'api/sync-cardapio-web.ts';
let sync = fs.readFileSync(syncPath, 'utf8');
if (!sync.includes('function courierId(order: any)')) {
  const anchor = 'const hasRotaFacilOwnership';
  const idx = sync.indexOf(anchor);
  if (idx < 0) throw new Error('[courier-fallback] sync anchor missing');
  const helper = `function courierId(order: any): string | null {\n  const direct = [\n    order?.deliveryman_id, order?.delivery_man_id, order?.courier_id, order?.driver_id, order?.motoboy_id, order?.entregador_id,\n    order?.delivery_person_id, order?.delivery_driver_id, order?.rider_id, order?.delivery_agent_id,\n    order?.delivery?.deliveryman_id, order?.delivery?.courier_id, order?.delivery?.driver_id, order?.delivery?.motoboy_id, order?.delivery?.entregador_id,\n    order?.route?.deliveryman_id, order?.route?.driver_id, order?.route?.courier_id, order?.delivery_route?.deliveryman_id, order?.delivery_route?.driver_id\n  ];\n  for (const value of direct) {\n    if (value != null && String(value).trim()) return String(value).trim();\n  }\n  const seen = new Set<any>();\n  const walk = (node: any, depth: number): string | null => {\n    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return null;\n    seen.add(node);\n    for (const [key, value] of Object.entries(node)) {\n      const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');\n      if (/(deliveryman|deliveryperson|deliverydriver|courier|driver|motoboy|entregador|rider|deliveryagent).*(id|uuid)$/.test(k)) {\n        if (value != null && String(value).trim()) return String(value).trim();\n      }\n    }\n    for (const value of Object.values(node)) {\n      if (value && typeof value === 'object') {\n        const found = walk(value, depth + 1);\n        if (found) return found;\n      }\n    }\n    return null;\n  };\n  return walk(order, 0);\n}\n\n`;
  sync = sync.slice(0, idx) + helper + sync.slice(idx);
}

sync = sync.replace(
  'const externalDriver = courierName(cwOrder);',
  `const externalDriver = courierName(cwOrder);\n      const externalDriverId = courierId(cwOrder);`
);

sync = sync.replace(
  `if (externalDriver) {\n        patch.externalMotoboyName = externalDriver;\n        patch.cardapioWebMotoboyName = externalDriver;\n        courierReconciledCount++;\n      }`,
  `if (externalDriver) {\n        patch.externalMotoboyName = externalDriver;\n        patch.cardapioWebMotoboyName = externalDriver;\n        courierReconciledCount++;\n      }\n      if (externalDriverId) {\n        patch.cardapioWebMotoboyId = externalDriverId;\n        patch.externalMotoboyId = externalDriverId;\n      }`
);

if (!sync.includes('cardapioWebMotoboyId')) throw new Error('[courier-fallback] courier id persistence missing');
fs.writeFileSync(syncPath, sync);

const panelPath = 'src/components/PredispatchRoutesPanel.tsx';
let panel = fs.readFileSync(panelPath, 'utf8');
panel = panel.replaceAll(
  `(order as any).externalMotoboyName || 'Não informado'`,
  `(order as any).externalMotoboyName || ((order as any).cardapioWebMotoboyId ? \`Entregador CW #\${(order as any).cardapioWebMotoboyId}\` : 'Não informado')`
);
fs.writeFileSync(panelPath, panel);

// Final safety checks: tab bridge + mounted-route hydration + CW read-only courier metadata.
const routes = fs.readFileSync('src/components/PredispatchRoutesPanel.tsx', 'utf8');
if (!routes.includes('useState<PreparedRoute[]>(() =>')) throw new Error('[hard-f5] prepared routes are not lazily hydrated');
if (!routes.includes("STORAGE_KEY + '_backup'")) throw new Error('[hard-f5] prepared route backup missing');
if (!store.includes('beforeunload') || !store.includes('cloudHydrated')) throw new Error('[hard-f5] runtime bridge incomplete');
if (!sync.includes('cardapioWebMotoboyId')) throw new Error('[courier-fallback] CW courier id fallback missing');

console.log('[hard-f5] actual sidebar tab restore + route persistence + CW courier fallback validated');
