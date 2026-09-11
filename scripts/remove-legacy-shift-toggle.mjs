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

let after = before;
if (after.includes(legacyToggle)) {
  after = after.replace(legacyToggle, '');
}

if (after === before) {
  console.log('[remove-legacy-shift-toggle] legacy sidebar shift toggle already absent');
} else {
  fs.writeFileSync(path, after);
  console.log('[remove-legacy-shift-toggle] removed duplicate legacy sidebar shift toggle');
}
