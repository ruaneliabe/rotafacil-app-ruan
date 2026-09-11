import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// Remove o esquema antigo de hidratação por effect, que podia sobrescrever o localStorage
// com [] no primeiro mount antes do estado carregado renderizar.
s = s.replace(
  "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);\n  const preparedRoutesHydrated = useRef(false);",
  `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });`
);

s = s.replace(
  "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);",
  `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });`
);

// Remove qualquer effect de carga antigo do mesmo STORAGE_KEY.
s = s.replace(/\n\s*useEffect\(\(\) => \{\n\s*try \{\n\s*const raw = window\.localStorage\.getItem\(STORAGE_KEY\);[\s\S]*?\n\s*\}, \[\]\);/m, '');

// O save agora pode rodar direto, porque o estado inicial já nasce hidratado.
s = s.replace(
  "  useEffect(() => {\n    if (!preparedRoutesHydrated.current) return;\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);",
  "  useEffect(() => {\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);"
);

// Limpa ref/import caso tenham sobrado sem uso.
s = s.replace("  const preparedRoutesHydrated = useRef(false);\n", '');
s = s.replace("import React, { useEffect, useMemo, useRef, useState } from 'react';", "import React, { useEffect, useMemo, useState } from 'react';");

if (!s.includes("useState<PreparedRoute[]>(() =>")) {
  throw new Error('[route-persistence] lazy hydration was not applied');
}
if (!s.includes("window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes))")) {
  throw new Error('[route-persistence] persistence writer missing');
}

fs.writeFileSync(path, s);
console.log('[route-persistence] mounted routes now survive refresh');
