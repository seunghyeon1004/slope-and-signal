// Slope and Signal - end-to-end tests. Written with Claude (Anthropic).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = readFileSync(new URL('../tests/fixtures/power_seoul_raw.json', import.meta.url), 'utf8');
const seoulHash = '#v=T2M&lat=37.5&lon=127&s=1981&e=2024&p=year&name=Seoul+area';

test('core flow with a stubbed POWER response matches the Python reference numbers', async ({ page }) => {
  await page.route('https://power.larc.nasa.gov/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: fixture, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(`./${seoulHash}`);
  const v = page.locator('.verdict');
  await expect(v).toBeVisible();
  // Python reference (tests/fixtures/stats_reference.json, power_seoul_t2m_anomaly):
  // OLS 0.35246 /decade, adjusted CI 0.23933..0.46558, Theil-Sen 0.36364
  await expect(v).toContainText('+0.352 °C per decade');
  await expect(v).toContainText('+0.239 to +0.466');
  await expect(v).toContainText('Theil-Sen estimate is +0.364');
  await expect(v).toContainText('Significant trend');
  await expect(page.locator('.stat-table')).toContainText('p < 0.0001');
  await expect(page.locator('figure.chart')).toHaveCount(3);
});

test('core flow with LIVE NASA POWER data (Seoul, air temperature)', async ({ page }, info) => {
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('.verdict')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#status')).toContainText(/Fetched live|saved in this browser/);
  await expect(page.locator('.verdict')).toContainText('per decade');
  await page.screenshot({ path: `docs/screens/gate1-${info.project.name}-top.png`, fullPage: false });
  await page.screenshot({ path: `docs/screens/gate1-${info.project.name}-full.png`, fullPage: true });
});

test('API failure shows a clear message', async ({ page }) => {
  await page.route('https://power.larc.nasa.gov/**', (r) => r.fulfill({ status: 503, body: 'down' }));
  await page.goto('./#v=T2M&lat=10&lon=10&s=1990&e=2020&p=year');
  await expect(page.locator('#status .error')).toContainText('NASA POWER');
});

test('form flow: pick a preset, a variable and a season, then investigate', async ({ page }) => {
  await page.route('https://power.larc.nasa.gov/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: fixture, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('./');
  await page.selectOption('#var', 'PRECTOTCORR');
  await page.selectOption('#preset', 'seoul');
  await page.selectOption('#period', 'JJA');
  await page.selectOption('#end', '2024');
  await page.click('#go');
  await expect(page.locator('.verdict')).toContainText('Rain and snowfall');
  await expect(page.locator('.verdict')).toContainText('JJA');
});
