import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[dispatch-layout-polish] ${path}: no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[dispatch-layout-polish] ${path}: updated`);
};

patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  s = s.replace(
    'className="rounded-2xl border border-violet-200 bg-violet-50/35 p-3"',
    'className="rounded-xl border border-violet-200 bg-violet-50/25 px-3 py-2"'
  );
  s = s.replace(
    'className="mb-2.5 flex items-center justify-between gap-3"',
    'className="mb-1.5 flex items-center justify-between gap-3"'
  );
  s = s.replace(
    'className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-700"',
    'className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-violet-700"'
  );
  s = s.replace(
    'className="grid gap-2 lg:grid-cols-3"',
    'className="grid gap-1.5 lg:grid-cols-3"'
  );
  s = s.replace(
    'className="flex min-w-0 items-center gap-3 rounded-xl border border-violet-100 bg-white p-2.5 shadow-sm"',
    'className="flex min-w-0 items-center gap-2 rounded-lg border border-violet-100 bg-white px-2.5 py-1.5"'
  );
  s = s.replace(
    'className="h-8 shrink-0 rounded-lg bg-violet-600 px-3 text-[9px] font-black text-white hover:bg-violet-500"',
    'className="h-7 shrink-0 rounded-md bg-violet-600 px-2.5 text-[8px] font-black text-white hover:bg-violet-500"'
  );

  return s;
});

patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;

  // A central nova não usa mais alternância Cards/Compacto. Mantemos o estado por compatibilidade,
  // mas removemos o controle visual para liberar espaço no cabeçalho.
  s = s.replace(
    /<div className="[^\"]*">\s*<button[^>]*>\s*<LayoutGrid[\s\S]*?Cards\s*<\/button>\s*<button[^>]*>\s*<List[\s\S]*?Compacto\s*<\/button>\s*<\/div>/,
    ''
  );

  return s;
});
