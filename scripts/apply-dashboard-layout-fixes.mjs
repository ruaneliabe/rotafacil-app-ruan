import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[layout-patch] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[layout-patch] ${path}: updated`);
};

// Deixa as quatro colunas operacionais bem mais altas para suportar alto volume
// sem transformar a área principal num painel apertado.
patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  s = s.replace(
    'className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"',
    'className="min-w-0 min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"'
  );

  s = s.replace(
    'max-h-[650px] min-h-[330px] overflow-y-auto',
    'max-h-[1000px] min-h-[700px] overflow-y-auto'
  );

  s = s.replace(
    'className="flex h-[220px] flex-col items-center justify-center px-5 text-center"',
    'className="flex h-[600px] flex-col items-center justify-center px-5 text-center"'
  );

  return s;
});

// O histórico de pedidos entregues é secundário na operação. Mantém ele abaixo
// da central principal e com um respiro maior, priorizando as colunas ativas.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  s = s.replace(
    "      {activeTab === 'operacao' && (\n        <DeliveredOrdersDashboard orders={orders} />\n      )}",
    "      {activeTab === 'operacao' && (\n        <div className=\"mt-12 pb-6\">\n          <DeliveredOrdersDashboard orders={orders} />\n        </div>\n      )}"
  );

  return s;
});
