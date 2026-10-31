#!/usr/bin/env python3
"""High Density Search (HDS): sweep the 5-mile area around Peckham square by square,
street by street, for small attractions (nature gardens, pocket parks, community gardens,
wildlife sites, murals, statues, little libraries…).

Commands
  python3 scripts/hds.py next [N]                  the next N unsearched cells (nearest first) with their search queries
  python3 scripts/hds.py geocode "SE15 4EE"         postcode -> lat/lon and streets
  python3 scripts/hds.py geocode "Costa Street, SE15" street (with district) -> lat/lon
  python3 scripts/hds.py cell LAT LON               which cell a point is in
  python3 scripts/hds.py done CELL QUERIES [pNNN …] mark a cell searched, with how many queries and the places found
  python3 scripts/hds.py lead NAME LAT LON URL NOTE record a single-source find to confirm later
  python3 scripts/hds.py status                     coverage so far

Data: data/hds/cells.json (grid + progress), data/hds/leads.json (unconfirmed finds),
data/hds/gazetteer.json.gz (ONSPD + OS Open Names, Open Government Licence v3.0).
"""
import datetime, gzip, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HDS = os.path.join(ROOT, "data", "hds")
CELLS = os.path.join(HDS, "cells.json")
LEADS = os.path.join(HDS, "leads.json")
GAZ = os.path.join(HDS, "gazetteer.json.gz")

# Words that surface small, public, kid-worthy places. Kept short so each query stays focused.
KINDS = ["garden", "nature", "wildlife", "pocket park", "playground", "mural", "statue", "community"]
ROAD_NUMBER = re.compile(r"^[ABM]\d+(\(M\))?$")


def load(path, default):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


def save(path, data):
    json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def queries_for(cell):
    """Street sweep: every named street in the cell, 4 per query, plus one query per postcode sector."""
    names = [s.split(",")[0] for s in cell["streets"] if not ROAD_NUMBER.match(s.split(",")[0])]
    district = cell["streets"][0].split(", ")[-1] if cell["streets"] else ""
    qs = []
    for i in range(0, len(names), 4):
        group = " OR ".join(f'"{n}"' for n in names[i:i + 4])
        qs.append(f"{group} {district} garden OR nature OR wildlife OR park OR mural OR statue")
    for sec in cell["sectors"][:2]:
        qs.append(f'"{sec}" community garden OR nature garden OR pocket park OR wildlife area')
    return qs


def cmd_next(n=5):
    data = load(CELLS, None)
    todo = [c for c in data["cells"] if c["status"] == "pending"][: int(n)]
    for c in todo:
        print(f"\n## Cell {c['id']}  ({c['km']} km from Peckham, centre {c['lat']}, {c['lon']})")
        print(f"Sectors: {', '.join(c['sectors']) or '-'}")
        print(f"Streets ({len(c['streets'])}): {'; '.join(s.split(',')[0] for s in c['streets'])}")
        print("Queries:")
        for q in queries_for(c):
            print("  -", q)
    left = sum(1 for c in data["cells"] if c["status"] == "pending")
    print(f"\n{left} cells still pending.")


def gazetteer():
    return json.load(gzip.open(GAZ, "rt", encoding="utf-8"))


def cmd_geocode(text):
    g = gazetteer()
    t = text.strip().upper().replace("  ", " ")
    m = re.match(r"^([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})$", t)
    if m:
        pc = f"{m.group(1)} {m.group(2)}"
        for p in g["postcodes"]:
            if p[0] == pc:
                print(json.dumps({"query": pc, "lat": p[1], "lon": p[2], "streets": p[3], "precision": "postcode (about 15 households)"}))
                return
        print(json.dumps({"query": pc, "error": "postcode not in the 5-mile gazetteer"})); sys.exit(1)
    parts = [x.strip() for x in text.split(",")]
    name, district = parts[0].lower(), (parts[1].upper() if len(parts) > 1 else None)
    hits = [s for s in g["streets"] if s[0].lower() == name and (district is None or s[1] == district)]
    if not hits:
        hits = [s for s in g["streets"] if s[0].lower().startswith(name) and (district is None or s[1] == district)]
    if not hits:
        print(json.dumps({"query": text, "error": "street not found; add the postal district, e.g. 'Costa Street, SE15'"})); sys.exit(1)
    out = [{"street": s[0], "district": s[1], "lat": s[2], "lon": s[3], "precision": "street centre"} for s in hits[:5]]
    print(json.dumps({"query": text, "matches": out}, ensure_ascii=False))


def cell_id(lat, lon):
    data = load(CELLS, None)
    best = min(data["cells"], key=lambda c: km((lat, lon), (c["lat"], c["lon"])))
    return best["id"]


def cmd_done(cid, queries, *found):
    data = load(CELLS, None)
    for c in data["cells"]:
        if c["id"] == cid:
            c["status"] = "searched"; c["searchedAt"] = datetime.date.today().isoformat()
            c["queries"] = int(queries); c["finds"] = sorted(set(c.get("finds", [])) | set(found))
            save(CELLS, data); print(f"{cid} marked searched ({queries} queries, {len(c['finds'])} finds)"); return
    print(f"no cell {cid}"); sys.exit(1)


def cmd_lead(name, lat, lon, url, note=""):
    leads = load(LEADS, {"leads": []})
    leads["leads"].append({"name": name, "lat": float(lat), "lon": float(lon), "cell": cell_id(float(lat), float(lon)),
                           "url": url, "note": note, "found": datetime.date.today().isoformat()})
    save(LEADS, leads); print(f"lead recorded: {name}")


def cmd_status():
    data = load(CELLS, None); cells = data["cells"]
    done = [c for c in cells if c["status"] != "pending"]
    rings = [(1, "1 km"), (2, "2 km"), (4, "4 km"), (8.3, "5 miles")]
    for r, label in rings:
        inside = [c for c in cells if c["km"] <= r]
        print(f"within {label}: {sum(1 for c in inside if c['status'] != 'pending')}/{len(inside)} cells searched")
    print(f"queries used: {sum(c.get('queries', 0) for c in done)}; places found: {sum(len(c.get('finds', [])) for c in done)}; "
          f"open leads: {len(load(LEADS, {'leads': []})['leads'])}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(0)
    {"next": lambda: cmd_next(*a[1:2]), "geocode": lambda: cmd_geocode(" ".join(a[1:])),
     "cell": lambda: print(cell_id(float(a[1]), float(a[2]))), "done": lambda: cmd_done(*a[1:]),
     "lead": lambda: cmd_lead(*a[1:]), "status": cmd_status}[a[0]]()
