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
      .runtime-operation-toggle{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:54px!important;padding:9px 11px!important;border:1px solid #e2e8f0!important;border-radius:11px!important;background:#fff!important;color:#334155!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important}
      .runtime-operation-toggle:hover{border-color:#c4b5fd!important;background:#fafaff!important}.runtime-operation-toggle.runtime-operation-open{border-color:#bbf7d0!important;background:#f0fdf4!important;color:#166534!important}
      .runtime-operation-copy{display:flex;align-items:center;gap:8px;min-width:0}.runtime-operation-dot{width:9px;height:9px;border-radius:999px;background:#94a3b8;flex:0 0 auto}.runtime-operation-open .runtime-operation-dot{background:#22c55e;box-shadow:0 0 0 3px #dcfce7}.runtime-operation-label{display:block;font-size:11px;font-weight:700;line-height:1.15;text-align:left}.runtime-operation-help{display:block;font-size:9px;color:#94a3b8;margin-top:3px;text-align:left}.runtime-operation-action{font-size:10px;font-weight:700;color:#7c3aed;white-space:nowrap}

      .runtime-team-shell{background:#f8fafc!important;border-color:#e2e8f0!important}.runtime-team-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;align-items:start!important}.runtime-team-card{min-width:0!important;border-radius:12px!important;padding:10px!important;background:#fff!important;box-shadow:0 1px 2px rgba(15,23,42,.04)!important;display:flex!important;flex-direction:column!important;gap:8px!important}.runtime-team-card .runtime-credentials{padding:7px 8px!important;background:#f8fafc!important;border-color:#e2e8f0!important;border-radius:8px!important}.runtime-team-card button,.runtime-team-card a{min-height:29px!important}.runtime-team-card .runtime-credentials button{min-height:26px!important}.runtime-team-card p,.runtime-team-card span{line-height:1.2!important}
      @media(max-width:1500px){.runtime-team-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}@media(max-width:1100px){.runtime-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:760px){.runtime-team-grid{grid-template-columns:1fr!important}}

      .runtime-delivery-modal{background:rgba(2,6,23,.52)!important;backdrop-filter:blur(2px)}.runtime-map-filter-card{top:82px!important;left:34px!important;width:196px!important;padding:8px!important;border-radius:10px!important;box-shadow:0 10px 24px rgba(15,23,42,.16)!important}.runtime-map-filter-card:before{content:'FILTROS';display:block;font-size:8px;font-weight:800;letter-spacing:.12em;color:#94a3b8;margin:0 0 6px 2px}.runtime-map-filter-card button{font-size:10px!important;min-height:26px!important}.runtime-map-filter-card span{font-size:10px!important}.runtime-map-filter-card input{transform:scale(.88);transform-origin:left center}.runtime-map-filter-card>div{gap:3px!important}.runtime-driver-panel{background:#f8fafc!important;padding:0!important;overflow:hidden!important}.runtime-driver-panel-head{position:sticky;top:0;z-index:4;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px!important;margin:0!important}.runtime-driver-panel-search{position:sticky;top:76px;z-index:3;background:#f8fafc;padding:8px 12px!important;margin:0!important}.runtime-driver-list{padding:4px 8px 10px!important;overflow-y:auto!important;flex:1!important}.runtime-driver-row{min-height:58px!important;margin:0 0 6px!important;padding:8px 10px!important;border-radius:10px!important;box-shadow:none!important;background:#fff!important}.runtime-driver-row.runtime-driver-next{border-color:#c4b5fd!important;background:#faf5ff!important;box-shadow:inset 3px 0 0 #7c3aed!important}.runtime-driver-meta{font-size:10px!important;color:#94a3b8!important}
    `;
    document.head.appendChild(style);

    const findStoreOpeningOverlay = () => {
      return Array.from(document.querySelectorAll<HTMLElement>('div.fixed, div[role="dialog"], div[class*="fixed"]')).find((el) => {
        const copy = (el.textContent || '').toLowerCase();
        return copy.includes('abrir loja') && (copy.includes('saldo inicial') || copy.includes('antes de começar'));
      }) || null;
    };

    const closeStoreOpeningOverlay = () => {
      const overlay = findStoreOpeningOverlay();
      if (!overlay) return;
      overlay.dataset.rotaFacilOpeningDismissed = 'true';
      overlay.style.display = 'none';
    };

    const decorateStoreOpeningModal = () => {
      const overlay = findStoreOpeningOverlay();
      if (!overlay || overlay.dataset.rotaFacilOpeningDecorated === 'true') return;
      overlay.dataset.rotaFacilOpeningDecorated = 'true';

      const card = Array.from(overlay.querySelectorAll<HTMLElement>('div')).find((el) => {
        const copy = (el.textContent || '').toLowerCase();
        return copy.includes('abrir loja') && copy.includes('saldo inicial') && el.querySelectorAll('button').length > 0;
      }) || overlay.firstElementChild as HTMLElement | null;
      if (!card) return;

      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

      const close = document.createElement('button');
      close.type = 'button';
      close.setAttribute('aria-label', 'Cancelar abertura da loja');
      close.title = 'Cancelar';
      close.innerHTML = '×';
      close.style.cssText = 'position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:24px;line-height:28px;font-weight:400;display:grid;place-items:center;cursor:pointer;z-index:5;';
      close.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closeStoreOpeningOverlay(); });
      card.appendChild(close);

      const primary = Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find((b) => {
        const label = (b.textContent || '').trim().toLowerCase();
        return label.includes('iniciar operação') || label.includes('abrir loja');
      });
      if (primary && !card.querySelector('[data-rota-facil-opening-cancel="true"]')) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.dataset.rotaFacilOpeningCancel = 'true';
        cancel.textContent = 'Cancelar';
        cancel.style.cssText = 'width:100%;margin-top:10px;height:38px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;';
        cancel.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); closeStoreOpeningOverlay(); });
        primary.insertAdjacentElement('afterend', cancel);
      }
    };

    const decorate = () => {
      decorateStoreOpeningModal();
      const teamTitle = Array.from(document.querySelectorAll('h1,h2,h3')).find((el) => (el.textContent || '').includes('Gestão da Equipe de Motoboys'));
      if (teamTitle) {
        const shell = teamTitle.closest('div[class*="rounded-2xl"]') as HTMLElement | null;
        shell?.classList.add('runtime-team-shell');
        if (shell) {
          const allDivs = Array.from(shell.querySelectorAll('div')) as HTMLElement[];
          const cardCandidates = allDivs.filter((el) => {
            const text = el.textContent || '';
            return text.includes('Arranque') && text.includes('Taxa por corrida') && text.includes('Ganho acumulado hoje:') && text.includes('Credenciais do App');
          });
          const cards = cardCandidates.filter((candidate) => !cardCandidates.some((other) => other !== candidate && candidate.contains(other)));
          const firstCard = cards[0];
          const grid = firstCard?.parentElement as HTMLElement | null;
          if (grid) {
            grid.classList.add('runtime-team-grid');
            cards.forEach((card) => {
              card.classList.add('runtime-team-card');
              Array.from(card.querySelectorAll('div')).forEach((div) => {
                if ((div.textContent || '').toUpperCase().includes('CREDENCIAIS DO APP')) div.classList.add('runtime-credentials');
              });
            });
          }
        }
      }

      const deliveryTitle = Array.from(document.querySelectorAll('h1,h2,h3')).find((el) => el.textContent?.trim() === 'Gestão de entrega');
      const overlay = deliveryTitle?.closest('.fixed') as HTMLElement | null;
      if (overlay) {
        overlay.classList.add('runtime-delivery-modal');
        const allAbsolute = Array.from(overlay.querySelectorAll('div.absolute')) as HTMLElement[];
        const filterCard = allAbsolute.find((el) => (el.textContent || '').includes('Todos os pedidos') && (el.textContent || '').includes('Todos os entregadores'));
        filterCard?.classList.add('runtime-map-filter-card');
        const panel = overlay.querySelector('aside') as HTMLElement | null;
        if (panel) {
          panel.classList.add('runtime-driver-panel');
          const head = Array.from(panel.children).find((el) => (el.textContent || '').includes('Fila de saída')) as HTMLElement | undefined;
          head?.classList.add('runtime-driver-panel-head');
          const searchWrap = Array.from(panel.querySelectorAll('div')).find((el) => el.querySelector('input[placeholder="Buscar entregador"]')) as HTMLElement | undefined;
          searchWrap?.classList.add('runtime-driver-panel-search');
          const buttons = Array.from(panel.querySelectorAll(':scope > button')) as HTMLButtonElement[];
          if (buttons.length) {
            let list = panel.querySelector('.runtime-driver-list') as HTMLElement | null;
            if (!list) {
              list = document.createElement('div');
              list.className = 'runtime-driver-list';
              buttons[0].before(list);
              buttons.forEach((b) => list!.appendChild(b));
            }
            Array.from(list.querySelectorAll(':scope > button')).forEach((button) => {
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
    let ticks = 0;
    const timer = window.setInterval(() => { decorate(); ticks += 1; if (ticks >= 24) window.clearInterval(timer); }, 300);
    const onClick = () => {
      window.setTimeout(decorate, 80);
      window.setTimeout(decorate, 300);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && findStoreOpeningOverlay()) closeStoreOpeningOverlay();
    };
    document.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      style.remove();
      unsubscribeSessionGuard();
    };
  }, []);

  return null;
}
