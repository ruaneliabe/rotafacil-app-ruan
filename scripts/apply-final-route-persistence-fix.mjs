import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// Reescreve somente a região entre preparedRoutes e activeById. Isso evita depender
// da forma que patches anteriores deixaram o estado/effects e impede sobrescrever
// as rotas com [] durante o primeiro render após F5.
const stateStart = s.indexOf('  const [preparedRoutes,');
const activeMapStart = s.indexOf('  const activeById = useMemo(', stateStart);

if (stateStart < 0 || activeMapStart < 0) {
  throw new Error('[route-persistence] anchors not found');
}

const canonical = `  const [preparedRoutes, setPreparedRoutesState] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const primary = window.localStorage.getItem(STORAGE_KEY);\n      const backup = window.localStorage.getItem(STORAGE_KEY + '_backup');\n      const raw = primary || backup;\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });\n  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);\n\n  const setPreparedRoutes = (update: React.SetStateAction<PreparedRoute[]>) => {\n    setPreparedRoutesState((current) => {\n      const next = typeof update === 'function'\n        ? (update as (value: PreparedRoute[]) => PreparedRoute[])(current)\n        : update;\n      if (typeof window !== 'undefined') {\n        try {\n          const serialized = JSON.stringify(next);\n          window.localStorage.setItem(STORAGE_KEY, serialized);\n          window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n        } catch {}\n      }\n      return next;\n    });\n  };\n\n`;

s = s.slice(0, stateStart) + canonical + s.slice(activeMapStart);

if (!s.includes('setPreparedRoutesState((current) =>')) {
  throw new Error('[route-persistence] synchronous setter missing');
}
if (!s.includes("STORAGE_KEY + '_backup'")) {
  throw new Error('[route-persistence] backup missing');
}

fs.writeFileSync(path, s);
console.log('[route-persistence] canonical mounted-route persistence applied');
