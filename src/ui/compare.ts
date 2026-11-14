/*
 * Slope and Signal - compare the same variable at two places.
 * Answers the challenge point that one variable can trend one way in one
 * region and the opposite way in another.
 * Written with Claude (Anthropic) under the team's direction.
 */
import { LAST_YEAR, variable } from '../data/catalogue';
import { PLACES } from '../data/places';
import { fetchPoint, PowerError } from '../data/power';
import { periodLabel, type PeriodKey } from '../data/series';
import { ols } from '../stats/trend';
import { compute, type Computed, type Query } from '../analysis';
import { escapeHtml, renderChart } from './chart';
import { periodOptions, placeText, presetOptions, shortName, startFor, variableOptions, yearOptions } from './common';
import { createWorldMap } from './worldmap';
import { fmtNum, fmtP, makeVerdict, rateDp, type Verdict } from '../verdict';

export interface CompareQuery {
  v: string;
  a: { lat: number; lon: number; name: string };
  b: { lat: number; lon: number; name: string };
  start: number;
  end: number;
  period: PeriodKey;
}

export interface CompareResult {
  a: Computed;
  b: Computed;
  va: Verdict;
  vb: Verdict;
  opposite: boolean;
}

export interface CompareApi {
  run(q: CompareQuery, opts?: { snapshotOnly?: boolean; scroll?: boolean }): Promise<CompareResult | null>;
}

export const DEFAULT_COMPARE: CompareQuery = {
  v: 'PRECTOTCORR',
  a: { lat: 13.5, lon: 2.1, name: 'Sahel near Niamey, Niger' },
  b: { lat: -3.1, lon: -60.0, name: 'Central Amazon near Manaus, Brazil' },
  start: 1981,
  end: LAST_YEAR,
  period: 'year',
};

