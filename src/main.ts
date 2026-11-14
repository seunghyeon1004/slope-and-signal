/*
 * Slope and Signal - app entry.
 * Code written with Claude (Anthropic) under the direction of team Slope and
 * Signal. Data: NASA POWER monthly API, fetched live in the browser.
 */
import './style.css';
import { CATALOGUE, LAST_YEAR, variable, type Variable } from './data/catalogue';
import { PLACES } from './data/places';
import { fetchPoint, PowerError, type PointData } from './data/power';
import { buildAnalysis, inYears, MONTH_NAMES, periodLabel, SEASONS, type PeriodKey } from './data/series';
import { analyseTrend, ols, type TrendReport } from './stats/trend';
import { escapeHtml, monthFmt, renderChart } from './ui/chart';
import { createWorldMap } from './ui/worldmap';
import { fmtNum, fmtP, makeVerdict, rateDp } from './verdict';
import { learnHtml } from './learn';

export interface Query {
  v: string;
  lat: number;
  lon: number;
  name: string;
  start: number;
  end: number;
  period: PeriodKey;
}

const DEFAULT: Query = { v: 'T2M', lat: 37.57, lon: 126.98, name: 'Seoul, South Korea', start: 1981, end: LAST_YEAR, period: 'year' };

function readHash(): Query {
  const q = new URLSearchParams(location.hash.replace(/^#\??/, ''));
  if (!q.has('v')) return { ...DEFAULT };
  const num = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const v = CATALOGUE.some((c) => c.id === q.get('v')) ? q.get('v')! : DEFAULT.v;
  const p = (q.get('p') ?? 'year') as PeriodKey;
  const okP = p === 'year' || p in SEASONS || /^m([1-9]|1[0-2])$/.test(p);
  return {
    v,
    lat: Math.max(-89.5, Math.min(89.5, num('lat', DEFAULT.lat))),
    lon: Math.max(-180, Math.min(180, num('lon', DEFAULT.lon))),
    name: q.get('name') ?? '',
    start: num('s', DEFAULT.start),
    end: num('e', DEFAULT.end),
    period: okP ? p : 'year',
  };
}

function writeHash(q: Query): void {
  const p = new URLSearchParams({ v: q.v, lat: String(q.lat), lon: String(q.lon), s: String(q.start), e: String(q.end), p: q.period });
  if (q.name) p.set('name', q.name);
  history.replaceState(null, '', `#${p}`);
}

export function placeText(q: Pick<Query, 'lat' | 'lon' | 'name'>): string {
  const ll = `${Math.abs(q.lat).toFixed(2)}°${q.lat >= 0 ? 'N' : 'S'}, ${Math.abs(q.lon).toFixed(2)}°${q.lon >= 0 ? 'E' : 'W'}`;
  return q.name ? `${q.name} (${ll})` : ll;
}

const main = document.getElementById('main')!;

main.innerHTML = `
<section class="intro">
  <h1>Is it really changing?</h1>
  <p class="lede">Pick something about the Earth, a place and a period. We fetch NASA data live, draw it, measure the slope and test whether the change is real or could be chance.</p>
</section>

<section id="investigate" class="panel" aria-labelledby="inv-h">
  <h2 id="inv-h">Investigate</h2>
  <form id="ask" class="ask" novalidate>
    <fieldset class="q">
      <legend><span class="qn">1</span> What do you want to investigate?</legend>
      <label for="var">Variable</label>
      <select id="var" name="var"></select>
      <p id="var-def" class="def" aria-live="polite"></p>
    </fieldset>
    <fieldset class="q">
      <legend><span class="qn">2</span> Where?</legend>
      <label for="preset">Pick a type of place</label>
      <select id="preset"><option value="">Choose a preset place...</option></select>
      <p class="hint">or click the map, or type coordinates</p>
      <div id="map" class="map-host"></div>
      <div class="row">
        <label>Latitude <input id="lat" type="number" step="0.01" min="-89.5" max="89.5" inputmode="decimal" /></label>
        <label>Longitude <input id="lon" type="number" step="0.01" min="-180" max="180" inputmode="decimal" /></label>
      </div>
      <p id="place-now" class="def" aria-live="polite"></p>
    </fieldset>
    <fieldset class="q">
      <legend><span class="qn">3</span> When?</legend>
      <div class="row">
        <label>From <select id="start"></select></label>
        <label>To <select id="end"></select></label>
      </div>
      <label for="period">Part of the year</label>
      <select id="period"></select>
      <p class="hint" id="period-hint"></p>
    </fieldset>
    <div class="actions"><button type="submit" id="go" class="btn primary">Investigate</button></div>
  </form>
  <div id="status" class="status" role="status" aria-live="polite"></div>
  <div id="result" class="result" hidden></div>
</section>

<section id="learn" class="panel" aria-labelledby="learn-h">${learnHtml()}</section>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const selVar = $<HTMLSelectElement>('var');
const selPreset = $<HTMLSelectElement>('preset');
const inLat = $<HTMLInputElement>('lat');
const inLon = $<HTMLInputElement>('lon');
const selStart = $<HTMLSelectElement>('start');
const selEnd = $<HTMLSelectElement>('end');
const selPeriod = $<HTMLSelectElement>('period');
const statusEl = $('status');
const resultEl = $('result');

// variables grouped
const groups = [...new Set(CATALOGUE.map((c) => c.group))];
selVar.innerHTML = groups
  .map((g) => `<optgroup label="${g}">${CATALOGUE.filter((c) => c.group === g).map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.units)})</option>`).join('')}</optgroup>`)
  .join('');
