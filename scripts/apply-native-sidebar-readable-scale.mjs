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

// 1) Coloca o controle de operação DENTRO da sidebar real e aumenta a legibilidade.
patch('src/components/StoreDashboardLegacy.tsx', (input) => {
  let s = input;

  s = s.replace(
    '<div className="flex min-h-screen bg-[#FAF9F6] text-slate-900 -m-3 md:-m-4">',
    '<div data-rota-dashboard="true" className="flex min-h-screen bg-[#FAF9F6] text-slate-900 -m-3 md:-m-4">'
  );

  const oldBottom = /<div className="space-y-2\.5">\s*<button\s+type="button"\s+onClick=\{onToggleShift\}[\s\S]*?\{onLogout && \([\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/;

  if (oldBottom.test(s)) {
    s = s.replace(oldBottom, `<div className="space-y-3">
          <div data-sidebar-operation-card="true" className={\`rounded-xl border p-3 shadow-sm \${shift.isOpen ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}\`}>
            <div className="flex items-center gap-2.5">
              <div className={\`grid h-8 w-8 shrink-0 place-items-center rounded-lg \${shift.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}\`}>
                <Power className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={\`h-2 w-2 rounded-full \${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}\`} />
                  <span className="truncate text-[12px] font-black text-slate-900">{shift.isOpen ? 'Operação aberta' : 'Operação fechada'}</span>
                </div>
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">{shift.isOpen ? 'Em andamento' : 'Fora do horário'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleShift}
              className={\`mt-3 flex h-9 w-full items-center justify-center rounded-lg px-3 text-[11px] font-black transition-colors \${shift.isOpen ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50' : 'bg-violet-600 text-white hover:bg-violet-500'}\`}
            >
              {shift.isOpen ? 'ENCERRAR TURNO' : 'ABRIR TURNO'}
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14px] font-medium text-slate-700 hover:bg-slate-100"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span className="flex-1 text-left">Configuração da loja</span>
          </button>

          <div className="flex items-center justify-between px-2.5 pt-2.5 border-t border-[#E5E3DC]">
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-slate-600">
              <User className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="truncate">{username || 'Admin'}</span>
            </span>
            {onLogout && (
              <button type="button" onClick={onLogout} title="Sair" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>`);
  }

  return s;
});

// 2) O card flutuante novo deixa de existir visualmente: há somente o card nativo da sidebar.
patch('src/components/StoreDashboard.tsx', (input) => {
  let s = input;
  s = s.replace(
    /<div data-rota-operation-card="true" className="[^"]*">/,
    '<div data-rota-operation-card="true" className="hidden">'
  );

  // Escala tipográfica moderada (~10-15%) sem aumentar o tamanho dos painéis.
  if (!s.includes('data-rota-readable-scale')) {
    s = s.replace(
      '<LegacyStoreDashboard {...dashboardProps} />',
      `<style data-rota-readable-scale>{\`\n        [data-rota-dashboard=\"true\"] [class*=\"text-[8px]\"] { font-size: 10px !important; line-height: 1.35 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[9px]\"] { font-size: 11px !important; line-height: 1.35 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[10px]\"] { font-size: 11.5px !important; line-height: 1.35 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[11px]\"] { font-size: 12px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] .text-xs { font-size: 13px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] [class*=\"text-[13px]\"] { font-size: 14px !important; line-height: 1.4 !important; }\n        [data-rota-dashboard=\"true\"] aside nav button { min-height: 42px; font-size: 14px !important; }\n      \`}</style>\n      <LegacyStoreDashboard {...dashboardProps} />`
    );
  }

  return s;
});
