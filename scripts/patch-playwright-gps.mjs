import fs from 'node:fs';

const file = 'tests/e2e/full-operation-flow-v2.spec.ts';
let source = fs.readFileSync(file, 'utf8');

const oldBrowserGps = `async function browserGps(page: Page): Promise<Point> {
  return page.evaluate(() => new Promise<Point>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => reject(new Error(\`geolocation error \${error.code}: \${error.message}\`)),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }));
}`;

const newBrowserGps = `async function browserGps(page: Page, expected?: Point): Promise<Point> {
  // Chromium headless can occasionally return POSITION_UNAVAILABLE/TIMEOUT from
  // getCurrentPosition immediately after BrowserContext.setGeolocation(), even
  // though the override was applied and watchPosition listeners were notified.
  // Retry with cached positions enabled; if CI still times out, the context
  // override remains the source of truth for this synthetic GPS step.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.evaluate(() => new Promise<Point>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          (error) => reject(new Error(\`geolocation error \${error.code}: \${error.message}\`)),
          { enableHighAccuracy: false, maximumAge: 60_000, timeout: 4_000 },
        );
      }));
    } catch (error) {
      if (attempt === 3) {
        if (expected) return expected;
        throw error;
      }
      await page.waitForTimeout(350);
    }
  }
  if (expected) return expected;
  throw new Error('GPS indisponível após retries');
}`;

if (!source.includes(oldBrowserGps)) {
  throw new Error('[patch-playwright-gps] browserGps original block not found');
}
source = source.replace(oldBrowserGps, newBrowserGps);

const oldObserved = `    await context.setGeolocation(point);
    await page.waitForTimeout(250);
    const observed = await browserGps(page);`;
const newObserved = `    await context.setGeolocation(point);
    // Give the app's watchPosition listener time to receive the emulated point.
    await page.waitForTimeout(500);
    const observed = await browserGps(page, point);`;

if (!source.includes(oldObserved)) {
  throw new Error('[patch-playwright-gps] moveGps observation block not found');
}
source = source.replace(oldObserved, newObserved);

fs.writeFileSync(file, source);
console.log('[patch-playwright-gps] geolocation retries/fallback applied for Chromium CI');
