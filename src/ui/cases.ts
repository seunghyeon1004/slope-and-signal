/*
 * Slope and Signal - guided demonstration cases that the user can watch step
 * by step (Play / Pause / Back / Next). Every number in the narration is
 * computed at run time from NASA POWER data (live, or the bundled snapshot of
 * the same request); none is typed in by hand.
 * Written with Claude (Anthropic) under the team's direction.
 */
import { LAST_YEAR, variable } from '../data/catalogue';
import type { Computed, Query } from '../analysis';
import type { CompareApi, CompareQuery, CompareResult } from './compare';
import type { InvestigateApi } from './investigate';
import type { MapQuery, MapResult, TrendMapApi } from './trendmap';
import { escapeHtml } from './chart';
import { spotlight } from './common';
import { fmtNum, fmtP } from '../verdict';

export interface Apps {
  inv: InvestigateApi;
  cmp: CompareApi;
  map: TrendMapApi;
}

interface Ctx {
  c?: Computed | null;
  cmp?: CompareResult | null;
  map?: MapResult | null;
  snapshotOnly: boolean;
}

interface Step {
  /** run before the text is shown */
  act?: (a: Apps, ctx: Ctx) => Promise<void>;
  /** CSS selector to bring into view */
  focus?: string;
  say: (ctx: Ctx) => string;
  /** literature source shown under the text */
  source?: string;
}

export interface Case {
  id: string;
  title: string;
  question: string;
  teaser: string;
  steps: Step[];
  /** snapshots this case needs: points as [lat, lon], and regional boxes */
  points: [number, number][];
}

const r = (v: number, dp = 2, signed = true) => fmtNum(v, dp, signed);
const need = <T>(x: T | null | undefined): T => {
  if (!x) throw new Error('The data for this step could not be loaded.');
  return x;
};

const SEOUL: Query = { v: 'T2M', lat: 37.57, lon: 126.98, name: 'Seoul, South Korea', start: 1981, end: LAST_YEAR, period: 'year' };
const POLES: CompareQuery = {
  v: 'T2M',
  a: { lat: 78.22, lon: 15.65, name: 'Svalbard, Norway' },
  b: { lat: -70.0, lon: -150.0, name: 'Ross Sea, off Antarctica' },
  start: 1981,
  end: LAST_YEAR,
  period: 'year',
};
const DELHI: Query = { v: 'ALLSKY_SFC_SW_DWN', lat: 28.61, lon: 77.21, name: 'Delhi, India', start: 2001, end: LAST_YEAR, period: 'year' };
const ALPS: Query = { v: 'SNODP', lat: 46.5, lon: 8.0, name: 'Swiss Alps', start: 1981, end: LAST_YEAR, period: 'MAM' };
const CHILE_MAP: MapQuery = { v: 'PRECTOTCORR', lat: -33, lon: -70, name: 'Central Chile near Santiago', size: 10, start: 1981, end: LAST_YEAR, period: 'year' };
const CHILE: Query = { v: 'PRECTOTCORR', lat: -33.5, lon: -71.0, name: 'Central Chile near Santiago', start: 1981, end: LAST_YEAR, period: 'year' };

