/*
 * Slope and Signal - app entry: builds the page sections.
 * Code written with Claude (Anthropic) under the direction of team Slope and
 * Signal. Data: NASA POWER monthly API, fetched live in the browser.
 */
import './style.css';
import { learnHtml } from './learn';
import { initCases } from './ui/cases';
import { initCompare } from './ui/compare';
import { initInvestigate, readHash } from './ui/investigate';
import { initTrendMap } from './ui/trendmap';

const main = document.getElementById('main')!;
main.innerHTML = `
<section class="intro">
  <h1>Is it really changing?</h1>
  <p class="lede">Pick something about the Earth, a place and a period. We fetch NASA data live, draw it, measure the slope and test whether the change is a trend or could be chance.</p>
  <ol class="how3" aria-label="How it works">
    <li><strong>Ask</strong> three short questions: what, where, when.</li>
    <li><strong>See</strong> the NASA POWER time series, with and without the seasonal cycle.</li>
    <li><strong>Test</strong> the slope: rate per decade, 95% interval, t-test and Mann-Kendall, in plain English.</li>
  </ol>
</section>
<section id="cases" class="panel" aria-labelledby="cases-h"></section>
<section id="investigate" class="panel" aria-labelledby="inv-h"></section>
<section id="compare" class="panel" aria-labelledby="cmp-h"></section>
<section id="trendmap" class="panel" aria-labelledby="tm-h"></section>
<section id="learn" class="panel" aria-labelledby="learn-h">${learnHtml()}</section>`;

const inv = initInvestigate(document.getElementById('investigate')!);
const cmp = initCompare(document.getElementById('compare')!);
const map = initTrendMap(document.getElementById('trendmap')!, (lat, lon) => {
  const q = inv.current();
  void inv.run({ ...q, lat, lon, name: '' }, { scroll: true });
});
initCases(document.getElementById('cases')!, { inv, cmp, map });

const fromHash = readHash();
if (fromHash) void inv.run(fromHash);
