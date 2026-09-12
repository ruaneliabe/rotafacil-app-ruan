import fs from 'node:fs';

const syncPath = 'api/sync-cardapio-web.ts';
const webhookPath = 'api/webhook-cardapio-web.ts';

let sync = fs.readFileSync(syncPath, 'utf8');
const webhook = fs.readFileSync(webhookPath, 'utf8');

function extractExistingToken(name) {
  const match = webhook.match(new RegExp(`const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]`));
  return match?.[1]?.trim() || '';
}

const pizzaToken = extractExistingToken('CARDAPIO_WEB_HOPE_PIZZA_TOKEN');
const burgerToken = extractExistingToken('CARDAPIO_WEB_HOPE_BURGER_TOKEN');

if (!pizzaToken || !burgerToken) {
  throw new Error('[cw-credentials] existing Cardapio Web credentials were not found in webhook source');
}

sync = sync.replace(
  "const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = process.env.CARDAPIO_WEB_HOPE_PIZZA_TOKEN || process.env.CW_HOPE_PIZZA_TOKEN || '';",
  `const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = process.env.CARDAPIO_WEB_HOPE_PIZZA_TOKEN || process.env.CW_HOPE_PIZZA_TOKEN || ${JSON.stringify(pizzaToken)};`
);

sync = sync.replace(
  "const CARDAPIO_WEB_HOPE_BURGER_TOKEN = process.env.CARDAPIO_WEB_HOPE_BURGER_TOKEN || process.env.CW_HOPE_BURGER_TOKEN || '';",
  `const CARDAPIO_WEB_HOPE_BURGER_TOKEN = process.env.CARDAPIO_WEB_HOPE_BURGER_TOKEN || process.env.CW_HOPE_BURGER_TOKEN || ${JSON.stringify(burgerToken)};`
);

if (sync.includes("process.env.CW_HOPE_PIZZA_TOKEN || '';" ) || sync.includes("process.env.CW_HOPE_BURGER_TOKEN || '';")) {
  throw new Error('[cw-credentials] sync still has empty credential fallback');
}

fs.writeFileSync(syncPath, sync);
console.log('[cw-credentials] automatic Cardapio Web sync credentials restored with env-first fallback');
