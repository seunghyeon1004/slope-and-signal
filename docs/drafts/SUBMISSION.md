# Submission draft: Slope and Signal

Draft text for every field of the NASA Space Apps 2026 project form. Drafted with Claude (Anthropic) for the team to review.
Teammate statistics review: none took place; the text below says so.

---

## Project Name

Slope and Signal

## High-Level Project Summary
(plain text, max 1500 characters; this draft has 939 characters and 165 words)

Slope and Signal is a free web app that turns anyone into an Earth system trend detective. You answer three short questions: what to investigate (18 variables such as temperature, rain, soil wetness, snow, sunshine, each with a plain definition), where (a map, coordinates or a type of place) and when. The app fetches NASA POWER data live in the browser (MERRA-2 and CERES based) and shows the time series with and without the seasonal cycle. It measures the rate of change per decade with a 95% confidence interval and tests it with a t-test and a Mann-Kendall test, both corrected for autocorrelation. Then it says in plain English what is changing, where, how much, and whether it is statistically significant. If it is not, it estimates how many more years of data would be needed. A two-place comparison and a trend map show that one variable can rise in one region and fall in another. Five guided cases can be watched step by step.

## Link to Project Demo

https://seunghyeon1004.github.io/slope-and-signal/demo.pdf
(7-page slide deck, PDF, also in the repository at docs/deck/Slope-and-Signal-demo.pdf)

## Link to Final Project