export const CASES: Case[] = [
  {
    id: 'seasons',
    title: 'Hidden by the seasons',
    question: 'Is Seoul getting warmer?',
    teaser: 'Summer is far warmer than winter. Can a slow trend hide under that big seasonal swing?',
    points: [[SEOUL.lat, SEOUL.lon]],
    steps: [
      {
        act: async (a, ctx) => void (ctx.c = await a.inv.run(SEOUL, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#ch-raw',
        say: (ctx) => {
          const c = need(ctx.c);
          const clim = c.analysis.clim;
          return `We asked NASA POWER for monthly air temperature at Seoul, ${c.start} to ${c.end}. The raw values swing between about ${Math.min(...clim).toFixed(1)} °C (coldest month on average) and ${Math.max(...clim).toFixed(1)} °C (warmest). With a wiggle that big, a slow trend is hard to see.`;
        },
      },
      {
        focus: '#ch-anom',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Now we remove the seasonal cycle: every month minus the average of the same month. What is left are anomalies, ${c.analysis.y.length} of them. The dark line rises: ${r(c.report.ols.slope * 10, 3)} °C per decade.`;
        },
      },
      {
        focus: '#stats',
        say: (ctx) => {
          const o = need(ctx.c).report.ols;
          return `Neighbouring months are alike (lag-1 autocorrelation ${o.lag1.toFixed(2)}), so ${o.n} months count like only ${o.neff.toFixed(0)} independent values. Even so, the adjusted 95% confidence interval is ${r(o.ciLowAdj * 10, 3)} to ${r(o.ciHighAdj * 10, 3)} °C per decade: it does not include zero.`;
        },
      },
      {
        focus: '#verdict',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Verdict: a statistically significant warming trend (adjusted t-test ${fmtP(c.report.ols.pAdj)}, Mann-Kendall with Hamed-Rao correction ${fmtP(c.report.mk.pCorr)}). Over ${c.start} to ${c.end} that adds up to about ${r(c.report.ols.slope * (c.end - c.start), 2)} °C. The test says it is unlikely to be chance; it does not say why.`;
        },
      },
    ],
  },
  {
    id: 'poles',
    title: 'Polar opposites',
    question: 'Do both polar regions warm?',
    teaser: 'Same variable, same years, two cold places at opposite ends of the Earth.',
    points: [[POLES.a.lat, POLES.a.lon], [POLES.b.lat, POLES.b.lon]],
    steps: [
      {
        act: async (a, ctx) => void (ctx.cmp = await a.cmp.run(POLES, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#compare',
        say: () => 'We compare air temperature at Svalbard in the Arctic (78°N) with the Ross Sea off Antarctica (70°S), 1981 to the latest full year.',
      },
      {
        focus: '#cmp-chart',
        say: (ctx) => {
          const m = need(ctx.cmp);
          return `Each place is drawn relative to its own average. Svalbard's line climbs at ${r(m.a.report.ols.slope * 10)} °C per decade; the Ross Sea line falls at ${r(m.b.report.ols.slope * 10)} °C per decade.`;
        },
      },
      {
        focus: '#cmp-sentence',
        say: (ctx) => {
          const m = need(ctx.cmp);
          return m.opposite
            ? `Both trends pass both adjusted tests (Svalbard ${fmtP(m.a.report.mk.pCorr)}, Ross Sea ${fmtP(m.b.report.mk.pCorr)}, Mann-Kendall with Hamed-Rao). One variable, opposite significant trends in two regions.`
            : `With this data the two trends are not both significant, so we cannot claim opposite trends (Svalbard ${fmtP(m.a.report.mk.pCorr)}, Ross Sea ${fmtP(m.b.report.mk.pCorr)}).`;
        },
      },
      {
        say: () =>
          'Detective note: satellites show that Antarctic sea ice slowly grew from the late 1970s until 2014 and then shrank fast, unlike the Arctic. The Ross Sea value here is a reanalysis over sea ice, so check it against other data before drawing conclusions. Try the trend map on the Ross Sea next.',
        source: 'Parkinson, C. L. (2019), PNAS 116(29), 14414-14423, doi:10.1073/pnas.1906556116',
      },
    ],
  },
  {
    id: 'haze',
    title: 'Haze over a megacity',
    question: 'Is less sunshine reaching the ground in Delhi?',
    teaser: 'The air above a big city: satellites measure how much sunlight gets through.',
    points: [[DELHI.lat, DELHI.lon]],
    steps: [
      {
        act: async (a, ctx) => void (ctx.c = await a.inv.run(DELHI, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#ch-year',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Sunshine reaching the ground (all-sky surface solar radiation, from the CERES satellite product) at Delhi, ${c.start} to ${c.end}. We start in 2001 so the whole record comes from one product.`;
        },
      },
      {
        focus: '#how-much',
        say: (ctx) => {
          const c = need(ctx.c);
          const v = variable('ALLSKY_SFC_SW_DWN');
          return `The trend is ${r(c.report.ols.slope * 10, 3)} ${v.units} per decade (95% CI ${r(c.report.ols.ciLowAdj * 10, 3)} to ${r(c.report.ols.ciHighAdj * 10, 3)}). The robust Theil-Sen slope agrees: ${r(c.report.sen.slope * 10, 3)}.`;
        },
      },
      {
        focus: '#verdict',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Adjusted t-test ${fmtP(c.report.ols.pAdj)}, Mann-Kendall (Hamed-Rao) ${fmtP(c.report.mk.pCorr)}. A falling trend in sunshine is called "dimming"; haze from pollution and more cloud are candidate causes. The statistics cannot tell which: that is the next clue to chase (try cloud cover at the same place).`;
        },
      },
    ],
  },
  {
    id: 'notyet',
    title: 'Not significant yet',
    question: 'Is spring snow in the Alps shrinking?',
    teaser: 'A slope can be real but still buried in noise. How long would we need to wait?',
    points: [[ALPS.lat, ALPS.lon]],
    steps: [
      {
        act: async (a, ctx) => void (ctx.c = await a.inv.run(ALPS, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#ch-year',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Spring (March to May) snow depth in the Swiss Alps, one value per year, ${c.analysis.yearly.t[0]} to ${c.end}. Some springs have deep snow, others very little: the dots jump around a lot.`;
        },
      },
      {
        focus: '#how-much',
        say: (ctx) => {
          const c = need(ctx.c);
          return `The line slopes down: ${r(c.report.ols.slope * 10, 2)} cm per decade. But the 95% confidence interval, ${r(c.report.ols.ciLowAdj * 10, 2)} to ${r(c.report.ols.ciHighAdj * 10, 2)} cm per decade, still includes zero.`;
        },
      },
      {
        focus: '#is-sig',
        say: (ctx) => {
          const c = need(ctx.c);
          const yn = c.report.yearsNeeded;
          const lv = c.report.ols.pAdj < 0.05 && c.report.mk.pCorr < 0.05;
          if (lv) return `With the newest data this trend now passes both tests (${fmtP(c.report.ols.pAdj)}, ${fmtP(c.report.mk.pCorr)}).`;
          return `Not statistically significant: adjusted t-test ${fmtP(c.report.ols.pAdj)}, Mann-Kendall (Hamed-Rao) ${fmtP(c.report.mk.pCorr)}. ${yn ? `If the slope and the year-to-year noise stayed the same, about ${yn} more years of data would make it significant.` : ''} "Not significant" does not mean "no change": it means "the data cannot tell yet".`;
        },
      },
    ],
  },
  {
    id: 'drywet',
    title: 'Wetter and drier in one box',
    question: 'Where is central Chile drying?',
    teaser: 'A trend map shows rain going down on one side of the Andes and up on the other.',
    points: [[CHILE.lat, CHILE.lon]],
    steps: [
      {
        act: async (a, ctx) => void (ctx.map = await a.map.run(CHILE_MAP, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#trendmap',
        say: () =>
          'We draw a trend map of rain and snowfall for a 10 by 10 degree box around central Chile: every grid cell gets its own Theil-Sen slope and Mann-Kendall test. Red means drier, blue means wetter.',
      },
      {
        focus: '.tm-fig',
        say: (ctx) => {
          const m = need(ctx.map);
          const centre = (up: boolean) => {
            const cs = m.cells.filter((x) => x.p < 0.05 && (up ? x.slope > 0 : x.slope < 0));
            if (!cs.length) return null;
            const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
            const la = med(cs.map((x) => x.lat));
            const lo = med(cs.map((x) => x.lon));
            return `${Math.abs(la).toFixed(1)}°${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(1)}°${lo >= 0 ? 'E' : 'W'}`;
          };
          const d = centre(false);
          const u = centre(true);
          return `Of ${m.tested} cells, ${m.sigDown} show a significant drying trend and ${m.sigUp} a significant wetting trend (dots, p < 0.05).${d ? ` The drying cells are centred around ${d}` : ''}${u ? `; the wetting cells around ${u}` : ''}. Opposite trends, a few hundred kilometres apart.`;
        },
      },
      {
        act: async (a, ctx) => void (ctx.c = await a.inv.run(CHILE, { snapshotOnly: ctx.snapshotOnly })),
        focus: '#verdict',
        say: (ctx) => {
          const c = need(ctx.c);
          return `Zooming in on the point near Santiago: ${r(c.report.ols.slope * 10, 3)} mm/day per decade, that is about ${fmtNum(Math.abs(c.report.ols.slope * 10 * 365), 0)} mm ${c.report.ols.slope < 0 ? 'less' : 'more'} rain per year every decade (adjusted t-test ${fmtP(c.report.ols.pAdj)}, Mann-Kendall ${fmtP(c.report.mk.pCorr)}). Central Chile has had a long drought since 2010, called the "megadrought".`;
        },
        source: 'Garreaud, R. D. et al. (2017), Hydrol. Earth Syst. Sci. 21, 6307-6327, doi:10.5194/hess-21-6307-2017; Garreaud, R. D. et al. (2020), Int. J. Climatol. 40(1), 421-439, doi:10.1002/joc.6219',
      },
    ],
  },
];

export function initCases(host: HTMLElement, apps: Apps): { start(id: string): void } {
  host.innerHTML = `
  <h2 id="cases-h">Guided cases: watch a detective at work</h2>
  <p class="lede-sm">Each case runs the tool step by step on real NASA data and explains what it sees. Press Play and watch, or step through at your own pace.</p>
  <div class="case-grid">${CASES.map(
    (c, i) => `<article class="case"><p class="case-n">Case ${i + 1}</p><h3>${escapeHtml(c.title)}</h3><p class="case-q">${escapeHtml(c.question)}</p><p class="small">${escapeHtml(c.teaser)}</p><button type="button" class="btn" data-case="${c.id}">Watch this case</button></article>`,
  ).join('')}</div>
  <label class="inline small"><input type="checkbox" id="snap-only" /> Use the saved copy of the data (works offline; same request, saved on 14 November 2026)</label>`;

  const dock = document.createElement('aside');
  dock.className = 'dock';
  dock.hidden = true;
  dock.setAttribute('aria-label', 'Guided case');
  dock.innerHTML = `
    <div class="dock-in">
      <div class="dock-head"><strong id="dock-title"></strong><span id="dock-count" class="small"></span><button type="button" class="link" id="dock-min" aria-expanded="true" aria-controls="dock-text">Minimise</button><button type="button" class="link" id="dock-close" aria-label="Close guided case">Close</button></div>
      <div class="dock-bar"><span id="dock-prog"></span></div>
      <p id="dock-text" aria-live="polite"></p>
      <p id="dock-src" class="dock-src" hidden></p>
      <div class="dock-ctl">
        <button type="button" class="btn" id="dock-prev">Back</button>
        <button type="button" class="btn primary" id="dock-play">Pause</button>
        <button type="button" class="btn" id="dock-next">Next</button>
      </div>
    </div>`;
  document.body.appendChild(dock);
  const $ = (id: string) => dock.querySelector(`#${id}`) as HTMLElement;

  let cur: Case | null = null;
  let idx = 0;
  let ctx: Ctx = { snapshotOnly: false };
  let playing = false;
  let timer: number | undefined;
  let token = 0;
  const done = new Set<number>();

  const STEP_MS = 9000;
  const schedule = () => {
    window.clearTimeout(timer);
    if (playing && cur && idx < cur.steps.length - 1) timer = window.setTimeout(() => void go(idx + 1), STEP_MS);
    if (playing && cur && idx === cur.steps.length - 1) {
      playing = false;
      syncCtl();
    }
  };
  const syncCtl = () => {
    if (!cur) return;
    $('dock-play').textContent = playing ? 'Pause' : idx === cur.steps.length - 1 ? 'Replay' : 'Play';
    ($('dock-prev') as HTMLButtonElement).disabled = idx === 0;
    ($('dock-next') as HTMLButtonElement).disabled = idx === cur.steps.length - 1;
    $('dock-count').textContent = `Step ${idx + 1} of ${cur.steps.length}`;
    $('dock-prog').style.width = `${((idx + 1) / cur.steps.length) * 100}%`;
  };

  async function go(i: number): Promise<void> {
    if (!cur) return;
    const my = ++token;
    window.clearTimeout(timer);
    idx = i;
    syncCtl();
    const step = cur.steps[i];
    $('dock-text').textContent = 'Working...';
    try {
      // replay earlier actions when jumping straight to a later step
      for (let k = 0; k <= i; k++) {
        const s = cur.steps[k];
        if (s.act && (k === i || !done.has(k))) {
          await s.act(apps, ctx);
          done.add(k);
        }
        if (my !== token) return;
      }
      if (step.focus) spotlight(document.querySelector(step.focus));
      $('dock-text').textContent = step.say(ctx);
      const src = $('dock-src');
      src.hidden = !step.source;
      src.textContent = step.source ? `Source: ${step.source}` : '';
    } catch (e) {
      $('dock-text').textContent = `${(e as Error).message} Tick "Use the saved copy of the data" above and try again.`;
      playing = false;
      syncCtl();
      return;
    }
    schedule();
  }

  host.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button[data-case]') as HTMLButtonElement | null;
    if (b) start(b.dataset.case!);
  });
  $('dock-next').addEventListener('click', () => {
    playing = false;
    if (cur && idx < cur.steps.length - 1) void go(idx + 1);
  });
  $('dock-prev').addEventListener('click', () => {
    playing = false;
    if (idx > 0) void go(idx - 1);
  });
  $('dock-play').addEventListener('click', () => {
    if (!cur) return;
    if (playing) {
      playing = false;
      window.clearTimeout(timer);
      syncCtl();
      return;
    }
    playing = true;
    if (idx === cur.steps.length - 1) void go(0);
    else void go(idx + 1);
  });
  $('dock-min').addEventListener('click', () => {
    const min = dock.classList.toggle('min');
    $('dock-min').textContent = min ? 'Show text' : 'Minimise';
    $('dock-min').setAttribute('aria-expanded', String(!min));
  });
  $('dock-close').addEventListener('click', () => {
    playing = false;
    window.clearTimeout(timer);
    token++;
    dock.hidden = true;
    document.body.classList.remove('touring');
  });
  document.addEventListener('keydown', (ev) => {
    if (dock.hidden || (ev.target as HTMLElement).closest('input, select, textarea, svg')) return;
    if (ev.key === 'Escape') ($('dock-close') as HTMLButtonElement).click();
  });

  function start(id: string): void {
    const c = CASES.find((x) => x.id === id);
    if (!c) return;
    cur = c;
    done.clear();
    ctx = { snapshotOnly: (host.querySelector('#snap-only') as HTMLInputElement).checked };
    $('dock-title').textContent = `${c.title}: ${c.question}`;
    dock.hidden = false;
    document.body.classList.add('touring');
    playing = true;
    void go(0);
    ($('dock-play') as HTMLButtonElement).focus({ preventScroll: true });
  }
  return { start };
}
