import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[ui-persistence] ' + path + ': updated');
  } else {
    console.log('[ui-persistence] ' + path + ': no-op');
  }
};

patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  // Canonicaliza a inicialização/persistência das rotas. Fazemos isso por região inteira
  // para nenhum patch anterior conseguir manter um effect que grave [] no primeiro render.
  const stateStart = s.indexOf('  const [preparedRoutes, setPreparedRoutes]');
  const activeMapStart = s.indexOf('  const activeById = useMemo(', stateStart);
  if (stateStart >= 0 && activeMapStart > stateStart) {
    const canonical = `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });\n  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);\n\n  useEffect(() => {\n    try {\n      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes));\n    } catch {}\n  }, [preparedRoutes]);\n\n`;
    s = s.slice(0, stateStart) + canonical + s.slice(activeMapStart);
  }

  return s;
});

patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;
  const old = "  const [activeTab, setActiveTab] = useState<'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'>('operacao');";
  const replacement = `  const [activeTab, setActiveTab] = useState<'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'>(() => {\n    try {\n      const saved = window.localStorage.getItem('rotafacil_dashboard_active_tab_v1');\n      return ['kanban', 'operacao', 'mapa', 'equipe', 'gestao', 'financeiro', 'historico'].includes(saved || '')\n        ? saved as 'kanban' | 'operacao' | 'mapa' | 'equipe' | 'gestao' | 'financeiro' | 'historico'\n        : 'operacao';\n    } catch {\n      return 'operacao';\n    }\n  });`;
  if (s.includes(old)) s = s.replace(old, replacement);

  if (!s.includes("rotafacil_dashboard_active_tab_v1', activeTab")) {
    const anchor = "  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string | null>(null);";
    if (s.includes(anchor)) {
      s = s.replace(anchor, `${anchor}\n\n  useEffect(() => {\n    try { window.localStorage.setItem('rotafacil_dashboard_active_tab_v1', activeTab); } catch {}\n  }, [activeTab]);`);
    }
  }

  return s;
});

console.log('[ui-persistence] F5 keeps mounted routes and current dashboard section');
