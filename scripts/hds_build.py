#!/usr/bin/env python3
"""Build the High Density Search grid and gazetteer for the 5-mile area around Peckham.

  python3 scripts/hds_build.py path/to/uk-address.json.gz

Input: the ONSPD + OS Open Names bundle from the npm package `uk-address-lookup`
(data/uk-address.json.gz inside it; both datasets are Open Government Licence v3.0).
Outputs:
  data/hds/gazetteer.json.gz  postcodes (lat/lon + street names) and streets (lat/lon) in the area
  data/hds/cells.json         500 m search cells with their streets and postcode sectors
An existing cells.json keeps each cell's search status and finds.
"""
import gzip, json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "hds")
PECKHAM = (51.4734, -0.0690)
RADIUS_KM = 8.05
CELL_M = 500
DLAT = CELL_M / 111320.0
DLON = CELL_M / (111320.0 * math.cos(math.radians(PECKHAM[0])))


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def bng_to_wgs84(E, N):
    """OSGB36 grid reference -> WGS84 lat/lon (Ordnance Survey formulae + Helmert)."""
    a, b = 6377563.396, 6356256.909; F0 = 0.9996012717
    lat0, lon0 = math.radians(49), math.radians(-2); N0, E0 = -100000, 400000
    e2 = 1 - (b * b) / (a * a); n = (a - b) / (a + b); lat = lat0; M = 0
    while True:
        lat = (N - N0 - M) / (a * F0) + lat
        Ma = (1 + n + 1.25 * n**2 + 1.25 * n**3) * (lat - lat0)
        Mb = (3 * n + 3 * n**2 + 21 / 8 * n**3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        Mc = (15 / 8 * n**2 + 15 / 8 * n**3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        Md = 35 / 24 * n**3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)
        if abs(N - N0 - M) < 1e-5: break
    s = math.sin(lat); nu = a * F0 / math.sqrt(1 - e2 * s * s); rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5
    eta2 = nu / rho - 1; t = math.tan(lat); sec = 1 / math.cos(lat); dE = E - E0
    phi = lat - t / (2 * rho * nu) * dE**2 + t / (24 * rho * nu**3) * (5 + 3 * t * t + eta2 - 9 * t * t * eta2) * dE**4 - t / (720 * rho * nu**5) * (61 + 90 * t * t + 45 * t**4) * dE**6
    lam = lon0 + sec / nu * dE - sec / (6 * nu**3) * (nu / rho + 2 * t * t) * dE**3 + sec / (120 * nu**5) * (5 + 28 * t * t + 24 * t**4) * dE**5 - sec / (5040 * nu**7) * (61 + 662 * t * t + 1320 * t**4 + 720 * t**6) * dE**7
    sp, cp, sl, cl = math.sin(phi), math.cos(phi), math.sin(lam), math.cos(lam)
    nu = a / math.sqrt(1 - e2 * sp * sp); x = nu * cp * cl; y = nu * cp * sl; z = (1 - e2) * nu * sp
    tx, ty, tz, s_ = 446.448, -125.157, 542.060, -20.4894e-6
    rx, ry, rz = [math.radians(v / 3600) for v in (0.1502, 0.2470, 0.8421)]
    x2 = tx + (1 + s_) * x - rz * y + ry * z; y2 = ty + rz * x + (1 + s_) * y - rx * z; z2 = tz - ry * x + rx * y + (1 + s_) * z
    a2, b2 = 6378137.0, 6356752.3142; e22 = 1 - (b2 * b2) / (a2 * a2); p = math.hypot(x2, y2); phi = math.atan2(z2, p * (1 - e22))
    for _ in range(10):
        nu = a2 / math.sqrt(1 - e22 * math.sin(phi) ** 2); phi = math.atan2(z2 + e22 * nu * math.sin(phi), p)
    return math.degrees(phi), math.degrees(math.atan2(y2, x2))


def cell_of(lat, lon):
    return int(math.floor((lon - PECKHAM[1]) / DLON + 0.5)), int(math.floor((lat - PECKHAM[0]) / DLAT + 0.5))


def main():
    src = json.load(gzip.open(sys.argv[1]))
    dist = src["districts"]
    margin = RADIUS_KM + 0.6
    # streets: [name, town, district, region, country, E, N]
    streets = []
    for s in src["streets"]:
        if not (520000 < s[5] < 548000 and 165000 < s[6] < 188000):
            continue
        lat, lon = bng_to_wgs84(s[5], s[6])
        if km(PECKHAM, (lat, lon)) <= margin:
            streets.append([s[0], dist[s[2]], round(lat, 5), round(lon, 5)])
    keep_idx = {}
    postcodes = []
    for p in src["postcodes"]:
        if abs(p[1] - PECKHAM[0]) > 0.09 or abs(p[2] - PECKHAM[1]) > 0.15:
            continue
        if km(PECKHAM, (p[1], p[2])) <= margin:
            postcodes.append([p[0], round(p[1], 5), round(p[2], 5), sorted({src["streets"][i][0] for i in p[3]})])
    gaz = {"source": "ONS Postcode Directory (Feb 2026) and OS Open Names (Apr 2026), Open Government Licence v3.0, via npm uk-address-lookup",
           "postcodes": postcodes, "streets": streets}
    os.makedirs(OUT, exist_ok=True)
    with gzip.open(os.path.join(OUT, "gazetteer.json.gz"), "wt", encoding="utf-8") as f:
        json.dump(gaz, f, separators=(",", ":"))
    # cells
    old = {}
    cp = os.path.join(OUT, "cells.json")
    if os.path.exists(cp):
        old = {c["id"]: c for c in json.load(open(cp))["cells"]}
    cells = {}
    for name, district, lat, lon in streets:
        x, y = cell_of(lat, lon)
        cells.setdefault((x, y), {"streets": set(), "sectors": {}})["streets"].add(f"{name}, {district}")
    for pc, lat, lon, _ in postcodes:
        x, y = cell_of(lat, lon)
        sec = cells.setdefault((x, y), {"streets": set(), "sectors": {}})["sectors"]
        sec[pc[:-2].strip()] = sec.get(pc[:-2].strip(), 0) + 1
    out = []
    for (x, y), v in cells.items():
        clat, clon = PECKHAM[0] + y * DLAT, PECKHAM[1] + x * DLON
        d = km(PECKHAM, (clat, clon))
        if d > RADIUS_KM + 0.25:
            continue
        cid = f"x{x:+d}y{y:+d}"
        c = {"id": cid, "lat": round(clat, 5), "lon": round(clon, 5), "km": round(d, 2),
             "streets": sorted(v["streets"]), "sectors": sorted(v["sectors"], key=lambda k: -v["sectors"][k]),  # most postcodes first
             "status": "pending", "searchedAt": None, "queries": 0, "finds": []}
        if cid in old:
            for k in ("status", "searchedAt", "queries", "finds"):
                c[k] = old[cid].get(k, c[k])
        out.append(c)
    out.sort(key=lambda c: c["km"])
    json.dump({"cellMeters": CELL_M, "centre": PECKHAM, "radiusKm": RADIUS_KM, "cells": out},
              open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(postcodes)} postcodes, {len(streets)} streets, {len(out)} cells "
          f"({sum(1 for c in out if c['status'] != 'pending')} already searched)")


if __name__ == "__main__":
    main()
