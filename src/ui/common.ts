/*
 * Slope and Signal - shared UI helpers.
 * Written with Claude (Anthropic) under the team's direction.
 */
import { CATALOGUE, LAST_YEAR, variable, type Variable } from '../data/catalogue';
import { PLACES } from '../data/places';
import { MONTH_NAMES, SEASONS, type PeriodKey } from '../data/series';
import { escapeHtml } from './chart';

export function variableOptions(): string {
  const groups = [...new Set(CATALOGUE.map((c) => c.group))];
  return groups
    .map((g) => `<optgroup label="${g}">${CATALOGUE.filter((c) => c.group === g).map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.units)})</option>`).join('')}</optgroup>`)
    .join('');
}

export function presetOptions(): string {
  const types = [...new Set(PLACES.map((p) => p.type))];
  return (
    `<option value="">Choose a preset place...</option>` +
    types.map((t) => `<optgroup label="${t}">${PLACES.filter((p) => p.type === t).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</optgroup>`).join('')
  );
}

export function periodOptions(): string {
  return (
    `<option value="year">Whole year</option>` +
    Object.entries(SEASONS).map(([k, s]) => `<option value="${k}">Season ${k}: ${s.label}</option>`).join('') +
    MONTH_NAMES.map((m, i) => `<option value="m${i + 1}">Only ${m}</option>`).join('')
  );
}

export function yearOptions(v: Variable, selected: number): string {
  const out: string[] = [];
  for (let y = v.firstYear; y <= LAST_YEAR; y++) out.push(`<option ${y === selected ? 'selected' : ''}>${y}</option>`);
  return out.join('');
}

/** Start year to use when the user switches to variable v. */
export function startFor(v: Variable, current: number): number {
  if (v.defaultStart && current < v.defaultStart) return v.defaultStart;
  return Math.max(current, v.firstYear);
}

export function isPeriod(p: string): p is PeriodKey {
  return p === 'year' || p in SEASONS || /^m([1-9]|1[0-2])$/.test(p);
}

export function placeText(q: { lat: number; lon: number; name?: string }): string {
  const ll = `${Math.abs(q.lat).toFixed(2)}°${q.lat >= 0 ? 'N' : 'S'}, ${Math.abs(q.lon).toFixed(2)}°${q.lon >= 0 ? 'E' : 'W'}`;
  return q.name ? `${q.name} (${ll})` : ll;
}

export function shortName(q: { lat: number; lon: number; name?: string }): string {
  return q.name ? q.name.split(',')[0] : placeText(q);
}

export function spotlight(el: Element | null): void {
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el.classList.remove('spot');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('spot');
}

export { variable };
