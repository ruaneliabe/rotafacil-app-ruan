import { useEffect } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, subscribeToMotoboys, subscribeToOrders } from '../lib/firebase';

export function RuntimeCorrections() {
  useEffect(() => {
    let logoutInProgress = false;
    let realFreeDrivers = 0;
    let motoboys: any[] = [];
    let orders: any[] = [];

    const activeForDriver = (driverId: string) =>
      orders.filter(
        (order) =>
          order.assignedMotoboyId === driverId &&
          !['delivered', 'cancelled', 'failed'].includes(order.status)
      ).length;

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

    const refreshOperationalChrome = () => {
      realFreeDrivers = motoboys.filter(
        (driver) => driver.status === 'available' && activeForDriver(driver.id) === 0
      ).length;

      document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
        const text = (el.textContent || '').trim();

        // The old green recommendation strip duplicates the dispatch action and
        // competes visually with the operational board. Keep dispatch inside the board.
        if (el.children.length > 0 && text.includes('Rota sugerida:') && text.includes('Despachar rota')) {
          el.style.display = 'none';
        }

        // The legacy header used raw `status === available`, which could call a
        // courier with assigned orders "livre". Mirror the real operational rule.
        if (el.children.length === 0 && /^\d+\s*livres?$/.test(text)) {
          el.textContent = `${realFreeDrivers} ${realFreeDrivers === 1 ? 'livre' : 'livres'}`;
        }
      });
    };

    const unsubscribeSessionGuard = subscribeToMotoboys((cloudMotoboys) => {
      motoboys = cloudMotoboys as any[];
      if (!logoutInProgress) {
        try {
          const raw = localStorage.getItem('rota_facil_session');
          if (raw) {
            const session = JSON.parse(raw) as { role?: string; motoboyId?: string };
            if (session.role === 'motoboy' && session.motoboyId) {
              const driver = cloudMotoboys.find((m) => m.id === session.motoboyId) as any;
              if (!driver || driver.accessRevokedAt) clearMotoboySessionAndReturnToLogin();
            }
          }
        } catch (error) {
          console.warn('Falha ao validar sessão global do motoboy:', error);
        }
      }
      window.setTimeout(refreshOperationalChrome, 0);
    });

    let cleaning148 = false;
    const unsubscribeOrders = subscribeToOrders((cloudOrders) => {
      orders = cloudOrders as any[];

      // One-time pilot cleanup: #148 was the manual Ruan Eliabe route test.
      // The client-name guard prevents a future real Cardápio Web #148 from being touched.
      const test148 = orders.find(
        (order) =>
          Number(order.codeNumber) === 148 &&
          String(order.clientName || '').trim().toLowerCase() === 'ruan eliabe' &&
          !['delivered', 'cancelled'].includes(order.status)
      );
      if (test148 && !cleaning148) {
        cleaning148 = true;
        deleteDoc(doc(db, 'orders', test148.id))
          .catch((error) => console.warn('Falha ao limpar pedido de teste #148:', error))
          .finally(() => { cleaning148 = false; });
      }

      window.setTimeout(refreshOperationalChrome, 0);
    });

    const observer = new MutationObserver(() => refreshOperationalChrome());
    observer.observe(document.body, { childList: true, subtree: true });
    refreshOperationalChrome();

    return () => {
      unsubscribeSessionGuard();
      unsubscribeOrders();
      observer.disconnect();
    };
  }, []);

  return null;
}
