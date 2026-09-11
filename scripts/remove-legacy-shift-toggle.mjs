import fs from 'node:fs';

const path = 'src/components/StoreDashboardLegacy.tsx';
const before = fs.readFileSync(path, 'utf8');

const legacyToggle = `          <button
            type="button"
            onClick={onToggleShift}
            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800"
          >
            <span className={\`w-1.5 h-1.5 rounded-full \${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}\`} />
            {shift.isOpen ? 'Loja aberta · encerrar' : 'Loja fechada · abrir'}
          </button>
`;

const operationCard = `          <div data-sidebar-operation-card="true" className={\`rounded-xl border p-3 shadow-sm \${shift.isOpen ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}\`}>
            <div className="flex items-center gap-2.5">
              <span className={\`h-2.5 w-2.5 shrink-0 rounded-full \${shift.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}\`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-slate-900">{shift.isOpen ? 'Operação aberta' : 'Operação fechada'}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{shift.isOpen ? 'Em andamento' : 'Fora do horário'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleShift}
              className={\`mt-3 flex h-10 w-full items-center justify-center rounded-lg px-3 text-[12px] font-black transition-colors \${shift.isOpen ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50' : 'bg-violet-600 text-white hover:bg-violet-500'}\`}
            >
              {shift.isOpen ? 'ENCERRAR TURNO' : 'ABRIR TURNO'}
            </button>
          </div>
`;

let after = before;
const hasNativeCard = after.includes('data-sidebar-operation-card="true"');

if (hasNativeCard) {
  // Se um patch anterior já criou o card correto, só garante que o botão legado não fique duplicado.
  if (after.includes(legacyToggle)) after = after.replace(legacyToggle, '');
} else if (after.includes(legacyToggle)) {
  // Esse script roda por último: em vez de apagar o único controle, converte o legado no card definitivo.
  after = after.replace(legacyToggle, operationCard);
} else {
  // Fallback para builds onde o bloco legado já foi removido por outro patch.
  // Injeta o card imediatamente antes do botão de configuração no rodapé da sidebar.
  const settingsAnchor = `          <button
            type="button"
            onClick={onOpenStoreSettings}`;
  if (after.includes(settingsAnchor)) {
    after = after.replace(settingsAnchor, operationCard + settingsAnchor);
  }
}

if (after === before) {
  console.log('[remove-legacy-shift-toggle] sidebar operation control already correct');
} else {
  fs.writeFileSync(path, after);
  console.log('[remove-legacy-shift-toggle] ensured one working operation control in sidebar');
}
