import fs from 'node:fs';

const replaceCourierFunction = (path) => {
  let s = fs.readFileSync(path, 'utf8');
  const startToken = 'function courierName(order: any): string | null {';
  const start = s.indexOf(startToken);
  if (start < 0) throw new Error(`[final-consistency] courierName missing in ${path}`);

  const braceStart = s.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error(`[final-consistency] courierName end missing in ${path}`);

  const replacement = `function courierName(order: any): string | null {\n  const cleanName = (value: any): string | null => {\n    if (value == null) return null;\n    if (typeof value === 'string') {\n      const text = value.trim();\n      if (!text || /^\\d+$/.test(text)) return null;\n      const lower = text.toLowerCase();\n      if (['available','offline','delivering','dispatched','released','pending','preparing'].includes(lower)) return null;\n      return text;\n    }\n    if (typeof value !== 'object') return null;\n    for (const key of ['name','nome','full_name','fullName','display_name','displayName','username','user_name']) {\n      const found = cleanName(value?.[key]);\n      if (found) return found;\n    }\n    for (const key of ['user','person','profile','employee','courier','driver','deliveryman','motoboy','entregador']) {\n      const found = cleanName(value?.[key]);\n      if (found) return found;\n    }\n    return null;\n  };\n\n  const direct = [\n    order?.deliveryman_name, order?.delivery_man_name, order?.courier_name, order?.driver_name,\n    order?.motoboy_name, order?.entregador_name, order?.entregador_nome, order?.delivery_person_name,\n    order?.delivery_driver_name, order?.rider_name, order?.delivery_agent_name,\n    order?.deliveryman, order?.delivery_man, order?.courier, order?.driver, order?.motoboy,\n    order?.entregador, order?.delivery_person, order?.delivery_driver, order?.rider, order?.delivery_agent,\n    order?.delivery?.deliveryman_name, order?.delivery?.courier_name, order?.delivery?.driver_name,\n    order?.delivery?.motoboy_name, order?.delivery?.entregador_name, order?.delivery?.delivery_person_name,\n    order?.delivery?.deliveryman, order?.delivery?.courier, order?.delivery?.driver, order?.delivery?.motoboy,\n    order?.delivery?.entregador, order?.delivery?.delivery_person, order?.delivery?.delivery_driver,\n    order?.logistic?.driver, order?.logistic?.courier, order?.logistic?.deliveryman,\n    order?.logistics?.driver, order?.logistics?.courier, order?.logistics?.deliveryman,\n    order?.dispatch?.driver, order?.dispatch?.courier, order?.dispatch?.deliveryman,\n  ];\n  for (const candidate of direct) {\n    const found = cleanName(candidate);\n    if (found) return found;\n  }\n\n  const seen = new Set<any>();\n  const walk = (node: any, depth: number): string | null => {\n    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return null;\n    seen.add(node);\n\n    for (const [key, value] of Object.entries(node)) {\n      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');\n      const courierKey = /(deliveryman|deliveryperson|deliverydriver|courier|driver|motoboy|entregador|rider|deliveryagent|deliverypartner)/.test(normalizedKey);\n      const idLike = /(id|uuid|code|token|phone|document)$/.test(normalizedKey);\n      if (courierKey && !idLike) {\n        const found = cleanName(value);\n        if (found) return found;\n      }\n    }\n\n    for (const value of Object.values(node)) {\n      if (value && typeof value === 'object') {\n        const found = walk(value, depth + 1);\n        if (found) return found;\n      }\n    }\n    return null;\n  };\n\n  return walk(order, 0);\n}`;

  s = s.slice(0, start) + replacement + s.slice(end);
  if (!s.includes('delivery_agent_name') || !s.includes('deliverypartner')) {
    throw new Error(`[final-consistency] deep courier extractor missing in ${path}`);
  }
  fs.writeFileSync(path, s);
};

// 1) F5: uma única fonte de verdade para a aba, salva sincronamente no clique.
const dashboardPath = 'src/components/StoreDashboardLegacy.tsx';
let dashboard = fs.readFileSync(dashboardPath, 'utf8');
const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const key = 'rotafacil_dashboard_active_tab_v7';
const stateStart = dashboard.indexOf('  const [activeTab,');
const nextState = dashboard.indexOf('  const [selectedMotoboyId,', stateStart);
if (stateStart < 0 || nextState < 0) throw new Error('[final-consistency] activeTab state region not found');
const tabBlock = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('${key}');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });\n  const setActiveTab = (next: ${type}) => {\n    if (typeof window !== 'undefined') { try { window.localStorage.setItem('${key}', next); } catch {} }\n    setActiveTabState(next);\n  };\n`;
dashboard = dashboard.slice(0, stateStart) + tabBlock + dashboard.slice(nextState);
if (!dashboard.includes(key) || !dashboard.includes("onClick={() => setActiveTab('operacao')}")) {
  throw new Error('[final-consistency] active tab v7 wiring missing');
}
fs.writeFileSync(dashboardPath, dashboard);

// 2) Remove qualquer auto-clique de reload que concorra com o estado acima.
const behaviorPath = 'src/components/DashboardUiBehaviorFixes.tsx';
let behavior = fs.readFileSync(behaviorPath, 'utf8');
behavior = behavior.replace(/\n\s*\/\/ F5\/reload deve sempre voltar[\s\S]*?const initialTabTimer = window\.setTimeout\([\s\S]*?\n\s*\},\s*\d+\);/g, '');
behavior = behavior.replace(/\n\s*window\.clearTimeout\(initialTabTimer\);/g, '');
if (behavior.includes('initialTabTimer')) throw new Error('[final-consistency] legacy reload timer survived');
fs.writeFileSync(behaviorPath, behavior);

// 3) Cardápio Web: procura o nome do entregador também em estruturas/campos não previstos.
replaceCourierFunction('api/sync-cardapio-web.ts');
replaceCourierFunction('api/webhook-cardapio-web.ts');

// 4) Valida as proteções críticas antes de deixar o Vite compilar.
const routes = fs.readFileSync('src/components/PredispatchRoutesPanel.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const sync = fs.readFileSync('api/sync-cardapio-web.ts', 'utf8');
const failures = [];
if (!routes.includes('useState<PreparedRoute[]>(() =>')) failures.push('rotas nao hidratam antes do primeiro render');
if (!routes.includes("STORAGE_KEY + '_backup'")) failures.push('backup de rotas ausente');
if (!routes.includes('cardapioWebMotoboyName') || !routes.includes('externalMotoboyName')) failures.push('nome do motoboy nao aparece em Em entrega');
if (!server.includes("app.all('/api/cardapio-web/sync'")) failures.push('alias de sync do Render ausente');
if (!sync.includes('delivery_agent_name') || !sync.includes('deliverypartner')) failures.push('extrator profundo de motoboy Cardapio Web ausente');
if (!dashboard.includes('rotafacil_dashboard_active_tab_v7')) failures.push('persistencia de aba v7 ausente');
if (failures.length) throw new Error('[final-consistency] validacao falhou: ' + failures.join(' | '));

console.log('[final-consistency] F5 tab, route persistence, Render sync and Cardapio Web courier extraction validated');
