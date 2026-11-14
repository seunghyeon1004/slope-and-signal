// Slope and Signal - Gate 2 end-to-end tests: guided cases, compare, trend map, suggestions.
// Written with Claude (Anthropic).
import { expect, test } from '@playwright/test';

// Force the bundled snapshots: NASA POWER is "down" for these tests.
const offline = async (page: import('@playwright/test').Page) =>
  page.route('https://power.larc.nasa.gov/**', (r) => r.fulfill({ status: 503, body: 'down' }));

test('guided case 1 plays step by step from the snapshot when the API is down', async ({ page }, info) => {
  await offline(page);
  await page.goto('./');
  await page.click('button[data-case="seasons"]');
  const text = page.locator('#dock-text');
  await expect(text).toContainText('swing between', { timeout: 20_000 });
  await expect(page.locator('#status')).toContainText('saved copy');
  await page.click('#dock-play'); // pause
  await page.click('#dock-next');
  await expect(text).toContainText('anomalies');
  await page.click('#dock-next');
  await expect(text).toContainText('confidence interval');
  await page.click('#dock-next');
  await expect(text).toContainText('statistically significant warming trend');
  await expect(page.locator('#dock-count')).toHaveText('Step 4 of 4');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screens/gate2-${info.project.name}-case1.png` });
});

test('Play advances on its own (watchable)', async ({ page }) => {
  test.setTimeout(60_000);
  await offline(page);
  await page.goto('./');
  await page.click('button[data-case="haze"]');
  await expect(page.locator('#dock-count')).toHaveText('Step 1 of 3', { timeout: 20_000 });
  await expect(page.locator('#dock-count')).toHaveText('Step 2 of 3', { timeout: 15_000 });
});

test('case "not significant yet" shows the years-needed estimate', async ({ page }, info) => {
  await offline(page);
  await page.goto('./');
  await page.click('button[data-case="notyet"]');
  await page.click('#dock-play');
  await page.click('#dock-next');
  await page.click('#dock-next');
  await expect(page.locator('#dock-text')).toContainText('Not statistically significant', { timeout: 20_000 });
  await expect(page.locator('#dock-text')).toContainText('more years of data');
  await expect(page.locator('#years-needed')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screens/gate2-${info.project.name}-case-notyet.png` });
});

test('compare: polar opposites from snapshots', async ({ page }, info) => {
  await offline(page);
  await page.goto('./');
  await page.click('button[data-case="poles"]');
  await page.click('#dock-play');
  await page.click('#dock-next');
  await page.click('#dock-next');
  await expect(page.locator('#cmp-sentence')).toContainText('Opposite trends', { timeout: 20_000 });
  await expect(page.locator('#dock-text')).toContainText('opposite significant trends');
  await page.locator('#dock-close').click();
  await page.locator('#compare').screenshot({ path: `docs/screens/gate2-${info.project.name}-compare.png` });
});

test('trend map: Chile box from snapshot has opposite significant cells', async ({ page }, info) => {
  test.setTimeout(60_000);
  await offline(page);
  await page.goto('./');
  await page.click('button[data-case="drywet"]');
  await page.click('#dock-play');
  await page.click('#dock-next');
  await expect(page.locator('#dock-text')).toContainText('significant drying trend', { timeout: 30_000 });
  await expect(page.locator('.tm-svg .cell')).toHaveCount(357);
  await expect(page.locator('#tm-summary')).toContainText('Opposite significant trends');
  await page.locator('#dock-close').click();
  await page.locator('#trendmap').screenshot({ path: `docs/screens/gate2-${info.project.name}-trendmap.png` });
});

test('region-type suggestions are offered and set the variable', async ({ page }) => {
  await page.goto('./');
  await page.selectOption('#preset', 'svalbard');
  await expect(page.locator('#suggest')).toContainText('Snow depth');
  await page.locator('#suggest button[data-v="SNODP"]').click();
  await expect(page.locator('#var')).toHaveValue('SNODP');
});

test('radiation variables default to 2001', async ({ page }) => {
  await page.goto('./');
  await page.selectOption('#var', 'ALLSKY_SFC_SW_DWN');
  await expect(page.locator('#start')).toHaveValue('2001');
});

test('Investigate scrolls to the result', async ({ page }) => {
  await offline(page);
  await page.goto('./');
  await page.selectOption('#preset', 'seoul');
  await page.click('#go');
  await expect(page.locator('#verdict')).toBeInViewport({ timeout: 20_000 });
});

test('LIVE: compare and trend map against the real API', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await page.locator('#compare button[type=submit]').click();
  await expect(page.locator('#cmp-sentence')).toBeVisible({ timeout: 60_000 });
  await page.selectOption('#tm-size', '4');
  await page.locator('#tm-form button[type=submit]').click();
  await expect(page.locator('#tm-summary')).toContainText('grid cells tested', { timeout: 90_000 });
});

test('CSV download for the teammate review recomputes the on-screen slope and S', async ({ page }) => {
  await offline(page);
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 20_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csv = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8');
  const rows = csv.trim().split('\n').filter((l) => /^\d/.test(l)).map((l) => l.split(',').map(Number));
  expect(rows.length).toBe(540);
  const t = rows.map((r) => r[2]);
  const y = rows.map((r) => r[4]);
  const n = y.length;
  const tm = t.reduce((a, b) => a + b) / n;
  const ym = y.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (t[i] - tm) * (y[i] - ym); sxx += (t[i] - tm) ** 2; }
  let S = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
  const shown = await page.locator('.stat-table').innerText();
  expect(shown).toContain(`S = ${S},`);
  const perDec = ((sxy / sxx) * 10).toFixed(3);
  await expect(page.locator('#how-much')).toContainText(`+${perDec} °C per decade`);
});

test('map zoom makes the map wider and a tap sets the place', async ({ page }) => {
  await page.goto('./');
  const host = page.locator('#map');
  const before = (await host.locator('svg').boundingBox())!.width;
  await page.locator('#investigate .map-tools button').click();
  const after = (await host.locator('svg').boundingBox())!.width;
  expect(after).toBeGreaterThan(before * 2);
  await host.locator('svg').click({ position: { x: after * 0.5, y: 100 } });
  await expect(page.locator('#place-now')).toContainText('Selected:');
  await expect(page.locator('#lon')).not.toHaveValue('126.98');
});
