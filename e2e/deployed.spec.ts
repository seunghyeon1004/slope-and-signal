// Slope and Signal - smoke test of the deployed site with LIVE NASA POWER data. Written with Claude (Anthropic).
// Run: DEPLOYED=1 npx playwright test e2e/deployed.spec.ts
import { expect, test } from '@playwright/test';
test.skip(!process.env.DEPLOYED, 'set DEPLOYED=1');
const SITE = 'https://seunghyeon1004.github.io/slope-and-signal/';
test('deployed site, live NASA POWER, Seoul air temperature', async ({ page }, info) => {
  await page.goto(`${SITE}#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea`);
  await expect(page.locator('.verdict')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#status')).toContainText('Fetched live from NASA POWER');
  await expect(page.locator('#ai-note')).toContainText('Claude (Anthropic)');
  await expect(page.locator('.stat-table')).toContainText('S = 38631,');
  await page.screenshot({ path: `docs/screens/gate2-deployed-${info.project.name}.png`, fullPage: false });
});
test('deployed site, guided cases run live (no snapshot)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(SITE);
  for (const id of ['seasons', 'poles', 'haze', 'notyet', 'drywet']) {
    await page.click(`button[data-case="${id}"]`);
    await page.click('#dock-play');
    await page.waitForTimeout(300);
    let n = Number((await page.locator('#dock-count').innerText()).split(' of ')[1]);
    for (let i = 1; i < n; i++) await page.click('#dock-next');
    await expect(page.locator('#dock-text')).not.toHaveText(/Working|could not|saved copy/, { timeout: 90_000 });
    console.log(id, '|', await page.locator('#dock-text').innerText());
    await page.click('#dock-close');
  }
  const snaps = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/data/snap/')).length);
  expect(snaps).toBe(0);
});
