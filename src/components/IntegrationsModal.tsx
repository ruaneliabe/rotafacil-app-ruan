import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe, Save, Store, Webhook, X, Zap, Building2, Copy, Check, Info } from 'lucide-react';
import { StoreIntegrationConfig, StoreIntegrations, StoreBranch } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  integrations?: StoreIntegrations;
  branches?: StoreBranch[];
  onSave: (integrations: StoreIntegrations, branches?: StoreBranch[]) => void;
  onSimulateIncomingOrder: (channel: 'ifood' | 'cardapio_web', branchId?: string) => void;
}

const CARDAPIO_WEB_HOPE_PIZZA_TOKEN = 'ed3bxFMKCQGtaqbTVJrDy6ZqfM7z2hEFLaRmQBo3tMW4ZkGuxTmBHAweBTrx';
const emptyConfig = (): StoreIntegrationConfig => ({ enabled: false, accountId: '', webhookUrl: '' });
const normalize = (value?: StoreIntegrations): StoreIntegrations => {
  return {
    ifood: { ...emptyConfig(), ...value?.ifood },
    cardapioWeb: {
      enabled: value?.cardapioWeb?.enabled ?? false,
      accountId: value?.cardapioWeb?.accountId || '',
      webhookUrl: value?.cardapioWeb?.webhookUrl || '',
    },
  };
};

