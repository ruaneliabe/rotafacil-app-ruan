import React, { useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { Motoboy } from '../types';
import { saveMotoboyToCloud, subscribeToMotoboys } from '../lib/firebase';
import { playCounterCallSound } from '../utils/soundUtils';

const getMotoboySessionId = (): string | null => {
  try {
    const raw = window.localStorage.getItem('rota_facil_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { role?: string; motoboyId?: string };
    return session.role === 'motoboy' ? session.motoboyId || null : null;
  } catch {
    return null;
  }
};

export const MotoboyCounterCallListener: React.FC = () => {
  const [calledDriver, setCalledDriver] = useState<Motoboy | null>(null);
  const lastSeenCallRef = useRef<number>(0);
  const repeatTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearRepeats = () => {
      repeatTimersRef.current.forEach((id) => window.clearTimeout(id));
      repeatTimersRef.current = [];
    };

    const triggerAlert = (driver: Motoboy, timestamp: number) => {
      clearRepeats();
      lastSeenCallRef.current = timestamp;
      setCalledDriver(driver);

      playCounterCallSound();
      try { navigator.vibrate?.([450, 180, 450, 180, 850]); } catch {}

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Rota Fácil', {
            body: 'Você foi chamado ao balcão da loja.',
            icon: '/favicon.ico',
            tag: `rota-facil-balcao-${driver.id}`,
            requireInteraction: true,
          });
        } catch {}
      }

      repeatTimersRef.current = [
        window.setTimeout(() => playCounterCallSound(), 1400),
        window.setTimeout(() => playCounterCallSound(), 3000),
      ];
    };

    const unsubscribe = subscribeToMotoboys((drivers) => {
      const motoboyId = getMotoboySessionId();
      if (!motoboyId) {
        setCalledDriver(null);
        return;
      }

      const driver = drivers.find((item) => item.id === motoboyId);
      if (!driver) return;

      const timestamp = Number(driver.callingToCounterAt || 0);
      const isFresh = timestamp > 0 && Date.now() - timestamp <= 20000;

      if (isFresh && timestamp !== lastSeenCallRef.current) {
        triggerAlert(driver, timestamp);
      }

      if (!timestamp && calledDriver?.id === driver.id) {
        clearRepeats();
        setCalledDriver(null);
      }
    });

    return () => {
      clearRepeats();
      unsubscribe();
    };
  }, [calledDriver?.id]);

  const acknowledge = async () => {
    if (!calledDriver) return;
    const driver = calledDriver;
    setCalledDriver(null);
    repeatTimersRef.current.forEach((id) => window.clearTimeout(id));
    repeatTimersRef.current = [];
    try { navigator.vibrate?.(0); } catch {}
    await saveMotoboyToCloud({ ...driver, callingToCounterAt: undefined });
  };

  if (!calledDriver) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl">
        <div className="bg-violet-600 px-6 py-5 text-center text-white">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/15">
            <BellRing className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="mt-3 text-xl font-black">Chamado ao balcão</h2>
          <p className="mt-1 text-sm text-violet-100">A loja está chamando você agora.</p>
        </div>

        <div className="p-5 text-center">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-950">{calledDriver.name}</strong>, dirija-se ao balcão para receber a próxima orientação ou retirada.
          </p>
          <button
            type="button"
            onClick={acknowledge}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white active:scale-[0.99]"
          >
            <CheckCircle2 className="h-5 w-5" />
            Entendi, estou indo
          </button>
        </div>
      </div>
    </div>
  );
};
