/*
 * Slope and Signal - trend statistics.
 * Code written with Claude (Anthropic) under the team's direction. Every
 * function is tested against scipy / pymannkendall values
 * (tools/make_fixtures.py -> tests/fixtures/stats_reference.json).
 *
 * - OLS slope, standard error, t-test, 95% confidence interval.
 * - Lag-1 autocorrelation of the OLS residuals and the effective sample size
 *   n_eff = n (1 - r1) / (1 + r1) (Santer et al. 2000), used for an adjusted
 *   t-test with df = n_eff - 2.
 * - Mann-Kendall test with tie correction (same as pymannkendall.original_test).
 * - Hamed and Rao (1998) variance correction, first 3 lags (as
 *   pymannkendall.hamed_rao_modification_test(lag=3)). App policy: the
 *   variance factor n/n* is floored at 1 so the correction can only make the
 *   test more cautious, never less.
 * - Theil-Sen slope with the Sen (1968) confidence interval (as
 *   scipy.stats.theilslopes), plus the same interval using the corrected
 *   variance.
 */
import { normPpf, normTwoSided, tPpf, tTwoSided } from './dist';

export const HR_LAG = 3;

export interface OlsResult {
  n: number;
  slope: number;
  intercept: number;
  se: number;
  t: number;
  p: number;
  ciLow: number;
  ciHigh: number;
  r2: number;
  residSd: number;
  lag1: number;
  neff: number;
  seAdj: number;
  dfAdj: number;
  tAdj: number;
  pAdj: number;
  ciLowAdj: number;
  ciHighAdj: number;
}

export function mean(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

export function median(sorted: ArrayLike<number>): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = n >> 1;
  return n % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2;
}

function sortedCopy(a: ArrayLike<number>): Float64Array {
  return Float64Array.from(a).sort();
}

/** Lag-1 autocorrelation of a zero-mean residual series. */
export function lag1Resid(e: ArrayLike<number>): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < e.length; i++) {
    den += e[i] * e[i];
    if (i + 1 < e.length) num += e[i] * e[i + 1];
  }
  return den > 0 ? num / den : 0;
}

export function effectiveN(n: number, r1: number): number {
  return r1 > 0 ? Math.min(n, (n * (1 - r1)) / (1 + r1)) : n;
}

export function ols(t: ArrayLike<number>, y: ArrayLike<number>): OlsResult {
  const n = y.length;
  const tm = mean(t);
  const ym = mean(y);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = t[i] - tm;
    const dy = y[i] - ym;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const intercept = ym - slope * tm;
  const resid = new Float64Array(n);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    resid[i] = y[i] - (intercept + slope * t[i]);
    sse += resid[i] * resid[i];
  }
  const df = n - 2;
  const residSd = Math.sqrt(sse / df);
  const se = residSd / Math.sqrt(sxx);
  const tt = slope / se;
  const p = tTwoSided(tt, df);
  const tc = tPpf(0.975, df);
  const r1 = lag1Resid(resid);
  const neff = effectiveN(n, r1);
  let seAdj = NaN;
  let dfAdj = NaN;
  let tAdj = NaN;
  let pAdj = NaN;
  let ciLowAdj = NaN;
  let ciHighAdj = NaN;
  if (neff > 3) {
    dfAdj = neff - 2;
    seAdj = se * Math.sqrt((n - 2) / dfAdj);
    tAdj = slope / seAdj;
    pAdj = tTwoSided(tAdj, dfAdj);
    const tca = tPpf(0.975, dfAdj);
    ciLowAdj = slope - tca * seAdj;
    ciHighAdj = slope + tca * seAdj;
  }
  return {
    n, slope, intercept, se, t: tt, p,
    ciLow: slope - tc * se, ciHigh: slope + tc * se,
    r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 0,
    residSd, lag1: r1, neff, seAdj, dfAdj, tAdj, pAdj, ciLowAdj, ciHighAdj,
  };
}

/** Average ranks (1-based), ties get the mean rank, like scipy.stats.rankdata. */
export function rankData(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
  const r = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]] === x[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

/** Sizes of groups of equal values that occur more than once. */
export function tieGroups(x: ArrayLike<number>): number[] {
  const s = sortedCopy(x);
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[i]) j++;
    if (j > i) out.push(j - i + 1);
    i = j + 1;
  }
  return out;
}

function acf(x: ArrayLike<number>, nlags: number): number[] {
  const n = x.length;
  const m = mean(x);
  const out: number[] = [];
  for (let k = 0; k <= nlags; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += (x[i] - m) * (x[i + k] - m);
    out.push(s / n);
  }
  return out.map((v) => v / out[0]);
}

export interface MkResult {
  n: number;
  s: number;
  varS: number;
  z: number;
  p: number;
  tau: number;
  /** Hamed-Rao n/n* exactly as pymannkendall (may be < 1). */
  nns: number;
  /** Corrected variance with n/n* floored at 1. */
  varSCorr: number;
  zCorr: number;
  pCorr: number;
}

function zFromS(s: number, v: number): number {
  if (s > 0) return (s - 1) / Math.sqrt(v);
  if (s < 0) return (s + 1) / Math.sqrt(v);
  return 0;
}

/** Index-based Sen slope (median of (y_j - y_i)/(j - i)), as pymannkendall. */
export function senPerIndex(y: ArrayLike<number>): number {
  const n = y.length;
  const sl = new Float64Array((n * (n - 1)) / 2);
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sl[k++] = (y[j] - y[i]) / (j - i);
  sl.sort();
  return median(sl);
}

