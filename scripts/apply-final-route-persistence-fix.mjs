import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// Limpa o esquema antigo de hidratação por effect. A rota deve nascer já carregada
// e toda alteração precisa ser gravada SINCRONAMENTE antes de um possível F5.
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*try \{\n\s*const raw = window\.localStorage\.getItem\(STORAGE_KEY\);[\s\S]*?\n\s*\}, \[\]\);/m, '');
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*if \(!preparedRoutesHydrated\.current\) return;[\s\S]*?\n\s*\}, \[preparedRoutes\]\);/m, '');
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*try \{ window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(preparedRoutes\)\); \} catch \{\}\n\s*\}, \[preparedRoutes\]\);/m, '');
s = s.replace("  const preparedRoutesHydrated = useRef(false);\n", '');
s = s.replace("import React, { useEffect, useMemo, useRef, useState } from 'react';", "import React, { useEffect, useMemo, useState } from 'react';");

const oldWithRef = "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);\n  const preparedRoutesHydrated = useRef(false);";
if (s.includes(oldWithRef)) s = s.replace(oldWithRef, "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);");

// Troca somente a declaração do estado; não remove nenhum outro state/helper do componente.
const plainState = "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);";
if (s.includes(plainState)) {
  s = s.replace(plainState, `  const [preparedRoutes, setPreparedRoutesState] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const primary = window.localStorage.getItem(STORAGE_KEY);\n      const backup = window.localStorage.getItem(STORAGE_KEY + '_backup');\n      const raw = primary || backup;\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });\n\n  const setPreparedRoutes = (update: React.SetStateAction<PreparedRoute[]>) => {\n    setPreparedRoutesState((current) => {\n      const next = typeof update === 'function'\n        ? (update as (value: PreparedRoute[]) => PreparedRoute[])(current)\n        : update;\n      if (typeof window !== 'undefined') {\n        try {\n          const serialized = JSON.stringify(next);\n          window.localStorage.setItem(STORAGE_KEY, serialized);\n          window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n        } catch {}\n      }\n      return next;\n    });\n  };`);
}

// Compatibilidade caso um build anterior já tenha lazy state com setPreparedRoutes normal.
const lazyStart = "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {";
if (s.includes(lazyStart)) {
  const stateStart = s.indexOf(lazyStart);
  const stateEnd = s.indexOf("\n  });", stateStart);
  if (stateEnd > stateStart) {
    const afterState = stateEnd + "\n  });".length;
    const replacement = `  const [preparedRoutes, setPreparedRoutesState] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const primary = window.localStorage.getItem(STORAGE_KEY);\n      const backup = window.localStorage.getItem(STORAGE_KEY + '_backup');\n      const raw = primary || backup;\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });\n\n  const setPreparedRoutes = (update: React.SetStateAction<PreparedRoute[]>) => {\n    setPreparedRoutesState((current) => {\n      const next = typeof update === 'function'\n        ? (update as (value: PreparedRoute[]) => PreparedRoute[])(current)\n        : update;\n      if (typeof window !== 'undefined') {\n        try {\n          const serialized = JSON.stringify(next);\n          window.localStorage.setItem(STORAGE_KEY, serialized);\n          window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n        } catch {}\n      }\n      return next;\n    });\n  };`;
    s = s.slice(0, stateStart) + replacement + s.slice(afterState);
  }
}

if (!s.includes('setPreparedRoutesState')) throw new Error('[route-persistence] state wrapper não aplicado');
if (!s.includes("STORAGE_KEY + '_backup'")) throw new Error('[route-persistence] backup não aplicado');

fs.writeFileSync(path, s);
console.log('[route-persistence] rotas montadas são salvas sincronamente e sobrevivem ao F5');
