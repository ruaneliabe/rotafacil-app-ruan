import fs from 'node:fs';

const STORE = 'src/components/StoreDashboard.tsx';
const ENHANCER = 'src/components/OperationManagementEnhancer.tsx';
const ROUTES = 'src/components/PredispatchRoutesPanel.tsx';
const RULES = 'firestore.rules';

// 1) F5: restore the proven external sidebar bridge LAST, after every legacy/dashboard patch.
let store = fs.readFileSync(STORE, 'utf8');
if (!store.includes("const DASHBOARD_TAB_BRIDGE_KEY = 'rotafacil_dashboard_actual_tab_v9';")) {
  const importAnchor = "import { getBrazilDateKey, getBrazilTimeString } from '../utils/dateUtils';\n";
  const helper = `\nconst DASHBOARD_TAB_BRIDGE_KEY = 'rotafacil_dashboard_actual_tab_v9';\nconst LEGACY_TAB_KEY = 'rotafacil_dashboard_active_tab_v7';\ntype DashboardTab = 'operacao' | 'kanban' | 'equipe' | 'financeiro' | 'gestao';\nconst tabFromLabel = (label: string): DashboardTab | null => {\n  const t = label.trim();\n  if (t.includes('Pedidos e despacho')) return 'operacao';\n  if (t === 'Kanban') return 'kanban';\n  if (t.startsWith('Entregadores')) return 'equipe';\n  if (t === 'Financeiro') return 'financeiro';\n  if (t.includes('Gestão e fechamento')) return 'gestao';\n  return null;\n};\nconst saveDashboardTab = (tab: DashboardTab) => { try { localStorage.setItem(DASHBOARD_TAB_BRIDGE_KEY, tab); sessionStorage.setItem(DASHBOARD_TAB_BRIDGE_KEY, tab); localStorage.setItem(LEGACY_TAB_KEY, tab); } catch {} };\nconst readDashboardTab = (): DashboardTab => { try { const v = sessionStorage.getItem(DASHBOARD_TAB_BRIDGE_KEY) || localStorage.getItem(DASHBOARD_TAB_BRIDGE_KEY); if (v === 'operacao' || v === 'kanban' || v === 'equipe' || v === 'financeiro' || v === 'gestao') return v; } catch {} return 'operacao'; };\n`;
  if (!store.includes(importAnchor)) throw new Error('[prod-hardening] StoreDashboard import anchor missing');
  store = store.replace(importAnchor, importAnchor + helper);

  const componentAnchor = "  const operationOpen = optimisticOpen ?? cloudOpen;\n";
  const bridge = `\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    const onClick = (event: MouseEvent) => {\n      const button = (event.target as HTMLElement | null)?.closest('button');\n      if (!button) return;\n      const tab = tabFromLabel(button.textContent || '');\n      if (tab) saveDashboardTab(tab);\n    };\n    const beforeUnload = () => {\n      const active = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => {\n        const tab = tabFromLabel(button.textContent || '');\n        if (!tab) return false;\n        const cls = String(button.className || '');\n        return (cls.includes('bg-violet-50') || cls.includes('bg-violet-100')) && (cls.includes('text-violet') || cls.includes('border-violet'));\n      });\n      const tab = active ? tabFromLabel(active.textContent || '') : null;\n      if (tab) saveDashboardTab(tab);\n    };\n    document.addEventListener('click', onClick, true);\n    window.addEventListener('beforeunload', beforeUnload);\n    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', beforeUnload); };\n  }, []);\n\n  useEffect(() => {\n    if (!cloudHydrated || typeof window === 'undefined') return;\n    const wanted = readDashboardTab();\n    saveDashboardTab(wanted);\n    const restore = () => {\n      const target = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => tabFromLabel(button.textContent || '') === wanted);\n      if (target) target.click();\n    };\n    const timers = [0, 100, 300, 750, 1300].map((ms) => window.setTimeout(restore, ms));\n    return () => timers.forEach(window.clearTimeout);\n  }, [cloudHydrated]);\n`;
  if (!store.includes(componentAnchor)) throw new Error('[prod-hardening] StoreDashboard component anchor missing');
  store = store.replace(componentAnchor, componentAnchor + bridge);
}

