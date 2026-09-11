import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[pilot-critical] ${path}: no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[pilot-critical] ${path}: updated`);
};

// CRITICAL: rotas montadas precisam sobreviver a F5.
patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  s = s.replace(
    "import React, { useEffect, useMemo, useState } from 'react';",
    "import React, { useEffect, useMemo, useRef, useState } from 'react';"
  );

  if (!s.includes('preparedRoutesHydrated')) {
    s = s.replace(
      "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);",
      "  const [preparedRoutes, setPreparedRoutes] = useState<PreparedRoute[]>([]);\n  const preparedRoutesHydrated = useRef(false);"
    );
  }

  const loadBlock = `  useEffect(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      if (raw) {\n        const parsed = JSON.parse(raw);\n        if (Array.isArray(parsed)) setPreparedRoutes(parsed);\n      }\n    } catch {}\n  }, []);`;

  const safeLoadBlock = `  useEffect(() => {\n    try {\n      const raw = window.localStorage.getItem(STORAGE_KEY);\n      if (raw) {\n        const parsed = JSON.parse(raw);\n        if (Array.isArray(parsed)) setPreparedRoutes(parsed);\n      }\n    } catch {} finally {\n      preparedRoutesHydrated.current = true;\n    }\n  }, []);`;

  s = s.replace(loadBlock, safeLoadBlock);

  const saveBlock = `  useEffect(() => {\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);`;

  const safeSaveBlock = `  useEffect(() => {\n    if (!preparedRoutesHydrated.current) return;\n    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preparedRoutes)); } catch {}\n  }, [preparedRoutes]);`;

  s = s.replace(saveBlock, safeSaveBlock);

  return s;
});

// CRITICAL: o motoboy nunca pode ficar preso em uma tela vazia fora da fila.
patch('src/components/MotoboyApp.tsx', (input) => {
  let s = input;

  // A fila só considera quem realmente está aguardando e ainda não foi chamado.
  s = s.replace(
    ".filter((motoboy) => motoboy.status === 'available')",
    ".filter((motoboy) => motoboy.status === 'available' && (!motoboy.callingToCounterAt || Number(motoboy.callingToCounterAt) < Number(motoboy.joinedQueueAt || 0)))"
  );

  s = s.replace(
    "  const inQueue = driver?.status === 'available';",
    "  const inQueue = queuePosition > 0;"
  );

  const ordersOpen = `        {tab === 'orders' && (\n          <>`;
  if (!s.includes('data-emergency-enter-queue="true"') && s.includes(ordersOpen)) {
    const emergency = `        {tab === 'orders' && (\n          <>\n            {!inQueue && !returning && driver.status !== 'delivering' && preparing.length === 0 && ready.length === 0 && route.length === 0 && (\n              <section data-emergency-enter-queue="true" className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">\n                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-50">\n                  <UsersRound className="h-10 w-10 text-violet-600" />\n                </div>\n                <h2 className="mt-5 text-xl font-black tracking-tight">Fora da fila</h2>\n                <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-relaxed text-slate-500">Entre na fila para ficar disponível para o próximo despacho.</p>\n                <button type="button" onClick={enterQueue} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-[16px] font-black text-white shadow-lg active:scale-[.99]">\n                  Entrar na fila <ArrowRight className="h-5 w-5" />\n                </button>\n              </section>\n            )}`;
    s = s.replace(ordersOpen, emergency);
  }

  // Pedidos chamados continuam visíveis mesmo após o motoboy sair da fila.
  s = s.replace(
    /\{inQueue && \(\s*<>/,
    '{(inQueue || preparing.length > 0 || ready.length > 0) && (\n              <>'
  );

  return s;
});