export const IntegrationsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  storeName,
  integrations,
  branches,
  onSave,
  onSimulateIncomingOrder,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('hope_pizza');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [draftBranches, setDraftBranches] = useState<StoreBranch[]>(() => {
    return branches && branches.length > 0
      ? branches
      : [
          {
            id: 'hope_burger',
            name: 'Hope Burger',
            tag: 'HB',
            icon: '🍔',
            integrations: {
              ifood: { enabled: true, accountId: 'hope-burger-ifood', webhookUrl: '' },
              cardapioWeb: { enabled: false, accountId: '', webhookUrl: '' },
            },
          },
          {
            id: 'hope_pizza',
            name: 'Hope Pizza',
            tag: 'HP',
            icon: '🍕',
            integrations: {
              ifood: { enabled: true, accountId: 'hope-pizza-ifood', webhookUrl: '' },
              cardapioWeb: { enabled: true, accountId: CARDAPIO_WEB_HOPE_PIZZA_TOKEN, webhookUrl: '' },
            },
          },
        ];
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (branches && branches.length > 0) {
        const enrichedBranches = branches.map((b) => {
          if (b.id === 'hope_pizza') {
            const currentToken = b.integrations?.cardapioWeb?.accountId;
            return {
              ...b,
              integrations: {
                ...b.integrations,
                cardapioWeb: {
                  enabled: true,
                  accountId: (!currentToken || currentToken === 'hope-pizza-cardapio') ? CARDAPIO_WEB_HOPE_PIZZA_TOKEN : currentToken,
                  webhookUrl: b.integrations?.cardapioWeb?.webhookUrl || '',
                },
              },
            };
          }
          if (b.id === 'hope_burger') {
            const currentToken = b.integrations?.cardapioWeb?.accountId;
            const isDefaultOrPizza = currentToken === CARDAPIO_WEB_HOPE_PIZZA_TOKEN || currentToken === 'hope-burger-cardapio';
            return {
              ...b,
              integrations: {
                ...b.integrations,
                cardapioWeb: {
                  enabled: isDefaultOrPizza ? false : Boolean(currentToken),
                  accountId: isDefaultOrPizza ? '' : (currentToken || ''),
                  webhookUrl: b.integrations?.cardapioWeb?.webhookUrl || '',
                },
              },
            };
          }
          return b;
        });
        setDraftBranches(enrichedBranches);
      }
      setSaved(false);
    }
  }, [branches, isOpen]);

  const currentBranch = draftBranches.find((b) => b.id === selectedBranchId) || draftBranches[0];
  const currentIntegrations = normalize(currentBranch?.integrations || integrations);

  const VERCEL_PRODUCTION_ORIGIN = 'https://rotafacil-app-ruan.vercel.app';
  const originUrl = typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
    ? window.location.origin
    : VERCEL_PRODUCTION_ORIGIN;

  const copyToClipboard = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
    }
  };

  const activeCount = useMemo(() => {
    return [currentIntegrations.ifood, currentIntegrations.cardapioWeb].filter((item) => item?.enabled).length;
  }, [currentIntegrations]);

  if (!isOpen) return null;

  const updateCurrentProvider = (provider: 'ifood' | 'cardapioWeb', patch: Partial<StoreIntegrationConfig>) => {
    setSaved(false);
    setDraftBranches((prev) =>
      prev.map((branch) => {
        if (branch.id === currentBranch.id) {
          const prevIntegrations = normalize(branch.integrations || integrations);
          const currentConfig = prevIntegrations[provider] || emptyConfig();
          const updated = {
            ...prevIntegrations,
            [provider]: { ...currentConfig, ...patch },
          };
          return { ...branch, integrations: updated };
        }
        return branch;
      })
    );
  };

  const handleSave = () => {
    const updatedAt = Date.now();
    const cleanBranches = draftBranches.map((b) => {
      const bNorm = normalize(b.integrations);
      return {
        ...b,
        integrations: {
          ifood: { ...bNorm.ifood, accountId: (bNorm.ifood?.accountId || '').trim(), webhookUrl: (bNorm.ifood?.webhookUrl || '').trim(), updatedAt },
          cardapioWeb: { ...bNorm.cardapioWeb, accountId: (bNorm.cardapioWeb?.accountId || '').trim(), webhookUrl: (bNorm.cardapioWeb?.webhookUrl || '').trim(), updatedAt },
        },
      };
    });

    const activeBranchClean = cleanBranches.find((b) => b.id === selectedBranchId) || cleanBranches[0];
    onSave(activeBranchClean.integrations!, cleanBranches);
    setSaved(true);
  };

  const providerCard = (
    provider: 'ifood' | 'cardapioWeb',
    name: string,
    description: string,
    accountLabel: string,
    placeholder: string,
    accent: 'red' | 'blue'
  ) => {
    const config = currentIntegrations[provider] || emptyConfig();
    const activeStyle =
      accent === 'red'
        ? 'bg-red-500/15 text-red-300 border-red-500/40'
        : 'bg-blue-500/15 text-blue-300 border-blue-500/40';

    const systemWebhookUrl = provider === 'cardapioWeb'
      ? `${originUrl}/api/webhook/cardapio-web/${currentBranch.id}`
      : `${originUrl}/api/webhook/ifood/${currentBranch.id}`;

    const isCwCopied = copiedKey === `webhook_${provider}_${currentBranch.id}`;

    return (
      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${activeStyle}`}>
              {provider === 'ifood' ? <Store className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm text-white">{name}</h4>
                <span className="text-[10px] font-bold text-slate-400">({currentBranch.name})</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            onClick={() => updateCurrentProvider(provider, { enabled: !config.enabled })}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-black transition-colors cursor-pointer ${
              config.enabled ? activeStyle : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {config.enabled ? 'ATIVA' : 'INATIVA'}
          </button>
        </div>

        {/* Webhook URL Box for Cardápio Web */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>URL de Webhook para cadastrar no {name} ({currentBranch.name}):</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(systemWebhookUrl, `webhook_${provider}_${currentBranch.id}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-all cursor-pointer border border-emerald-500/30"
            >
              {isCwCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCwCopied ? 'URL Copiada!' : 'Copiar URL'}</span>
            </button>
          </div>
          <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 break-all select-all">
            {systemWebhookUrl}
          </div>
          <p className="text-[10px] text-slate-400">
            Cole essa URL no painel do {name} da <strong>{currentBranch.name}</strong> em <em>Configurações &gt; Integrações &gt; Webhook</em> para receber os pedidos instantaneamente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{accountLabel}</span>
            <input
              value={config.accountId || ''}
              onChange={(e) => updateCurrentProvider(provider, { accountId: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">URL Personalizada (Opcional)</span>
            <input
              type="url"
              value={config.webhookUrl || ''}
              onChange={(e) => updateCurrentProvider(provider, { webhookUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
          <p className="text-[11px] text-slate-400">
            Origem: <strong>{currentBranch.name}</strong> • Conexão em tempo real
          </p>
          <button
            type="button"
            disabled={!config.enabled}
            onClick={() => onSimulateIncomingOrder(provider === 'ifood' ? 'ifood' : 'cardapio_web', currentBranch.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-200 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Testar Pedido em {currentBranch.name.split(' ')[1] || currentBranch.name}
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl my-auto space-y-5 text-slate-100">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tight">Integrações Multi-Loja</h3>
              <p className="text-xs text-slate-400">
                Gerencie conexões do iFood e Cardápio Web para Hope Burger e Hope Pizza
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Store Selector Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
          {draftBranches.map((branch) => {
            const isSelected = branch.id === selectedBranchId;
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => {
                  setSelectedBranchId(branch.id);
                  setSaved(false);
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{branch.icon || '🏪'}</span>
                <span>{branch.name}</span>
                {branch.integrations?.ifood?.enabled || branch.integrations?.cardapioWeb?.enabled ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {providerCard(
            'ifood',
            'iFood',
            'Recebimento automático de pedidos da loja no iFood.',
            'Merchant ID / Código da Loja',
            'Ex.: hope-burger-1234',
            'red'
          )}
          {providerCard(
            'cardapioWeb',
            'Cardápio Web',
            'Receba pedidos gerados no site ou cardápio digital desta loja.',
            'Identificador da Loja / Token',
            'Ex.: hope-burger-cw',
            'blue'
          )}
        </div>

        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 rounded-xl p-3 text-xs leading-relaxed flex items-center gap-2">
          <span>💡</span>
          <span>
            Ambas as lojas (<strong>Hope Burger</strong> e <strong>Hope Pizza</strong>) recebem seus pedidos diretamente nesta mesma tela de despacho, identificados pelas tags nos cartões.
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-emerald-300 flex items-center gap-1.5">
            {saved && (
              <>
                <CheckCircle2 className="w-4 h-4" /> Configurações salvas
              </>
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" /> Salvar integrações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
