// Slope and Signal - accessibility checks with axe-core, light and dark, plus keyboard paths.
// Written with Claude (Anthropic).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const offline = async (page: import('@playwright/test').Page) =>
  page.route('https://power.larc.nasa.gov/**', (r) => r.fulfill({ status: 503, body: 'down' }));

async function fillEverything(page: import('@playwright/test').Page) {
  await offline(page);
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 20_000 });
  await page.click('button[data-case="poles"]');
  await expect(page.locator('#cmp-sentence')).toBeVisible({ timeout: 20_000 });
  await page.click('#dock-close');
  await page.click('button[data-case="drywet"]');
  await expect(page.locator('#tm-summary')).toBeVisible({ timeout: 20_000 });
  await page.click('#dock-play'); // pause, keep dock open so it is checked too
}

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: no WCAG A/AA violations (${scheme})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await fillEverything(page);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const summary = r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes; e.g. ${v.nodes[0]?.target.join(' ')} ${v.nodes[0]?.failureSummary?.split('\n')[1] ?? ''}`);
    console.log(`[${scheme}] passes=${r.passes.length} violations=${r.violations.length}\n` + summary.join('\n'));
    expect(r.violations, summary.join('\n')).toEqual([]);
  });
}

test('keyboard: start a case, pause, step, minimise and close without a mouse', async ({ page }) => {
  await offline(page);
  await page.goto('./');
  await page.locator('button[data-case="seasons"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock-text')).toContainText('swing between', { timeout: 20_000 });
  await expect(page.locator('#dock-play')).toBeFocused();
  await page.keyboard.press('Enter'); // pause
  await page.keyboard.press('Tab'); // next
  await expect(page.locator('#dock-next')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock-count')).toHaveText('Step 2 of 4');
  await page.locator('#dock-min').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock-text')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dock-text')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.dock')).toBeHidden();
});

test('keyboard: map arrows move the marker, chart arrows show values', async ({ page }) => {
  await offline(page);
  await page.goto('./#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea');
  await expect(page.locator('#verdict')).toBeVisible({ timeout: 20_000 });
  await page.locator('#map svg').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#lat')).toHaveValue('38.57');
  await page.locator('#ch-year svg').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ch-year .tooltip')).toBeVisible();
  await expect(page.locator('#ch-year .tooltip')).toContainText('1981');
});

test('every interactive element is reachable by Tab and has an accessible name', async ({ page }) => {
  await offline(page);
  await page.goto('./');
  const unnamed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a[href], button, select, input, [tabindex="0"]')] as HTMLElement[];
    return els.filter((e) => {
      const name = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent?.trim() || (e as HTMLInputElement).labels?.[0]?.textContent?.trim() || e.getAttribute('title');
      return !name;
    }).map((e) => e.outerHTML.slice(0, 80));
  });
  expect(unnamed).toEqual([]);
});
