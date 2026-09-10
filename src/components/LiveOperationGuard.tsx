import { useEffect } from 'react';

const isMotoboySession = () => {
  try {
    const raw = localStorage.getItem('rota_facil_session');
    if (!raw) return false;
    const session = JSON.parse(raw) as { role?: string };
    return session.role === 'motoboy';
  } catch {
    return false;
  }
};

export function LiveOperationGuard() {
  useEffect(() => {
    let badge: HTMLDivElement | null = null;
    let state = 'syncing';
    let lastOkAt = 0;

    const removeBadge = () => {
      badge?.remove();
      badge = null;
      document.getElementById('rota-live-health')?.remove();
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

    const render = () => {
      if (isMotoboySession()) {
        removeBadge();
        return;
      }
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

    const onHealth = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      state = detail.state || state;
      lastOkAt = detail.lastOkAt || lastOkAt;
      render();
    };

    window.addEventListener('rota:cardapio-web-health', onHealth);
    render();
    const timer = window.setInterval(render, 5000);
    return () => {
      window.removeEventListener('rota:cardapio-web-health', onHealth);
      window.clearInterval(timer);
      removeBadge();
    };
  }, []);
  return null;
}
