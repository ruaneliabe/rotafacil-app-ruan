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

    const removeBadge = () => {
      badge?.remove();
      badge = null;
      document.getElementById('rota-live-health')?.remove();
    };

    const removeMotoboyEnhancements = () => {
      document.querySelector('[data-motoboy-queue-info="true"]')?.remove();
      document.querySelector('[data-motoboy-pending-preview="true"]')?.remove();
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

      // Cabeçalho mais compacto no celular.
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

      // O pedido manual nasce sem motoboy. O primeiro da fila deve enxergar que
      // existe uma entrega aguardando o despacho da loja, sem fingir que já foi atribuída.
      const pendingUnassigned = latestOrders
        .filter((o) => isOpenOrder(o) && !o.assignedMotoboyId && ['pending', 'preparing'].includes(String(o.status)))
        .sort((a, b) => Number(a.createdTimestamp || 0) - Number(b.createdTimestamp || 0));
      const visiblePending = driver.status === 'available' && position === 1 ? pendingUnassigned : [];

      const appRoot = header.parentElement as HTMLElement | null;
      const main = appRoot?.querySelector('main') as HTMLElement | null;
      const preparingHeading = main ? Array.from(main.querySelectorAll('h2')).find((el) => el.textContent?.trim() === 'Preparando') : undefined;
      const preparingSection = preparingHeading?.closest('section') as HTMLElement | null;
      let preview = main?.querySelector<HTMLElement>('[data-motoboy-pending-preview="true"]') || null;

      if (visiblePending.length && main && preparingSection) {
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
      } else {
        preview?.remove();
      }

      // Atualiza o contador visual da aba Pedidos incluindo a prévia pendente.
      const ordersButton = Array.from(appRoot?.querySelectorAll('nav button') || []).find((button) => button.textContent?.trim().startsWith('Pedidos'));
      const ordersLabel = ordersButton?.querySelector('span');
      if (ordersLabel) {
        const assignedWaiting = latestOrders.filter((o) => o.assignedMotoboyId === driver.id && isOpenOrder(o) && ['pending', 'preparing', 'ready_at_counter'].includes(String(o.status))).length;
        const previewCount = visiblePending.length;
        ordersLabel.textContent = `Pedidos (${assignedWaiting + previewCount})`;
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
