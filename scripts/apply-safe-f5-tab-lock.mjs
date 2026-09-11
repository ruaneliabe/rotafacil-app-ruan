import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
let s = fs.readFileSync(path, 'utf8');

const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const oldState = `  const [activeTab, setActiveTab] = useState<${type}>('operacao');`;
const safeState = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('rotafacil_dashboard_active_tab_v3');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });\n\n  const setActiveTab = (next: React.SetStateAction<${type}>) => {\n    setActiveTabState((current) => {\n      const resolved = typeof next === 'function' ? (next as (value: typeof current) => typeof current)(current) : next;\n      if (typeof window !== 'undefined') {\n        try { window.localStorage.setItem('rotafacil_dashboard_active_tab_v3', resolved); } catch {}\n      }\n      return resolved;\n    });\n  };`;

if (s.includes(oldState)) s = s.replace(oldState, safeState);

// Se houver um patch anterior com setter normal/lazy, converte sem tocar em outros states.
const oldLazyStart = `  const [activeTab, setActiveTab] = useState<${type}>(() => {`;
if (s.includes(oldLazyStart)) {
  const start = s.indexOf(oldLazyStart);
  const end = s.indexOf('\n  });', start);
  if (end > start) {
    const after = end + '\n  });'.length;
    s = s.slice(0, start) + safeState + s.slice(after);
  }
}

// Remove effects antigos de persistência para não haver duas fontes concorrentes.
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*if \(typeof window === 'undefined'\) return;\n\s*try \{ window\.localStorage\.setItem\('rotafacil_dashboard_active_tab_v[12]', activeTab\); \} catch \{\}\n\s*\}, \[activeTab\]\);/g, '');
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*try \{ window\.localStorage\.setItem\('rotafacil_dashboard_active_tab_v1', activeTab\); \} catch \{\}\n\s*\}, \[activeTab\]\);/g, '');

if (!s.includes('setActiveTabState')) throw new Error('[safe-f5-tab] setter síncrono não aplicado');
if (!s.includes('rotafacil_dashboard_active_tab_v3')) throw new Error('[safe-f5-tab] chave persistente não aplicada');

fs.writeFileSync(path, s);
console.log('[safe-f5-tab] aba atual é salva no clique e restaurada após F5');
