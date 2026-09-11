import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
let s = fs.readFileSync(path, 'utf8');

const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const oldState = `  const [activeTab, setActiveTab] = useState<${type}>('operacao');`;
const safeState = `  const [activeTab, setActiveTab] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('rotafacil_dashboard_active_tab_v2');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });`;

if (s.includes(oldState)) {
  s = s.replace(oldState, safeState);
}

const selectedAnchor = `  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(null);`;
const persistBlock = `\n\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    try { window.localStorage.setItem('rotafacil_dashboard_active_tab_v2', activeTab); } catch {}\n  }, [activeTab]);`;

if (!s.includes("rotafacil_dashboard_active_tab_v2', activeTab") && s.includes(selectedAnchor)) {
  s = s.replace(selectedAnchor, selectedAnchor + persistBlock);
}

if (!s.includes("rotafacil_dashboard_active_tab_v2")) {
  throw new Error('[safe-f5-tab] active tab persistence was not applied');
}

fs.writeFileSync(path, s);
console.log('[safe-f5-tab] current dashboard tab survives refresh');
