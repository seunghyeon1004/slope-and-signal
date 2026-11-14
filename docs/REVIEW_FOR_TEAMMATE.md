# Statistics review checklist (for Kim Mi Yeon)

Prepared with Claude (Anthropic) for team Slope and Signal. About 20 to 30 minutes.

## 1. Open this screen

https://seunghyeon1004.github.io/slope-and-signal/#v=T2M&lat=37.57&lon=126.98&s=1981&e=2025&p=year&name=Seoul%2C+South+Korea

This is air temperature at Seoul, 1981 to 2025, whole year. Scroll to **"The statistics behind the verdict"**.
Then click **"Download the data (CSV)"** in the green verdict box. The CSV has 2 comment lines, then a header
row `year,month,time,value,anomaly`, then 540 rows (rows 4 to 543 in a spreadsheet).

## 2. Check three numbers

On 14 Nov 2026 the screen showed the values below. NASA can revise data, so small changes are possible.

| # | Number on screen | Value seen | How to recompute from the CSV |
|---|---|---|---|
| 1 | Least-squares slope per decade | +0.359 °C | `=SLOPE(E4:E543, C4:C543)*10` (anomaly against time) |
| 2 | Its 95% interval, adjusted for autocorrelation | +0.250 to +0.468 | formulas below |
| 3 | Mann-Kendall S and its p-value | S = 38631, p < 0.0001 | formula below |

## 3. Formulas used (all in `src/stats/trend.ts`)

- **Anomaly:** value minus the mean of the same calendar month over 1981 to 2025, rounded to 6 decimals (so that equal values count as ties in Mann-Kendall; the CSV has exactly these values). **Time:** t = year + (month - 0.5)/12.
- **Least squares:** b = Σ(t - t̄)(y - ȳ) / Σ(t - t̄)². Standard error SE = √(SSE/(n - 2)) / √Σ(t - t̄)².
- **Autocorrelation:** residuals e = y - (a + b·t), r₁ = Σ eᵢeᵢ₊₁ / Σ eᵢ².
  Effective sample size n_eff = n(1 - r₁)/(1 + r₁) (Santer et al. 2000), used only when r₁ > 0.
  SE_adj = SE·√((n - 2)/(n_eff - 2)). 95% interval: b ± t₀.₉₇₅(df = n_eff - 2)·SE_adj. Two-sided p from t = b/SE_adj with the same df.
  In a spreadsheet: residuals in column F (`=E4-(INTERCEPT(E$4:E$543,C$4:C$543)+SLOPE(E$4:E$543,C$4:C$543)*C4)`),
  r₁ = `=SUMPRODUCT(F4:F542,F5:F543)/SUMSQ(F4:F543)`, SE = `=STEYX(E4:E543,C4:C543)/SQRT(DEVSQ(C4:C543))`,
  critical t = `=T.INV.2T(0.05, n_eff-2)` (a spreadsheet may round df to a whole number; with df near 274 that changes nothing in the shown decimals).
- **Mann-Kendall:** S = Σ over all pairs i < j of sign(yⱼ - yᵢ).
  Var(S) = [n(n - 1)(2n + 5) - Σ tₖ(tₖ - 1)(2tₖ + 5)]/18, where tₖ is the size of each group of tied values.
  z = (S - 1)/√Var(S) if S > 0, (S + 1)/√Var(S) if S < 0. p = 2(1 - Φ(|z|)).
  Google Sheets, one cell: `=SUMPRODUCT((ROW(E4:E543)<TRANSPOSE(ROW(E4:E543)))*SIGN(TRANSPOSE(E4:E543)-E4:E543))`
- **Hamed-Rao correction (the p the verdict uses):** detrend with the Sen slope, rank the result, take the
  autocorrelation of the ranks at lags 1 to 3, keep only lags outside ±1.96/√n, and multiply Var(S) by
  n/n* = 1 + 2/(n(n-1)(n-2)) · Σ (n-k)(n-k-1)(n-k-2)·ρₖ. **Our choice:** n/n* is never allowed below 1.
- **Theil-Sen slope:** median of all pairwise slopes (yⱼ - yᵢ)/(tⱼ - tᵢ); interval from Sen (1968).
- **Verdict rule:** "significant" only if the adjusted t-test **and** the Hamed-Rao Mann-Kendall test both give p < 0.05;
  "mixed evidence" if only one does.

All of these are tested against scipy 1.17.1 and pymannkendall 1.4.3 (`tests/fixtures/stats_reference.json`).

## 4. Please reply with

1. Do numbers 1 to 3 match your own calculation? (yes / no, and your values)
2. Is the n_eff adjustment and the "floor at 1" for Hamed-Rao reasonable for monthly anomalies?
3. Anything in the "How to read this" panel that is wrong or unclear for a high-school student?

Your answer will be described honestly in the submission (what you checked and what you found).
