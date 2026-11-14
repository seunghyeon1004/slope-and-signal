/*
 * Slope and Signal - from POWER data to a trend report (no DOM).
 * Written with Claude (Anthropic) under the team's direction.
 */
import type { Variable } from './data/catalogue';
import type { PointData } from './data/power';
import { buildAnalysis, inYears, type AnalysisSeries, type PeriodKey } from './data/series';
import { analyseTrend, type TrendReport } from './stats/trend';

export interface Query {
  v: string;
  lat: number;
  lon: number;
  name: string;
  start: number;
  end: number;
  period: PeriodKey;
}

export interface Computed {
  report: TrendReport;
  analysis: AnalysisSeries;
  start: number;
  end: number;
}

export function compute(query: Query, v: Variable, data: PointData): Computed | string {
  const all = data.series[v.id] ?? [];
  const start = Math.max(query.start, v.firstYear);
  const s = inYears(all, start, query.end);
  if (s.length < 24)
    return `NASA POWER has no usable ${v.name.toLowerCase()} values here for ${start} to ${query.end}${v.landOnly ? ' (this variable exists only over land; is the point in the sea?)' : ''}.`;
  const analysis = buildAnalysis(s, query.period, v.agg);
  if (analysis.y.length < 8) return 'Not enough complete years for this part of the year (at least 8 are needed).';
  if (analysis.y.every((x) => x === analysis.y[0])) return `${v.name} does not vary here (for example no snow at all), so there is nothing to test.`;
  const report = analyseTrend(analysis.t, analysis.y, analysis.stepsPerYear);
  return { report, analysis, start, end: query.end };
}