const types = [...new Set(PLACES.map((p) => p.type))];
selPreset.innerHTML += types
  .map((t) => `<optgroup label="${t}">${PLACES.filter((p) => p.type === t).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</optgroup>`)
  .join('');
selPeriod.innerHTML =
  `<option value="year">Whole year (seasonal cycle removed)</option>` +
  Object.entries(SEASONS).map(([k, s]) => `<option value="${k}">Season ${k}: ${s.label}</option>`).join('') +
  MONTH_NAMES.map((m, i) => `<option value="m${i + 1}">Only ${m}</option>`).join('');

let q = readHash();

function fillYears(): void {
  const v = variable(selVar.value || q.v);
  const yrs: number[] = [];
  for (let y = v.firstYear; y <= LAST_YEAR; y++) yrs.push(y);
  const s = Math.max(q.start, v.firstYear);
  selStart.innerHTML = yrs.map((y) => `<option ${y === s ? 'selected' : ''}>${y}</option>`).join('');
  selEnd.innerHTML = yrs.map((y) => `<option ${y === q.end ? 'selected' : ''}>${y}</option>`).join('');
}

const map = createWorldMap($('map'), (lat, lon) => {
  q = { ...q, lat, lon, name: '' };
  selPreset.value = '';
  syncPlace();
});

function syncPlace(): void {
  inLat.value = String(q.lat);
  inLon.value = String(q.lon);
  map.setMarkers([{ lat: q.lat, lon: q.lon, label: q.name ? q.name.split(',')[0] : '', kind: 'a' }]);
  $('place-now').textContent = `Selected: ${placeText(q)}`;
}

function syncVar(): void {
  const v = variable(selVar.value);
  $('var-def').innerHTML = `${escapeHtml(v.plain)} <span class="src">Source: ${escapeHtml(v.source)}, from ${v.firstYear}.</span>`;
}

function syncPeriodHint(): void {
  $('period-hint').textContent =
    selPeriod.value === 'year'
      ? 'The test uses monthly anomalies: each month minus its own long-term average, so the summer-winter cycle does not hide the trend.'
      : 'The test uses one value per year for this part of the year.';
}

function syncForm(): void {
  selVar.value = q.v;
  fillYears();
  selPeriod.value = q.period;
  const pr = PLACES.find((p) => p.name === q.name);
  selPreset.value = pr ? pr.id : '';
  syncPlace();
  syncVar();
  syncPeriodHint();
}

