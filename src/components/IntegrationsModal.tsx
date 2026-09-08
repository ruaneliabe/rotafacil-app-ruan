import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, Globe, Save, Store, Webhook, X, Zap } from 'lucide-react';
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

const emptyConfig = (): StoreIntegrationConfig => ({ enabled: false, accountId: '', webhookUrl: '' });
const normalize = (value?: StoreIntegrations): StoreIntegrations => ({
  ifood: { ...emptyConfig(), ...value?.ifood },
  cardapioWeb: { ...emptyConfig(), ...value?.cardapioWeb, merchantToken: undefined },
});

export const IntegrationsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  storeName,
  integrations,
  branches = [],
  onSave,
  onSimulateIncomingOrder,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [draftBranches, setDraftBranches] = useState<StoreBranch[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const safeBranches = branches.map((branch) => ({
      ...branch,
      integrations: normalize(branch.integrations),
    }));
    setDraftBranches(safeBranches);
    setSelectedBranchId((current) => safeBranches.some((b) => b.id === current) ? current : (safeBranches[0]?.id || ''));
    setSaved(false);
  }, [branches, isOpen]);

  const currentBranch = draftBranches.find((b) => b.id === selectedBranchId) || draftBranches[0];
  const currentIntegrations = normalize(currentBranch?.integrations || integrations);
  const activeCount = useMemo(
    () => [currentIntegrations.ifood, currentIntegrations.cardapioWeb].filter((item) => item?.enabled).length,
    [currentIntegrations]
  );

  if (!isOpen) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const updateProvider = (provider: 'ifood' | 'cardapioWeb', patch: Partial<StoreIntegrationConfig>) => {
    if (!currentBranch) return;
    setSaved(false);
    setDraftBranches((prev) => prev.map((branch) => {
      if (branch.id !== currentBranch.id) return branch;
      const normalized = normalize(branch.integrations);
      return {
        ...branch,
        integrations: {
          ...normalized,
          [provider]: { ...(normalized[provider] || emptyConfig()), ...patch, merchantToken: undefined },
        },
      };
    }));
  };

  const handleSave = () => {
    if (!currentBranch) return;
    const cleanBranches = draftBranches.map((branch) => {
      const normalized = normalize(branch.integrations);
      return {
        ...branch,
        integrations: {
          ifood: { ...normalized.ifood, accountId: String(normalized.ifood?.accountId || '').trim() },
          cardapioWeb: {
            ...normalized.cardapioWeb,
            accountId: String(normalized.cardapioWeb?.accountId || branch.id).trim(),
            merchantToken: undefined,
          },
        },
      };
    });
    const active = cleanBranches.find((b) => b.id === currentBranch.id) || cleanBranches[0];
    onSave(active.integrations!, cleanBranches);
    setSaved(true);
  };

  const providerCard = (provider: 'ifood' | 'cardapioWeb', name: string) => {
    if (!currentBranch) return null;
    const config = currentIntegrations[provider] || emptyConfig();
    const webhookUrl = provider === 'cardapioWeb'
      ? `${originUrl}/api/webhook/cardapio-web/${currentBranch.id}`
      : `${originUrl}/api/webhook/ifood/${currentBranch.id}`;
    const copyKey = `${provider}_${currentBranch.id}`;

    return (
      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center">
              {provider === 'ifood' ? <Store className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-black text-sm text-white">{name} · {currentBranch.name}</h4>
              <p className="text-xs text-slate-400 mt-1">
                {provider === 'cardapioWeb'
                  ? 'A chave da API fica somente no servidor. Esta tela nunca armazena nem exibe o segredo.'
                  : 'Configuração pública da integração desta loja.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateProvider(provider, { enabled: !config.enabled })}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-black ${config.enabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
          >
            {config.enabled ? 'ATIVA' : 'INATIVA'}
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">Webhook desta loja</span>
            <button type="button" onClick={() => copyToClipboard(webhookUrl, copyKey)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-xs">
              {copiedKey === copyKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === copyKey ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="font-mono text-[11px] text-emerald-400 break-all">{webhookUrl}</div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
            {provider === 'cardapioWeb' ? 'Identificador público da loja' : 'Merchant ID'}
          </span>
          <input
            value={config.accountId || (provider === 'cardapioWeb' ? currentBranch.id : '')}
            onChange={(e) => updateProvider(provider, { accountId: e.target.value })}
            placeholder={currentBranch.id}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
          />
        </label>

        <button
          type="button"
          disabled={!config.enabled}
          onClick={() => onSimulateIncomingOrder(provider === 'ifood' ? 'ifood' : 'cardapio_web', currentBranch.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-40 text-xs font-bold"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Testar integração
        </button>
      </section>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><Webhook className="w-5 h-5" /></div>
            <div>
              <h3 className="font-black text-lg">Integrações por loja</h3>
              <p className="text-xs text-slate-400">{storeName} · {activeCount} integração(ões) ativa(s) na loja selecionada</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {draftBranches.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
            Cadastre ao menos uma loja/filial antes de configurar integrações.
          </div>
        ) : (
          <>
            <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto">
              {draftBranches.map((branch) => (
                <button key={branch.id} type="button" onClick={() => setSelectedBranchId(branch.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${branch.id === currentBranch?.id ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                  {branch.icon || '🏪'} {branch.name}
                </button>
              ))}
            </div>
            {providerCard('ifood', 'iFood')}
            {providerCard('cardapioWeb', 'Cardápio Web')}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-emerald-300">{saved && <><CheckCircle2 className="w-4 h-4 inline mr-1" />Configurações salvas</>}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-800 rounded-xl text-xs font-bold">Cancelar</button>
            <button type="button" disabled={!currentBranch} onClick={handleSave} className="px-4 py-2.5 bg-emerald-600 disabled:opacity-40 rounded-xl text-xs font-black flex items-center gap-2"><Save className="w-4 h-4" /> Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
