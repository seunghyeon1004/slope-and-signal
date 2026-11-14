// Slope and Signal - evidence screenshots (SCREENS=1 npx playwright test e2e/screens.spec.ts). Written with Claude (Anthropic).
import { expect, test } from '@playwright/test';
test.skip(!process.env.SCREENS, 'set SCREENS=1');
test('screens', async ({ page }, info) => {
  const p = info.project.name;
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 60_000 });
  await page.locator('#investigate fieldset.q-where').screenshot({ path: `docs/screens/gate2-${p}-where.png` });
  await page.locator('#verdict').screenshot({ path: `docs/screens/gate2-${p}-verdict.png` });
  await page.screenshot({ path: `docs/screens/gate2-${p}-full.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('#result').screenshot({ path: `docs/screens/gate2-${p}-result-dark.png` });
});