export function initCompare(host: HTMLElement): CompareApi {
  host.innerHTML = `
  <h2 id="cmp-h">Compare two places</h2>
  <p class="lede-sm">The same variable can trend one way in one place and the opposite way in another, even when the same process drives both. Test it.</p>
  <form id="cmp-form" class="cmp-form" novalidate>
    <div class="cmp-places">
      <fieldset class="q place-a"><legend><span class="dot-a" aria-hidden="true"></span> Place A</legend>
        <select id="cmp-pa" aria-label="Preset for place A">${presetOptions()}</select>
        <div class="row"><label>Lat <input id="cmp-la" type="number" step="0.01" inputmode="decimal" /></label><label>Lon <input id="cmp-oa" type="number" step="0.01" inputmode="decimal" /></label></div>
      </fieldset>
      <fieldset class="q place-b"><legend><span class="dot-b" aria-hidden="true"></span> Place B</legend>
        <select id="cmp-pb" aria-label="Preset for place B">${presetOptions()}</select>
        <div class="row"><label>Lat <input id="cmp-lb" type="number" step="0.01" inputmode="decimal" /></label><label>Lon <input id="cmp-ob" type="number" step="0.01" inputmode="decimal" /></label></div>
      </fieldset>
    </div>
    <div class="cmp-map">
      <p class="hint" id="cmp-which-hint">Tapping the map moves: <label class="inline"><input type="radio" name="cmp-which" value="a" checked> A</label> <label class="inline"><input type="radio" name="cmp-which" value="b"> B</label></p>
      <div id="cmp-map" class="map-host"></div>
    </div>
    <div class="cmp-what">
      <label for="cmp-var">Variable</label><select id="cmp-var">${variableOptions()}</select>
      <div class="row"><label>From <select id="cmp-s"></select></label><label>To <select id="cmp-e"></select></label></div>
      <label for="cmp-p">Part of the year</label><select id="cmp-p">${periodOptions()}</select>
      <div class="actions"><button class="btn primary" type="submit">Compare</button></div>
    </div>
  </form>
  <div id="cmp-status" class="status" role="status" aria-live="polite"></div>
  <div id="cmp-out" tabindex="-1"></div>`;

  const $ = <T extends HTMLElement>(id: string) => host.querySelector(`#${id}`) as T;
  let q: CompareQuery = structuredClone(DEFAULT_COMPARE);
  const map = createWorldMap($('cmp-map'), (lat, lon) => {
    const which = (host.querySelector('input[name="cmp-which"]:checked') as HTMLInputElement).value as 'a' | 'b';
    q[which] = { lat, lon, name: '' };
    if (which === 'a') (host.querySelector('input[value="b"]') as HTMLInputElement).checked = true;
    sync();
  });
  const sync = () => {
    $<HTMLSelectElement>('cmp-var').value = q.v;
    const v = variable(q.v);
    $('cmp-s').innerHTML = yearOptions(v, Math.max(q.start, v.firstYear));
    $('cmp-e').innerHTML = yearOptions(v, q.end);
    $<HTMLSelectElement>('cmp-p').value = q.period;
    for (const k of ['a', 'b'] as const) {
      $<HTMLInputElement>(`cmp-l${k}`).value = String(q[k].lat);
      $<HTMLInputElement>(`cmp-o${k}`).value = String(q[k].lon);
      const pr = PLACES.find((p) => p.name === q[k].name);
      $<HTMLSelectElement>(`cmp-p${k}`).value = pr ? pr.id : '';
    }
    map.setMarkers([
      { ...q.a, label: `A: ${shortName(q.a)}`, kind: 'a' },
      { ...q.b, label: `B: ${shortName(q.b)}`, kind: 'b' },
    ]);
  };
  for (const k of ['a', 'b'] as const) {
    $(`cmp-p${k}`).addEventListener('change', (ev) => {
      const p = PLACES.find((x) => x.id === (ev.target as HTMLSelectElement).value);
      if (p) {
        q[k] = { lat: p.lat, lon: p.lon, name: p.name };
        sync();
      }
    });
    for (const id of [`cmp-l${k}`, `cmp-o${k}`]) {
      $(id).addEventListener('change', () => {
        const la = Number($<HTMLInputElement>(`cmp-l${k}`).value);
        const lo = Number($<HTMLInputElement>(`cmp-o${k}`).value);
        if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 89.5 && Math.abs(lo) <= 180) {
          q[k] = { lat: la, lon: lo, name: '' };
          sync();
        }
      });
    }
  }
  $('cmp-var').addEventListener('change', () => {
    const v = variable($<HTMLSelectElement>('cmp-var').value);
    q.v = v.id;
    q.start = startFor(v, Number($<HTMLSelectElement>('cmp-s').value));
    sync();
  });
  $('cmp-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    let s = Number($<HTMLSelectElement>('cmp-s').value);
    let e = Number($<HTMLSelectElement>('cmp-e').value);
    if (e < s) [s, e] = [e, s];
    q = { ...q, v: $<HTMLSelectElement>('cmp-var').value, start: s, end: e, period: $<HTMLSelectElement>('cmp-p').value as PeriodKey };
    void run(q, { scroll: true });
  });

  let runId = 0;
  async function run(query: CompareQuery, opts: { snapshotOnly?: boolean; scroll?: boolean } = {}): Promise<CompareResult | null> {
    q = structuredClone(query);
    sync();
    const my = ++runId;
    const v = variable(q.v);
    const st = $('cmp-status');
    const out = $('cmp-out');
    st.innerHTML = `<p class="loading"><span class="spinner" aria-hidden="true"></span>Asking NASA POWER for both places...</p>`;
    let da, db;
    try {
      [da, db] = await Promise.all([fetchPoint(q.a.lat, q.a.lon, opts), fetchPoint(q.b.lat, q.b.lon, opts)]);
    } catch (e) {
      if (my !== runId) return null;
      st.innerHTML = `<p class="error"><strong>No data.</strong> ${escapeHtml(e instanceof PowerError ? e.message : String(e))}</p>`;
      return null;
    }
    if (my !== runId) return null;
    const src = [da, db].some((d) => d.source === 'snapshot') ? 'Shown from saved copies (snapshots) of the NASA POWER requests.' : 'Data from NASA POWER.';
    st.innerHTML = `<p class="ok">${src}</p>`;
    const mk = (p: CompareQuery['a']): Query => ({ v: q.v, lat: p.lat, lon: p.lon, name: p.name, start: q.start, end: q.end, period: q.period });
    const ca = compute(mk(q.a), v, da);
    const cb = compute(mk(q.b), v, db);
    if (typeof ca === 'string' || typeof cb === 'string') {
      out.innerHTML = `<p class="warn">${escapeHtml(typeof ca === 'string' ? `Place A: ${ca}` : '')} ${escapeHtml(typeof cb === 'string' ? `Place B: ${cb}` : '')}</p>`;
      return null;
    }
    const periodText = periodLabel(q.period);
    const va = makeVerdict({ v, report: ca.report, place: q.a.name || placeText(q.a), periodText, start: ca.start, end: ca.end, kind: ca.analysis.kind });
    const vb = makeVerdict({ v, report: cb.report, place: q.b.name || placeText(q.b), periodText, start: cb.start, end: cb.end, kind: cb.analysis.kind });
    const dp = rateDp(v);
    const sa = ca.report.ols.slope * 10;
    const sb = cb.report.ols.slope * 10;
    const opposite = sa * sb < 0 && va.level === 'strong' && vb.level === 'strong';
    let sentence: string;
    if (opposite) sentence = `Opposite trends: ${v.name.toLowerCase()} goes ${sa > 0 ? 'up' : 'down'} at A (${fmtNum(sa, dp, true)} ${v.units} per decade) and ${sb > 0 ? 'up' : 'down'} at B (${fmtNum(sb, dp, true)}), and both trends are statistically significant by both adjusted tests.`;
    else if (sa * sb < 0) sentence = `The slopes point in opposite directions (A ${fmtNum(sa, dp, true)}, B ${fmtNum(sb, dp, true)} ${v.units} per decade), but not both trends are significant, so we cannot claim opposite trends yet.`;
    else sentence = `Both places move in the same direction (A ${fmtNum(sa, dp, true)}, B ${fmtNum(sb, dp, true)} ${v.units} per decade). ${Math.abs(sa) > Math.abs(sb) ? 'A' : 'B'} changes ${(Math.max(Math.abs(sa), Math.abs(sb)) / Math.max(1e-12, Math.min(Math.abs(sa), Math.abs(sb)))).toFixed(1)} times faster.`;
    const card = (label: string, cls: string, vd: Verdict, c: Computed) => `
      <article class="mini verdict level-${vd.level}">
        <p class="badge"><span class="${cls}" aria-hidden="true"></span> ${label}: ${vd.level === 'strong' ? 'significant trend' : vd.level === 'mixed' ? 'mixed evidence' : 'no significant trend'}</p>
        <h3>${escapeHtml(vd.where)}</h3>
        <p><strong>${fmtNum(c.report.ols.slope * 10, dp, true)} ${escapeHtml(v.units)} per decade</strong> (95% CI ${fmtNum(c.report.ols.ciLowAdj * 10, dp, true)} to ${fmtNum(c.report.ols.ciHighAdj * 10, dp, true)})</p>
        <p class="small">Adjusted t-test ${fmtP(c.report.ols.pAdj)}; Mann-Kendall (Hamed-Rao) ${fmtP(c.report.mk.pCorr)}; Theil-Sen ${fmtNum(c.report.sen.slope * 10, dp, true)} per decade.</p>
        ${vd.longer ? `<p class="small">${escapeHtml(vd.longer)}</p>` : ''}
      </article>`;
    out.innerHTML = `
      <p class="cmp-sentence ${opposite ? 'opp' : ''}" id="cmp-sentence">${escapeHtml(sentence)}</p>
      <div class="cmp-cards">${card('A', 'dot-a', va, ca)}${card('B', 'dot-b', vb, cb)}</div>
      <div id="cmp-chart"></div>
      <p class="small">${escapeHtml(v.name)}, ${escapeHtml(periodText)}, ${ca.start} to ${q.end}. Tests run on ${ca.analysis.kind === 'monthly-anomaly' ? 'monthly anomalies' : 'one value per year'} at each place, separately.</p>`;
    // chart: yearly values as anomalies from each place's own mean, so the trends are comparable on one axis
    const ya = ca.analysis.yearly;
    const yb = cb.analysis.yearly;
    const ma = ya.y.reduce((s, x) => s + x, 0) / ya.y.length;
    const mb = yb.y.reduce((s, x) => s + x, 0) / yb.y.length;
    const ra = ya.y.map((x) => x - ma);
    const rb = yb.y.map((x) => x - mb);
    const oa = ols(ya.t, ra);
    const ob = ols(yb.t, rb);
    renderChart(out.querySelector('#cmp-chart')!, {
      title: `${v.name}, ${periodText}: each place relative to its own average (${v.units})`,
      summary: `Yearly values minus each place's ${ca.start}-${q.end} average. A trend line ${fmtNum(oa.slope * 10, dp, true)}, B trend line ${fmtNum(ob.slope * 10, dp, true)} ${v.units} per decade.`,
      yLabel: `Difference from average (${v.units})`,
      series: [
        { name: `A: ${shortName(q.a)}`, t: ya.t, y: ra, color: 'var(--series-1)', style: 'dots' },
        { name: `B: ${shortName(q.b)}`, t: yb.t, y: rb, color: 'var(--series-2)', style: 'dots' },
      ],
      trends: [
        { name: 'Trend A', slope: oa.slope, intercept: oa.intercept, color: 'var(--series-1)' },
        { name: 'Trend B', slope: ob.slope, intercept: ob.intercept, color: 'var(--series-2)', dash: true },
      ],
      dp: v.dp,
      zeroLine: true,
    });
    if (opts.scroll) out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return { a: ca, b: cb, va, vb, opposite };
  }

  sync();
  return { run };
}
