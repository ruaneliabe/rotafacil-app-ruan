import fs from 'node:fs';

const path = 'src/components/MotoboyApp.tsx';
let s = fs.readFileSync(path, 'utf8');

// Motoboy chamado sai da fila, mas continua vendo os pedidos reservados/prontos.
s = s.replace(
  '{inQueue && (\n              <>',
  '{(inQueue || preparing.length > 0 || ready.length > 0) && (\n              <>'
);

// Nunca deixa a aba Pedidos em branco quando o motoboy está fora da fila.
const anchor = `            {(inQueue || preparing.length > 0 || ready.length > 0) && (\n              <>`;
if (!s.includes('data-motoboy-idle-recovery="true"') && s.includes(anchor)) {
  const fallback = `            {!inQueue && !returning && driver.status !== 'delivering' && preparing.length === 0 && ready.length === 0 && route.length === 0 && (\n              <section data-motoboy-idle-recovery="true" className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">\n                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-50">\n                  <UsersRound className="h-10 w-10 text-violet-600" />\n                </div>\n                <h2 className="mt-5 text-xl font-black tracking-tight">Fora da fila</h2>\n                <p className="mx-auto mt-2 max-w-[290px] text-[13px] leading-relaxed text-slate-500">Entre na fila para ficar disponível para o próximo despacho.</p>\n                <button onClick={enterQueue} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-[16px] font-black text-white shadow-lg shadow-violet-200 active:scale-[.99]">\n                  Entrar na fila <ArrowRight className="h-5 w-5" />\n                </button>\n              </section>\n            )}\n\n`;
  s = s.replace(anchor, fallback + anchor);
}

fs.writeFileSync(path, s);
console.log('[motoboy-pilot-recovery] applied');
