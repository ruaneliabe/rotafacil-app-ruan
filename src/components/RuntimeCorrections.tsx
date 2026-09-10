import { useEffect } from 'react';
import { subscribeToMotoboys } from '../lib/firebase';

export function RuntimeCorrections() {
  useEffect(() => {
    let logoutInProgress = false;

    const clearMotoboySessionAndReturnToLogin = () => {
      if (logoutInProgress) return;
      logoutInProgress = true;
      try {
        localStorage.removeItem('rota_facil_session');
        localStorage.removeItem('rota_facil_active_motoboy_id');
        sessionStorage.removeItem('rota_facil_session');
        sessionStorage.removeItem('rota_facil_active_motoboy_id');
      } catch {}
      window.location.replace(`${window.location.origin}${window.location.pathname}?login=1&t=${Date.now()}`);
    };

    const unsubscribeSessionGuard = subscribeToMotoboys((cloudMotoboys) => {
      if (logoutInProgress) return;
      try {
        const raw = localStorage.getItem('rota_facil_session');
        if (!raw) return;
        const session = JSON.parse(raw) as { role?: string; motoboyId?: string };
        if (session.role !== 'motoboy' || !session.motoboyId) return;
        const driver = cloudMotoboys.find((m) => m.id === session.motoboyId) as any;
        if (!driver || driver.accessRevokedAt) clearMotoboySessionAndReturnToLogin();
      } catch (error) {
        console.warn('Falha ao validar sessão global do motoboy:', error);
      }
    });

    const style = document.createElement('style');
    style.id = 'rota-facil-fleet-visual-polish';
    style.textContent = `
      /* Status da operação: ação clara, sem parecer texto perdido no rodapé. */
      .runtime-operation-toggle{
        display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;
        min-height:48px!important;padding:8px 10px!important;border:1px solid #e2e8f0!important;border-radius:10px!important;
        background:#fff!important;color:#334155!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;
      }
      .runtime-operation-toggle:hover{border-color:#c4b5fd!important;background:#fafaff!important}
      .runtime-operation-toggle.runtime-operation-open{border-color:#bbf7d0!important;background:#f0fdf4!important;color:#166534!important}
      .runtime-operation-toggle.runtime-operation-closed{border-color:#e2e8f0!important;background:#fff!important;color:#334155!important}
      .runtime-operation-toggle .runtime-operation-copy{display:flex;align-items:center;gap:8px;min-width:0}
      .runtime-operation-toggle .runtime-operation-dot{width:8px;height:8px;border-radius:999px;background:#94a3b8;flex:0 0 auto}
      .runtime-operation-toggle.runtime-operation-open .runtime-operation-dot{background:#22c55e;box-shadow:0 0 0 3px #dcfce7}
      .runtime-operation-toggle .runtime-operation-label{display:block;font-size:11px;font-weight:700;line-height:1.15;text-align:left}
      .runtime-operation-toggle .runtime-operation-help{display:block;font-size:9px;font-weight:500;color:#94a3b8;margin-top:2px;text-align:left}
      .runtime-operation-toggle .runtime-operation-action{font-size:10px;font-weight:700;color:#7c3aed;white-space:nowrap}

      /* Equipe: mais densidade para 10–20 motoboys, sem virar mural de cartões gigantes. */
      .runtime-team-shell{background:#f8fafc!important;border-color:#e2e8f0!important}
      .runtime-team-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;align-items:start!important}
      .runtime-team-card{border-radius:12px!important;padding:12px!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;background:#fff!important}
      .runtime-team-card .runtime-credentials{background:#f8fafc!important;border-color:#e2e8f0!important;padding:8px!important}
      .runtime-team-card .runtime-secondary-actions{gap:5px!important}
      @media(min-width:1500px){.runtime-team-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
      @media(max-width:1200px){.runtime-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
      @media(max-width:760px){.runtime-team-grid{grid-template-columns:1fr!important}}

      /* Gestão de entrega: filtros agrupados e fila compacta/escaneável. */
      .runtime-delivery-modal{background:rgba(2,6,23,.62)!important;backdrop-filter:blur(2px)}
      .runtime-map-filter-card{width:216px!important;padding:10px!important;border-radius:12px!important;box-shadow:0 12px 30px rgba(15,23,42,.16)!important}
      .runtime-map-filter-card:before{content:'VISUALIZAÇÃO';display:block;font-size:9px;font-weight:800;letter-spacing:.1em;color:#94a3b8;margin-bottom:7px}
      .runtime-driver-panel{background:#f8fafc!important;padding:0!important;overflow:hidden!important}
      .runtime-driver-panel-head{position:sticky;top:0;z-index:4;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 12px 9px!important;margin:0!important}
      .runtime-driver-panel-search{position:sticky;top:58px;z-index:3;background:#f8fafc;padding:8px 12px!important;margin:0!important}
      .runtime-driver-list{padding:4px 8px 10px!important;overflow-y:auto!important;flex:1!important}
      .runtime-driver-row{min-height:62px!important;margin:0 0 6px!important;padding:9px 10px!important;border-radius:10px!important;box-shadow:none!important;background:#fff!important}
      .runtime-driver-row:hover{border-color:#c4b5fd!important;background:#fafaff!important}
      .runtime-driver-row.runtime-driver-next{border-color:#c4b5fd!important;background:#faf5ff!important;box-shadow:inset 3px 0 0 #7c3aed!important}
      .runtime-driver-row p{margin-top:3px!important}
      .runtime-driver-row .runtime-driver-meta{font-size:10px!important;color:#94a3b8!important}
      .runtime-driver-panel .runtime-driver-summary{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:6px!important}
      .runtime-driver-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;color:#64748b;font-size:9px;font-weight:700}
    `;
    document.head.appendChild(style);

    const decorate = () => {
      // 1) Status da operação no rodapé da sidebar.
      Array.from(document.querySelectorAll('button')).forEach((button) => {
        const text = (button.textContent || '').trim().toLowerCase();
        if (!text.startsWith('operação aberta') && !text.startsWith('operação fechada') && !text.startsWith('loja aberta') && !text.startsWith('loja fechada')) return;
        button.classList.add('runtime-operation-toggle');
        const open = text.includes('aberta');
        button.classList.toggle('runtime-operation-open', open);
        button.classList.toggle('runtime-operation-closed', !open);
        button.innerHTML = `<span class="runtime-operation-copy"><span class="runtime-operation-dot"></span><span><span class="runtime-operation-label">${open ? 'Operação aberta' : 'Operação fechada'}</span><span class="runtime-operation-help">${open ? 'Recebendo pedidos deste turno' : 'Nenhum pedido entra na operação ativa'}</span></span></span><span class="runtime-operation-action">${open ? 'Encerrar' : 'Abrir'}</span>`;
      });

      // 2) Tela de equipe: grade mais escalável.
      const teamTitle = Array.from(document.querySelectorAll('h1,h2,h3')).find((el) => (el.textContent || '').includes('Gestão da Equipe de Motoboys'));
      if (teamTitle) {
        const shell = teamTitle.parentElement?.parentElement as HTMLElement | null;
        shell?.classList.add('runtime-team-shell');
        const grids = shell ? Array.from(shell.querySelectorAll('div')).filter((el) => el.className.includes('grid-cols-1') && el.className.includes('md:grid-cols-3')) : [];
        grids.forEach((grid) => {
          grid.classList.add('runtime-team-grid');
          Array.from(grid.children).forEach((child) => {
            const card = child as HTMLElement;
            card.classList.add('runtime-team-card');
            Array.from(card.querySelectorAll('div')).forEach((div) => {
              const t = (div.textContent || '').toUpperCase();
              if (t.includes('CREDENCIAIS DO APP')) div.classList.add('runtime-credentials');
            });
          });
        });
      }

      // 3) Modal de gestão: filtros e fila preparados para 15+ entregadores.
      const deliveryTitle = Array.from(document.querySelectorAll('h1,h2,h3')).find((el) => el.textContent?.trim() === 'Gestão de entrega');
      const overlay = deliveryTitle?.closest('.fixed') as HTMLElement | null;
      if (overlay) {
        overlay.classList.add('runtime-delivery-modal');
        const filterLabel = Array.from(overlay.querySelectorAll('p')).find((el) => el.textContent?.trim().toUpperCase() === 'MOSTRAR NO MAPA');
        const filterCard = filterLabel?.parentElement as HTMLElement | null;
        if (filterCard) {
          filterLabel.style.display = 'none';
          filterCard.classList.add('runtime-map-filter-card');
        }

        const panel = overlay.querySelector('aside') as HTMLElement | null;
        if (panel) {
          panel.classList.add('runtime-driver-panel');
          const head = Array.from(panel.querySelectorAll('div')).find((el) => (el.textContent || '').includes('Fila de saída') && (el.textContent || '').includes('próximo a receber')) as HTMLElement | undefined;
          if (head) {
            head.classList.add('runtime-driver-panel-head');
            if (!head.querySelector('.runtime-driver-summary')) {
              const chips = document.createElement('div');
              chips.className = 'runtime-driver-summary';
              const all = panel.querySelectorAll('button').length;
              const nextName = Array.from(panel.querySelectorAll('button')).find((b) => (b.textContent || '').includes('PRÓXIMO'))?.querySelector('b')?.textContent || '—';
              chips.innerHTML = `<span class="runtime-driver-chip">Próximo: ${nextName}</span><span class="runtime-driver-chip">${all} no painel</span>`;
              head.appendChild(chips);
            }
          }
          const searchWrap = Array.from(panel.querySelectorAll('div')).find((el) => el.querySelector('input[placeholder="Buscar entregador"]')) as HTMLElement | undefined;
          searchWrap?.classList.add('runtime-driver-panel-search');

          const driverButtons = Array.from(panel.querySelectorAll(':scope > button')) as HTMLButtonElement[];
          if (driverButtons.length) {
            let listWrap = panel.querySelector('.runtime-driver-list') as HTMLElement | null;
            if (!listWrap) {
              listWrap = document.createElement('div');
              listWrap.className = 'runtime-driver-list';
              driverButtons[0].before(listWrap);
              driverButtons.forEach((b) => listWrap!.appendChild(b));
            }
            Array.from(listWrap.querySelectorAll(':scope > button')).forEach((button) => {
              button.classList.add('runtime-driver-row');
              button.classList.toggle('runtime-driver-next', (button.textContent || '').includes('PRÓXIMO'));
              const ps = button.querySelectorAll('p');
              if (ps.length > 1) ps[ps.length - 1].classList.add('runtime-driver-meta');
            });
          }
        }
      }
    };

    decorate();
    const observer = new MutationObserver(() => window.requestAnimationFrame(decorate));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      style.remove();
      unsubscribeSessionGuard();
    };
  }, []);

  return null;
}
