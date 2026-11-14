/*
 * Slope and Signal - turning NASA POWER monthly values into analysis series.
 * Code written with Claude (Anthropic) under the team's direction.
 */

export type Agg = 'mean' | 'sum' | 'max' | 'min';

export interface MonthValue {
  year: number;
  month: number; // 1..12
  value: number;
}

export type PeriodKey = 'year' | 'DJF' | 'MAM' | 'JJA' | 'SON' | `m${number}`;

export const SEASONS: Record<string, { label: string; months: number[] }> = {
  DJF: { label: 'December to February', months: [12, 1, 2] },
  MAM: { label: 'March to May', months: [3, 4, 5] },
  JJA: { label: 'June to August', months: [6, 7, 8] },
  SON: { label: 'September to November', months: [9, 10, 11] },
};

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const FILL = -999;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parse one parameter of a POWER monthly response: { "YYYYMM": value } with MM=13 annual. */
export function parsePowerSeries(obj: Record<string, number>): MonthValue[] {
  const out: MonthValue[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const year = Number(k.slice(0, 4));
    const month = Number(k.slice(4));
    if (month >= 1 && month <= 12 && v !== FILL && Number.isFinite(v)) out.push({ year, month, value: v });
  }
  out.sort((a, b) => a.year - b.year || a.month - b.month);
  return out;
}

export function inYears(s: MonthValue[], start: number, end: number): MonthValue[] {
  return s.filter((m) => m.year >= start && m.year <= end);
}

/** Mean value of each calendar month (index 0 = January). NaN when absent. */
export function climatology(s: MonthValue[]): number[] {
  const sum = new Array(12).fill(0);
  const cnt = new Array(12).fill(0);
  for (const m of s) {
    sum[m.month - 1] += m.value;
    cnt[m.month - 1]++;
  }
  return sum.map((v, i) => (cnt[i] ? v / cnt[i] : NaN));
}

export function decimalTime(year: number, month: number): number {
  return year + (month - 0.5) / 12;
}

/** Monthly anomalies: value minus the mean of its calendar month. */
export function anomalies(s: MonthValue[], clim = climatology(s)): { t: number[]; y: number[] } {
  return { t: s.map((m) => decimalTime(m.year, m.month)), y: s.map((m) => m.value - clim[m.month - 1]) };
}

function aggregate(vals: { value: number; days: number }[], agg: Agg): number {
  switch (agg) {
    case 'sum':
      return vals.reduce((a, b) => a + b.value, 0);
    case 'max':
      return Math.max(...vals.map((v) => v.value));
    case 'min':
      return Math.min(...vals.map((v) => v.value));
    default: {
      const d = vals.reduce((a, b) => a + b.days, 0);
      return vals.reduce((a, b) => a + b.value * b.days, 0) / d;
    }
  }
}

/**
 * One value per year for the given months (complete years only). For
 * December-February the December of the previous year is used, so "DJF 2020"
 * means Dec 2019 + Jan 2020 + Feb 2020.
 */
export function yearlySeries(s: MonthValue[], months: number[], agg: Agg): { t: number[]; y: number[] } {
  const byKey = new Map<string, number>();
  for (const m of s) byKey.set(`${m.year}-${m.month}`, m.value);
  const years = [...new Set(s.map((m) => m.year))].sort((a, b) => a - b);
  const t: number[] = [];
  const y: number[] = [];
  const wrap = months[0] === 12 && months.length > 1; // DJF-style season crossing new year
  for (const yr of years) {
    const vals: { value: number; days: number }[] = [];
    let ok = true;
    for (const mo of months) {
      const yy = wrap && mo === 12 ? yr - 1 : yr;
      const v = byKey.get(`${yy}-${mo}`);
      if (v === undefined) {
        ok = false;
        break;
      }
      vals.push({ value: v, days: daysInMonth(yy, mo) });
    }
    if (ok) {
      t.push(yr);
      y.push(aggregate(vals, agg));
    }
  }
  return { t, y };
}

export function periodMonths(p: PeriodKey): number[] {
  if (p === 'year') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (p in SEASONS) return SEASONS[p].months;
  return [Number(p.slice(1))];
}

export function periodLabel(p: PeriodKey): string {
  if (p === 'year') return 'the whole year';
  if (p in SEASONS) return `${p} (${SEASONS[p].label})`;
  return MONTH_NAMES[Number(p.slice(1)) - 1];
}

export interface AnalysisSeries {
  /** What the trend test runs on. */
  t: number[];
  y: number[];
  stepsPerYear: number;
  kind: 'monthly-anomaly' | 'yearly';
  /** Yearly values for display (always present). */
  yearly: { t: number[]; y: number[] };
  clim: number[];
}

/**
 * Whole year: the test runs on deseasonalised monthly anomalies (seasonal cycle
 * removed). Season or single month: the test runs on one value per year.
 */
export function buildAnalysis(s: MonthValue[], period: PeriodKey, agg: Agg): AnalysisSeries {
  const clim = climatology(s);
  const yearly = yearlySeries(s, periodMonths(period), agg);
  if (period === 'year') {
    const a = anomalies(s, clim);
    return { ...a, stepsPerYear: 12, kind: 'monthly-anomaly', yearly, clim };
  }
  return { t: yearly.t, y: yearly.y, stepsPerYear: 1, kind: 'yearly', yearly, clim };
}
