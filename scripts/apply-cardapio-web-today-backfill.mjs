import fs from 'node:fs';

const target = 'api/sync-cardapio-web.ts';
let source = fs.readFileSync(target, 'utf8');

const helperAnchor = "function changedPatch(current: any, next: any) {";
if (!source.includes('function saoPauloDateKey')) {
  const helper = `function saoPauloDateKey(raw: any): string | null {\n  if (raw == null || raw === '') return null;\n  const d = new Date(raw);\n  if (Number.isNaN(d.getTime())) return null;\n  const parts = new Intl.DateTimeFormat('en-CA', {\n    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'\n  }).formatToParts(d);\n  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));\n  return \`${'${obj.year}'}-${'${obj.month}'}-${'${obj.day}'}\`;\n}\n\nfunction todaySaoPaulo(): string {\n  return saoPauloDateKey(new Date())!;\n}\n\nfunction isSummaryFromToday(summary: any): boolean {\n  const candidates = [summary?.created_at, summary?.createdAt, summary?.created, summary?.order_date, summary?.orderDate, summary?.date];\n  for (const value of candidates) {\n    const key = saoPauloDateKey(value);\n    if (key) return key === todaySaoPaulo();\n  }\n  return false;\n}\n\n`;
  if (!source.includes(helperAnchor)) throw new Error('[cw-today-backfill] helper anchor missing');
  source = source.replace(helperAnchor, helper + helperAnchor);
}

const oldGuard = `      if (!activeExternal.has(rawStatus)) {\n        skippedHistorical++;\n        continue;\n      }`;
const newGuard = `      // Missing orders from TODAY must be imported even if Cardapio Web already closed/delivered them.\n      // This preserves the full daily operation after outages/quota incidents while still refusing old history.\n      const missingFromToday = isSummaryFromToday(summary);\n      if (!activeExternal.has(rawStatus) && !missingFromToday) {\n        skippedHistorical++;\n        continue;\n      }`;
if (!source.includes(oldGuard)) throw new Error('[cw-today-backfill] missing-order guard anchor missing');
source = source.replace(oldGuard, newGuard);

source = source.replace(
  "console.log('[cw-import-recovery] active Cardapio Web orders are imported and existing orders reconciled without historical scans');",
  "console.log('[cw-import-recovery] active orders plus today backfill are imported; older history remains excluded');"
);

for (const marker of ['function isSummaryFromToday', 'const missingFromToday = isSummaryFromToday(summary)', '!activeExternal.has(rawStatus) && !missingFromToday']) {
  if (!source.includes(marker)) throw new Error(`[cw-today-backfill] validation failed: ${marker}`);
}

fs.writeFileSync(target, source);
console.log('[cw-today-backfill] today Cardapio Web orders are preserved/backfilled even after store close');
