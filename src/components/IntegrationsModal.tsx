import React, { useState } from 'react';
import {
  Webhook,
  CheckCircle2,
  Copy,
  Zap,
  Globe,
  Smartphone,
  Server,
  RefreshCw,
  X,
  Code,
  ShieldCheck,
  Radio,
  Sliders,
  ExternalLink
} from 'lucide-react';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateIncomingOrder: (channel: 'ifood' | 'cardapio_web' | 'pdv' | 'whatsapp') => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  onSimulateIncomingOrder,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [ifoodEnabled, setIfoodEnabled] = useState(true);
  const [cardapioWebEnabled, setCardapioWebEnabled] = useState(true);
  const [anotaAiEnabled, setAnotaAiEnabled] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'simulator' | 'docs'>('overview');

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/v1/integrations/webhook/orders`;
  const storeApiKey = 'DEMO_ONLY_NOT_CONFIGURED';

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-auto space-y-5 text-slate-100">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-tight">Hub de Integrações Automáticas</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                  Agnóstico
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronização em tempo real com iFood, Cardápio Web, Anota AI e Sistemas PDV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedTab('overview')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Canais Ativos</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTab('simulator')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedTab === 'simulator'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulador de Webhook</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTab('docs')}
            className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedTab === 'docs'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>API & Webhooks</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {selectedTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Canais de Pedidos Habilitados</span>
                <span className="text-emerald-400 text-[11px] lowercase">3/3 ativos</span>
              </h4>

              {/* iFood Channel */}
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔴</span>
                  <div>
                    <h5 className="font-extrabold text-sm text-white">iFood Merchant API</h5>
                    <p className="text-[11px] text-slate-400">Sincroniza pedidos aprovados e gera código de despacho no iFood</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIfoodEnabled(!ifoodEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    ifoodEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {ifoodEnabled ? 'CONECTADO' : 'DESATIVADO'}
                </button>
              </div>

              {/* Cardápio Web Channel */}
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌐</span>
                  <div>
                    <h5 className="font-extrabold text-sm text-white">Cardápio Web / Site Próprio</h5>
                    <p className="text-[11px] text-slate-400">Recepção via Webhook HTTP instantâneo na criação do pedido</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCardapioWebEnabled(!cardapioWebEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    cardapioWebEnabled
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {cardapioWebEnabled ? 'CONECTADO' : 'DESATIVADO'}
                </button>
              </div>

              {/* Anota AI / PDV Channel */}
              <div className="flex items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💻</span>
                  <div>
                    <h5 className="font-extrabold text-sm text-white">Anota AI / PDV Interno</h5>
                    <p className="text-[11px] text-slate-400">Recebe os pedidos diretamente do caixa/atendente no balcão</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnotaAiEnabled(!anotaAiEnabled)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    anotaAiEnabled
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {anotaAiEnabled ? 'CONECTADO' : 'DESATIVADO'}
                </button>
              </div>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 text-xs text-emerald-200 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5 font-black">Como o Rota Fácil se posiciona?</strong>
                Você não precisa trocar seu sistema de vendas! O Rota Fácil entra <strong>depois do pedido feito</strong> — ele assume como o cérebro operacional da sua frota de entregadores próprios, agrupando rotas e rastreando no mapa em tempo real.
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIMULATOR */}
        {selectedTab === 'simulator' && (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Testar Recepção em Tempo Real</span>
                </h4>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Simulação de Produção
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clique nos botões abaixo para simular a chegada instantânea de um pedido vindo diretamente das plataformas. O pedido cairá no seu painel com a tag do canal correspondente!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSimulateIncomingOrder('ifood');
                    onClose();
                  }}
                  className="p-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 hover:border-red-400 text-red-100 rounded-xl transition-all cursor-pointer text-left space-y-1 shadow-xs group"
                >
                  <div className="flex items-center justify-between font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>🔴</span> Simular Pedido iFood
                    </span>
                    <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-extrabold">
                      iFood API
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 group-hover:text-slate-300">
                    Insere pedido com itens de hambúrguer gourmet e endereço do centro.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSimulateIncomingOrder('cardapio_web');
                    onClose();
                  }}
                  className="p-3 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/40 hover:border-blue-400 text-blue-100 rounded-xl transition-all cursor-pointer text-left space-y-1 shadow-xs group"
                >
                  <div className="flex items-center justify-between font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>🌐</span> Simular Cardápio Web
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-extrabold">
                      Webhook HTTP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 group-hover:text-slate-300">
                    Insere pedido direto do site próprio do restaurante com taxa de entrega.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSimulateIncomingOrder('pdv');
                    onClose();
                  }}
                  className="p-3 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 hover:border-purple-400 text-purple-100 rounded-xl transition-all cursor-pointer text-left space-y-1 shadow-xs group"
                >
                  <div className="flex items-center justify-between font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>💻</span> Simular Pedido PDV
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-extrabold">
                      Sistema Interno
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 group-hover:text-slate-300">
                    Insere pedido registrado pelo operador do balcão/caixa.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSimulateIncomingOrder('whatsapp');
                    onClose();
                  }}
                  className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-100 rounded-xl transition-all cursor-pointer text-left space-y-1 shadow-xs group"
                >
                  <div className="flex items-center justify-between font-black text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>💬</span> Simular WhatsApp Bot
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-extrabold">
                      Zap Direto
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 group-hover:text-slate-300">
                    Insere pedido anotado via robô de WhatsApp ou atendente da loja.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-950/60 border border-amber-500/50 text-amber-200 rounded-xl p-3 text-xs font-bold leading-relaxed">
          ⚠️ Integrações externas ainda estão em modo de demonstração. iFood, WhatsApp, Cardápio Web e Webhooks não estão conectados de verdade nesta versão.
        </div>

        {/* TAB 3: DOCS & WEBHOOK KEYS */}
        {selectedTab === 'docs' && (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>Credenciais do Seu Endpoint Webhook</span>
              </h4>

              {/* Webhook URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Webhook Payload Endpoint (POST)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono px-3 py-2 rounded-xl focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, 'url')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'url' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    <span>{copiedKey === 'url' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* API Secret */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Secret Key Bearer Token
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={storeApiKey}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono px-3 py-2 rounded-xl focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(storeApiKey, 'secret')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedKey === 'secret' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    <span>{copiedKey === 'secret' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* JSON Example */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Exemplo de JSON Aceito (iFood / Webhook Standard)
                </label>
                <pre className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-[10px] text-slate-300 font-mono overflow-x-auto">
{`{
  "originChannel": "ifood",
  "clientName": "Ana Clara Santos",
  "clientPhone": "47998811223",
  "address": "Rua XV de Novembro, 850 - Ap 302",
  "neighborhood": "Centro",
  "total": 68.50,
  "paymentMethod": "pix",
  "itemsSummary": "2x X-Salada Gourmet, 1x Coca 2L"
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