selVar.addEventListener('change', () => {
  q.v = selVar.value;
  fillYears();
  syncVar();
});
selPeriod.addEventListener('change', syncPeriodHint);
selPreset.addEventListener('change', () => {
  const p = PLACES.find((x) => x.id === selPreset.value);
  if (!p) return;
  q = { ...q, lat: p.lat, lon: p.lon, name: p.name };
  syncPlace();
  $('place-now').textContent = `Selected: ${placeText(q)}. ${p.hint}`;
});
for (const inp of [inLat, inLon]) {
  inp.addEventListener('change', () => {
    const la = Number(inLat.value);
    const lo = Number(inLon.value);
    if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 89.5 && Math.abs(lo) <= 180) {
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
  run(q);
});

let runId = 0;
let debounce: number | undefined;

export async function run(query: Query): Promise<void> {
  writeHash(query);
  const my = ++runId;
  window.clearTimeout(debounce);
  await new Promise<void>((r) => (debounce = window.setTimeout(r, 250)));
  if (my !== runId) return;
  const v = variable(query.v);
  if (query.end - query.start + 1 < 8) {
    statusEl.innerHTML = `<p class="warn">Please choose at least 8 years: a trend test needs a longer record.</p>`;
    return;
  }
  statusEl.innerHTML = `<p class="loading"><span class="spinner" aria-hidden="true"></span>Asking NASA POWER for ${escapeHtml(placeText(query))}...</p>`;
  document.body.classList.add('busy');
  let data: PointData;
  try {
    data = await fetchPoint(query.lat, query.lon);
  } catch (e) {
    if (my !== runId) return;
    document.body.classList.remove('busy');
    statusEl.innerHTML = `<p class="error"><strong>No data.</strong> ${escapeHtml(e instanceof PowerError ? e.message : String(e))} Try again in a minute, or open one of the guided cases, which have a saved copy of the data.</p>`;
    return;
  }
  if (my !== runId) return;
  document.body.classList.remove('busy');
  const src = data.source === 'live' ? 'Fetched live from NASA POWER just now.' : data.source === 'cache' ? 'From NASA POWER (saved in this browser earlier).' : 'NASA POWER was not reachable, so a saved copy (snapshot) of the same request is shown.';
  statusEl.innerHTML = `<p class="ok">${src} <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener">See the raw request</a>.</p>`;
  renderResult(query, v, data);
}

interface Computed {
  report: TrendReport;
  analysis: ReturnType<typeof buildAnalysis>;
  start: number;
  end: number;
}

export function compute(query: Query, v: Variable, data: PointData): Computed | string {
  const all = data.series[v.id] ?? [];
  const start = Math.max(query.start, v.firstYear);
  const s = inYears(all, start, query.end);
  if (s.length < 24) return `NASA POWER has no usable ${v.name.toLowerCase()} values here for ${start} to ${query.end}${v.landOnly ? ' (this variable exists only over land; is the point in the sea?)' : ''}.`;
  const analysis = buildAnalysis(s, query.period, v.agg);
  if (analysis.y.length < 8) return 'Not enough complete years for this part of the year.';
  const allSame = analysis.y.every((x) => x === analysis.y[0]);
  if (allSame) return `${v.name} is constant here (for example no snow at all), so there is nothing to test.`;
  const report = analyseTrend(analysis.t, analysis.y, analysis.stepsPerYear);
  return { report, analysis, start, end: query.end };
}

function renderResult(query: Query, v: Variable, data: PointData): void {
  const c = compute(query, v, data);
  resultEl.hidden = false;
  if (typeof c === 'string') {
    resultEl.innerHTML = `<p class="warn">${escapeHtml(c)}</p>`;
    return;
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

  resultEl.innerHTML = `
  <article class="verdict level-${vd.level}" aria-labelledby="vd-h">
    <p class="badge"><span aria-hidden="true">${icon}</span> ${badge}</p>
    <h3 id="vd-h">${escapeHtml(vd.headline)}</h3>
    <dl class="four">
      <div><dt>What is changing?</dt><dd>${escapeHtml(vd.what)}</dd></div>
      <div><dt>Where?</dt><dd>${escapeHtml(place)}${data.elevation !== null ? `, ground height in the model ${Math.round(data.elevation)} m` : ''}.</dd></div>
      <div><dt>How much?</dt><dd>${escapeHtml(vd.howMuch)}</dd></div>
      <div><dt>Is it significant?</dt><dd>${escapeHtml(vd.significance)}${vd.longer ? ` <strong>${escapeHtml(vd.longer)}</strong>` : ''}</dd></div>
    </dl>
    ${vd.caution.length ? `<ul class="caution">${vd.caution.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
    <p class="share"><a href="${escapeHtml(location.href)}">Link to this investigation</a> · <button type="button" class="link" id="csv">Download the data (CSV)</button></p>
  </article>
  <div id="ch-anom"></div>
  <div id="ch-year"></div>
  <div id="ch-raw"></div>
  <section class="stats" aria-labelledby="st-h">
    <h3 id="st-h">The statistics behind the verdict</h3>
    <p>Tests run on ${testOn}, ${start} to ${end}. Rates are per decade.</p>
    <div class="table-wrap"><table class="stat-table">
      <thead><tr><th scope="col">Method</th><th scope="col">Rate per decade</th><th scope="col">95% interval</th><th scope="col">p-value</th></tr></thead>
      <tbody>
        <tr><th scope="row">Least-squares line, plain t-test</th><td>${fmtNum(o.slope * 10, dp, true)}</td><td>${fmtNum(o.ciLow * 10, dp, true)} to ${fmtNum(o.ciHigh * 10, dp, true)}</td><td>${fmtP(o.p)}</td></tr>
        <tr class="main-row"><th scope="row">Least-squares line, t-test adjusted for autocorrelation (n<sub>eff</sub> = ${o.neff.toFixed(1)} of ${o.n})</th><td>${fmtNum(o.slope * 10, dp, true)}</td><td>${fmtNum(o.ciLowAdj * 10, dp, true)} to ${fmtNum(o.ciHighAdj * 10, dp, true)}</td><td>${fmtP(o.pAdj)}</td></tr>
        <tr><th scope="row">Mann-Kendall test (S = ${mk.s}, Kendall's tau = ${mk.tau.toFixed(3)})</th><td>direction ${mk.s > 0 ? 'up' : mk.s < 0 ? 'down' : 'none'}</td><td>not applicable</td><td>${fmtP(mk.p)}</td></tr>
        <tr class="main-row"><th scope="row">Mann-Kendall with Hamed-Rao autocorrelation correction (variance x ${Math.max(1, mk.nns).toFixed(2)})</th><td>direction ${mk.s > 0 ? 'up' : mk.s < 0 ? 'down' : 'none'}</td><td>not applicable</td><td>${fmtP(mk.pCorr)}</td></tr>
        <tr><th scope="row">Theil-Sen slope (median of all pairwise slopes)</th><td>${fmtNum(sen.slope * 10, dp, true)}</td><td>${fmtNum(sen.low * 10, dp, true)} to ${fmtNum(sen.high * 10, dp, true)} (corrected: ${fmtNum(sen.lowCorr * 10, dp, true)} to ${fmtNum(sen.highCorr * 10, dp, true)})</td><td>uses the Mann-Kendall p</td></tr>
      </tbody>
    </table></div>
    <p class="small">Lag-1 autocorrelation of the residuals: ${o.lag1.toFixed(3)}. R² of the line: ${o.r2.toFixed(3)}. Residual standard deviation: ${fmtNum(o.residSd, v.dp)} ${escapeHtml(v.units)}. The verdict uses the two highlighted rows. See "How to read this" below for what each number means.</p>
  </section>`;

  const unit = v.units;
  if (analysis.kind === 'monthly-anomaly') {
    const run12 = runningMean(analysis.t, analysis.y, 12);
    renderChart(document.getElementById('ch-anom')!, {
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
    document.getElementById('ch-anom')!.remove();
  }
  const yr = analysis.yearly;
  const yo = ols(yr.t, yr.y);
  renderChart(document.getElementById('ch-year')!, {
    title: `${v.name}, ${periodText}: one value per year (${v.yearlyLabel}, ${unit})`,
    summary: `${yr.t.length} years from ${yr.t[0]} to ${yr.t[yr.t.length - 1]}. Straight line: least-squares trend of these yearly values, ${fmtNum(yo.slope * 10, dp, true)} ${unit} per decade.`,
    yLabel: unit,
    series: [{ name: `Yearly value (${v.yearlyLabel})`, t: yr.t, y: yr.y, color: 'var(--series-1)', style: 'dots' }],
    trends: [{ name: 'Trend (least squares)', slope: yo.slope, intercept: yo.intercept, color: 'var(--trend)' }],
    dp: v.dp,
  });
  const raw = inYears(data.series[v.id], start, end);
  renderChart(document.getElementById('ch-raw')!, {
    title: `Raw monthly values (${unit})`,
    summary: `All ${raw.length} months as NASA POWER delivers them. The big wiggle is the seasonal cycle, which can hide a slow trend.`,
    yLabel: unit,
    series: [{ name: 'Monthly value', t: raw.map((m) => m.year + (m.month - 0.5) / 12), y: raw.map((m) => m.value), color: 'var(--series-1)', style: 'thin' }],
    dp: v.dp,
    timeFmt: monthFmt,
  });
  document.getElementById('csv')!.addEventListener('click', () => downloadCsv(query, v, raw, analysis));
}

function runningMean(t: number[], y: number[], w: number): { t: number[]; y: number[] } {
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

function downloadCsv(query: Query, v: Variable, raw: { year: number; month: number; value: number }[], a: Computed['analysis']): void {
  const lines = [
    `# Slope and Signal export. Source: NASA POWER monthly API, parameter ${v.id} (${v.units}), lat ${query.lat}, lon ${query.lon}`,
    `# anomaly = value minus the mean of the same calendar month over the selected years`,
    'year,month,value,anomaly',
    ...raw.map((m) => `${m.year},${m.month},${m.value},${(m.value - a.clim[m.month - 1]).toFixed(4)}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const u = URL.createObjectURL(blob);
  const aEl = document.createElement('a');
  aEl.href = u;
  aEl.download = `slope-and-signal_${v.id}_${query.lat}_${query.lon}.csv`;
  aEl.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

syncForm();
if (location.hash.includes('v=')) run(q);
