/*
 * Slope and Signal - clickable world map (equirectangular SVG).
 * Land outlines: Natural Earth 1:110m (public domain).
 * Written with Claude (Anthropic) under the team's direction.
 */
import land from '../data/land110.json';

const NS = 'http://www.w3.org/2000/svg';
const W = 720;
const LAT_TOP = 85;
const LAT_BOT = -80;
const H = Math.round((W * (LAT_TOP - LAT_BOT)) / 360);

export function ringsToPath(rings: number[][][], X: (lon: number) => number, Y: (lat: number) => number): string {
  return rings.map((r) => r.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('') + 'Z').join('');
}

export interface MapMarker {
  lat: number;
  lon: number;
  label: string;
  kind: 'a' | 'b';
}

export interface WorldMap {
  setMarkers(m: MapMarker[]): void;
  setBox(b: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null): void;
}

export function createWorldMap(host: HTMLElement, onPick: (lat: number, lon: number) => void): WorldMap {
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * H;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'worldmap');
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-label', 'World map. Click to choose a place, or focus and use the arrow keys to move the marker by one degree and Enter to choose.');
  svg.setAttribute('tabindex', '0');
  const ocean = document.createElementNS(NS, 'rect');
  ocean.setAttribute('width', String(W));
  ocean.setAttribute('height', String(H));
  ocean.setAttribute('class', 'ocean');
  svg.appendChild(ocean);
  const grat = document.createElementNS(NS, 'path');
  let gd = '';
  for (let lo = -150; lo <= 150; lo += 30) gd += `M${X(lo)},0V${H}`;
  for (let la = -60; la <= 60; la += 30) gd += `M0,${Y(la)}H${W}`;
  grat.setAttribute('d', gd);
  grat.setAttribute('class', 'graticule');
  svg.appendChild(grat);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ringsToPath(land as number[][][], X, Y));
  path.setAttribute('class', 'land');
  svg.appendChild(path);
  const boxEl = document.createElementNS(NS, 'rect');
  boxEl.setAttribute('class', 'mapbox');
  boxEl.setAttribute('visibility', 'hidden');
  svg.appendChild(boxEl);
  const marks = document.createElementNS(NS, 'g');
  svg.appendChild(marks);
  host.appendChild(svg);
  const tools = document.createElement('p');
  tools.className = 'map-tools';
  tools.innerHTML = '<button type="button" class="link">Zoom map in</button>';
  host.after(tools);
  const zoomBtn = tools.querySelector('button')!;
  const centreOnCursor = () => {
    if (!host.classList.contains('zoomed')) return;
    const w = svg.getBoundingClientRect().width;
    host.scrollLeft = Math.max(0, (X(cursor.lon) / W) * w - host.clientWidth / 2);
  };
  zoomBtn.addEventListener('click', () => {
    const z = host.classList.toggle('zoomed');
    zoomBtn.textContent = z ? 'Zoom map out' : 'Zoom map in';
    zoomBtn.setAttribute('aria-pressed', String(z));
    centreOnCursor();
  });

  let cursor = { lat: 20, lon: 0 };
  const pick = (lat: number, lon: number) => {
    cursor = { lat, lon };
    onPick(lat, lon);
  };
  svg.addEventListener('click', (ev) => {
    const r = svg.getBoundingClientRect();
    const lon = ((ev.clientX - r.left) / r.width) * 360 - 180;
    const lat = LAT_TOP - ((ev.clientY - r.top) / r.height) * (LAT_TOP - LAT_BOT);
    pick(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
  });
  svg.addEventListener('keydown', (ev) => {
    const d = ev.shiftKey ? 10 : 1;
    let { lat, lon } = cursor;
    if (ev.key === 'ArrowUp') lat = Math.min(LAT_TOP, lat + d);
    else if (ev.key === 'ArrowDown') lat = Math.max(LAT_BOT, lat - d);
    else if (ev.key === 'ArrowLeft') lon = lon - d < -180 ? lon - d + 360 : lon - d;
    else if (ev.key === 'ArrowRight') lon = lon + d > 180 ? lon + d - 360 : lon + d;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      pick(cursor.lat, cursor.lon);
      ev.preventDefault();
      return;
    } else return;
    ev.preventDefault();
    pick(lat, lon);
  });

  return {
    setMarkers(ms) {
      marks.innerHTML = '';
      for (const mk of ms) {
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', `marker marker-${mk.kind}`);
        g.setAttribute('transform', `translate(${X(mk.lon)},${Y(mk.lat)})`);
        g.innerHTML = `<line class="cross" x1="${-X(mk.lon)}" x2="${W - X(mk.lon)}" y1="0" y2="0"></line><line class="cross" y1="${-Y(mk.lat)}" y2="${H - Y(mk.lat)}" x1="0" x2="0"></line><circle r="10" class="ring"></circle><circle r="5" class="core"></circle>`;
        const t = document.createElementNS(NS, 'text');
        const right = X(mk.lon) < W - 150;
        t.setAttribute('x', right ? '14' : '-14');
        t.setAttribute('text-anchor', right ? 'start' : 'end');
        t.setAttribute('y', Y(mk.lat) < 20 ? '18' : '-10');
        t.textContent = mk.label;
        g.appendChild(t);
        marks.appendChild(g);
        if (mk.kind === 'a') cursor = { lat: mk.lat, lon: mk.lon };
      }
      centreOnCursor();
    },
    setBox(b) {
      if (!b) {
        boxEl.setAttribute('visibility', 'hidden');
        return;
      }
      boxEl.setAttribute('visibility', 'visible');
      boxEl.setAttribute('x', String(X(b.lonMin)));
      boxEl.setAttribute('y', String(Y(b.latMax)));
      boxEl.setAttribute('width', String(X(b.lonMax) - X(b.lonMin)));
      boxEl.setAttribute('height', String(Y(b.latMin) - Y(b.latMax)));
    },
  };
}
