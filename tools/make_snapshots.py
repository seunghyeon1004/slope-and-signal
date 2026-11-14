# Slope and Signal - saves the exact NASA POWER requests used by the guided
# cases into public/data/snap/, so the cases also work when the API is down.
# Written with Claude (Anthropic). Run: .venv/bin/python tools/make_snapshots.py
import json, os, re, urllib.request

H = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(H, "..", "public", "data", "snap")
CAT = open(os.path.join(H, "..", "src", "data", "catalogue.ts")).read()
IDS = re.findall(r"id: '([A-Z0-9_]+)', name:", CAT)
START, END = 1981, 2025
POINTS = [(37.57, 126.98), (78.22, 15.65), (-70.0, -150.0), (28.61, 77.21), (46.5, 8.0), (-33.5, -71.0)]
REGIONS = [("PRECTOTCORR", -38, -28, -75, -65)]


def js(x):
    return str(int(x)) if float(x).is_integer() else repr(float(x))


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "slope-and-signal-snapshot"})
    return json.load(urllib.request.urlopen(req, timeout=180))


os.makedirs(OUT, exist_ok=True)
for lat, lon in POINTS:
    url = (f"https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={','.join(IDS)}&community=AG"
           f"&longitude={js(lon)}&latitude={js(lat)}&start={START}&end={END}&format=JSON")
    j = get(url)
    assert "properties" in j, j
    fn = os.path.join(OUT, f"{lat:.2f}_{lon:.2f}.json")
    json.dump(j, open(fn, "w"), separators=(",", ":"))
    print(fn, os.path.getsize(fn))
for p, a, b, c, d in REGIONS:
    url = (f"https://power.larc.nasa.gov/api/temporal/monthly/regional?parameters={p}&community=AG"
           f"&latitude-min={js(a)}&latitude-max={js(b)}&longitude-min={js(c)}&longitude-max={js(d)}&start={START}&end={END}&format=JSON")
    j = get(url)
    assert "features" in j, j
    fn = os.path.join(OUT, f"region_{p}_{js(a)}_{js(b)}_{js(c)}_{js(d)}.json")
    json.dump(j, open(fn, "w"), separators=(",", ":"))
    print(fn, os.path.getsize(fn))
print(len(IDS), "parameters:", ",".join(IDS))
