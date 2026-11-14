# Slope and Signal - converts Natural Earth (public domain) land polygons into
# compact rings for the app. Written with Claude (Anthropic).
import json, os
H = os.path.dirname(os.path.abspath(__file__))
def rings(path, nd):
    out = []
    for f in json.load(open(path))["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for p in polys:
            for r in p:
                rr = []
                for x, y in r:
                    pt = [round(x, nd), round(y, nd)]
                    if not rr or rr[-1] != pt:
                        rr.append(pt)
                if len(rr) > 3:
                    out.append(rr)
    return out
r110 = rings(os.path.join(H, "ne", "ne_110m_land.geojson"), 1)
r50 = rings(os.path.join(H, "ne", "ne_50m_land.geojson"), 2)
json.dump(r110, open(os.path.join(H, "..", "src", "data", "land110.json"), "w"), separators=(",", ":"))
json.dump(r50, open(os.path.join(H, "..", "public", "data", "land50.json"), "w"), separators=(",", ":"))
print(len(r110), len(r50))
