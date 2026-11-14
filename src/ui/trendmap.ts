/*
 * Slope and Signal - trend map for a box (NASA POWER regional endpoint).
 * Each grid cell: one value per year, Mann-Kendall test with the Hamed-Rao
 * correction and the Theil-Sen slope. Colour = slope per decade on a
 * diverging scale; a dot marks p < 0.05.
 * Coastlines: Natural Earth 1:50m land (public domain).
 * Written with Claude (Anthropic) under the team's direction.
 */
import { LAST_YEAR, variable, type Variable } from '../data/catalogue';
import { fetchRegion, PowerError, type Box, type GridCell } from '../data/power';
import { inYears, periodLabel, periodMonths, yearlySeries, type PeriodKey } from '../data/series';
import { mannKendall, theilSen } from '../stats/trend';
import { escapeHtml } from './chart';
import { periodOptions, placeText, presetOptions, startFor, variableOptions, yearOptions } from './common';
import { PLACES } from '../data/places';
import { fmtNum, fmtP, rateDp } from '../verdict';

export interface MapQuery {
  v: string;
  lat: number;
  lon: number;
  name: string;
  size: number; // degrees, <= 10
  start: number;
  end: number;
  period: PeriodKey;
}

export interface CellResult {
  lat: number;
  lon: number;
  slope: number; // per decade
  p: number;
  n: number;
}

export interface MapResult {
  cells: CellResult[];
  sigUp: number;
  sigDown: number;
  tested: number;
  box: Box;
}

export const DEFAULT_MAP: MapQuery = { v: 'PRECTOTCORR', lat: -33, lon: -70, name: 'Central Chile and western Argentina', size: 10, start: 1981, end: LAST_YEAR, period: 'year' };

/** Box of `size` degrees centred on a point, snapped to the 0.5 degree grid and kept on the globe. */
export function boxAround(lat: number, lon: number, size: number): Box {
  const s = Math.min(10, Math.max(2, size));
  const h = s / 2;
  const snap = (x: number) => Math.round(x * 2) / 2;
  let latMin = snap(lat - h);
  latMin = Math.max(-90, Math.min(90 - s, latMin));
  let lonMin = snap(lon - h);
  lonMin = Math.max(-180, Math.min(180 - s, lonMin));
  return { latMin, latMax: latMin + s, lonMin, lonMax: lonMin + s };
}

export function cellTrends(cells: GridCell[], v: Variable, start: number, end: number, period: PeriodKey): CellResult[] {
  const out: CellResult[] = [];
  for (const c of cells) {
    const s = inYears(c.series, Math.max(start, v.firstYear), end);
    const y = yearlySeries(s, periodMonths(period), v.agg);
    if (y.y.length < 8 || y.y.every((x) => x === y.y[0])) continue;
    const mk = mannKendall(y.y);
    const sen = theilSen(y.t, y.y);
    out.push({ lat: c.lat, lon: c.lon, slope: sen.slope * 10, p: mk.pCorr, n: y.y.length });
  }
  return out;
}

