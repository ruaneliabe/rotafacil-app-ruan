import { useEffect } from 'react';

/**
 * Camada visual leve para o piloto.
 * Não altera regras de pedido, Cardápio Web, fila ou Firestore.
 * Só organiza a apresentação da tela de operação depois que o React renderiza.
 */
export function PilotVisualPolish() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'rota-facil-pilot-polish';
    style.textContent = `
      html,body,#root{background:#070b12!important;color:#e5e7eb!important}
      body{overflow-x:hidden!important}
      .pilot-nav{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;background:transparent!important;border:0!important;border-bottom:1px solid #273244!important;border-radius:0!important;padding:0!important;min-height:50px!important;overflow-x:auto!important}
      .pilot-nav>div{display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:nowrap!important}
      .pilot-nav button{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:48px!important;padding:0 12px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#94a3b8!important;white-space:nowrap!important;opacity:1!important;visibility:visible!important}
      .pilot-nav button span{opacity:1!important;visibility:visible!important}
      .pilot-nav button:hover{color:#f8fafc!important}
      .pilot-nav .pilot-finance{margin-left:4px!important;color:#c4b5fd!important}
      .pilot-nav .pilot-finance::before{content:'$';display:grid;place-items:center;width:18px;height:18px;border-radius:5px;background:#24173f;color:#c4b5fd;font-size:10px;font-weight:700}
      .pilot-hide{display:none!important}
      .pilot-store-header{border-color:#263244!important;box-shadow:0 16px 45px rgba(0,0,0,.16)!important}
      .pilot-store-header .pilot-store-status{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:6px 10px!important;border-radius:8px!important;font-size:11px!important;font-weight:600!important}
      .pilot-store-header .pilot-cw-status{display:inline-flex!important;align-items:center!important;padding:6px 10px!important;border:1px solid #334155!important;border-radius:8px!important;background:#0b1220!important;color:#94a3b8!important;font-size:11px!important}
      .pilot-central{border-color:#263244!important;box-shadow:0 22px 55px rgba(0,0,0,.22)!important}
      .pilot-metric-number{font-size:24px!important;line-height:1!important;font-weight:650!important;letter-spacing:-.03em!important}
      .pilot-metric-label{font-size:11px!important;letter-spacing:.04em!important;color:#8190a7!important}
      .pilot-test-order{background:transparent!important;border:1px solid #334155!important;color:#94a3b8!important;box-shadow:none!important;opacity:.78!important}
      .pilot-test-order:hover{color:#e2e8f0!important;background:#111827!important;opacity:1!important}
      .pilot-empty{min-height:145px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:20px!important;color:#64748b!important;font-size:11px!important}
      .pilot-empty strong{display:block!important;color:#cbd5e1!important;font-size:12px!important;margin-bottom:4px!important}
      .pilot-empty span{display:block!important;color:#64748b!important;font-size:10px!important;max-width:220px!important}
      @media(max-width:900px){.pilot-nav{gap:2px!important}.pilot-nav button{padding:0 8px!important}.pilot-metric-number{font-size:20px!important}}
    `;
    document.head.appendChild(style);

    const emptyCopy: Record<string, [string,string]> = {
      'Preparando': ['Nenhum pedido em produção','Os próximos pedidos do Cardápio Web aparecerão aqui.'],
      'Vinculados a motoboy': ['Nenhuma carga atribuída','Pedidos vinculados a um entregador aparecerão aqui.'],
      'Pronto / aguardando retirada': ['Nenhum pedido pronto','Quando a cozinha finalizar, o pedido aparecerá aqui.'],
      'Em entrega': ['Nenhum pedido em entrega','Pedidos despachados aparecerão aqui durante a rota.'],
    };

    const apply = () => {
      const centralTitle = Array.from(document.querySelectorAll('h1,h2,h3')).find(el => el.textContent?.trim() === 'Central de entregas');
      if (!centralTitle) return false;

      const central = centralTitle.parentElement?.parentElement?.parentElement as HTMLElement | null;
      central?.classList.add('pilot-central');

      // Navegação operacional: sem Mapa ao Vivo e sem Gestão & Fechamento duplicado.
      Array.from(document.querySelectorAll('nav,div')).forEach(el => {
        const text = el.textContent || '';
        if (text.includes('Pedidos & Despacho') && text.includes('Kanban') && text.includes('Entregadores') && el.children.length < 12) {
          el.classList.add('pilot-nav');
          Array.from(el.querySelectorAll('button')).forEach(button => {
            const label = (button.textContent || '').trim();
            if (label.includes('Mapa ao Vivo')) button.classList.add('pilot-hide');
            if (label.includes('Gestão & Fechamento') || label === 'Financeiro') {
              button.classList.add('pilot-finance');
              const span = button.querySelector('span');
              if (span) span.textContent = 'Financeiro'; else button.textContent = 'Financeiro';
            }
          });
        }
      });

      // Cabeçalho da loja: remove ações de teste/gestão duplicadas e melhora leitura de status.
      const storeHeader = Array.from(document.querySelectorAll('header')).find(el => {
        const text = el.textContent || '';
        return text.includes('Rota Fácil') && text.includes('Loja') && (text.includes('Novo Pedido') || text.includes('Gestão'));
      }) as HTMLElement | undefined;
      if (storeHeader) {
        storeHeader.classList.add('pilot-store-header');
        Array.from(storeHeader.querySelectorAll('button')).forEach(button => {
          const label = (button.textContent || '').trim();
          if (label.includes('Novo Pedido') || label === '⚙️ Gestão' || label === 'Gestão') button.classList.add('pilot-hide');
        });
        Array.from(storeHeader.querySelectorAll('span,button,a')).forEach(el => {
          const label = (el.textContent || '').trim();
          if (/^Loja (Aberta|Fechada)$/i.test(label)) el.classList.add('pilot-store-status');
          if (/^CW:\s*(Aberto|Fechado)$/i.test(label)) {
            el.classList.add('pilot-cw-status');
            el.textContent = label.replace(/^CW:/i, 'Cardápio Web:');
            (el as HTMLElement).title = 'Status espelhado do Cardápio Web';
          }
        });
      }

      // CTA principal fica Gestão de entrega; pedido manual fica claramente secundário/de teste.
      Array.from(document.querySelectorAll('button')).forEach(button => {
        const label = (button.textContent || '').trim();
        if (label === 'Pedido de teste') button.classList.add('pilot-test-order');
      });

      // Métricas maiores, sem transformar em cards gigantes.
      const metricLabels = ['PEDIDOS ATIVOS','PREPARANDO','EM ENTREGA','ENTREGADORES'];
      Array.from(document.querySelectorAll('p')).forEach(label => {
        if (!metricLabels.includes((label.textContent || '').trim())) return;
        label.classList.add('pilot-metric-label');
        const box = label.parentElement;
        const number = box?.querySelector('strong');
        number?.classList.add('pilot-metric-number');
      });

      // Estados vazios específicos por coluna.
      Array.from(document.querySelectorAll('section')).forEach(section => {
        const heading = section.querySelector('h3')?.textContent?.trim();
        if (!heading || !emptyCopy[heading]) return;
        const empty = Array.from(section.querySelectorAll('div')).find(el => el.children.length === 0 && el.textContent?.trim() === 'Nenhum pedido') as HTMLElement | undefined;
        if (!empty) return;
        const [title,subtitle] = emptyCopy[heading];
        empty.classList.add('pilot-empty');
        empty.innerHTML = `<div><strong>${title}</strong><span>${subtitle}</span></div>`;
      });

      return true;
    };

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (apply() || tries >= 20) window.clearInterval(timer);
    }, 300);
    apply();

    return () => {
      window.clearInterval(timer);
      style.remove();
    };
  }, []);

  return null;
}

export default PilotVisualPolish;
