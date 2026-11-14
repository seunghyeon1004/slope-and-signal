// Slope and Signal - renders docs/deck/deck.html to PDF with Playwright's bundled Chromium.
// Written with Claude (Anthropic). Run: node tools/make_deck.mjs
import { chromium } from '@playwright/test';
import { copyFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(pathToFileURL('docs/deck/deck.html').href, { waitUntil: 'networkidle' });
await p.pdf({ path: 'docs/deck/Slope-and-Signal-demo.pdf', width: '1280px', height: '720px', printBackground: true, pageRanges: '' });
for (let i = 1; i <= 7; i++) {
  const s = p.locator('section.slide').nth(i - 1);
  await s.screenshot({ path: `docs/deck/preview-${i}.png` });
}
await b.close();
copyFileSync('docs/deck/Slope-and-Signal-demo.pdf', 'public/demo.pdf');
console.log('ok');
