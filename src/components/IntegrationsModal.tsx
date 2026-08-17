import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe, Save, Store, Webhook, X, Zap } from 'lucide-react';
import { StoreIntegrationConfig, StoreIntegrations } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  integrations?: StoreIntegrations;
  onSave: (integrations: StoreIntegrations) => void;
  onSimulateIncomingOrder: (channel: 'ifood' | 'cardapio_web') => void;
}

const emptyConfig = (): StoreIntegrationConfig => ({ enabled: false, accountId: '', webhookUrl: '' });
const normalize = (value?: StoreIntegrations): StoreIntegrations => ({
  ifood: { ...emptyConfig(), ...value?.ifood },
  cardapioWeb: { ...emptyConfig(), ...value?.cardapioWeb },
});

export const IntegrationsModal: React.FC<Props> = ({
  isOpen, onClose, storeName, integrations, onSave, onSimulateIncomingOrder,
}) => {
  const [draft, setDraft] = useState(() => normalize(integrations));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(normalize(integrations));
      setSaved(false);
    }
  }, [integrations, isOpen]);

  const activeCount = useMemo(
    () => [draft.ifood, draft.cardapioWeb].filter((item) => item.enabled).length,
    [draft]
  );
  if (!isOpen) return null;

  const update = (provider: keyof StoreIntegrations, patch: Partial<StoreIntegrationConfig>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [provider]: { ...current[provider], ...patch } }));
  };

  const handleSave = () => {
    const updatedAt = Date.now();
    const next = {
      ifood: { ...draft.ifood, accountId: draft.ifood.accountId.trim(), webhookUrl: draft.ifood.webhookUrl.trim(), updatedAt },
      cardapioWeb: { ...draft.cardapioWeb, accountId: draft.cardapioWeb.accountId.trim(), webhookUrl: draft.cardapioWeb.webhookUrl.trim(), updatedAt },
    };
    setDraft(next);
    onSave(next);
    setSaved(true);
  };

  const providerCard = (
    provider: keyof StoreIntegrations,
    name: string,
    description: string,
    accountLabel: string,
    placeholder: string,
    accent: 'red' | 'blue'
  ) => {
    const config = draft[provider];
    const activeStyle = accent === 'red'
      ? 'bg-red-500/15 text-red-300 border-red-500/40'
      : 'bg-blue-500/15 text-blue-300 border-blue-500/40';
    return (
      <section className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${activeStyle}`}>
              {provider === 'ifood' ? <Store className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-black text-sm text-white">{name}</h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={config.enabled}
            onClick={() => update(provider, { enabled: !config.enabled })}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-black transition-colors cursor-pointer ${config.enabled ? activeStyle : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            {config.enabled ? 'ATIVA' : 'INATIVA'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{accountLabel}</span>
            <input value={config.accountId} onChange={(e) => update(provider, { accountId: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">URL de recebimento</span>
            <input type="url" value={config.webhookUrl} onChange={(e) => update(provider, { webhookUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">Configuração vinculada à loja {storeName}.</p>
          <button type="button" disabled={!config.enabled}
            onClick={() => onSimulateIncomingOrder(provider === 'ifood' ? 'ifood' : 'cardapio_web')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-200 transition-colors cursor-pointer">
            <Zap className="w-3.5 h-3.5" /> Testar pedido
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"><Webhook className="w-5 h-5" /></div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tight">Integrações da loja</h3>
              <p className="text-xs text-slate-400">{storeName} · {activeCount} de 2 canais ativos</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {providerCard('ifood', 'iFood', 'Configure a conta da loja e o endpoint usado na entrada de pedidos.', 'ID do merchant', 'Ex.: 12345678', 'red')}
          {providerCard('cardapioWeb', 'Cardápio Web', 'Receba os pedidos do site ou cardápio digital desta loja.', 'Identificador da loja', 'Ex.: hope-burger', 'blue')}
        </div>
        <div className="bg-amber-950/50 border border-amber-500/30 text-amber-200 rounded-xl p-3 text-xs leading-relaxed">
          A configuração e o fluxo simulado funcionam nesta versão. A conexão com APIs externas depende de um serviço seguro no servidor; credenciais secretas não são armazenadas aqui.
        </div>
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-emerald-300 flex items-center gap-1.5">{saved && <><CheckCircle2 className="w-4 h-4" /> Configurações salvas</>}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer">Cancelar</button>
            <button type="button" onClick={handleSave} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer"><Save className="w-4 h-4" /> Salvar integrações</button>
          </div>
        </div>
      </div>
    </div>
  );
};
