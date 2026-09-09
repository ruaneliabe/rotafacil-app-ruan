import { useEffect } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db, subscribeToMotoboys, subscribeToOrders } from '../lib/firebase';
import { getBrazilDateKey } from '../utils/dateUtils';

export function RuntimeCorrections() {
  useEffect(() => {
    let logoutInProgress = false;
    let cleanupStarted = false;

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

    const unsubscribeOrders = subscribeToOrders((cloudOrders) => {
      if (cleanupStarted) return;
      cleanupStarted = true;

      const today = getBrazilDateKey();
      const testOrders = cloudOrders.filter((order: any) => {
        const isToday = order.createdDate === today;
        const isRealIntegration =
          order.originChannel === 'cardapio_web' ||
          order.originChannel === 'ifood' ||
          Boolean(order.externalOrderId);

        return isToday && !isRealIntegration;
      });

      if (testOrders.length === 0) return;

      Promise.all(
        testOrders.map((order) => deleteDoc(doc(db, 'orders', order.id)))
      ).catch((error) => {
        console.warn('Falha ao limpar pedidos de teste de hoje:', error);
      });
    });

    return () => {
      unsubscribeSessionGuard();
      unsubscribeOrders();
    };
  }, []);

  return null;
}
