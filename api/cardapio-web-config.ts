export interface CardapioWebStoreConfig {
  storeId: string;
  name: string;
  prefix: string;
  apiKey: string;
  aliases?: string[];
  originLat?: number;
  originLng?: number;
}

function normalizeStoreId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
}

export function getCardapioWebStores(): CardapioWebStoreConfig[] {
  const raw = process.env.CARDAPIO_WEB_STORES_JSON;
  if (!raw) {
    throw new Error('CARDAPIO_WEB_STORES_JSON nao configurado no ambiente do servidor');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CARDAPIO_WEB_STORES_JSON possui JSON invalido');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('CARDAPIO_WEB_STORES_JSON deve ser uma lista de lojas');
  }

  const stores = parsed
    .map((item: any) => ({
      storeId: normalizeStoreId(item?.storeId),
      name: String(item?.name || '').trim(),
      prefix: String(item?.prefix || '').trim().toUpperCase(),
      apiKey: String(item?.apiKey || '').trim(),
      aliases: Array.isArray(item?.aliases)
        ? item.aliases.map((alias: unknown) => normalizeStoreId(alias)).filter(Boolean)
        : [],
      originLat: Number.isFinite(Number(item?.originLat)) ? Number(item.originLat) : undefined,
      originLng: Number.isFinite(Number(item?.originLng)) ? Number(item.originLng) : undefined,
    }))
    .filter((store) => store.storeId && store.name && store.prefix && store.apiKey);

  if (stores.length === 0) {
    throw new Error('Nenhuma loja valida configurada em CARDAPIO_WEB_STORES_JSON');
  }

  const ids = new Set<string>();
  for (const store of stores) {
    if (ids.has(store.storeId)) {
      throw new Error(`storeId duplicado em CARDAPIO_WEB_STORES_JSON: ${store.storeId}`);
    }
    ids.add(store.storeId);
  }

  return stores;
}

export function findCardapioWebStore(
  stores: CardapioWebStoreConfig[],
  selector: unknown
): CardapioWebStoreConfig | undefined {
  const normalized = normalizeStoreId(selector);
  if (!normalized) return undefined;

  return stores.find(
    (store) => store.storeId === normalized || store.aliases?.includes(normalized)
  );
}
