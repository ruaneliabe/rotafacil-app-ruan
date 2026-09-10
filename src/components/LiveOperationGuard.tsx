import { useEffect } from 'react';
import { subscribeToMotoboys, subscribeToOrders } from '../lib/firebase';
import { Motoboy, Order } from '../types';

const getSession = () => {
  try {
    const raw = localStorage.getItem('rota_facil_session');
    return raw ? JSON.parse(raw) as { role?: string; motoboyId?: string } : null;
  } catch {
    return null;
  }
};

const isMotoboySession = () => getSession()?.role === 'motoboy';
const isOpenOrder = (order: Order) => !['delivered', 'cancelled', 'failed'].includes(String(order.status));
const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export function LiveOperationGuard() {
  useEffect(() => {
    let badge: HTMLDivElement | null = null;
    let state = 'syncing';
    let lastOkAt = 0;
    let latestMotoboys: Motoboy[] = [];
    let latestOrders: Order[] = [];
    let decorateQueued = false;
    let queueTabActive = false;

    const removeBadge = () => {
      badge?.remove();
      badge = null;
      document.getElementById('rota-live-health')?.remove();
    };

    const restoreMain = () => {
      document.querySelectorAll<HTMLElement>('[data-motoboy-hidden-by-queue="true"]').forEach((el) => {
        el.style.display = el.dataset.motoboyPreviousDisplay || '';
        delete el.dataset.motoboyHiddenByQueue;
        delete el.dataset.motoboyPreviousDisplay;
      });
      document.querySelector<HTMLElement>('[data-motoboy-queue-panel="true"]')?.remove();
      queueTabActive = false;
    };

    const removeMotoboyEnhancements = () => {
      restoreMain();
      document.querySelector('[data-motoboy-queue-info="true"]')?.remove();
      document.querySelector('[data-motoboy-pending-preview="true"]')?.remove();
      document.querySelector('[data-motoboy-queue-tab="true"]')?.remove();
    };

    const ensureBadge = () => {
      if (isMotoboySession()) {
        removeBadge();
        return null;
      }
      if (badge) return badge;
      badge = document.createElement('div');
      badge.id = 'rota-live-health';
      Object.assign(badge.style, {
        position: 'fixed', right: '18px', bottom: '16px', zIndex: '70',
        padding: '7px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
        fontFamily: 'inherit', border: '1px solid rgba(71,85,105,.65)',
        background: 'rgba(15,23,42,.94)', color: '#cbd5e1', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
        pointerEvents: 'none', transition: 'opacity .2s ease'
      });
      document.body.appendChild(badge);
      return badge;
    };

    const buildQueuePanel = (main: HTMLElement, driver: Motoboy, queue: Motoboy[], position: number | null) => {
      restoreMain();
      queueTabActive = true;

      Array.from(main.children).forEach((child) => {
        const el = child as HTMLElement;
        el.dataset.motoboyPreviousDisplay = el.style.display || '';
        el.dataset.motoboyHiddenByQueue = 'true';
        el.style.display = 'none';
      });

      const panel = document.createElement('section');
      panel.dataset.motoboyQueuePanel = 'true';
      panel.style.cssText = 'overflow:hidden;border:1px solid #e2e8f0;background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,.06);';

      const queueIndex = position ? position - 1 : -1;
      const ahead = queueIndex > 0 ? queueIndex : 0;
      const rows = queue.length
        ? queue.map((motoboy, index) => {
            const isMe = motoboy.id === driver.id;
            const isNext = index === 0;
            return `
              <div style="display:flex;align-items:center;gap:12px;padding:13px 14px;${index ? 'border-top:1px solid #f1f5f9;' : ''}${isMe ? 'background:#faf5ff;' : ''}">
                <div style="width:36px;height:36px;flex:0 0 36px;border-radius:999px;display:grid;place-items:center;font-size:12px;font-weight:900;${isNext ? 'background:#7c3aed;color:#fff;' : 'background:#f1f5f9;color:#475569;'}">${index + 1}</div>
                <div style="min-width:0;flex:1;">
                  <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                    <div style="font-size:13px;font-weight:900;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(motoboy.name)}</div>
                    ${isMe ? '<span style="border-radius:999px;background:#ede9fe;color:#6d28d9;padding:3px 6px;font-size:8px;font-weight:900;">VOCÊ</span>' : ''}
                  </div>
                  <div style="margin-top:2px;font-size:10px;color:#94a3b8;">${isNext ? 'Próximo a receber pedido' : `Aguardando · ${index} ${index === 1 ? 'motoboy antes' : 'motoboys antes'}`}</div>
                </div>
                ${isNext ? '<span style="border-radius:999px;background:#ecfdf5;color:#047857;padding:5px 8px;font-size:9px;font-weight:900;">PRÓXIMO</span>' : ''}
              </div>`;
          }).join('')
        : '<div style="padding:42px 20px;text-align:center;color:#94a3b8;font-size:12px;font-weight:700;">Nenhum motoboy na fila agora.</div>';

      panel.innerHTML = `
        <div style="padding:16px;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
            <div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;">Fila de motoboys</div>
              <div style="margin-top:3px;font-size:10px;color:#64748b;">Ordem atual para receber o próximo despacho</div>
            </div>
            <span style="border-radius:999px;background:#f1f5f9;color:#64748b;padding:5px 8px;font-size:9px;font-weight:900;">${queue.length} NA FILA</span>
          </div>
          ${driver.status === 'available' && position ? `
            <div style="margin-top:13px;border:1px solid #ddd6fe;background:#faf5ff;border-radius:12px;padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div><div style="font-size:9px;font-weight:800;color:#7c3aed;text-transform:uppercase;">Sua posição</div><div style="margin-top:2px;font-size:18px;font-weight:900;color:#4c1d95;">${position}º da fila</div></div>
              <div style="font-size:10px;font-weight:700;color:#7c3aed;text-align:right;">${ahead === 0 ? 'Você é o próximo' : `${ahead} ${ahead === 1 ? 'motoboy na sua frente' : 'motoboys na sua frente'}`}</div>
            </div>` : `
            <div style="margin-top:13px;border-radius:12px;background:#f8fafc;padding:11px 12px;font-size:10px;font-weight:700;color:#64748b;">Você não está na fila agora.</div>`}
        </div>
        <div>${rows}</div>`;

      main.appendChild(panel);
    };

    const decorateMotoboy = () => {
      if (!isMotoboySession()) {
        removeMotoboyEnhancements();
        return;
      }

      removeBadge();
      const session = getSession();
      if (!session?.motoboyId) return;
      const driver = latestMotoboys.find((m) => m.id === session.motoboyId);
      if (!driver) return;

      const appTitle = Array.from(document.querySelectorAll('h1')).find((el) => el.textContent?.trim() === 'Rota Fácil') as HTMLElement | undefined;
      const header = appTitle?.closest('header') as HTMLElement | null;
      if (!header || !appTitle) return;

      header.style.paddingBottom = '10px';
      header.style.paddingLeft = '18px';
      header.style.paddingRight = '18px';
      appTitle.style.fontSize = '21px';
      appTitle.style.lineHeight = '1.05';
      const statusLine = appTitle.parentElement?.querySelector('div.mt-1') as HTMLElement | null;
      if (statusLine) {
        statusLine.style.marginTop = '4px';
        statusLine.style.fontSize = '11px';
      }
      header.querySelectorAll('button').forEach((button) => {
        (button as HTMLElement).style.width = '36px';
        (button as HTMLElement).style.height = '36px';
      });

      const queue = latestMotoboys
        .filter((m) => m.status === 'available')
        .sort((a, b) => Number(a.joinedQueueAt || Number.MAX_SAFE_INTEGER) - Number(b.joinedQueueAt || Number.MAX_SAFE_INTEGER));
      const queueIndex = queue.findIndex((m) => m.id === driver.id);
      const position = queueIndex >= 0 ? queueIndex + 1 : null;
      const ahead = queueIndex > 0 ? queueIndex : 0;

      let queueInfo = header.querySelector<HTMLElement>('[data-motoboy-queue-info="true"]');
      if (driver.status === 'available' && position) {
        if (!queueInfo) {
          queueInfo = document.createElement('div');
          queueInfo.dataset.motoboyQueueInfo = 'true';
          queueInfo.style.cssText = 'margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);padding:7px 9px;color:#e2e8f0;font-size:10px;line-height:1.2;';
          header.appendChild(queueInfo);
        }
        queueInfo.innerHTML = `<span><b style="color:#fff">${position}º na fila</b> · ${ahead === 0 ? 'você é o próximo' : `${ahead} ${ahead === 1 ? 'motoboy' : 'motoboys'} na sua frente`}</span><span style="color:#94a3b8">${queue.length} na fila</span>`;
      } else {
        queueInfo?.remove();
      }

      const appRoot = header.parentElement as HTMLElement | null;
      const main = appRoot?.querySelector('main') as HTMLElement | null;
      const nav = appRoot?.querySelector('nav') as HTMLElement | null;
      if (nav && main) {
        nav.style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
        let queueButton = nav.querySelector<HTMLButtonElement>('[data-motoboy-queue-tab="true"]');
        if (!queueButton) {
          queueButton = document.createElement('button');
          queueButton.type = 'button';
          queueButton.dataset.motoboyQueueTab = 'true';
          queueButton.style.cssText = 'height:64px;min-width:0;border-radius:12px;border:1px solid #f1f5f9;background:#fff;color:#475569;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;font-weight:900;';
          queueButton.innerHTML = `<span style="font-size:17px;line-height:1">☷</span><span>Fila${position ? ` (${position}º)` : ''}</span>`;
          queueButton.addEventListener('click', () => {
            buildQueuePanel(main, driver, queue, position);
            nav.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
              if (button === queueButton) {
                button.style.background = '#081A2F';
                button.style.color = '#fff';
                button.style.borderColor = '#081A2F';
              } else {
                button.style.background = '#fff';
                button.style.color = '#475569';
              }
            });
          });
          nav.appendChild(queueButton);
        } else {
          const labels = queueButton.querySelectorAll('span');
          if (labels[1]) labels[1].textContent = `Fila${position ? ` (${position}º)` : ''}`;
        }

        Array.from(nav.querySelectorAll<HTMLButtonElement>('button:not([data-motoboy-queue-tab="true"])')).forEach((button) => {
          if (button.dataset.queueRestoreBound === 'true') return;
          button.dataset.queueRestoreBound = 'true';
          button.addEventListener('click', () => {
            if (!queueTabActive) return;
            restoreMain();
            const q = nav.querySelector<HTMLButtonElement>('[data-motoboy-queue-tab="true"]');
            if (q) {
              q.style.background = '#fff';
              q.style.color = '#475569';
              q.style.borderColor = '#f1f5f9';
            }
          });
        });

        if (queueTabActive) buildQueuePanel(main, driver, queue, position);
      }

      const pendingUnassigned = latestOrders
        .filter((o) => isOpenOrder(o) && !o.assignedMotoboyId && ['pending', 'preparing'].includes(String(o.status)))
        .sort((a, b) => Number(a.createdTimestamp || 0) - Number(b.createdTimestamp || 0));
      const visiblePending = driver.status === 'available' && position === 1 ? pendingUnassigned : [];

      const preparingHeading = main ? Array.from(main.querySelectorAll('h2')).find((el) => el.textContent?.trim() === 'Preparando') : undefined;
      const preparingSection = preparingHeading?.closest('section') as HTMLElement | null;
      let preview = main?.querySelector<HTMLElement>('[data-motoboy-pending-preview="true"]') || null;

      if (!queueTabActive && visiblePending.length && main && preparingSection) {
        if (!preview) {
          preview = document.createElement('section');
          preview.dataset.motoboyPendingPreview = 'true';
          preview.style.cssText = 'overflow:hidden;border:1px solid #ddd6fe;background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,.05);';
          preparingSection.before(preview);
        }
        const cards = visiblePending.slice(0, 3).map((order, index) => `
          <div style="${index ? 'border-top:1px solid #f1f5f9;' : ''}padding:12px 14px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">#${esc(order.codeNumber)} · ${esc(order.clientName || 'Cliente')}</div>
                <div style="margin-top:3px;font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(order.neighborhood || order.address || 'Endereço da entrega')}</div>
              </div>
              <span style="flex:0 0 auto;border-radius:999px;background:#f5f3ff;color:#7c3aed;padding:4px 7px;font-size:9px;font-weight:900;">AGUARDANDO</span>
            </div>
          </div>`).join('');
        preview.innerHTML = `
          <div style="padding:12px 14px 10px;background:#faf5ff;border-bottom:1px solid #ede9fe;">
            <div style="font-size:13px;font-weight:900;color:#5b21b6;">Próximo despacho da fila</div>
            <div style="margin-top:2px;font-size:10px;color:#7c3aed;">A loja ainda precisa confirmar o despacho para você.</div>
          </div>${cards}`;
      } else if (!queueTabActive) {
        preview?.remove();
      }

      const ordersButton = Array.from(appRoot?.querySelectorAll('nav button') || []).find((button) => button.textContent?.trim().startsWith('Pedidos'));
      const ordersLabel = ordersButton?.querySelector('span:last-child');
      if (ordersLabel) {
        const assignedWaiting = latestOrders.filter((o) => o.assignedMotoboyId === driver.id && isOpenOrder(o) && ['pending', 'preparing', 'ready_at_counter'].includes(String(o.status))).length;
        ordersLabel.textContent = `Pedidos (${assignedWaiting + visiblePending.length})`;
      }
    };

    const queueDecorate = () => {
      if (decorateQueued) return;
      decorateQueued = true;
      requestAnimationFrame(() => {
        decorateQueued = false;
        decorateMotoboy();
      });
    };

    const render = () => {
      if (isMotoboySession()) {
        removeBadge();
        queueDecorate();
        return;
      }
      removeMotoboyEnhancements();
      const el = ensureBadge();
      if (!el) return;
      const stale = lastOkAt > 0 && Date.now() - lastOkAt > 20000;
      if (state === 'error' || stale) {
        el.textContent = 'Sincronização instável';
        el.style.color = '#fca5a5';
        el.style.borderColor = 'rgba(239,68,68,.45)';
        el.style.opacity = '1';
      } else if (state === 'ok') {
        el.textContent = 'Operação sincronizada';
        el.style.color = '#86efac';
        el.style.borderColor = 'rgba(34,197,94,.35)';
        el.style.opacity = '.78';
      } else {
        el.textContent = 'Sincronizando operação';
        el.style.color = '#cbd5e1';
        el.style.opacity = '.65';
      }
    };

    const unsubscribeMotoboys = subscribeToMotoboys((items) => {
      latestMotoboys = items;
      queueDecorate();
    });
    const unsubscribeOrders = subscribeToOrders((items) => {
      latestOrders = items;
      queueDecorate();
    });

    const onHealth = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      state = detail.state || state;
      lastOkAt = detail.lastOkAt || lastOkAt;
      render();
    };

    window.addEventListener('rota:cardapio-web-health', onHealth);
    render();
    const observer = new MutationObserver(queueDecorate);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(render, 5000);

    return () => {
      window.removeEventListener('rota:cardapio-web-health', onHealth);
      window.clearInterval(timer);
      observer.disconnect();
      unsubscribeMotoboys();
      unsubscribeOrders();
      removeBadge();
      removeMotoboyEnhancements();
    };
  }, []);
  return null;
}
