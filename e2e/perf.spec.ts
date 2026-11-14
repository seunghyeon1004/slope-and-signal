// Slope and Signal - deployed-site checks: public PDF and performance numbers (DEPLOYED=1). Written with Claude (Anthropic).
import { expect, test } from '@playwright/test';
test.skip(!process.env.DEPLOYED, 'set DEPLOYED=1');
const SITE = 'https://seunghyeon1004.github.io/slope-and-signal/';

test('demo PDF is public (fresh logged-out context) and has 7 pages', async ({ request }) => {
  const r = await request.get(`${SITE}demo.pdf`);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toContain('pdf');
  const buf = await r.body();
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log('demo.pdf bytes', buf.length, 'pages', pages);
  expect(pages).toBe(7);
});

test('performance: first load and time to a live verdict', async ({ page }, info) => {
  const t0 = Date.now();
  await page.goto(`${SITE}#v=T2M&lat=40.71&lon=-74.01&s=1981&e=2025&p=year&name=New+York`);
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 60_000 });
  const toVerdict = Date.now() - t0;
  const m = await page.evaluate(async () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const lcp: number = await new Promise((r) => {
      new PerformanceObserver((l) => { const e = l.getEntries(); r(e[e.length - 1].startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => r(-1), 2000);
    });
    const power = res.find((e) => e.name.includes('power.larc.nasa.gov'));
    const own = res.filter((e) => e.name.includes('github.io'));
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      lcp: Math.round(lcp),
      ownTransferKB: Math.round((nav.transferSize + own.reduce((a, e) => a + e.transferSize, 0)) / 1024),
      powerMs: power ? Math.round(power.duration) : null,
      powerKB: power ? Math.round(power.transferSize / 1024) : null,
    };
  });
  // a second variable for the same place must not hit the API again
  const before = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('power.larc')).length);
  const t1 = Date.now();
  await page.selectOption('#var', 'PRECTOTCORR');
  await page.click('#go');
  await expect(page.locator('#verdict')).toContainText('Rain and snowfall');
  const switchMs = Date.now() - t1;
  const after = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('power.larc')).length);
  console.log(info.project.name, JSON.stringify({ ...m, toVerdictMs: toVerdict, switchVariableMs: switchMs, extraApiCalls: after - before }));
  expect(after - before).toBe(0);
});
