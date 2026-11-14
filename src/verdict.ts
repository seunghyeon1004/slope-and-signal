/*
 * Slope and Signal - plain-English verdicts.
 * Written with Claude (Anthropic) under the team's direction.
 *
 * Rule: the word "significant" is never printed without the test and its
 * p-value beside it.
 */
import type { TrendReport } from './stats/trend';
import type { Variable } from './data/catalogue';

export const ALPHA = 0.05;

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return 'p not available';
  if (p < 0.0001) return 'p < 0.0001';
  if (p < 0.001) return `p = ${p.toFixed(4)}`;
  return `p = ${p.toFixed(3)}`;
}

export function fmtNum(v: number, dp: number, signed = false): string {
  if (!Number.isFinite(v)) return 'n/a';
  const s = Math.abs(v) < 0.5 * 10 ** -dp ? (0).toFixed(dp) : v.toFixed(dp);
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  if (neg) return `−${body}`;
  return signed ? `+${body}` : body;
}

/** decimals for a per-decade rate: two more than the variable's own, capped */
export function rateDp(v: Variable): number {
  return Math.min(v.dp + 1, 4);
}

export type Level = 'strong' | 'mixed' | 'none';

export interface Verdict {
  level: Level;
  direction: 'up' | 'down' | 'flat';
  headline: string;
  what: string;
  where: string;
  howMuch: string;
  significance: string;
  longer: string | null;
  caution: string[];
}

export interface VerdictInput {
  v: Variable;
  report: TrendReport;
  place: string;
  periodText: string;
  start: number;
  end: number;
  kind: 'monthly-anomaly' | 'yearly';
}

function dirWord(v: Variable, up: boolean): string {
  if (v.group === 'Temperature' && v.id !== 'FROST_DAYS') return up ? 'warming' : 'cooling';
  if (['PRECTOTCORR', 'GWETTOP', 'GWETROOT'].includes(v.id)) return up ? 'wetting' : 'drying';
  return up ? 'rising' : 'falling';
}

export function makeVerdict(x: VerdictInput): Verdict {
  const { v, report, place, periodText, start, end } = x;
  const o = report.ols;
  const mk = report.mk;
  const sen = report.sen;
  const years = end - start + 1;
  const perDec = o.slope * 10;
  const dp = rateDp(v);
  const tOk = Number.isFinite(o.pAdj) && o.pAdj < ALPHA;
  const mkOk = mk.pCorr < ALPHA;
  const level: Level = tOk && mkOk ? 'strong' : tOk || mkOk ? 'mixed' : 'none';
  const direction = Math.abs(perDec) < 1e-12 ? 'flat' : perDec > 0 ? 'up' : 'down';
  const total = o.slope * (years - 1);
  const word = direction === 'flat' ? 'no change' : dirWord(v, direction === 'up');

  const what = `${v.name} (${v.units}), ${periodText}.`;
  const where = place;
  const ciLo = o.ciLowAdj * 10;
  const ciHi = o.ciHighAdj * 10;
  const howMuch =
    `${fmtNum(perDec, dp, true)} ${v.units} per decade ` +
    `(95% confidence interval ${fmtNum(ciLo, dp, true)} to ${fmtNum(ciHi, dp, true)}, allowing for autocorrelation). ` +
    `Over ${start} to ${end} that adds up to about ${fmtNum(total, v.dp, true)} ${v.units}. ` +
    `The robust Theil-Sen estimate is ${fmtNum(sen.slope * 10, dp, true)} ${v.units} per decade.`;

  const tTxt = `adjusted t-test ${fmtP(o.pAdj)}`;
  const mkTxt = `Mann-Kendall test with Hamed-Rao correction ${fmtP(mk.pCorr)}`;
  let significance: string;
  if (level === 'strong') {
    significance = `Statistically significant at the 5% level: ${tTxt}, ${mkTxt}. A trend this clear would very rarely appear by chance in data without a real trend.`;
  } else if (level === 'mixed') {
    significance = `Mixed evidence: only one test passes the 5% level (${tTxt}; ${mkTxt}). Treat this as a hint, not a finding.`;
  } else {
    significance = `Not statistically significant at the 5% level (${tTxt}; ${mkTxt}). The year-to-year ups and downs are large compared with the slope, so chance alone could produce a slope like this.`;
  }
  let longer: string | null = null;
  if (level !== 'strong') {
    if (report.yearsNeeded === null) {
      longer = 'Even centuries more data at this tiny slope would not make it significant: there is no meaningful linear trend here.';
    } else if (report.yearsNeeded > 0) {
      longer = `If the slope and the noise stayed the same, about ${report.yearsNeeded} more year${report.yearsNeeded === 1 ? '' : 's'} of data (until about ${end + report.yearsNeeded}) would make the adjusted t-test significant. Sometimes all a trend needs is a longer record.`;
    }
  }
  const caution: string[] = [];
  if (years < 15) caution.push(`Only ${years} years: short records give wide confidence intervals.`);
  if (o.lag1 > 0.3) caution.push(`Neighbouring values are correlated (lag-1 autocorrelation ${o.lag1.toFixed(2)}), which is why the adjusted tests are more cautious than the plain ones.`);
  if ((v.id.startsWith('ALLSKY') || v.id === 'CLOUD_AMT') && start <= 2000 && end >= 2001)
    caution.push('Radiation and cloud data switch from the GEWEX SRB product to CERES SYN1deg in 2001; part of a trend across that year can come from the change of product.');
  if (v.landOnly) caution.push('This variable is only meaningful over land.');

  const levelWord = level === 'strong' ? 'a significant' : level === 'mixed' ? 'a possible' : 'no significant';
  const headline =
    level === 'none'
      ? `${place}: ${levelWord} trend in ${v.name.toLowerCase()} (${periodText}), ${start} to ${end}.`
      : `${place}: ${levelWord} ${word} trend in ${v.name.toLowerCase()} (${periodText}), ${fmtNum(perDec, dp, true)} ${v.units} per decade, ${start} to ${end}.`;
  return { level, direction, headline, what, where, howMuch, significance, longer, caution };
}
