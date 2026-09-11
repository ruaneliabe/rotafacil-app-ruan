import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
let s = fs.readFileSync(path, 'utf8');

const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const stateStart = s.indexOf('  const [activeTab,');
const nextState = s.indexOf('  const [selectedMotoboyId,', stateStart);

if (stateStart < 0 || nextState < 0) {
  throw new Error('[safe-f5-tab] activeTab anchors not found');
}

const canonical = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('rotafacil_dashboard_active_tab_v4');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });\n\n  const setActiveTab = (next: ${type}) => {\n    if (typeof window !== 'undefined') {\n      try { window.localStorage.setItem('rotafacil_dashboard_active_tab_v4', next); } catch {}\n    }\n    setActiveTabState(next);\n  };\n`;

s = s.slice(0, stateStart) + canonical + s.slice(nextState);

if (!s.includes('rotafacil_dashboard_active_tab_v4')) {
  throw new Error('[safe-f5-tab] canonical persistence missing');
}

fs.writeFileSync(path, s);
console.log('[safe-f5-tab] current tab restored exactly after F5');
