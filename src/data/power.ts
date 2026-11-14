/*
 * Slope and Signal - NASA POWER API client (browser, no key needed).
 * Written with Claude (Anthropic) under the team's direction.
 *
 * Be polite: one request fetches every catalogue variable for a place for the
 * whole record, responses are cached in memory and (points only) in
 * localStorage, and identical in-flight requests are shared.
 */
import { ALL_IDS, LAST_YEAR, POWER_FIRST_YEAR } from './catalogue';
import { parsePowerSeries, type MonthValue } from './series';

const BASE = 'https://power.larc.nasa.gov/api/temporal/monthly';
const LS_PREFIX = 'sas:pt:';
const LS_MAX = 12;

export interface PointData {
  lat: number;
  lon: number;
  elevation: number | null;
  series: Record<string, MonthValue[]>;
  source: 'live' | 'cache' | 'snapshot';
  url: string;
  fetchedAt: string;
}

export class PowerError extends Error {}

const mem = new Map<string, PointData>();
const inflight = new Map<string, Promise<PointData>>();

export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

export function pointUrl(lat: number, lon: number, params = ALL_IDS, start = POWER_FIRST_YEAR, end = LAST_YEAR): string {
  const q = new URLSearchParams({
    parameters: params.join(','),
    community: 'AG',
    longitude: String(roundCoord(lon)),
    latitude: String(roundCoord(lat)),
    start: String(start),
    end: String(end),
    format: 'JSON',
  });
  return `${BASE}/point?${q}`;
}

export function regionalUrl(param: string, box: Box, start = POWER_FIRST_YEAR, end = LAST_YEAR): string {
  const q = new URLSearchParams({
    parameters: param,
    community: 'AG',
    'latitude-min': String(box.latMin),
    'latitude-max': String(box.latMax),
    'longitude-min': String(box.lonMin),
    'longitude-max': String(box.lonMax),
    start: String(start),
    end: String(end),
    format: 'JSON',
  });
  return `${BASE}/regional?${q}`;
}

/** Convert a POWER point response (GeoJSON Feature) into PointData. */
export function fromPointJson(j: any, source: PointData['source'], url: string): PointData {
  const params = j?.properties?.parameter;
  if (!params) {
    const msg = Array.isArray(j?.messages) && j.messages.length ? j.messages.join(' ') : 'Unexpected response from NASA POWER.';
    throw new PowerError(msg);
  }
  const series: Record<string, MonthValue[]> = {};
  for (const [k, v] of Object.entries(params)) series[k] = parsePowerSeries(v as Record<string, number>);
  const c = j.geometry?.coordinates ?? [];
  return { lon: c[0], lat: c[1], elevation: c[2] ?? null, series, source, url, fetchedAt: new Date().toISOString() };
}

function lsGet(key: string): any | null {
  try {
    const s = localStorage.getItem(LS_PREFIX + key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function lsPut(key: string, json: any): void {
  try {
    const idxKey = LS_PREFIX + 'index';
    const idx: string[] = JSON.parse(localStorage.getItem(idxKey) || '[]').filter((k: string) => k !== key);
    idx.push(key);
    while (idx.length > LS_MAX) {
      const old = idx.shift()!;
      localStorage.removeItem(LS_PREFIX + old);
    }
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(json));
    localStorage.setItem(idxKey, JSON.stringify(idx));
  } catch {
    /* storage full or blocked: memory cache still works */
  }
}

async function getJson(url: string, timeoutMs: number): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      throw new PowerError(`NASA POWER answered with HTTP ${r.status} and no data.`);
    }
    if (!r.ok) {
      const msg = Array.isArray(j?.messages) ? j.messages.join(' ') : j?.header || `HTTP ${r.status}`;
      throw new PowerError(`NASA POWER could not answer: ${msg}`);
    }
    return j;
  } catch (e) {
    if (e instanceof PowerError) throw e;
    if ((e as Error).name === 'AbortError') throw new PowerError('NASA POWER took too long to answer (timeout).');
    throw new PowerError('Could not reach NASA POWER (network problem or the service is down).');
  } finally {
    clearTimeout(timer);
  }
}

/** Snapshot files bundled for demo cases: public/data/snap/<lat>_<lon>.json */
export function snapshotName(lat: number, lon: number): string {
  return `${roundCoord(lat).toFixed(2)}_${roundCoord(lon).toFixed(2)}.json`;
}

async function trySnapshot(lat: number, lon: number): Promise<PointData | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/snap/${snapshotName(lat, lon)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return fromPointJson(j, 'snapshot', pointUrl(lat, lon));
  } catch {
    return null;
  }
}

export interface FetchOpts {
  /** force the bundled snapshot (offline demo) */
  snapshotOnly?: boolean;
  timeoutMs?: number;
}

export async function fetchPoint(lat: number, lon: number, opts: FetchOpts = {}): Promise<PointData> {
  const la = roundCoord(lat);
  const lo = roundCoord(lon);
  const key = `${la},${lo}`;
  if (opts.snapshotOnly) {
    const s = await trySnapshot(la, lo);
    if (s) return s;
    throw new PowerError('No bundled snapshot for this place.');
  }
  const m = mem.get(key);
  if (m) return { ...m, source: m.source === 'live' ? 'cache' : m.source };
  const cached = lsGet(key);
  if (cached) {
    const d = fromPointJson(cached, 'cache', pointUrl(la, lo));
    mem.set(key, d);
    return d;
  }
  const running = inflight.get(key);
  if (running) return running;
  const url = pointUrl(la, lo);
  const p = (async () => {
    try {
      const j = await getJson(url, opts.timeoutMs ?? 45000);
      const d = fromPointJson(j, 'live', url);
      mem.set(key, d);
      lsPut(key, j);
      return d;
    } catch (e) {
      const s = await trySnapshot(la, lo);
      if (s) {
        mem.set(key, s);
        return s;
      }
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export interface Box {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface GridCell {
  lat: number;
  lon: number;
  series: MonthValue[];
}

const regMem = new Map<string, GridCell[]>();

export function fromRegionalJson(j: any, param: string): GridCell[] {
  const feats = j?.features;
  if (!Array.isArray(feats)) {
    const msg = Array.isArray(j?.messages) && j.messages.length ? j.messages.join(' ') : 'Unexpected response from NASA POWER.';
    throw new PowerError(msg);
  }
  return feats.map((f: any) => ({
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    series: parsePowerSeries(f.properties.parameter[param]),
  }));
}

/** Gridded data for a box (max 10 x 10 degrees, one variable). */
export async function fetchRegion(param: string, box: Box, opts: FetchOpts = {}): Promise<{ cells: GridCell[]; source: PointData['source']; url: string }> {
  const url = regionalUrl(param, box);
  const key = url;
  const snapName = `region_${param}_${box.latMin}_${box.latMax}_${box.lonMin}_${box.lonMax}.json`;
  const snap = async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}data/snap/${snapName}`);
      if (!r.ok) return null;
      return fromRegionalJson(await r.json(), param);
    } catch {
      return null;
    }
  };
  if (opts.snapshotOnly) {
    const s = await snap();
    if (s) return { cells: s, source: 'snapshot', url };
    throw new PowerError('No bundled snapshot for this box.');
  }
  const m = regMem.get(key);
  if (m) return { cells: m, source: 'cache', url };
  try {
    const j = await getJson(url, opts.timeoutMs ?? 90000);
    const cells = fromRegionalJson(j, param);
    regMem.set(key, cells);
    return { cells, source: 'live', url };
  } catch (e) {
    const s = await snap();
    if (s) return { cells: s, source: 'snapshot', url };
    throw e;
  }
}
