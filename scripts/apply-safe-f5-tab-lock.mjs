import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
let s = fs.readFileSync(path, 'utf8');

const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const plain = `  const [activeTab, setActiveTab] = useState<${type}>('operacao');`;
const lazy = `  const [activeTab, setActiveTab] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('rotafacil_dashboard_active_tab_v5');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });`;

// Replace ONLY the state declaration. Never slice away neighboring hooks/state.
if (s.includes(plain)) s = s.replace(plain, lazy);

// If an older final patch left setActiveTabState/wrapper code, convert that small block only.
const oldWrappedStart = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {`;
if (s.includes(oldWrappedStart)) {
  const start = s.indexOf(oldWrappedStart);
  const nextState = s.indexOf('  const [selectedMotoboyId,', start);
  if (start >= 0 && nextState > start) {
    s = s.slice(0, start) + lazy + '\n' + s.slice(nextState);
  }
}

// Remove only previous persistence effects for old keys.
s = s.replace(/\n\s*useEffect\(\(\) => \{[\s\S]*?rotafacil_dashboard_active_tab_v[1-4][\s\S]*?\n\s*\}, \[activeTab\]\);/g, '');

// Persist the current tab after every real tab change. Since initial state is restored lazily,
// this cannot redirect the user to another tab on first render.
const anchor = `  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(null);`;
const persist = `\n\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    try { window.localStorage.setItem('rotafacil_dashboard_active_tab_v5', activeTab); } catch {}\n  }, [activeTab]);`;
if (s.includes(anchor) && !s.includes("rotafacil_dashboard_active_tab_v5', activeTab")) {
  s = s.replace(anchor, anchor + persist);
}

if (!s.includes('rotafacil_dashboard_active_tab_v5')) {
  throw new Error('[safe-f5-tab] v5 persistence missing');
}

fs.writeFileSync(path, s);
console.log('[safe-f5-tab] surgical current-tab persistence applied');
