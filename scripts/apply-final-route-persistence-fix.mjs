import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// IMPORTANT: do not replace the whole region between preparedRoutes and activeById.
// Other build patches inject listeners/state there (route creation bridge, flow locks, etc.).
// Replacing that whole region can compile but leave runtime references/listeners broken.

// Remove hydration ref added by older recovery patch; lazy state makes it unnecessary.
s = s.replace("  const preparedRoutesHydrated = useRef(false);\n", '');
s = s.replace(
  "import React, { useEffect, useMemo, useRef, useState } from 'react';",
  "import React, { useEffect, useMemo, useState } from 'react';"
);

// Replace ONLY the preparedRoutes declaration, preserving every state/effect/listener after it.
const lazyState = `  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>(() => {\n    if (typeof window === 'undefined') return [];\n    try {\n      const primary = window.localStorage.getItem(STORAGE_KEY);\n      const backup = window.localStorage.getItem(STORAGE_KEY + '_backup');\n      const raw = primary || backup;\n      if (!raw) return [];\n      const parsed = JSON.parse(raw);\n      return Array.isArray(parsed) ? parsed : [];\n    } catch {\n      return [];\n    }\n  });`;

s = s.replace(
  "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);",
  lazyState
);

// If an earlier build patch already changed it to lazy state, leave it intact.
// Remove only the old load-on-mount effect that can race with the save effect.
s = s.replace(
  /\n\s*useEffect\(\(\) => \{\n\s*try \{\n\s*const raw = window\.localStorage\.getItem\(STORAGE_KEY\);[\s\S]*?\n\s*\}, \[\]\);/m,
  ''
);

// Normalize the writer: state is already hydrated before first render, so saving is safe.
s = s.replace(
  /  useEffect\(\(\) => \{\n\s*if \(!preparedRoutesHydrated\.current\) return;\n\s*try \{ window\.localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(preparedRoutes\)\); \} catch \{\}\n\s*\}, \[preparedRoutes\]\);/,
  `  useEffect(() => {\n    try {\n      const serialized = JSON.stringify(preparedRoutes);\n      window.localStorage.setItem(STORAGE_KEY, serialized);\n      window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n    } catch {}\n  }, [preparedRoutes]);`
);

s = s.replace(
  "  useEffect(() => {\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);",
  `  useEffect(() => {\n    try {\n      const serialized = JSON.stringify(preparedRoutes);\n      window.localStorage.setItem(STORAGE_KEY, serialized);\n      window.localStorage.setItem(STORAGE_KEY + '_backup', serialized);\n    } catch {}\n  }, [preparedRoutes]);`
);

if (!s.includes("useState<PreparedRoute[]>(() =>")) {
  throw new Error('[route-persistence] lazy preparedRoutes state missing');
}
if (!s.includes("STORAGE_KEY + '_backup'")) {
  throw new Error('[route-persistence] backup writer missing');
}

fs.writeFileSync(path, s);
console.log('[route-persistence] surgical F5 persistence applied without deleting injected runtime code');