let land50: number[][][] | null = null;
async function loadLand(): Promise<number[][][]> {
  if (land50) return land50;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/land50.json`);
    land50 = (await r.json()) as number[][][];
  } catch {
    land50 = [];
  }
  return land50;
}

const NS = 'http://www.w3.org/2000/svg';
const fmtDeg = (v: number, pos: string, neg: string) => `${Math.abs(v)}°${v > 0 ? pos : v < 0 ? neg : ''}`;

export interface TrendMapApi {
  run(q: MapQuery, opts?: { snapshotOnly?: boolean; scroll?: boolean }): Promise<MapResult | null>;
  setCentre(lat: number, lon: number, name: string): void;
}

export function initTrendMap(host: HTMLElement, onCellPick: (lat: number, lon: number) => void): TrendMapApi {
  host.innerHTML = `
  <h2 id="tm-h">Trend map: where is it changing?</h2>
  <p class="lede-sm">Most trends are not global. Choose a box up to 10 by 10 degrees (the NASA POWER limit) and see the trend in every grid cell: opposite colours inside one box are opposite trends.</p>
  <form id="tm-form" class="tm-form" novalidate>
    <label>Centre <select id="tm-preset">${presetOptions()}</select></label>
    <div class="row"><label>Lat <input id="tm-lat" type="number" step="0.01" inputmode="decimal" /></label><label>Lon <input id="tm-lon" type="number" step="0.01" inputmode="decimal" /></label></div>
    <label>Box size <select id="tm-size"><option value="4">4 × 4 degrees</option><option value="6">6 × 6 degrees</option><option value="8">8 × 8 degrees</option><option value="10" selected>10 × 10 degrees</option></select></label>
    <label>Variable <select id="tm-var">${variableOptions()}</select></label>
    <div class="row"><label>From <select id="tm-s"></select></label><label>To <select id="tm-e"></select></label></div>
    <label>Part of the year <select id="tm-p">${periodOptions()}</select></label>
    <div class="actions"><button class="btn primary" type="submit">Draw trend map</button></div>
  </form>
  <div id="tm-status" class="status" role="status" aria-live="polite"></div>
  <div id="tm-out" tabindex="-1"></div>`;
  const $ = <T extends HTMLElement>(id: string) => host.querySelector(`#${id}`) as T;
  let q: MapQuery = { ...DEFAULT_MAP };
  const sync = () => {
    const v = variable(q.v);
    $<HTMLSelectElement>('tm-var').value = q.v;
    $('tm-s').innerHTML = yearOptions(v, Math.max(q.start, v.firstYear));
    $('tm-e').innerHTML = yearOptions(v, q.end);
    $<HTMLSelectElement>('tm-p').value = q.period;
    $<HTMLSelectElement>('tm-size').value = String(q.size);
    $<HTMLInputElement>('tm-lat').value = String(q.lat);
    $<HTMLInputElement>('tm-lon').value = String(q.lon);
    const pr = PLACES.find((p) => p.name === q.name);
    $<HTMLSelectElement>('tm-preset').value = pr ? pr.id : '';
  };
  $('tm-preset').addEventListener('change', () => {
    const p = PLACES.find((x) => x.id === $<HTMLSelectElement>('tm-preset').value);
    if (p) {
      q = { ...q, lat: p.lat, lon: p.lon, name: p.name };
      sync();
    }
  });
  $('tm-var').addEventListener('change', () => {
    const v = variable($<HTMLSelectElement>('tm-var').value);
    q = { ...q, v: v.id, start: startFor(v, Number($<HTMLSelectElement>('tm-s').value)) };
    sync();
  });
  $('tm-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const la = Number($<HTMLInputElement>('tm-lat').value);
    const lo = Number($<HTMLInputElement>('tm-lon').value);
    let s = Number($<HTMLSelectElement>('tm-s').value);
    let e = Number($<HTMLSelectElement>('tm-e').value);
    if (e < s) [s, e] = [e, s];
    const moved = la !== q.lat || lo !== q.lon;
    q = {
      ...q,
      v: $<HTMLSelectElement>('tm-var').value,
      lat: Number.isFinite(la) ? Math.max(-89.5, Math.min(89.5, la)) : q.lat,
      lon: Number.isFinite(lo) ? Math.max(-180, Math.min(180, lo)) : q.lon,
      name: moved ? '' : q.name,
      size: Number($<HTMLSelectElement>('tm-size').value),
      start: s,
      end: e,
      period: $<HTMLSelectElement>('tm-p').value as PeriodKey,
    };
    void run(q, { scroll: true });
  });

  let runId = 0;
  async function run(query: MapQuery, opts: { snapshotOnly?: boolean; scroll?: boolean } = {}): Promise<MapResult | null> {
    q = { ...query };
    sync();
    const my = ++runId;
    const v = variable(q.v);
    const box = boxAround(q.lat, q.lon, q.size);
    const st = $('tm-status');
    const out = $('tm-out');
    st.innerHTML = `<p class="loading"><span class="spinner" aria-hidden="true"></span>Asking NASA POWER for every grid cell in the box (this can take 10 to 40 seconds)...</p>`;
    let res;
    try {
      [res] = await Promise.all([fetchRegion(v.id, box, opts), loadLand()]);
    } catch (e) {
      if (my !== runId) return null;
      st.innerHTML = `<p class="error"><strong>No data.</strong> ${escapeHtml(e instanceof PowerError ? e.message : String(e))}</p>`;
      return null;
    }
    if (my !== runId) return null;
    st.innerHTML = `<p class="ok">${res.source === 'snapshot' ? 'Shown from a saved copy (snapshot) of the NASA POWER request.' : 'Data from NASA POWER.'} <a href="${escapeHtml(res.url)}" target="_blank" rel="noopener">See the raw request</a>.</p>`;
    const cells = cellTrends(res.cells, v, q.start, q.end, q.period);
    if (!cells.length) {
      out.innerHTML = `<p class="warn">No grid cell in this box has enough ${escapeHtml(v.name.toLowerCase())} data${v.landOnly ? ' (this variable exists only over land)' : ''}.</p>`;
      return null;
    }
    const result = draw(out, cells, box, v, q);
    if (opts.scroll) out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return result;
  }

  function draw(out: HTMLElement, cells: CellResult[], box: Box, v: Variable, query: MapQuery): MapResult {
    const dp = rateDp(v);
    const sig = cells.filter((c) => c.p < 0.05);
    const sigUp = sig.filter((c) => c.slope > 0).length;
    const sigDown = sig.filter((c) => c.slope < 0).length;
    const abs = cells.map((c) => Math.abs(c.slope)).sort((a, b) => a - b);
    const vmax = abs[Math.floor(abs.length * 0.95)] || abs[abs.length - 1] || 1;
    // 9 classes, symmetric: -4..4. Positive pole is warm (red) when an increase means warming/drying signal per catalogue.
    const cls = (s: number) => Math.max(-4, Math.min(4, Math.round((s / vmax) * 4)));
    const colourVar = (k: number) => `var(--d${v.upIsWarm ? k : -k})`;
    const W = 600;
    const H = Math.round((W * (box.latMax - box.latMin)) / (box.lonMax - box.lonMin));
    const X = (lon: number) => ((lon - box.lonMin) / (box.lonMax - box.lonMin)) * W;
    const Y = (lat: number) => ((box.latMax - lat) / (box.latMax - box.latMin)) * H;
    const lons = [...new Set(cells.map((c) => c.lon))].sort((a, b) => a - b);
    const lats = [...new Set(cells.map((c) => c.lat))].sort((a, b) => a - b);
    const dlon = lons.length > 1 ? lons[1] - lons[0] : 0.625;
    const dlat = lats.length > 1 ? lats[1] - lats[0] : 0.5;
    const hw = (W * dlon) / (box.lonMax - box.lonMin) / 2; // half a cell, cells overhang the box edge
    const hh = (H * dlat) / (box.latMax - box.latMin) / 2;
    const pct = (k: number) => `${Math.round((100 * k) / cells.length)}%`;
    const word = (up: boolean) => (up ? 'increase' : 'decrease');
    const summary =
      `${cells.length} grid cells tested. ${sigUp} (${pct(sigUp)}) show a significant ${word(true)} and ${sigDown} (${pct(sigDown)}) a significant ${word(false)} ` +
      `(Mann-Kendall with Hamed-Rao correction, p < 0.05). ` +
      (sigUp > 0 && sigDown > 0 ? 'Opposite significant trends inside one box: the same variable goes up in one part and down in another.' : sigUp + sigDown === 0 ? 'No cell has a significant trend.' : 'All significant cells point the same way.');
    out.innerHTML = `
      <figure class="chart tm-fig">
        <figcaption><span class="chart-title">${escapeHtml(v.name)}, ${escapeHtml(periodLabel(query.period))}: Theil-Sen trend per decade, ${Math.max(query.start, v.firstYear)} to ${query.end}</span>
        <span class="chart-summary" id="tm-summary">${escapeHtml(summary)}</span></figcaption>
        <div class="tm-legend" aria-hidden="true">
          ${[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => `<span class="sw" style="background:${colourVar(k)}"></span>`).join('')}
          <span class="tm-ends"><span>${fmtNum(-vmax, dp, true)}</span><span>0</span><span>${fmtNum(vmax, dp, true)} ${escapeHtml(v.units)} per decade</span></span>
          <span class="tm-sigkey"><span class="sigdot"></span> Dot = significant trend (p &lt; 0.05); colour = size of the slope.</span>
        </div>
        <div class="tm-wrap"><svg viewBox="${-46 - hw} ${-10 - hh} ${W + 58 + 2 * hw} ${H + 38 + 2 * hh}" class="tm-svg" role="img" aria-labelledby="tm-h tm-summary"></svg><div class="tooltip" hidden></div></div>
        <p class="small">Grid points from ${fmtDeg(box.latMin, 'N', 'S')} to ${fmtDeg(box.latMax, 'N', 'S')} and ${fmtDeg(box.lonMin, 'E', 'W')} to ${fmtDeg(box.lonMax, 'E', 'W')}${query.name ? `, around ${escapeHtml(placeText(query))}` : ''}. Each square is one NASA POWER grid cell (${dlat}° × ${dlon}°). Tap a cell to investigate it in detail. With hundreds of cells, about 5% can look significant by chance alone, and neighbouring cells are not independent: look for large coherent patches, not single cells.</p>
        <details class="table-alt"><summary>Show all cells as a table</summary><table tabindex="0"><caption>Trend per grid cell</caption><thead><tr><th scope="col">Latitude</th><th scope="col">Longitude</th><th scope="col">Theil-Sen per decade</th><th scope="col">p (Hamed-Rao)</th></tr></thead><tbody>
        ${cells.map((c) => `<tr><td>${c.lat}</td><td>${c.lon}</td><td>${fmtNum(c.slope, dp, true)}</td><td>${fmtP(c.p)}</td></tr>`).join('')}</tbody></table></details>
      </figure>`;
    const svg = out.querySelector('svg')!;
    const tip = out.querySelector('.tooltip') as HTMLDivElement;
    const gCells = document.createElementNS(NS, 'g');
    svg.appendChild(gCells);
    for (const c of cells) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(X(c.lon - dlon / 2)));
      r.setAttribute('y', String(Y(c.lat + dlat / 2)));
      r.setAttribute('width', String((W * dlon) / (box.lonMax - box.lonMin) + 0.5));
      r.setAttribute('height', String((H * dlat) / (box.latMax - box.latMin) + 0.5));
      r.setAttribute('fill', colourVar(cls(c.slope)));
      r.setAttribute('class', 'cell');
      r.dataset.i = String(cells.indexOf(c));
      gCells.appendChild(r);
    }
    // coastline
    const land = land50 ?? [];
    const inBox = land.filter((ring) => ring.some(([x, y]) => x >= box.lonMin - 1 && x <= box.lonMax + 1 && y >= box.latMin - 1 && y <= box.latMax + 1));
    const clipId = `tmclip${Math.random().toString(36).slice(2, 8)}`;
    svg.insertAdjacentHTML('beforeend', `<clipPath id="${clipId}"><rect x="${-hw}" y="${-hh}" width="${W + 2 * hw}" height="${H + 2 * hh}"></rect></clipPath>`);
    const coast = document.createElementNS(NS, 'path');
    coast.setAttribute('d', inBox.map((r) => r.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('') + 'Z').join(''));
    coast.setAttribute('class', 'coast');
    coast.setAttribute('clip-path', `url(#${clipId})`);
    svg.appendChild(coast);
    const gDots = document.createElementNS(NS, 'g');
    gDots.setAttribute('class', 'sigdots');
    for (const c of sig) {
      const d = document.createElementNS(NS, 'circle');
      d.setAttribute('cx', String(X(c.lon)));
      d.setAttribute('cy', String(Y(c.lat)));
      d.setAttribute('r', String(Math.max(1.6, Math.min(3.2, (W * dlon) / (box.lonMax - box.lonMin) / 6))));
      gDots.appendChild(d);
    }
    svg.appendChild(gDots);
    const centre = document.createElementNS(NS, 'g');
    centre.setAttribute('class', 'tm-centre');
    centre.setAttribute('transform', `translate(${X(query.lon)},${Y(query.lat)})`);
    centre.innerHTML = '<circle r="7"></circle>';
    const ct = document.createElementNS(NS, 'text');
    const right = X(query.lon) < W - 160;
    ct.setAttribute('x', right ? '11' : '-11');
    ct.setAttribute('y', '-9');
    ct.setAttribute('text-anchor', right ? 'start' : 'end');
    ct.textContent = query.name ? query.name.split(',')[0] : placeText(query);
    centre.appendChild(ct);
    svg.appendChild(centre);
    // latitude / longitude ticks on the edges
    const span = box.lonMax - box.lonMin;
    const step = span > 6 ? 2 : 1;
    const ticks = document.createElementNS(NS, 'g');
    ticks.setAttribute('class', 'tm-ticks');
    const fmtLat = (v: number) => `${Math.abs(v)}°${v > 0 ? 'N' : v < 0 ? 'S' : ''}`;
    const fmtLon = (v: number) => `${Math.abs(v)}°${v > 0 ? 'E' : v < 0 ? 'W' : ''}`;
    let tk = '';
    for (let v = Math.ceil(box.latMin / step) * step; v <= box.latMax; v += step)
      tk += `<line x1="${-hw - 5}" x2="${-hw}" y1="${Y(v)}" y2="${Y(v)}"></line><text x="${-hw - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtLat(v)}</text>`;
    for (let v = Math.ceil(box.lonMin / step) * step; v <= box.lonMax; v += step)
      tk += `<line x1="${X(v)}" x2="${X(v)}" y1="${H + hh}" y2="${H + hh + 5}"></line><text x="${X(v)}" y="${H + hh + 19}" text-anchor="middle">${fmtLon(v)}</text>`;
    ticks.innerHTML = tk;
    svg.appendChild(ticks);
    const cellAt = (ev: PointerEvent | MouseEvent) => {
      const t = ev.target as SVGElement;
      return t.classList.contains('cell') ? cells[Number(t.dataset.i)] : null;
    };
    svg.addEventListener('pointermove', (ev) => {
      const c = cellAt(ev);
      if (!c) {
        tip.hidden = true;
        return;
      }
      const rect = svg.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = `<strong>${placeText(c)}</strong><br>${fmtNum(c.slope, dp, true)} ${escapeHtml(v.units)} per decade<br>${fmtP(c.p)}${c.p < 0.05 ? ' (significant)' : ''}`;
      tip.style.left = `${Math.min(ev.clientX - rect.left + 12, rect.width - 170)}px`;
      tip.style.top = `${Math.max(0, ev.clientY - rect.top - 60)}px`;
    });
    svg.addEventListener('pointerleave', () => (tip.hidden = true));
    svg.addEventListener('click', (ev) => {
      const c = cellAt(ev);
      if (c) onCellPick(c.lat, c.lon);
    });
    return { cells, sigUp, sigDown, tested: cells.length, box };
  }

  sync();
  return {
    run,
    setCentre(lat, lon, name) {
      q = { ...q, lat, lon, name };
      sync();
    },
  };
}
