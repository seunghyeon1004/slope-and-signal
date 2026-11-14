# Slope and Signal - reference fixture generator.
# Written with the help of Claude (Anthropic) under the team's direction.
#
# Produces tests/fixtures/stats_reference.json with values computed by scipy,
# numpy and pymannkendall. The TypeScript statistics in src/stats are tested
# against this file. Run:  .venv/bin/python tools/make_fixtures.py
import json
import math
import os

import numpy as np
import pymannkendall as mk
from scipy import stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "tests", "fixtures", "stats_reference.json")
HR_LAG = 3  # first 3 lags, as proposed by Hamed and Rao (1998)
RAW = os.path.join(HERE, "..", "tests", "fixtures", "power_seoul_raw.json")


def find_repeats(a):
    vals, counts = np.unique(np.asarray(a, float), return_counts=True)
    return counts[counts > 1]


def ols_block(t, y):
    t = np.asarray(t, float)
    y = np.asarray(y, float)
    n = len(y)
    res = stats.linregress(t, y)
    resid = y - (res.intercept + res.slope * t)
    r1 = float(np.sum(resid[:-1] * resid[1:]) / np.sum(resid * resid))
    neff = n * (1 - r1) / (1 + r1) if r1 > 0 else float(n)
    neff = min(neff, n)
    df = n - 2
    tcrit = stats.t.ppf(0.975, df)
    out = {
        "slope": res.slope,
        "intercept": res.intercept,
        "se": res.stderr,
        "t": res.slope / res.stderr,
        "p": res.pvalue,
        "ci_low": res.slope - tcrit * res.stderr,
        "ci_high": res.slope + tcrit * res.stderr,
        "r2": res.rvalue ** 2,
        "lag1": r1,
        "neff": neff,
    }
    if neff > 3:
        df_adj = neff - 2
        se_adj = res.stderr * math.sqrt((n - 2) / df_adj)
        t_adj = res.slope / se_adj
        out.update({
            "se_adj": se_adj,
            "df_adj": df_adj,
            "t_adj": t_adj,
            "p_adj": 2 * stats.t.sf(abs(t_adj), df_adj),
            "ci_low_adj": res.slope - stats.t.ppf(0.975, df_adj) * se_adj,
            "ci_high_adj": res.slope + stats.t.ppf(0.975, df_adj) * se_adj,
        })
    return out


def mk_block(t, y):
    y = np.asarray(y, float)
    o = mk.original_test(y)
    h = mk.hamed_rao_modification_test(y, lag=HR_LAG)
    ts = stats.theilslopes(y, np.asarray(t, float), alpha=0.95)
    # Theil-Sen CI with the Hamed-Rao corrected variance of S (our documented
    # extension): the same Sen (1968) index rule with var_s scaled by n/n*.
    slopes = []
    tt = np.asarray(t, float)
    for i in range(len(y)):
        for j in range(i + 1, len(y)):
            if tt[j] != tt[i]:
                slopes.append((y[j] - y[i]) / (tt[j] - tt[i]))
    slopes = np.sort(np.asarray(slopes))
    nt = len(slopes)
    z = stats.norm.ppf(0.025)
    # App policy: the correction may only make the test MORE cautious, so the
    # variance factor n/n* is floored at 1 (pymannkendall can return n/n* < 1,
    # even negative, for short series with negative autocorrelation).
    nns = h.var_s / o.var_s
    var_c = o.var_s * max(1.0, nns)
    zc = 0.0 if o.s == 0 else (o.s - np.sign(o.s)) / math.sqrt(var_c)
    pc = 2 * stats.norm.sf(abs(zc))
    sigma = math.sqrt(var_c)
    ru = min(int(np.round((nt - z * sigma) / 2.0)), nt - 1)
    rl = max(int(np.round((nt + z * sigma) / 2.0)) - 1, 0)
    return {
        "s": o.s,
        "var_s": o.var_s,
        "z": o.z,
        "p": o.p,
        "tau": o.Tau,
        "hr_var_s": h.var_s,
        "hr_nns": nns,
        "hrc_var_s": var_c,
        "hrc_z": zc,
        "hrc_p": pc,
        "hr_z": h.z,
        "hr_p": h.p,
        "sen_slope": ts.slope,
        "sen_intercept": ts.intercept,
        "sen_low": ts.low_slope,
        "sen_high": ts.high_slope,
        "sen_low_hr": slopes[rl],
        "sen_high_hr": slopes[ru],
        "pmk_sen_per_index": o.slope,
    }


