import fs from 'node:fs';

const APP = 'src/App.tsx';
let app = fs.readFileSync(APP, 'utf8');

const oldBlock = `  useEffect(() => {\n    let unsubOrders: (() => void) | null = null;\n    if (session) {\n      const motoboyScope = session.role === 'motoboy' ? session.motoboyId : undefined;\n      unsubOrders = subscribeToOrders((cloudOrders) => {\n        setOrders((prev) => {\n          if (prev.length > 0 && cloudOrders.length > prev.length) {\n            const prevIds = new Set(prev.map((o) => o.id));\n            if (cloudOrders.some((o) => !prevIds.has(o.id))) playNewOrderSound();\n          }\n          return cloudOrders;\n        });\n        setCloudSynced(true);\n      }, motoboyScope);\n    } else {\n      setOrders([]);\n    }\n    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {\n`;

const newBlock = `  useEffect(() => {\n    let unsubOrders: (() => void) | null = null;\n    // The store dashboard can remain mounted even when the local session object is\n    // temporarily absent/stale after a deploy or reload. Never blank the operation\n    // in that case: only scope the listener when this is definitely a motoboy session.\n    const motoboyScope = session?.role === 'motoboy' ? session.motoboyId : undefined;\n    unsubOrders = subscribeToOrders((cloudOrders) => {\n      setOrders((prev) => {\n        if (prev.length > 0 && cloudOrders.length > prev.length) {\n          const prevIds = new Set(prev.map((o) => o.id));\n          if (cloudOrders.some((o) => !prevIds.has(o.id))) playNewOrderSound();\n        }\n        return cloudOrders;\n      });\n      setCloudSynced(true);\n    }, motoboyScope);\n    const unsubMotoboys = subscribeToMotoboys((cloudMotoboys) => {\n`;

if (!app.includes(oldBlock)) {
  if (!app.includes("const motoboyScope = session?.role === 'motoboy' ? session.motoboyId : undefined;")) {
    throw new Error('[order-session-fallback] realtime subscription anchor missing');
  }
} else {
  app = app.replace(oldBlock, newBlock);
}

if (app.includes('    } else {\n      setOrders([]);\n    }')) {
  throw new Error('[order-session-fallback] destructive empty-orders fallback still present');
}
if (!app.includes("const motoboyScope = session?.role === 'motoboy' ? session.motoboyId : undefined;")) {
  throw new Error('[order-session-fallback] scoped motoboy subscription missing');
}

fs.writeFileSync(APP, app);
console.log('[order-session-fallback] store orders remain subscribed even with stale/missing local session');
