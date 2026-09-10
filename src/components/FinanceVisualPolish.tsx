import React, { useEffect } from 'react';

const ensureStyle = () => {
  if (document.getElementById('rota-finance-polish-style')) return;
  const style = document.createElement('style');
  style.id = 'rota-finance-polish-style';
  style.textContent = `
    [data-finance-polished="true"] { --rf-finance-gap: 14px; }
    [data-finance-polished="true"] .rf-finance-periods { box-shadow: inset 0 0 0 1px rgba(226,232,240,.7); }
    [data-finance-polished="true"] .rf-finance-empty { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
    [data-finance-polished="true"] .rf-finance-empty-card { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:#94a3b8; text-align:center; padding:24px; }
    [data-finance-polished="true"] .rf-finance-empty-icon { width:38px; height:38px; border-radius:12px; display:grid; place-items:center; background:#f8fafc; border:1px solid #e2e8f0; color:#8b5cf6; font-weight:900; }
    [data-finance-polished="true"] .rf-finance-shift { border-width:1px !important; box-shadow:0 1px 2px rgba(15,23,42,.04); }
    [data-finance-polished="true"] .rf-finance-settlement table tbody tr { height:46px; }
    [data-finance-polished="true"] .rf-finance-settlement table td { padding-top:9px !important; padding-bottom:9px !important; }
  `;
  document.head.appendChild(style);
};

const text = (el: Element | null) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

export const FinanceVisualPolish: React.FC = () => {
  useEffect(() => {
    ensureStyle();

    const polish = () => {
      const heading = Array.from(document.querySelectorAll('h3')).find((el) => text(el) === 'Central financeira') as HTMLElement | undefined;
      if (!heading) return;

      const root = heading.closest('.space-y-4') as HTMLElement | null;
      if (!root) return;
      root.dataset.financePolished = 'true';

      const periodWrap = Array.from(root.querySelectorAll('div')).find((el) => {
        const t = text(el);
        return t.includes('Hoje') && t.includes('Ontem') && t.includes('7 dias') && t.includes('Semana passada') && el.querySelectorAll('button').length >= 4;
      }) as HTMLElement | undefined;
      periodWrap?.classList.add('rf-finance-periods');

      const settlementHeading = Array.from(root.querySelectorAll('h4')).find((el) => text(el) === 'Acerto dos motoboys');
      const settlement = settlementHeading?.closest('section') as HTMLElement | null;
      settlement?.classList.add('rf-finance-settlement');

      const shiftLabel = Array.from(root.querySelectorAll('p')).find((el) => {
        const t = text(el);
        return t.startsWith('Turno de hoje em andamento') || t === 'Operação fechada';
      });
      const shiftBox = shiftLabel?.closest('div.rounded-2xl') as HTMLElement | null;
      if (shiftBox) {
        shiftBox.classList.add('rf-finance-shift');
        if (!shiftBox.querySelector('[data-shift-label="true"]')) {
          const badge = document.createElement('span');
          badge.dataset.shiftLabel = 'true';
          badge.className = `ml-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${text(shiftLabel).includes('andamento') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`;
          badge.textContent = text(shiftLabel).includes('andamento') ? 'AO VIVO' : 'PARADO';
          shiftLabel?.appendChild(badge);
        }
      }

      const revenueHeading = Array.from(root.querySelectorAll('h4')).find((el) => text(el) === 'Faturamento e entregas');
      const revenueSection = revenueHeading?.closest('section') as HTMLElement | null;
      if (revenueSection) {
        const zeroRevenue = Array.from(root.querySelectorAll('p')).some((el) => text(el) === 'R$ 0,00' && text(el.parentElement).includes('Faturamento (entregas)'));
        const chartBox = Array.from(revenueSection.querySelectorAll('div')).find((el) => el.className.includes('h-[250px]')) as HTMLElement | undefined;
        if (chartBox) {
          chartBox.style.position = 'relative';
          const old = chartBox.querySelector('[data-finance-empty="revenue"]');
          if (zeroRevenue && !old) {
            const empty = document.createElement('div');
            empty.dataset.financeEmpty = 'revenue';
            empty.className = 'rf-finance-empty';
            empty.innerHTML = '<div class="rf-finance-empty-card"><div class="rf-finance-empty-icon">↗</div><strong class="text-xs text-slate-600">Sem movimento no período</strong><span class="text-[10px]">O gráfico aparece conforme os pedidos entram e são concluídos.</span></div>';
            chartBox.appendChild(empty);
            chartBox.querySelectorAll(':scope > div:not([data-finance-empty])').forEach((el) => ((el as HTMLElement).style.opacity = '0.12'));
          } else if (!zeroRevenue && old) {
            old.remove();
            chartBox.querySelectorAll(':scope > div').forEach((el) => ((el as HTMLElement).style.opacity = ''));
          }
        }
      }

      const storeHeading = Array.from(root.querySelectorAll('h4')).find((el) => text(el) === 'Faturamento por loja');
      const storeSection = storeHeading?.closest('section') as HTMLElement | null;
      if (storeSection) {
        const isZero = text(storeSection).includes('R$ 0,00') && text(storeSection).includes('Sem faturamento no período.');
        const donut = Array.from(storeSection.querySelectorAll('div')).find((el) => (el as HTMLElement).style.background.includes('conic-gradient')) as HTMLElement | undefined;
        if (isZero && donut) {
          donut.style.background = '#f8fafc';
          donut.style.border = '1px dashed #cbd5e1';
          donut.style.width = '128px';
          donut.style.height = '128px';
          donut.style.boxShadow = 'none';
        }
      }
    };

    polish();
    const observer = new MutationObserver(() => requestAnimationFrame(polish));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
};