def clean(o):
    """Replace NaN/inf (invalid JSON) by None, convert numpy scalars."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return f if math.isfinite(f) else None
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def case(name, t, y):
    return {"name": name, "t": list(map(float, t)), "y": list(map(float, y)),
            "ols": ols_block(t, y), "mk": mk_block(t, y)}


def main():
    rng = np.random.default_rng(20261114)
    cases = []
    # 1. white noise + trend, annual
    t = np.arange(1981, 2025)
    cases.append(case("annual_trend_noise", t, 0.03 * (t - 1981) + rng.normal(0, 0.4, len(t))))
    # 2. pure noise, no trend
    cases.append(case("annual_no_trend", t, rng.normal(10, 1, len(t))))
    # 3. AR(1) phi=0.6 monthly anomalies with small trend
    n = 360
    e = np.zeros(n)
    for i in range(1, n):
        e[i] = 0.6 * e[i - 1] + rng.normal(0, 0.5)
    tm = 1990 + (np.arange(n) + 0.5) / 12
    cases.append(case("monthly_ar1_trend", tm, 0.02 * (tm - 1990) + e))
    # 4. ties (rounded to 1 decimal), decreasing
    y = np.round(5 - 0.05 * (t - 1981) + rng.normal(0, 0.5, len(t)), 1)
    cases.append(case("annual_ties_decreasing", t, y))
    # 5. short series
    t5 = np.arange(2010, 2022)
    cases.append(case("short_12", t5, [3.1, 2.9, 3.4, 3.3, 3.8, 3.5, 3.9, 4.2, 3.7, 4.4, 4.1, 4.6]))
    # 6. real NASA POWER data: Seoul area T2M monthly anomalies 1981-2024
    raw = json.load(open(RAW))
    ser = raw["properties"]["parameter"]["T2M"]
    vals = {}
    for k, v in ser.items():
        yy, mm = int(k[:4]), int(k[4:])
        if mm <= 12 and v != -999:
            vals[(yy, mm)] = v
    clim = {m: np.mean([v for (yy, mm), v in vals.items() if mm == m]) for m in range(1, 13)}
    keys = sorted(vals)
    tr = [yy + (mm - 0.5) / 12 for yy, mm in keys]
    # rounded to 6 decimals exactly like the app (src/data/series.ts r6) so ties are well defined
    an = [round(vals[k] - clim[k[1]], 6) for k in keys]
    c6 = case("power_seoul_t2m_anomaly", tr, an)
    c6["clim"] = [clim[m] for m in range(1, 13)]
    cases.append(c6)
    # 7. real annual (month 13) values
    ta = sorted(int(k[:4]) for k in ser if k.endswith("13"))
    ya = [ser[f"{yy}13"] for yy in ta]
    cases.append(case("power_seoul_t2m_annual", ta, ya))

    dist = {
        "t_cdf": [[x, df, float(stats.t.cdf(x, df))] for x in (-3.5, -1.2, 0.0, 0.7, 2.1, 4.0) for df in (1, 3, 10.5, 42, 538)],
        "t_ppf": [[p, df, float(stats.t.ppf(p, df))] for p in (0.025, 0.5, 0.9, 0.975, 0.995) for df in (2, 5, 17.3, 100)],
        "norm_cdf": [[x, float(stats.norm.cdf(x))] for x in (-8, -3.2, -1.96, -0.5, 0, 0.3, 1.0, 2.5, 6)],
        "norm_ppf": [[p, float(stats.norm.ppf(p))] for p in (1e-9, 0.001, 0.025, 0.2, 0.5, 0.8, 0.975, 0.999999)],
    }
    json.dump(clean({"generator": "tools/make_fixtures.py", "hr_lag": HR_LAG, "scipy": __import__("scipy").__version__,
               "numpy": np.__version__, "pymannkendall": mk.__version__,
               "cases": cases, "dist": dist}), open(OUT, "w"), indent=1, allow_nan=False)
    print("wrote", OUT, len(cases), "cases")


if __name__ == "__main__":
    main()