https://seunghyeon1004.github.io/slope-and-signal/
(source code: https://github.com/seunghyeon1004/slope-and-signal)

## Detailed Project Description
(rich text)

### What it does
Slope and Signal answers the four questions of the challenge for any place on Earth: **what** is changing, **where**, **how much**, and **whether the change is what scientists call significant**.

1. **Ask three questions.**
   - *What:* 18 NASA POWER variables in five groups (temperature, water, snow and ice, air and sky, sunlight), each with a one-sentence definition for a high-school student, its units, its source and its first year.
   - *Where:* click or tap a world map (keyboard works too), type coordinates, or pick one of 19 preset places by type: desert, desert city, rain forest, tidal estuary, big city, polar, mountains, dry grassland, Mediterranean climate, ocean, drying lake. When you pick a type of place, the app suggests three variables worth investigating there and says why. The suggestions come from fixed rules in the code (no model runs in the app).
   - *When:* any range of years since 1981 (2001 for sunshine and cloud, see below), and the whole year, a season or a single month.
2. **See the data.** Three charts: anomalies with the seasonal cycle removed (each month minus its own long-term average), one value per year, and the raw monthly values. Every chart has hover values, keyboard navigation, a one-sentence summary and a data table.
3. **Get a verdict in plain English.** For example: "Seoul: a significant warming trend in air temperature, +0.359 °C per decade (95% CI +0.250 to +0.468), adjusted t-test p < 0.0001, Mann-Kendall with Hamed-Rao correction p < 0.0001." The word "significant" never appears without the test and its p-value. When a trend is not significant, the app says so and estimates how many more years of data at the same slope and noise would make it significant, because "sometimes all a trend needs is a longer period".
4. **Find opposite trends.**
   - *Compare two places:* for example, air temperature rises at Svalbard (+0.77 °C per decade) and falls over the Ross Sea off Antarctica (−0.63 °C per decade), both significant.
   - *Trend map for a box up to 10 by 10 degrees:* every NASA POWER grid cell gets its own Theil-Sen slope and Mann-Kendall test. Colour shows the slope and a dot marks significance. Around central Chile, 163 of 357 cells show significant drying and 28 show significant wetting, in one box.
5. **Watch guided cases.** Five demonstrations play step by step (Play, Pause, Back, Next), scroll to the part being explained, and narrate it. Every number in the narration is computed from the data at run time. The cases:
   - Hidden by the seasons (Seoul)
   - Polar opposites (Svalbard vs Ross Sea)
   - Haze over a megacity (Delhi sunshine)
   - Not significant yet (Alps spring snow, p = 0.06; about 2 more years needed)
   - Wetter and drier in one box (central Chile)
6. **Learn.** A "How to read this" panel explains trend, slope, anomaly, p-value, confidence interval, t-test, Mann-Kendall, Theil-Sen, autocorrelation, why trend maps need care with many tests, and what a trend does not tell you.

### How it works
- A static TypeScript web app with no server. The browser calls the NASA POWER monthly API directly; it needs no key and allows cross-origin requests.
  - One point request fetches all 18 variables for 1981 to 2025, so switching variables is instant and the API is used politely.
  - The regional endpoint fetches the grid for the trend map.
  - Responses are cached in memory and in the browser; identical requests are shared.
  - Clear messages appear if the API fails, and the guided cases fall back to saved copies of the identical requests.
- **Statistics: the project's own TypeScript code (written with Claude), not a statistics library:**
  - Least-squares slope, standard error, t-test and 95% interval.
  - Lag-1 autocorrelation of the residuals and the effective sample size n(1 − r)/(1 + r) (Santer et al. 2000) for an adjusted t-test.
  - Mann-Kendall test with tie correction, and the Hamed and Rao (1998) correction using 3 lags. The app's rule is that the correction may only make the test more cautious, never less.
  - Theil-Sen slope with the Sen (1968) interval.
  - Student-t and normal distributions computed with incomplete beta and gamma functions.
- **Validation:**
  - 50 unit tests compare every statistic with scipy and pymannkendall reference values (generator script and fixtures are in the repository) to about 1e-9.
  - Property tests check invariances: adding a constant changes no slope; scaling scales slopes and keeps p-values; reversing time flips every sign.
  - 40 browser test runs (20 tests, each on desktop and phone, with Playwright) cover every feature, including live NASA POWER runs.
  - Testing showed that the Mann-Kendall S changed with floating-point noise: equal anomalies differed by 1e-15, so different software counted different ties. The app now rounds derived values to 6 decimals, and a test checks that the S in the app matches Python's S exactly.
- **Honest caveats** appear next to every verdict:
  - MERRA-2 is a reanalysis, so a trend can partly reflect changes in the observing system.
  - "Significant" does not say why something changes.
  - A grid box is not a weather station.
  - Sunshine and cloud data change product (GEWEX SRB to CERES) in 2001, so those variables start in 2001 by default and the app warns when a range crosses that year.
  - The trend map warns that about 1 cell in 20 can look significant by chance.
- **Accessibility:**
  - Keyboard paths through every section and the case player.
  - A table view and text summary for every chart.
  - Light and dark mode.
  - Automated WCAG 2.1 AA checks (axe-core) report 0 violations in both modes.

### Benefits and intended impact
- High-school and college students, teachers and curious adults can do a real trend analysis in a minute, with no install, login or statistics package.
- The tool teaches judgement as well as numbers: why the seasonal cycle must be removed, why correlated months need corrected tests, why "not significant" is not the same as "no change", and why opposite trends can come from one process.
- Every investigation has its own link and a CSV download, so a class can share and recompute results by hand.

### What makes it creative
- **The verdict:** a plain-English answer to the challenge's four questions, with the evidence beside it.
- **"How many more years?":** turns a non-significant result into a lesson instead of a dead end.
- **Watchable cases:** the guided cases narrate real numbers computed live.
- **Opposite trends:** they become visible twice, side by side and inside one map.

### Factors considered
- Validity first: tested statistics, autocorrelation corrections, conservative wording, data caveats, no invented numbers.
- Politeness to the free API: one request per place, caching and saved copies for demos.
- Audience: definitions for a high-school student, help for each region type, and accessibility.
- Scope: linear trends, as the challenge suggests; non-linear methods are left for the future.

### Tools and languages
- **Languages and frameworks:** TypeScript, HTML and CSS, Vite (build), no front-end framework and no chart library. Charts and maps are drawn as SVG by the project's own code (no chart or map library).
- **Testing:** Vitest and fast-check (unit and property tests), Playwright with headless Chromium and axe-core (browser and accessibility tests).
- **Reference values:** Python 3.11 with scipy, numpy and pymannkendall.
- **Hosting:** GitHub Actions and GitHub Pages.

## Use of AI (SI)

**Recommended boxes to tick:**
- [x] Data Analysis and Interpretation
- [x] Visual Design or Image Creation
- [x] Presentation, Video, or Audio
- [x] Other Project-Related SI Use
- [ ] Building SI/ML Into the Project (the app contains no AI or ML)
- [ ] None

**Description:**
We used Claude (Anthropic), a large language model, as a coding and writing assistant, directed by the team.

- **Code:** Claude wrote the code and on-screen text, including the statistics, the charts and the visual design (layout and colours; no images were generated).
- **Data exploration:** Claude ran exploratory analyses of NASA POWER data to help choose the guided cases.
- **Documents:** Claude drafted the deck and this text.

The team selected this challenge on the assistant's recommendation and approved the design. The feature set follows the objectives listed in the challenge statement; Claude proposed how to implement them and wrote the code and text. The team directed the work, checked results and made the decisions.

The statistics were checked against independent reference software (scipy, pymannkendall); no independent human review of the statistics has been done.

The app itself contains no AI. Every number it shows comes from NASA data and the project's tested statistics code. The disclosure appears in the README ("Use of AI"), in the app footer, in a `generator` meta tag, and in a header comment in every source file. No AI-generated images, audio or video are used; all pictures are real screenshots of the app.


## NASA Data
(link text + URL pairs)

- NASA POWER (Prediction Of Worldwide Energy Resources), NASA Langley Research Center: https://power.larc.nasa.gov/
- NASA POWER monthly and annual API (used live by the app): https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
- NASA POWER parameter dictionary (used to check every variable): https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=monthly
- MERRA-2 reanalysis, NASA Global Modeling and Assimilation Office (source of POWER meteorology): https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/
- CERES SYN1deg, NASA Langley (source of POWER surface radiation and cloud from 2001): https://ceres.larc.nasa.gov/data/
- GEWEX Surface Radiation Budget, NASA Langley (source of POWER surface radiation before 2001): https://gewex-srb.larc.nasa.gov/

## Space Agency Partner Data and Other References
(link text + URL pairs)

Data and maps
- Natural Earth 1:110m and 1:50m land polygons (public domain): https://www.naturalearthdata.com/

Literature (methods)
- Mann, H. B. (1945), Nonparametric tests against trend, Econometrica 13(3), 245-259: https://doi.org/10.2307/1907187
- Sen, P. K. (1968), Estimates of the regression coefficient based on Kendall's tau, J. Am. Stat. Assoc. 63(324), 1379-1389: https://doi.org/10.1080/01621459.1968.10480934
- Hamed, K. H. and Rao, A. R. (1998), A modified Mann-Kendall trend test for autocorrelated data, J. Hydrology 204(1-4), 182-196: https://doi.org/10.1016/S0022-1694(97)00125-X
- Santer, B. D. et al. (2000), Statistical significance of trends and trend differences in layer-average atmospheric temperature time series, J. Geophys. Res. 105(D6), 7337-7356: https://doi.org/10.1029/1999JD901105

Literature (background facts in the guided cases)
- Garreaud, R. D., Alvarez-Garreton, C., Barichivich, J., Boisier, J. P. et al. (2017), The 2010-2015 megadrought in central Chile: impacts on regional hydroclimate and vegetation, Hydrol. Earth Syst. Sci. 21, 6307-6327: https://doi.org/10.5194/hess-21-6307-2017
- Garreaud, R. D., Boisier, J. P., Rondanelli, R., Montecinos, A. et al. (2020), The Central Chile Mega Drought (2010-2018): A climate dynamics perspective, Int. J. Climatol. 40(1), 421-439: https://doi.org/10.1002/joc.6219
- Parkinson, C. L. (2019), A 40-y record reveals gradual Antarctic sea ice increases followed by decreases at rates far exceeding the rates seen in the Arctic, PNAS 116(29), 14414-14423: https://doi.org/10.1073/pnas.1906556116

Challenge resources consulted
- Statistical test methods to detect trends in time series data: https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b
- A Comprehensive Guide to Statistical Significance: https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance

Software (app)
- TypeScript (Apache-2.0): https://www.typescriptlang.org/
- Vite (MIT): https://vite.dev/
- Fonts: none loaded; the app uses the device's system font.

Software (testing and reference values only, not shipped in the app)
- Vitest (MIT): https://vitest.dev/
- fast-check (MIT): https://fast-check.dev/
- Playwright (Apache-2.0): https://playwright.dev/
- axe-core and @axe-core/playwright (MPL-2.0): https://github.com/dequelabs/axe-core
- SciPy (BSD-3-Clause): https://scipy.org/
- NumPy (BSD-3-Clause): https://numpy.org/
- pymannkendall (MIT), Hussain and Mahmud (2019), J. Open Source Softw. 4(39), 1556: https://doi.org/10.21105/joss.01556
- pypdf (BSD-3-Clause, used to count deck pages): https://github.com/py-pdf/pypdf

Hosting and AI
- GitHub Pages and GitHub Actions: https://pages.github.com/
- Claude (Anthropic), AI assistant used for code and text: https://www.anthropic.com/claude

Not used: KNMI Climate Explorer. No cross-check with it was run, so it is not listed as a source.
