/*
 * Slope and Signal - "How to read this" panel, written for a high-school
 * student. Text drafted with Claude (Anthropic) under the team's direction.
 */
export function learnHtml(): string {
  return `
  <h2 id="learn-h">How to read this</h2>
  <div class="learn-grid">
    <article>
      <h3>Trend and slope</h3>
      <p>A <strong>trend</strong> is a steady change in one direction. We fit the straight line that is closest to all the points (the <em>least-squares line</em>). Its <strong>slope</strong> is the rate of change. We show it <strong>per decade</strong>: +0.4 °C per decade means about 0.4 °C warmer every 10 years.</p>
    </article>
    <article>
      <h3>Seasonal cycle and anomalies</h3>
      <p>Summer is always warmer than winter. That big yearly wiggle can hide a slow trend. So for "whole year" we take each month and subtract the average of the same month over all chosen years. What is left, the <strong>anomaly</strong>, says "how unusual was this month for its time of year".</p>
    </article>
    <article>
      <h3>p-value</h3>
      <p>Imagine there were <em>no</em> real trend, only random ups and downs. The <strong>p-value</strong> is the chance of still seeing a slope at least as steep as ours. A small p (below 0.05, that is 5%) means chance is an unlikely explanation. We then call the trend <strong>statistically significant</strong>. It does not tell you <em>why</em> it changes, and a large p does not show that nothing changes.</p>
    </article>
    <article>
      <h3>95% confidence interval</h3>
      <p>The data are only one sample of the weather, so the slope is uncertain. The <strong>95% confidence interval</strong> is the range of slopes that fit the data reasonably well. If it does not include 0, the trend is significant at the 5% level. A narrow interval means a precise estimate.</p>
    </article>
    <article>
      <h3>t-test</h3>
      <p>The <strong>t-test</strong> divides the slope by its uncertainty (its standard error). The bigger that ratio, the smaller the p-value. It assumes the leftover scatter around the line is random and roughly bell-shaped.</p>
    </article>
    <article>
      <h3>Mann-Kendall test and Theil-Sen slope</h3>
      <p>The <strong>Mann-Kendall test</strong> only asks: when you compare every pair of points, is the later one more often higher (or lower)? It ignores how big the steps are, so one extreme year cannot fool it, and it works for any steady (monotonic) change, not just straight lines. The <strong>Theil-Sen slope</strong> is the median of the slopes between all pairs of points: a robust partner to the least-squares slope.</p>
    </article>
    <article>
      <h3>Autocorrelation: why we adjust</h3>
      <p>A warm month is often followed by another warm month. Such neighbours are not independent, so 500 months carry less information than 500 separate coin tosses, and plain tests become over-confident. We measure the <strong>lag-1 autocorrelation</strong> r of the leftovers around the line and use the <strong>effective sample size</strong> n<sub>eff</sub> = n(1 - r)/(1 + r) in the t-test (Santer et al., 2000). For Mann-Kendall we use the <strong>Hamed-Rao correction</strong> (1998) with the first 3 lags of the ranks; we never let the correction make the test <em>less</em> cautious. The verdict uses these adjusted tests.</p>
    </article>
    <article>
      <h3>Not significant? Wait longer</h3>
      <p>A real but slow change can be buried in noise for years. If the slope and the noise stayed as they are, we compute how many more years of data the adjusted t-test would need to reach p &lt; 0.05. This is a thought experiment, not a forecast.</p>
    </article>
    <article>
      <h3>Where do the numbers come from?</h3>
      <p>NASA's <strong>POWER</strong> service gives monthly values for any point on Earth since 1981. Most variables come from <strong>MERRA-2</strong>, a NASA model that combines satellite and ground observations into a consistent global picture (a "reanalysis"). Sunlight and cloud come from satellite products (GEWEX SRB, then CERES). Values describe a grid box tens of kilometres wide (about 50 x 60 km for MERRA-2, about 100 km for sunlight and cloud), not a single weather station.</p>
    </article>
    <article>
      <h3>What a trend does not tell you</h3>
      <p>A <strong>significant trend</strong> means the change is unlikely to be chance. It does not say <em>why</em> it happens: that needs other clues. MERRA-2 is a <strong>reanalysis</strong> (a weather model fed with observations), so a trend can partly come from changes in which satellites and stations were available over the years. And one value describes a grid box tens of kilometres wide, not a weather station in a town. Compare with other data before drawing big conclusions.</p>
    </article>
    <article>
      <h3>Trend maps and many tests</h3>
      <p>The trend map runs one test per grid cell, often hundreds. At the 5% level, about 1 cell in 20 can look significant by pure chance, and neighbouring cells share the same weather. So trust large, coherent patches more than single dots. Each cell uses one value per year, the Mann-Kendall test with the Hamed-Rao correction and the Theil-Sen slope.</p>
    </article>
  </div>`;
}