// Hide destructive/debug controls in production UI.
store = store.replace("import { TestOrdersControl } from './TestOrdersControl';\n", '');
store = store.replace(/\n\s*<TestOrdersControl[^>]*\/>/g, '');
fs.writeFileSync(STORE, store);

// 2) Novo despacho: close delivery-management overlay first, then open NewOrderModal on next task.
// This prevents the legacy overlay/enhancer observer and the order modal from fighting in the same render tick.
let enhancer = fs.readFileSync(ENHANCER, 'utf8');
if (!enhancer.includes('const openNewDispatchSafely = () =>')) {
  const anchor = "  const notify = (message: string) => {\n";
  const safeOpen = `  const openNewDispatchSafely = () => {\n    close();\n    window.setTimeout(() => onOpenNewOrderModal(), 0);\n  };\n\n`;
  if (!enhancer.includes(anchor)) throw new Error('[prod-hardening] enhancer notify anchor missing');
  enhancer = enhancer.replace(anchor, safeOpen + anchor);
}
enhancer = enhancer.replace('onClick={onOpenNewOrderModal}', 'onClick={openNewDispatchSafely}');
fs.writeFileSync(ENHANCER, enhancer);

// 3) Removing a prepared route must update state + both persistence keys synchronously.
let routes = fs.readFileSync(ROUTES, 'utf8');
const removeRegex = /const removeRoute = \(id: string\) => setPreparedRoutes\(\(current\) => current\.filter\(\(route\) => route\.id !== id\)\);/;
if (removeRegex.test(routes)) {
  routes = routes.replace(removeRegex, `const removeRoute = (id: string) => {\n    setPreparedRoutes((current) => {\n      const next = current.filter((route) => route.id !== id);\n      try {\n        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));\n        window.localStorage.setItem(STORAGE_KEY + '_backup', JSON.stringify(next));\n      } catch {}\n      return next;\n    });\n    triggerActionToast('Rota removida. Pedidos voltaram para pedidos soltos.');\n  };`);
}
if (!routes.includes("STORAGE_KEY + '_backup'")) throw new Error('[prod-hardening] route persistence backup missing after remove fix');
fs.writeFileSync(ROUTES, routes);

// 4) Firestore settlements: the current rules omit this collection entirely.
let rules = fs.readFileSync(RULES, 'utf8');
if (!rules.includes('match /settlements/{settlementId}')) {
  const anchor = '    // Default Deny Catch-all\n';
  const settlementRule = `    match /settlements/{settlementId} {\n      allow read: if true;\n      allow create, update: if isValidId(settlementId);\n      allow delete: if false;\n    }\n\n`;
  if (!rules.includes(anchor)) throw new Error('[prod-hardening] firestore catch-all anchor missing');
  rules = rules.replace(anchor, settlementRule + anchor);
  fs.writeFileSync(RULES, rules);
}

// Final build guards.
for (const [file, value] of [
  [STORE, 'rotafacil_dashboard_actual_tab_v9'],
  [STORE, 'beforeunload'],
  [ENHANCER, 'openNewDispatchSafely'],
  [ROUTES, "STORAGE_KEY + '_backup'"],
  [RULES, 'match /settlements/{settlementId}'],
]) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(value)) throw new Error(`[prod-hardening] validation failed in ${file}: ${value}`);
}
if (fs.readFileSync(STORE, 'utf8').includes('<TestOrdersControl')) throw new Error('[prod-hardening] test controls still visible');

console.log('[prod-hardening] F5, safe new dispatch, route removal, production test UI and settlement rules validated');
