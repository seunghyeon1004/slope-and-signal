/*
 * Slope and Signal - clickable world map (equirectangular SVG).
 * Land outlines: Natural Earth 1:110m (public domain).
 * Written with Claude (Anthropic) under the team's direction.
 */
import land from '../data/land110.json';

const NS = 'http://www.w3.org/2000/svg';
const W = 720;
const H = 360;

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
  const Y = (lat: number) => ((90 - lat) / 180) * H;
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

  let cursor = { lat: 20, lon: 0 };
  const pick = (lat: number, lon: number) => {
    cursor = { lat, lon };
    onPick(lat, lon);
  };
  svg.addEventListener('click', (ev) => {
    const r = svg.getBoundingClientRect();
    const lon = ((ev.clientX - r.left) / r.width) * 360 - 180;
    const lat = 90 - ((ev.clientY - r.top) / r.height) * 180;
    pick(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
  });
  svg.addEventListener('keydown', (ev) => {
    const d = ev.shiftKey ? 10 : 1;
    let { lat, lon } = cursor;
    if (ev.key === 'ArrowUp') lat = Math.min(89, lat + d);
    else if (ev.key === 'ArrowDown') lat = Math.max(-89, lat - d);
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
        g.innerHTML = `<circle r="7" class="ring"></circle><circle r="3.5" class="core"></circle>`;
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', '10');
        t.setAttribute('y', '4');
        t.textContent = mk.label;
        g.appendChild(t);
        marks.appendChild(g);
        if (mk.kind === 'a') cursor = { lat: mk.lat, lon: mk.lon };
      }
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
