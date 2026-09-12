import type { BrowserContext } from '@playwright/test';

export type Point = { latitude: number; longitude: number; accuracy?: number };

export function interpolateRoute(start: Point, end: Point, steps: number): Point[] {
  const count = Math.max(1, steps);
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    return {
      latitude: start.latitude + (end.latitude - start.latitude) * t,
      longitude: start.longitude + (end.longitude - start.longitude) * t,
      accuracy: 8,
    };
  });
}

export async function moveGps(
  context: BrowserContext,
  start: Point,
  end: Point,
  options: { intervalMs?: number; durationMs?: number; onStep?: (point: Point, index: number) => Promise<void> | void } = {},
) {
  const intervalMs = options.intervalMs ?? 5000;
  const durationMs = options.durationMs ?? 60_000;
  const steps = Math.max(1, Math.ceil(durationMs / intervalMs));
  const points = interpolateRoute(start, end, steps);

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    await context.setGeolocation(point);
    await options.onStep?.(point, i);
    if (i < points.length - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
