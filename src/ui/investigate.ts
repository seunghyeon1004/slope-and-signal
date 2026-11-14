/*
 * Slope and Signal - the "Investigate" section: three questions, live NASA
 * POWER data, charts, statistics and a plain-English verdict.
 * Written with Claude (Anthropic) under the team's direction.
 */
import { LAST_YEAR, variable, type Variable } from '../data/catalogue';
import { PLACES, suggestFor } from '../data/places';
import { fetchPoint, PowerError, type PointData } from '../data/power';
import { inYears, periodLabel, r6, type PeriodKey } from '../data/series';
import { ols } from '../stats/trend';
import { compute, type Computed, type Query } from '../analysis';
import { escapeHtml, monthFmt, renderChart } from './chart';
import { isPeriod, periodOptions, placeText, presetOptions, shortName, startFor, variableOptions, yearOptions } from './common';
import { createWorldMap } from './worldmap';
import { fmtNum, fmtP, makeVerdict, rateDp } from '../verdict';

export const DEFAULT_QUERY: Query = { v: 'T2M', lat: 37.57, lon: 126.98, name: 'Seoul, South Korea', start: 1981, end: LAST_YEAR, period: 'year' };

export const CAVEAT =
  'Keep in mind: most of these values come from MERRA-2, a reanalysis (a weather model combined with observations), so a trend can partly reflect changes in the observing system. A significant trend says that the change is unlikely to be chance, not why it happens. One value describes a grid box tens of kilometres wide, not a weather station.';

export interface RunOpts {
  snapshotOnly?: boolean;
  scroll?: boolean;
}

export interface InvestigateApi {
  run(q: Query, opts?: RunOpts): Promise<Computed | null>;
  current(): Query;
  setPlace(lat: number, lon: number, name: string): void;
}

