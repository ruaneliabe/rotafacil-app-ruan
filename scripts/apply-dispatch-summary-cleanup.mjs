import fs from 'node:fs';

const path = 'src/components/PredispatchRoutesPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  /\n\s*\{\(looseOrders\.length > 0 \|\| prepared\.length > 0\) && \(\n\s*<div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50\/55 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">[\s\S]*?\n\s*\)\}\n/,
  '\n'
);

fs.writeFileSync(path, s);
console.log('[dispatch-summary-cleanup] redundant summary banner removed');
