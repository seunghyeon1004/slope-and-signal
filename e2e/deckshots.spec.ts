// Slope and Signal - real screenshots for the demo deck (DECK=1 npx playwright test e2e/deckshots.spec.ts --project=desktop).
// Uses the LIVE NASA POWER API. Written with Claude (Anthropic).
import { expect, test } from '@playwright/test';
test.skip(!process.env.DECK, 'set DECK=1');
test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const D = 'docs/deck/img';
test('deck screenshots', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#status')).toContainText('NASA POWER');
  await page.addStyleTag({ content: 'header.site{position:static!important} .spot{animation:none!important}' });
  await page.locator('#ask').screenshot({ path: `${D}/ask.png` });
  await page.locator('#verdict').screenshot({ path: `${D}/verdict.png` });
  await page.locator('#ch-anom').screenshot({ path: `${D}/anomalies.png` });
  await page.locator('#ch-raw').screenshot({ path: `${D}/raw.png` });
  await page.locator('#stats').screenshot({ path: `${D}/stats.png` });
  await page.locator('#ch-year').screenshot({ path: `${D}/yearly.png` });
  await page.locator('#cases').screenshot({ path: `${D}/cases.png` });
  // case 4 with dock
  await page.click('button[data-case="notyet"]');
  await page.click('#dock-play');
  await page.click('#dock-next');
  await page.click('#dock-next');
  await expect(page.locator('#dock-text')).toContainText('Not statistically significant', { timeout: 60_000 });
  await page.setViewportSize({ width: 960, height: 760 });
  await page.locator('#is-sig').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -40));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${D}/case-notyet.png` });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.click('#dock-close');
  await page.click('button[data-case="poles"]');
  await page.click('#dock-play');
  await expect(page.locator('#cmp-sentence')).toBeVisible({ timeout: 60_000 });
  await page.click('#dock-close');
  await page.locator('#cmp-out').screenshot({ path: `${D}/compare.png` });
  await page.click('button[data-case="drywet"]');
  await page.click('#dock-play');
  await expect(page.locator('#tm-summary')).toBeVisible({ timeout: 90_000 });
  await page.click('#dock-close');
  await page.locator('.tm-fig').screenshot({ path: `${D}/trendmap.png` });
  await page.locator('.tm-wrap').screenshot({ path: `${D}/trendmap-plot.png` });
  await page.locator('#learn').screenshot({ path: `${D}/learn.png` });
});
