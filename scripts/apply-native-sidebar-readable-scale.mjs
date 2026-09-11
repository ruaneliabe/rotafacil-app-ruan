import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) {
    console.log(`[native-sidebar] ${path}: already patched or no-op`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`[native-sidebar] ${path}: updated`);
};

// Sidebar nativa: deixa UM ÚNICO controle de operação, dentro da sidebar,
// acima das configurações. Nada flutuante e nada duplicado.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  s = s.replace(
    '<div className="flex min-h-screen bg-[#FAF9F6] text-slate-900 -m-3 md:-m-4">',
    '<div data-rota-dashboard="true" className="flex min-h-screen bg-[#FAF9F6] text-slate-900 -m-3 md:-m-4">'
  );

  // Remove o item redundante "Gestão e fechamento" da navegação.
  s = s.replace(
    /\n\s*<button\s+type="button"\s+onClick=\{\(\) => setActiveTab\('gestao'\)\}[\s\S]*?<span className="flex-1 text-left">Gestão e fechamento<\/span>[\s\S]*?<\/button>/,
    ''
  );

  const sidebarBottom = /\n\s*<div className="space-y-2\.5">\s*<button\s+type="button"\s+onClick=\{onToggleShift\}[\s\S]*?\{onLogout && \([\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/;

  const sidebarReplacement = `
        <div className="space-y-3">
          <div data-sidebar-operation-card="true" className={\`rounded-2xl border p-3.5 shadow-sm \${shift.isOpen ? 'border-emerald-300/60 bg-emerald-50/80' : 'border-slate-200 bg-white'}\`}>
            <div className="flex items-center gap-2.5">
              <span className={\`h-2.5 w-2.5 shrink-0 rounded-full \${shift.isOpen ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.10)]' : 'bg-slate-400'}\`} />
              <div className="min-w-0 flex-1">
                <p className={\`truncate text-[13px] font-black \${shift.isOpen ? 'text-emerald-700' : 'text-slate-800'}\`}>
                  {shift.isOpen ? 'Operação aberta' : 'Operação fechada'}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {shift.isOpen ? 'Em andamento' : 'Fora do horário'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleShift}
              className={\`mt-3 flex h-11 w-full items-center justify-center rounded-xl px-3 text-[13px] font-black transition-colors \${shift.isOpen ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-violet-600 text-white hover:bg-violet-500'}\`}
            >
              <Power className="mr-2 h-4 w-4" />
              {shift.isOpen ? 'Encerrar turno' : 'Abrir turno'}
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="w-full flex min-h-11 items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Settings className="w-4.5 h-4.5 text-slate-500" />
            <span className="flex-1 text-left">Configuração da loja</span>
          </button>

          <div className="flex items-center justify-between px-3 pt-3 border-t border-[#E5E3DC]">
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-slate-600">
              <User className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="truncate">{username || 'Admin'}</span>
            </span>
            {onLogout && (
              <button type="button" onClick={onLogout} title="Sair" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>`;

  if (sidebarBottom.test(s)) s = s.replace(sidebarBottom, sidebarReplacement);

  // Aumenta os controles superiores do legado sem inflar os painéis.
  s = s.replaceAll('className="px-2.5 py-1 rounded transition-all cursor-pointer', 'className="min-h-10 px-3 py-2 rounded-lg text-[13px] transition-all cursor-pointer');
  s = s.replace('className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-all border border-[#E5E3DC] cursor-pointer"', 'className="grid h-10 w-10 place-items-center bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl transition-all border border-[#E5E3DC] cursor-pointer"');
  s = s.replaceAll('className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs rounded-lg', 'className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[13px] rounded-xl');
  s = s.replaceAll('className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold text-xs rounded-lg', 'className="h-10 px-4 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold text-[13px] rounded-xl');

  return s;
});

// O card flutuante antigo do wrapper fica SEMPRE oculto. O botão funcional é o da sidebar.
// Também injeta uma escala visual mais confortável no dashboard inteiro.
patch('src/components/StoreDashboard.tsx', (input) => {
  let s = input;

  s = s.replace(
    /<div data-rota-operation-card="true" className="[^"]*">/,
    '<div data-rota-operation-card="true" className="hidden">'
  );

  const oldStyle = /\s*<style data-rota-readable-scale>[\s\S]*?<\/style>/;
  s = s.replace(oldStyle, '');

  if (!s.includes('data-rota-readable-scale')) {
    s = s.replace(
      '<LegacyStoreDashboard {...dashboardProps} />',
      `<style data-rota-readable-scale>{\`\n        /* Escala geral de leitura */\n        [data-rota-dashboard=\"true\"] { font-size: 14px; }\n        [data-rota-dashboard=\"true\"] aside { width: 236px !important; }\n        [data-rota-dashboard=\"true\"] aside nav { gap: 4px !important; }\n        [data-rota-dashboard=\"true\"] aside nav button { min-height: 44px !important; font-size: 14px !important; border-radius: 12px !important; padding-left: 12px !important; padding-right: 12px !important; }\n\n        /* Tipografia pequena deixa de parecer miniatura */\n        [data-rota-dashboard=\"true\"] [class*=\"text-[8px]\"] { font-size: 10.5px !important; line-height: 1.35 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[9px]\"] { font-size: 11px !important; line-height: 1.35 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[10px]\"] { font-size: 11.5px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[11px]\"] { font-size: 12px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] .text-xs { font-size: 13px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[13px]\"] { font-size: 14px !important; line-height: 1.4 !important; }\n\n        /* Botões principais mais fáceis de clicar */\n        [data-rota-dashboard=\"true\"] button[class*=\"bg-violet-600\"],\n        [data-rota-dashboard=\"true\"] button[class*=\"bg-emerald-600\"] { min-height: 40px; font-size: 13px !important; padding-left: 16px; padding-right: 16px; border-radius: 11px; }\n\n        /* KPIs / cards de operação */\n        [data-rota-dashboard=\"true\"] [data-dispatch-kpi] strong,\n        [data-rota-dashboard=\"true\"] [data-dispatch-kpi] b { font-size: 21px !important; }\n\n        /* Linhas de pedido ganham respiro sem virar cards gigantes */\n        [data-rota-dashboard=\"true\"] [data-order-card],\n        [data-rota-dashboard=\"true\"] [data-order-row] { min-height: 52px; }\n\n        /* Inputs/busca com área clicável semelhante ao Cardápio Web */\n        [data-rota-dashboard=\"true\"] input { min-height: 42px; font-size: 14px !important; }\n      \`}</style>\n      <LegacyStoreDashboard {...dashboardProps} />`
    );
  }

  return s;
});
