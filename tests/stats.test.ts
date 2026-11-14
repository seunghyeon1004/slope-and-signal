/*
 * Slope and Signal - statistics tests against scipy / pymannkendall fixtures.
 * Written with Claude (Anthropic) under the team's direction.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import ref from './fixtures/stats_reference.json';
import raw from './fixtures/power_seoul_raw.json';
import { normCdf, normPpf, tCdf, tPpf } from '../src/stats/dist';
import { analyseTrend, mannKendall, ols, theilSen, yearsToSignificance } from '../src/stats/trend';
import { anomalies, climatology, inYears, parsePowerSeries, yearlySeries } from '../src/data/series';

type Case = (typeof ref.cases)[number];
const close = (a: number, b: number | null, rel = 1e-9, abs = 1e-12) => {
  expect(b).not.toBeNull();
  const tol = Math.max(abs, rel * Math.abs(b as number));
  expect(Math.abs(a - (b as number)), `got ${a} want ${b}`).toBeLessThanOrEqual(tol);
};

describe('distributions vs scipy', () => {
  it('normal cdf', () => ref.dist.norm_cdf.forEach(([x, v]) => close(normCdf(x), v, 1e-12, 1e-15)));
  it('normal ppf', () => ref.dist.norm_ppf.forEach(([p, v]) => close(normPpf(p), v, 1e-10)));
  it('t cdf', () => ref.dist.t_cdf.forEach(([x, df, v]) => close(tCdf(x, df), v, 1e-10, 1e-13)));
  it('t ppf', () => ref.dist.t_ppf.forEach(([p, df, v]) => close(tPpf(p, df), v, 1e-9, 1e-12)));
});

describe.each(ref.cases.map((c) => [c.name, c] as [string, Case]))('case %s', (_n, c) => {
  const o = ols(c.t, c.y);
  const m = mannKendall(c.y);
  const s = theilSen(c.t, c.y, m.varSCorr);
  it('OLS slope, se, t, p, CI', () => {
    close(o.slope, c.ols.slope);
    close(o.intercept, c.ols.intercept, 1e-8);
    close(o.se, c.ols.se);
    close(o.t, c.ols.t);
    close(o.p, c.ols.p, 1e-8, 1e-14);
    close(o.ciLow, c.ols.ci_low);
    close(o.ciHigh, c.ols.ci_high);
    close(o.r2, c.ols.r2);
  });
  it('lag-1 autocorrelation, n_eff and adjusted t-test', () => {
    close(o.lag1, c.ols.lag1);
    close(o.neff, c.ols.neff);
    close(o.pAdj, c.ols.p_adj, 1e-8, 1e-14);
    close(o.ciLowAdj, c.ols.ci_low_adj);
    close(o.ciHighAdj, c.ols.ci_high_adj);
  });
  it('Mann-Kendall S, var(S), z, p, tau', () => {
    expect(m.s).toBe(c.mk.s);
    close(m.varS, c.mk.var_s);
    close(m.z, c.mk.z);
    close(m.p, c.mk.p, 1e-7, 1e-12); // pymannkendall uses 1-cdf, less precise in the tail
    close(m.tau, c.mk.tau);
  });
  it('Hamed-Rao correction (lag 3) and floored variant', () => {
    close(m.nns, c.mk.hr_nns, 1e-9, 1e-12);
    if (c.mk.hr_p !== null) close(m.varS * m.nns, c.mk.hr_var_s, 1e-9);
    close(m.varSCorr, c.mk.hrc_var_s);
    close(m.zCorr, c.mk.hrc_z);
    close(m.pCorr, c.mk.hrc_p, 1e-9, 1e-14);
  });
  it('Theil-Sen slope and confidence intervals', () => {
    close(s.slope, c.mk.sen_slope);
    close(s.intercept, c.mk.sen_intercept, 1e-8);
    close(s.low, c.mk.sen_low);
    close(s.high, c.mk.sen_high);
    close(s.lowCorr, c.mk.sen_low_hr);
    close(s.highCorr, c.mk.sen_high_hr);
  });
});

describe('POWER parsing and deseasonalising', () => {
  it('reproduces the Python climatology and anomalies for real Seoul T2M', () => {
    const s = inYears(parsePowerSeries((raw as any).properties.parameter.T2M), 1981, 2024);
    const clim = climatology(s);
    const c = ref.cases.find((x) => x.name === 'power_seoul_t2m_anomaly') as any;
    clim.forEach((v, i) => close(v, c.clim[i]));
    const a = anomalies(s, clim);
    expect(a.y.length).toBe(c.y.length);
    a.y.forEach((v, i) => close(v, c.y[i], 1e-9, 1e-12));
    a.t.forEach((v, i) => close(v, c.t[i]));
  });
});

describe('invariances (property tests)', () => {
  // values on a 0.01 grid, like real measurements (avoids denormal artefacts)
  const series = fc.array(fc.integer({ min: -5000, max: 5000 }).map((v) => v / 100), { minLength: 8, maxLength: 60 });
  const T = (n: number) => Array.from({ length: n }, (_, i) => 1990 + i);
  it('adding a constant changes no slope or p-value', () => {
    fc.assert(fc.property(series, fc.integer({ min: -100, max: 100 }), (y, k) => {
      const t = T(y.length);
      const a = analyseTrend(t, y, 1);
      const b = analyseTrend(t, y.map((v) => v + k), 1);
      expect(b.ols.slope).toBeCloseTo(a.ols.slope, 6);
      expect(b.mk.s).toBe(a.mk.s);
      expect(b.sen.slope).toBeCloseTo(a.sen.slope, 6);
    }), { numRuns: 60 });
  });
  it('scaling by c>0 scales slopes, keeps p-values', () => {
    fc.assert(fc.property(series, fc.integer({ min: 2, max: 9 }), (y, c) => {
      const t = T(y.length);
      const a = analyseTrend(t, y, 1);
      const b = analyseTrend(t, y.map((v) => v * c), 1);
      expect(b.ols.slope).toBeCloseTo(a.ols.slope * c, 6);
      expect(b.sen.slope).toBeCloseTo(a.sen.slope * c, 6);
      if (Number.isFinite(a.ols.p)) expect(b.ols.p).toBeCloseTo(a.ols.p, 6);
      expect(b.mk.p).toBeCloseTo(a.mk.p, 9);
    }), { numRuns: 60 });
  });
  it('reversing time flips the sign of every slope and of S', () => {
    fc.assert(fc.property(series, (y) => {
      const t = T(y.length);
      const a = analyseTrend(t, y, 1);
      const b = analyseTrend(t, [...y].reverse(), 1);
      expect(b.ols.slope).toBeCloseTo(-a.ols.slope, 6);
      expect(b.mk.s + a.mk.s).toBe(0);
      expect(b.sen.slope).toBeCloseTo(-a.sen.slope, 6);
    }), { numRuns: 60 });
  });
  it('Hamed-Rao floored correction never lowers the p-value', () => {
    fc.assert(fc.property(series, (y) => {
      const m = mannKendall(y);
      expect(m.pCorr).toBeGreaterThanOrEqual(m.p - 1e-15);
    }), { numRuns: 60 });
  });
});

describe('years needed for significance', () => {
  it('is 0 when already significant and grows as noise grows', () => {
    const base = { n: 30, slope: 0.05, residSd: 0.3, lag1: 0.1 };
    expect(yearsToSignificance({ ...base, residSd: 0.05 }, 1)).toBe(0);
    const y1 = yearsToSignificance({ ...base, residSd: 3 }, 1)!;
    const y2 = yearsToSignificance({ ...base, residSd: 6 }, 1)!;
    expect(y1).toBeGreaterThan(0);
    expect(y2).toBeGreaterThan(y1);
  });
  it('matches a direct check: at n+k years the adjusted p is below 0.05, at n+k-1 not', () => {
    const t = Array.from({ length: 25 }, (_, i) => 2000 + i);
    const y = t.map((v, i) => 0.01 * i + Math.sin(i * 1.7) * 0.6);
    const o = ols(t, y);
    const k = yearsToSignificance(o, 1)!;
    expect(k).toBeGreaterThan(0);
    expect(yearsToSignificance({ ...o, n: o.n + k }, 1)).toBe(0);
    expect(yearsToSignificance({ ...o, n: o.n + k - 1 }, 1)).toBe(1);
  });
  it('returns null for a zero slope', () => expect(yearsToSignificance({ n: 20, slope: 0, residSd: 1, lag1: 0 }, 1)).toBeNull());
});

describe('yearly aggregation', () => {
  const s = inYears(parsePowerSeries((raw as any).properties.parameter.T2M), 1981, 2024);
  it('whole year keeps the first year and matches the POWER annual value closely', () => {
    const y = yearlySeries(s, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'mean');
    expect(y.t[0]).toBe(1981);
    expect(y.t.length).toBe(44);
    // POWER's own annual (month 13) is a day-weighted mean rounded to 0.01
    const ann = (raw as any).properties.parameter.T2M['201013'];
    expect(Math.abs(y.y[y.t.indexOf(2010)] - ann)).toBeLessThan(0.006);
  });
  it('DJF uses December of the previous year, so the first year is dropped', () => {
    const y = yearlySeries(s, [12, 1, 2], 'mean');
    expect(y.t[0]).toBe(1982);
  });
  it('sum aggregation for frost days equals the POWER annual total', () => {
    const f = inYears(parsePowerSeries((raw as any).properties.parameter.FROST_DAYS), 1981, 2024);
    const y = yearlySeries(f, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'sum');
    expect(y.y[y.t.indexOf(2010)]).toBe((raw as any).properties.parameter.FROST_DAYS['201013']);
  });
});
