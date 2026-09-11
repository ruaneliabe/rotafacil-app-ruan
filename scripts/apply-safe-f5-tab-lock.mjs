import fs from 'node:fs';

const dashboardPath = 'src/components/StoreDashboardLegacy.tsx';
let s = fs.readFileSync(dashboardPath, 'utf8');

const type = "'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'";
const key = 'rotafacil_dashboard_active_tab_v6';
const plain = `  const [activeTab, setActiveTab] = useState<${type}>('operacao');`;
const oldLazyStart = `  const [activeTab, setActiveTab] = useState<${type}>(() => {`;
const oldWrappedStart = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {`;
const replacement = `  const [activeTab, setActiveTabState] = useState<${type}>(() => {\n    if (typeof window === 'undefined') return 'operacao';\n    try {\n      const saved = window.localStorage.getItem('${key}');\n      if (saved === 'kanban' || saved === 'operacao' || saved === 'mapa' || saved === 'equipe' || saved === 'gestao' || saved === 'financeiro' || saved === 'historico') return saved;\n    } catch {}\n    return 'operacao';\n  });\n  const setActiveTab = (next: ${type}) => {\n    try { window.localStorage.setItem('${key}', next); } catch {}\n    setActiveTabState(next);\n  };`;

if (s.includes(plain)) {
  s = s.replace(plain, replacement);
} else {
  const candidates = [oldWrappedStart, oldLazyStart];
  for (const startToken of candidates) {
    const start = s.indexOf(startToken);
    if (start < 0) continue;
    const end = s.indexOf('  const [selectedMotoboyId,', start);
    if (end > start) {
      s = s.slice(0, start) + replacement + '\n' + s.slice(end);
      break;
    }
  }
}

// Remove qualquer effect antigo de persistência de aba. O setter acima salva no clique,
// antes de qualquer F5, sem corrida de hidratação.
s = s.replace(/\n\s*useEffect\(\(\) => \{[\s\S]*?rotafacil_dashboard_active_tab_v\d+[\s\S]*?\n\s*\}, \[activeTab\]\);/g, '');

if (!s.includes(key) || !s.includes('setActiveTabState(next)')) {
  throw new Error('[safe-f5-tab] synchronous tab persistence missing');
}
fs.writeFileSync(dashboardPath, s);

// O enhancer antigo tentava clicar em "Pedidos e despacho" 120ms após montar,
// antes do dashboard real terminar a hidratação. Isso concorria com o estado e podia
// deixar Financeiro ativo. Removemos apenas esse auto-clique; os demais comportamentos ficam intactos.
const behaviorPath = 'src/components/DashboardUiBehaviorFixes.tsx';
let b = fs.readFileSync(behaviorPath, 'utf8');
b = b.replace(/\n\s*\/\/ F5\/reload deve sempre voltar[\s\S]*?const initialTabTimer = window\.setTimeout\(\(\) => \{[\s\S]*?\}, 120\);\n/g, '\n');
b = b.replace(/\n\s*window\.clearTimeout\(initialTabTimer\);/g, '');
fs.writeFileSync(behaviorPath, b);

console.log('[safe-f5-tab] synchronous current-tab persistence applied; legacy reload click removed');