export function readHash(): Query | null {
  const q = new URLSearchParams(location.hash.replace(/^#\??/, ''));
  if (!q.has('v')) return null;
  const num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  let v = DEFAULT_QUERY.v;
  try {
    v = variable(q.get('v')!).id;
  } catch {
    /* keep default */
  }
  const p = q.get('p') ?? 'year';
  return {
    v,
    lat: Math.max(-89.5, Math.min(89.5, num('lat', DEFAULT_QUERY.lat))),
    lon: Math.max(-180, Math.min(180, num('lon', DEFAULT_QUERY.lon))),
    name: q.get('name') ?? '',
    start: num('s', DEFAULT_QUERY.start),
    end: Math.min(LAST_YEAR, num('e', DEFAULT_QUERY.end)),
    period: isPeriod(p) ? p : 'year',
  };
}

export function hashFor(q: Query): string {
  const p = new URLSearchParams({ v: q.v, lat: String(q.lat), lon: String(q.lon), s: String(q.start), e: String(q.end), p: q.period });
  if (q.name) p.set('name', q.name);
  return `#${p}`;
}

export function initInvestigate(host: HTMLElement): InvestigateApi {
  host.innerHTML = `
  <h2 id="inv-h">Investigate</h2>
  <form id="ask" class="ask" novalidate>
    <fieldset class="q">
      <legend><span class="qn">1</span> What do you want to investigate?</legend>
      <label for="var">Variable</label>
      <select id="var" name="var">${variableOptions()}</select>
      <p id="var-def" class="def" aria-live="polite"></p>
    </fieldset>
    <fieldset class="q q-where">
      <legend><span class="qn">2</span> Where?</legend>
      <label for="preset">Pick a type of place</label>
      <select id="preset">${presetOptions()}</select>
      <p class="hint">or tap the map, or type coordinates</p>
      <div id="map" class="map-host"></div>
      <div class="row">
        <label>Latitude <input id="lat" type="number" step="0.01" min="-89.5" max="89.5" inputmode="decimal" /></label>
        <label>Longitude <input id="lon" type="number" step="0.01" min="-180" max="180" inputmode="decimal" /></label>
      </div>
      <p id="place-now" class="def" aria-live="polite"></p>
      <div id="suggest" class="suggest"></div>
    </fieldset>
    <fieldset class="q">
      <legend><span class="qn">3</span> When?</legend>
      <div class="row">
        <label>From <select id="start"></select></label>
        <label>To <select id="end"></select></label>
      </div>
      <label for="period">Part of the year</label>
      <select id="period">${periodOptions()}</select>
      <p class="hint" id="period-hint"></p>
    </fieldset>
    <div class="actions"><button type="submit" id="go" class="btn primary">Investigate</button></div>
  </form>
  <div id="status" class="status" role="status" aria-live="polite"></div>
  <div id="result" class="result" hidden tabindex="-1"></div>`;

  const $ = <T extends HTMLElement>(id: string) => host.querySelector(`#${id}`) as T;
  const selVar = $<HTMLSelectElement>('var');
  const selPreset = $<HTMLSelectElement>('preset');
  const inLat = $<HTMLInputElement>('lat');
  const inLon = $<HTMLInputElement>('lon');
  const selStart = $<HTMLSelectElement>('start');
  const selEnd = $<HTMLSelectElement>('end');
  const selPeriod = $<HTMLSelectElement>('period');
  const statusEl = $('status');
  const resultEl = $('result');

  let q: Query = readHash() ?? { ...DEFAULT_QUERY };

  const fillYears = () => {
    const v = variable(selVar.value || q.v);
    selStart.innerHTML = yearOptions(v, Math.max(q.start, v.firstYear));
    selEnd.innerHTML = yearOptions(v, q.end);
  };
  const map = createWorldMap($('map'), (lat, lon) => {
    q = { ...q, lat, lon, name: '' };
    selPreset.value = '';
    syncPlace();
  });
  const syncSuggest = () => {
    const pr = PLACES.find((p) => p.name === q.name);
    const s = suggestFor(q.lat, pr?.type);
    $('suggest').innerHTML =
      `<p class="hint">Worth investigating at a ${escapeHtml(s.label)}:</p><ul>` +
      s.list.map((x) => `<li><button type="button" class="chip" data-v="${x.v}">${escapeHtml(variable(x.v).name)}</button> <span>${escapeHtml(x.why)}</span></li>`).join('') +
      '</ul>';
  };
  const syncPlace = () => {
    inLat.value = String(q.lat);
    inLon.value = String(q.lon);
    map.setMarkers([{ lat: q.lat, lon: q.lon, label: q.name ? shortName(q) : placeText(q), kind: 'a' }]);
    const pr = PLACES.find((p) => p.name === q.name);
    $('place-now').textContent = `Selected: ${placeText(q)}.${pr ? ` ${pr.hint}` : ''}`;
    syncSuggest();
  };
  const syncVar = () => {
    const v = variable(selVar.value);
    $('var-def').innerHTML = `${escapeHtml(v.plain)} <span class="src">Source: ${escapeHtml(v.source)}, from ${v.firstYear}${v.defaultStart ? `; we start in ${v.defaultStart} by default because the data product changes then` : ''}.</span>`;
  };
  const syncPeriodHint = () => {
    $('period-hint').textContent =
      selPeriod.value === 'year'
        ? 'The test uses monthly anomalies: each month minus its own long-term average, so the summer-winter cycle does not hide the trend.'
        : 'The test uses one value per year for this part of the year.';
  };
  const syncForm = () => {
    selVar.value = q.v;
    fillYears();
    selPeriod.value = q.period;
    const pr = PLACES.find((p) => p.name === q.name);
    selPreset.value = pr ? pr.id : '';
    syncPlace();
    syncVar();
    syncPeriodHint();
  };
  const changeVar = (id: string) => {
    const v = variable(id);
    q = { ...q, v: id, start: startFor(v, Number(selStart.value) || q.start), end: Number(selEnd.value) || q.end };
    selVar.value = id;
    fillYears();
    syncVar();
  };

  selVar.addEventListener('change', () => changeVar(selVar.value));
  selPeriod.addEventListener('change', syncPeriodHint);
  selPreset.addEventListener('change', () => {
    const p = PLACES.find((x) => x.id === selPreset.value);
    if (!p) return;
    q = { ...q, lat: p.lat, lon: p.lon, name: p.name };
    syncPlace();
  });
  $('suggest').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button[data-v]') as HTMLButtonElement | null;
    if (b) changeVar(b.dataset.v!);
  });
  for (const inp of [inLat, inLon]) {
    inp.addEventListener('change', () => {
      const la = Number(inLat.value);
      const lo = Number(inLon.value);
      if (inLat.value !== '' && inLon.value !== '' && Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 89.5 && Math.abs(lo) <= 180) {
        q = { ...q, lat: la, lon: lo, name: '' };
        selPreset.value = '';
        syncPlace();
      } else {
        $('place-now').textContent = 'Latitude must be between -89.5 and 89.5, longitude between -180 and 180.';
      }
    });
  }
  $('ask').addEventListener('submit', (ev) => {
    ev.preventDefault();
    let s = Number(selStart.value);
    let e = Number(selEnd.value);
    if (e < s) [s, e] = [e, s];
    q = { ...q, v: selVar.value, start: s, end: e, period: selPeriod.value as PeriodKey };
    void run(q, { scroll: true });
  });

  let runId = 0;
  let debounce: number | undefined;

  async function run(query: Query, opts: RunOpts = {}): Promise<Computed | null> {
    q = { ...query };
    syncForm();
    history.replaceState(null, '', hashFor(q));
    const my = ++runId;
    window.clearTimeout(debounce);
    await new Promise<void>((r) => (debounce = window.setTimeout(r, 200)));
    if (my !== runId) return null;
    const v = variable(q.v);
    if (q.end - q.start + 1 < 8) {
      statusEl.innerHTML = `<p class="warn">Please choose at least 8 years: a trend test needs a longer record.</p>`;
      return null;
    }
    statusEl.innerHTML = `<p class="loading"><span class="spinner" aria-hidden="true"></span>Asking NASA POWER for ${escapeHtml(placeText(q))}...</p>`;
    document.body.classList.add('busy');
    let data: PointData;
    try {
      data = await fetchPoint(q.lat, q.lon, { snapshotOnly: opts.snapshotOnly });
    } catch (e) {
      if (my !== runId) return null;
      document.body.classList.remove('busy');
      statusEl.innerHTML = `<p class="error"><strong>No data.</strong> ${escapeHtml(e instanceof PowerError ? e.message : String(e))} Try again in a minute, or open one of the guided cases, which have a saved copy of their data.</p>`;
      return null;
    }
    if (my !== runId) return null;
    document.body.classList.remove('busy');
    const src =
      data.source === 'live' ? 'Fetched live from NASA POWER just now.' : data.source === 'cache' ? 'From NASA POWER (saved in this browser earlier).' : 'Shown from a saved copy (snapshot) of the same NASA POWER request.';
    statusEl.innerHTML = `<p class="ok">${src} <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">See the raw request</a>.</p>`;
    const c = renderResult(q, v, data);
    if (opts.scroll) {
      resultEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      resultEl.focus({ preventScroll: true });
    }
    return c;
  }

  function renderResult(query: Query, v: Variable, data: PointData): Computed | null {
    const c = compute(query, v, data);
    resultEl.hidden = false;
    if (typeof c === 'string') {
      resultEl.innerHTML = `<p class="warn">${escapeHtml(c)}</p>`;
      return null;
    }
    const { report, analysis, start, end } = c;
    const place = placeText(query);
    const periodText = periodLabel(query.period);
    const vd = makeVerdict({ v, report, place: query.name || place, periodText, start, end, kind: analysis.kind });
    const dp = rateDp(v);
    const o = report.ols;
    const mk = report.mk;
    const sen = report.sen;
    const badge = vd.level === 'strong' ? 'Significant trend' : vd.level === 'mixed' ? 'Mixed evidence' : 'No significant trend';
    const icon = vd.level === 'strong' ? '&#10003;' : vd.level === 'mixed' ? '~' : '&#8211;';
    const testOn = analysis.kind === 'monthly-anomaly' ? `${analysis.y.length} monthly anomalies` : `${analysis.y.length} yearly values`;
    const dir = mk.s > 0 ? 'up' : mk.s < 0 ? 'down' : 'none';

    resultEl.innerHTML = `
    <article class="verdict level-${vd.level}" aria-labelledby="vd-h" id="verdict">
      <p class="badge"><span aria-hidden="true">${icon}</span> ${badge}</p>
      <h3 id="vd-h">${escapeHtml(vd.headline)}</h3>
      <dl class="four">
        <div><dt>What is changing?</dt><dd>${escapeHtml(vd.what)}</dd></div>
        <div><dt>Where?</dt><dd>${escapeHtml(place)}${data.elevation !== null ? `, ground height in the model ${Math.round(data.elevation)} m` : ''}.</dd></div>
        <div><dt>How much?</dt><dd id="how-much">${escapeHtml(vd.howMuch)}</dd></div>
        <div><dt>Is it significant?</dt><dd id="is-sig">${escapeHtml(vd.significance)}${vd.longer ? ` <strong id="years-needed">${escapeHtml(vd.longer)}</strong>` : ''}</dd></div>
      </dl>
      ${vd.caution.length ? `<ul class="caution">${vd.caution.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
      <p class="caveat">${escapeHtml(CAVEAT)}</p>
      <p class="share"><a href="${escapeHtml(location.href)}">Link to this investigation</a> · <button type="button" class="link" id="csv">Download the data (CSV)</button></p>
    </article>
    <div id="ch-anom"></div>
    <div id="ch-year"></div>
    <div id="ch-raw"></div>
    <section class="stats" aria-labelledby="st-h" id="stats">
      <h3 id="st-h">The statistics behind the verdict</h3>
      <p>Tests run on ${testOn}, ${start} to ${end}. Rates are per decade, in ${escapeHtml(v.units)}.</p>
      <div class="table-wrap"><table class="stat-table">
        <thead><tr><th scope="col">Method</th><th scope="col">Rate per decade</th><th scope="col">95% interval</th><th scope="col">p-value</th></tr></thead>
        <tbody>
          <tr><th scope="row">Least-squares line, plain t-test (df = ${o.n - 2})</th><td>${fmtNum(o.slope * 10, dp, true)}</td><td>${fmtNum(o.ciLow * 10, dp, true)} to ${fmtNum(o.ciHigh * 10, dp, true)}</td><td>${fmtP(o.p)}</td></tr>
          <tr class="main-row"><th scope="row">Least-squares line, t-test adjusted for autocorrelation (n<sub>eff</sub> = ${o.neff.toFixed(1)} of ${o.n})</th><td>${fmtNum(o.slope * 10, dp, true)}</td><td>${fmtNum(o.ciLowAdj * 10, dp, true)} to ${fmtNum(o.ciHighAdj * 10, dp, true)}</td><td>${fmtP(o.pAdj)}</td></tr>
          <tr><th scope="row">Mann-Kendall test (S = ${mk.s}, Kendall's tau = ${mk.tau.toFixed(3)})</th><td>direction ${dir}</td><td>not applicable</td><td>${fmtP(mk.p)}</td></tr>
          <tr class="main-row"><th scope="row">Mann-Kendall with Hamed-Rao correction, 3 lags (variance × ${Math.max(1, mk.nns).toFixed(2)})</th><td>direction ${dir}</td><td>not applicable</td><td>${fmtP(mk.pCorr)}</td></tr>
          <tr><th scope="row">Theil-Sen slope (median of all pairwise slopes)</th><td>${fmtNum(sen.slope * 10, dp, true)}</td><td>${fmtNum(sen.low * 10, dp, true)} to ${fmtNum(sen.high * 10, dp, true)} (corrected: ${fmtNum(sen.lowCorr * 10, dp, true)} to ${fmtNum(sen.highCorr * 10, dp, true)})</td><td>uses the Mann-Kendall p</td></tr>
        </tbody>
      </table></div>
      <p class="small">Lag-1 autocorrelation of the residuals: ${o.lag1.toFixed(3)}. R² of the line: ${o.r2.toFixed(3)}. Residual standard deviation: ${fmtNum(o.residSd, v.dp)} ${escapeHtml(v.units)}. The verdict uses the two highlighted rows: "significant" needs both below 0.05. See "How to read this" for what each number means.</p>
    </section>`;

    const unit = v.units;
    if (analysis.kind === 'monthly-anomaly') {
      const run12 = runningMean(analysis.t, analysis.y, 12);
      renderChart(resultEl.querySelector('#ch-anom')!, {
        title: `Anomalies: ${v.name.toLowerCase()} with the seasonal cycle removed (${unit})`,
        summary: `Each month minus its own ${start}-${end} average. The straight line is the trend, ${fmtNum(o.slope * 10, dp, true)} ${unit} per decade.`,
        yLabel: `Anomaly (${unit})`,
        series: [
          { name: 'Monthly anomaly', t: analysis.t, y: analysis.y, color: 'var(--series-1-soft)', style: 'thin' },
          { name: '12-month running mean', t: run12.t, y: run12.y, color: 'var(--series-1)', style: 'line' },
        ],
        trends: [{ name: 'Trend (least squares)', slope: o.slope, intercept: o.intercept, color: 'var(--trend)' }],
        dp: v.dp,
        zeroLine: true,
        timeFmt: monthFmt,
      });
    } else {
      resultEl.querySelector('#ch-anom')!.remove();
    }
    const yr = analysis.yearly;
    const yo = ols(yr.t, yr.y);
    renderChart(resultEl.querySelector('#ch-year')!, {
      title: `${v.name}, ${periodText}: one value per year (${v.yearlyLabel}, ${unit})`,
      summary: `${yr.t.length} years from ${yr.t[0]} to ${yr.t[yr.t.length - 1]}. Straight line: least-squares trend of these yearly values, ${fmtNum(yo.slope * 10, dp, true)} ${unit} per decade.`,
      yLabel: unit,
      series: [{ name: `Yearly value (${v.yearlyLabel})`, t: yr.t, y: yr.y, color: 'var(--series-1)', style: 'dots' }],
      trends: [{ name: 'Trend (least squares)', slope: yo.slope, intercept: yo.intercept, color: 'var(--trend)' }],
      dp: v.dp,
    });
    const raw = inYears(data.series[v.id], start, end);
    renderChart(resultEl.querySelector('#ch-raw')!, {
      title: `Raw monthly values (${unit})`,
      summary: `All ${raw.length} months as NASA POWER delivers them. The big wiggle is the seasonal cycle, which can hide a slow trend.`,
      yLabel: unit,
      series: [{ name: 'Monthly value', t: raw.map((m) => m.year + (m.month - 0.5) / 12), y: raw.map((m) => m.value), color: 'var(--series-1)', style: 'thin' }],
      dp: v.dp,
      timeFmt: monthFmt,
    });
    resultEl.querySelector('#csv')!.addEventListener('click', () => downloadCsv(query, v, raw, c.analysis.clim));
    return c;
  }

  syncForm();
  return {
    run,
    current: () => ({ ...q }),
    setPlace(lat, lon, name) {
      q = { ...q, lat, lon, name };
      syncPlace();
    },
  };
}

export function runningMean(t: number[], y: number[], w: number): { t: number[]; y: number[] } {
  const ot: number[] = [];
  const oy: number[] = [];
  for (let i = 0; i + w <= y.length; i++) {
    if (t[i + w - 1] - t[i] > (w - 0.5) / 12) continue; // gap
    let s = 0;
    for (let k = i; k < i + w; k++) s += y[k];
    ot.push((t[i] + t[i + w - 1]) / 2);
    oy.push(s / w);
  }
  return { t: ot, y: oy };
}

function downloadCsv(query: Query, v: Variable, raw: { year: number; month: number; value: number }[], clim: number[]): void {
  const lines = [
    `# Slope and Signal export. Source: NASA POWER monthly API (community AG), parameter ${v.id} (${v.units}), latitude ${query.lat}, longitude ${query.lon}, years ${raw[0]?.year}-${raw[raw.length - 1]?.year}`,
    `# anomaly = value minus the mean of the same calendar month over these years; time = year + (month - 0.5)/12`,
    'year,month,time,value,anomaly',
    ...raw.map((m) => `${m.year},${m.month},${(m.year + (m.month - 0.5) / 12).toFixed(6)},${m.value},${r6(m.value - clim[m.month - 1])}`),
  ];
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `slope-and-signal_${v.id}_${query.lat}_${query.lon}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