export function mannKendall(y: ArrayLike<number>, lag = HR_LAG): MkResult {
  const n = y.length;
  let s = 0;
  for (let k = 0; k < n - 1; k++) {
    const yk = y[k];
    for (let j = k + 1; j < n; j++) {
      const d = y[j] - yk;
      if (d > 0) s++;
      else if (d < 0) s--;
    }
  }
  let tieSum = 0;
  for (const tp of tieGroups(y)) tieSum += tp * (tp - 1) * (2 * tp + 5);
  const varS = (n * (n - 1) * (2 * n + 5) - tieSum) / 18;
  const z = zFromS(s, varS);
  const p = normTwoSided(z);
  // Hamed-Rao: ranks of the detrended series, significant acf lags 1..lag
  const b = senPerIndex(y);
  const det = new Float64Array(n);
  for (let i = 0; i < n; i++) det[i] = y[i] - (i + 1) * b;
  const ranks = rankData(det);
  const L = Math.min(lag, n - 1);
  const r = acf(ranks, L);
  const bound = normPpf(0.975) / Math.sqrt(n);
  let sni = 0;
  for (let i = 1; i <= L; i++) {
    if (!(r[i] <= bound && r[i] >= -bound)) sni += (n - i) * (n - i - 1) * (n - i - 2) * r[i];
  }
  const nns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni;
  const varSCorr = varS * Math.max(1, nns);
  const zCorr = zFromS(s, varSCorr);
  return {
    n, s, varS, z, p, tau: s / (0.5 * n * (n - 1)), nns, varSCorr, zCorr,
    pCorr: normTwoSided(zCorr),
  };
}

/** numpy.round semantics: half to even. */
function roundHalfEven(v: number): number {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export interface SenResult {
  slope: number;
  intercept: number;
  low: number;
  high: number;
  lowCorr: number;
  highCorr: number;
}

function senInterval(slopes: Float64Array, varS: number): [number, number] {
  const nt = slopes.length;
  const z = normPpf(0.025);
  const sigma = Math.sqrt(varS);
  const ru = Math.min(roundHalfEven((nt - z * sigma) / 2), nt - 1);
  const rl = Math.max(roundHalfEven((nt + z * sigma) / 2) - 1, 0);
  return [slopes[rl], slopes[ru]];
}

/** Theil-Sen slope against real time t; CI per Sen (1968) as scipy.theilslopes. */
export function theilSen(t: ArrayLike<number>, y: ArrayLike<number>, varSCorr?: number): SenResult {
  const n = y.length;
  const buf: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = t[j] - t[i];
      if (dx > 0) buf.push((y[j] - y[i]) / dx);
    }
  }
  const slopes = Float64Array.from(buf).sort();
  const slope = median(slopes);
  const intercept = median(sortedCopy(y)) - slope * median(sortedCopy(t));
  let tie = 0;
  for (const k of tieGroups(t)) tie += k * (k - 1) * (2 * k + 5);
  for (const k of tieGroups(y)) tie += k * (k - 1) * (2 * k + 5);
  const sigsq = (n * (n - 1) * (2 * n + 5) - tie) / 18;
  const [low, high] = senInterval(slopes, sigsq);
  const [lowCorr, highCorr] = varSCorr !== undefined ? senInterval(slopes, varSCorr) : [NaN, NaN];
  return { slope, intercept, low, high, lowCorr, highCorr };
}

export interface TrendReport {
  ols: OlsResult;
  mk: MkResult;
  sen: SenResult;
  /** Extra years of data at the same slope and noise for adjusted p < 0.05 (0 if already). */
  yearsNeeded: number | null;
}

/**
 * Smallest number of extra years after which the autocorrelation-adjusted
 * t-test would give p < alpha, if the slope, residual noise and lag-1
 * autocorrelation stayed the same and sampling stayed regular. null if more
 * than maxYears would be needed (or the slope is zero).
 */
export function yearsToSignificance(
  o: Pick<OlsResult, 'n' | 'slope' | 'residSd' | 'lag1'>,
  stepsPerYear: number,
  alpha = 0.05,
  maxYears = 300,
): number | null {
  if (!(Math.abs(o.slope) > 0) || !(o.residSd > 0)) return null;
  const dt = 1 / stepsPerYear;
  const pAt = (N: number): number => {
    const sxx = (dt * dt * N * (N * N - 1)) / 12;
    const se = o.residSd / Math.sqrt(sxx);
    const neff = effectiveN(N, o.lag1);
    if (neff <= 3) return 1;
    const seA = se * Math.sqrt((N - 2) / (neff - 2));
    return tTwoSided(o.slope / seA, neff - 2);
  };
  if (pAt(o.n) < alpha) return 0;
  for (let extra = 1; extra <= maxYears; extra++) {
    if (pAt(o.n + extra * stepsPerYear) < alpha) return extra;
  }
  return null;
}

export function analyseTrend(t: ArrayLike<number>, y: ArrayLike<number>, stepsPerYear: number): TrendReport {
  const o = ols(t, y);
  const m = mannKendall(y);
  const s = theilSen(t, y, m.varSCorr);
  return { ols: o, mk: m, sen: s, yearsNeeded: yearsToSignificance(o, stepsPerYear) };
}
