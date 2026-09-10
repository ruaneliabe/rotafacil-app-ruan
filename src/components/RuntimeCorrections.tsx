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

    return () => {
      unsubscribeSessionGuard();
    };
  }, []);

  return null;
}
