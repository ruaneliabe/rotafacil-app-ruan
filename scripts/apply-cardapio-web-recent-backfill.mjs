import fs from 'node:fs';

const target = 'api/sync-cardapio-web.ts';
let source = fs.readFileSync(target, 'utf8');

source = source.replace(
  "function isSummaryFromToday(summary: any): boolean {\n  const candidates = [summary?.created_at, summary?.createdAt, summary?.created, summary?.order_date, summary?.orderDate, summary?.date];\n  for (const value of candidates) {\n    const key = saoPauloDateKey(value);\n    if (key) return key === todaySaoPaulo();\n  }\n  return false;\n}",
  "function isSummaryRecent(summary: any): boolean {\n  const candidates = [summary?.created_at, summary?.createdAt, summary?.created, summary?.order_date, summary?.orderDate, summary?.date];\n  const today = todaySaoPaulo();\n  const yesterday = saoPauloDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));\n  for (const value of candidates) {\n    const key = saoPauloDateKey(value);\n    if (key) return key === today || key === yesterday;\n  }\n  return false;\n}"
);

source = source.replace(
  'const missingFromToday = isSummaryFromToday(summary);',
  'const missingFromRecentWindow = isSummaryRecent(summary);'
);
source = source.replace(
  '!activeExternal.has(rawStatus) && !missingFromToday',
  '!activeExternal.has(rawStatus) && !missingFromRecentWindow'
);
source = source.replace(
  'today Cardapio Web orders are preserved/backfilled even after store close',
  'today and previous-day Cardapio Web orders are preserved/backfilled after quota recovery'
);

for (const marker of ['function isSummaryRecent', 'missingFromRecentWindow', "key === today || key === yesterday"]) {
  if (!source.includes(marker)) throw new Error(`[cw-recent-backfill] validation failed: ${marker}`);
}

fs.writeFileSync(target, source);
console.log('[cw-recent-backfill] current and previous day can be recovered after quota reset');
