/*
 * Slope and Signal - small SVG time-series chart with hover, keyboard and a
 * text/table alternative. No chart library.
 * Written with Claude (Anthropic) under the team's direction.
 */

export interface Series {
  name: string;
  t: number[];
  y: number[];
  /** CSS colour (use a var()) */
  color: string;
  style: 'line' | 'dots' | 'thin';
}

export interface TrendLine {
  name: string;
  slope: number;
  intercept: number;
  color: string;
  dash?: boolean;
}

export interface ChartSpec {
  title: string;
  summary: string;
  yLabel: string;
  series: Series[];
  trends?: TrendLine[];
  dp: number;
  zeroLine?: boolean;
  timeFmt?: (t: number) => string;
}

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) {
    const d = Math.abs(lo) * 0.1 || 1;
    lo -= d;
    hi += d;
  }
  const span = hi - lo;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export function monthFmt(t: number): string {
  const y = Math.floor(t);
  const m = Math.min(11, Math.max(0, Math.floor((t - y) * 12)));
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]} ${y}`;
}

let uid = 0;

export function renderChart(host: HTMLElement, spec: ChartSpec): void {
  host.innerHTML = '';
  const id = `c${++uid}`;
  const fig = document.createElement('figure');
  fig.className = 'chart';
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<span class="chart-title" id="${id}-t"></span><span class="chart-summary" id="${id}-s"></span>`;
  cap.querySelector('.chart-title')!.textContent = spec.title;
  cap.querySelector('.chart-summary')!.textContent = spec.summary;
  fig.appendChild(cap);

  // legend for >= 2 entries
  const entries = [
    ...spec.series.map((s) => ({ name: s.name, color: s.color, kind: s.style })),
    ...(spec.trends ?? []).map((t) => ({ name: t.name, color: t.color, kind: t.dash ? 'dash' : 'trend' })),
  ];
  if (entries.length >= 2) {
    const lg = document.createElement('ul');
    lg.className = 'legend';
    for (const e of entries) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="key key-${e.kind}" style="--k:${e.color}"></span>`;
      li.append(document.createTextNode(e.name));
      lg.appendChild(li);
    }
    fig.appendChild(lg);
  }

  const W = 760;
  const H = 300;
  const m = { l: 56, r: 16, t: 12, b: 32 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-labelledby': `${id}-t ${id}-s`, class: 'chart-svg', tabindex: 0 });
  fig.appendChild(svg);

  const allT = spec.series.flatMap((s) => s.t);
  const allY = spec.series.flatMap((s) => s.y);
  const t0 = Math.min(...allT);
  const t1 = Math.max(...allT);
  let y0 = Math.min(...allY);
  let y1 = Math.max(...allY);
  if (spec.zeroLine) {
    y0 = Math.min(y0, 0);
    y1 = Math.max(y1, 0);
  }
  const pad = (y1 - y0) * 0.06 || 1;
  const yt = niceTicks(y0 - pad, y1 + pad, 5);
  const yl = Math.min(yt[0], y0);
  const yh = Math.max(yt[yt.length - 1], y1);
  const tpad = (t1 - t0) * 0.01 || 0.5;
  const X = (t: number) => m.l + ((t - (t0 - tpad)) / (t1 - t0 + 2 * tpad)) * (W - m.l - m.r);
  const Y = (v: number) => m.t + (1 - (v - yl) / (yh - yl)) * (H - m.t - m.b);

  const grid = el('g', { class: 'grid' }, svg);
  for (const v of yt) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid);
    const tx = el('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, grid);
    tx.textContent = v.toFixed(Math.max(0, Math.min(3, -Math.floor(Math.log10((yt[1] - yt[0]) || 1)))));
  }
  const xt = niceTicks(t0, t1, 8).filter((v) => Number.isInteger(v));
  for (const v of xt) {
    const tx = el('text', { x: X(v), y: H - 10, 'text-anchor': 'middle', class: 'tick' }, grid);
    tx.textContent = String(v);
    el('line', { x1: X(v), x2: X(v), y1: H - m.b, y2: H - m.b + 4, class: 'axis' }, grid);
  }
  el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }, grid);
  if (spec.zeroLine && yl < 0 && yh > 0) el('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: 'zero' }, grid);
  const ylab = el('text', { x: 12, y: m.t + (H - m.t - m.b) / 2, transform: `rotate(-90 12 ${m.t + (H - m.t - m.b) / 2})`, 'text-anchor': 'middle', class: 'ylab' }, svg);
  ylab.textContent = spec.yLabel;

  for (const s of spec.series) {
    if (s.style === 'dots') {
      const g = el('g', { fill: s.color }, svg);
      s.t.forEach((t, i) => el('circle', { cx: X(t), cy: Y(s.y[i]), r: 3.5, class: 'dot' }, g));
      const d = s.t.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(s.y[i]).toFixed(1)}`).join('');
      el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 1, 'stroke-opacity': 0.5 }, svg);
    } else {
      const d = s.t.map((t, i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(s.y[i]).toFixed(1)}`).join('');
      el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.style === 'thin' ? 1 : 2, 'stroke-linejoin': 'round' }, svg);
    }
  }
  for (const tr of spec.trends ?? []) {
    el('line', {
      x1: X(t0), x2: X(t1), y1: Y(tr.intercept + tr.slope * t0), y2: Y(tr.intercept + tr.slope * t1),
      stroke: tr.color, 'stroke-width': 2.5, 'stroke-dasharray': tr.dash ? '6 4' : 'none', class: 'trend',
    }, svg);
  }

  // hover layer
  const hover = el('g', { class: 'hover', visibility: 'hidden' }, svg);
  const vline = el('line', { y1: m.t, y2: H - m.b, class: 'crosshair' }, hover);
  const dots = spec.series.map((s) => el('circle', { r: 5, fill: s.color, class: 'hover-dot' }, hover));
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  fig.appendChild(tip);
  const base = spec.series[0];
  const fmtT = spec.timeFmt ?? ((t: number) => String(Math.round(t)));
  let cur = -1;
  const show = (i: number) => {
    if (i < 0 || i >= base.t.length) return;
    cur = i;
    const t = base.t[i];
    vline.setAttribute('x1', String(X(t)));
    vline.setAttribute('x2', String(X(t)));
    const lines: string[] = [`<strong>${fmtT(t)}</strong>`];
    spec.series.forEach((s, k) => {
      let j = s.t.indexOf(t);
      if (j < 0) j = nearest(s.t, t);
      const ok = j >= 0 && Math.abs(s.t[j] - t) < 0.75;
      dots[k].setAttribute('visibility', ok ? 'visible' : 'hidden');
      if (ok) {
        dots[k].setAttribute('cx', String(X(s.t[j])));
        dots[k].setAttribute('cy', String(Y(s.y[j])));
        lines.push(`<span class="key key-line" style="--k:${s.color}"></span>${escapeHtml(s.name)}: ${s.y[j].toFixed(spec.dp)}`);
      }
    });
    for (const tr of spec.trends ?? []) lines.push(`<span class="key key-trend" style="--k:${tr.color}"></span>${escapeHtml(tr.name)}: ${(tr.intercept + tr.slope * t).toFixed(spec.dp)}`);
    tip.innerHTML = lines.join('<br>');
    hover.setAttribute('visibility', 'visible');
    tip.hidden = false;
    const rect = svg.getBoundingClientRect();
    const px = (X(t) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(px + 12, 0), rect.width - 180)}px`;
    tip.style.top = `${36}px`;
  };
  const hide = () => {
    hover.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  svg.addEventListener('pointermove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    const t = t0 - tpad + ((x - m.l) / (W - m.l - m.r)) * (t1 - t0 + 2 * tpad);
    show(nearest(base.t, t));
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 12 : 1;
    if (ev.key === 'ArrowRight') show(Math.min(base.t.length - 1, (cur < 0 ? -1 : cur) + step));
    else if (ev.key === 'ArrowLeft') show(Math.max(0, (cur < 0 ? base.t.length : cur) - step));
    else if (ev.key === 'Escape') hide();
    else return;
    ev.preventDefault();
  });

  // table alternative
  const det = document.createElement('details');
  det.className = 'table-alt';
  det.innerHTML = `<summary>Show the data as a table</summary>`;
  const tbl = document.createElement('table');
  tbl.tabIndex = 0;
  const head = `<tr><th scope="col">Time</th>${spec.series.map((s) => `<th scope="col">${escapeHtml(s.name)}</th>`).join('')}</tr>`;
  const times = [...new Set(spec.series.flatMap((s) => s.t))].sort((a, b) => a - b);
  const rows = times
    .map((t) => `<tr><th scope="row">${fmtT(t)}</th>${spec.series.map((s) => {
      const j = s.t.indexOf(t);
      return `<td>${j >= 0 ? s.y[j].toFixed(spec.dp) : ''}</td>`;
    }).join('')}</tr>`)
    .join('');
  tbl.innerHTML = `<caption>${escapeHtml(spec.title)}</caption><thead>${head}</thead><tbody>${rows}</tbody>`;
  det.appendChild(tbl);
  fig.appendChild(det);
  host.appendChild(fig);
}

function nearest(arr: number[], t: number): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - t);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
