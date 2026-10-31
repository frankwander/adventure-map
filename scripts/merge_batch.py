#!/usr/bin/env python3
"""Merge scout/review batch files into data/places.json.

  python3 scripts/merge_batch.py new  batch.json [more.json …]   # new places (from scouting)
  python3 scripts/merge_batch.py ai   batch.json [more.json …]   # [{"id": …, "ai": {…}}] reviews

New places get the next free ids, are skipped if they duplicate an existing place (same
normalised name within 400 m, or any place within 60 m with an overlapping name), and are
otherwise appended. Run scripts/build.py afterwards to validate and regenerate data.js.
"""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "places.json")
KEEP = ("name", "lat", "lon", "type", "area", "scope", "source", "locationNote", "link", "ai")


def norm(s):
    s = s.lower().replace("&", "and").replace("’", "'")
    s = re.sub(r"\b(the|playground|play area|park|gardens?|adventure|london)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def m(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))


def is_dupe(c, places):
    for p in places:
        d = m(c, p)
        a, b = norm(c["name"]), norm(p["name"])
        if a and a == b and d < 400:
            return p
        if d < 60 and a and b and (a in b or b in a):
            return p
    return None


def main():
    mode, files = sys.argv[1], sys.argv[2:]
    data = json.load(open(SRC, encoding="utf-8"))
    places = data["places"]
    by_id = {p["id"]: p for p in places}
    nxt = max(int(p["id"][1:]) for p in places if re.match(r"^p\d+$", p["id"])) + 1
    added, skipped, reviewed = [], [], []
    for f in files:
        for c in json.load(open(f, encoding="utf-8")):
            if mode == "ai":
                p = by_id.get(c.get("id"))
                if not p:
                    skipped.append((c.get("id"), "unknown id")); continue
                p["ai"] = c["ai"]; reviewed.append(p["name"])
                continue
            try:
                c["lat"], c["lon"] = round(float(c["lat"]), 5), round(float(c["lon"]), 5)
            except (KeyError, TypeError, ValueError):
                skipped.append((c.get("name"), "no coordinates")); continue
            d = is_dupe(c, places)
            if d:
                skipped.append((c["name"], f"duplicate of {d['name']} ({d['id']})")); continue
            p = {"id": f"p{nxt:03d}"}
            nxt += 1
            for k in KEEP:
                if c.get(k) not in (None, "", []):
                    p[k] = c[k]
            p.setdefault("scope", "local"); p.setdefault("source", "ai")
            places.append(p); added.append(f"{p['id']} {p['name']}")
    json.dump(data, open(SRC, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for a in added: print("added", a)
    for r in reviewed: print("reviewed", r)
    for s in skipped: print("skipped", s[0], "-", s[1])


if __name__ == "__main__":
    main()
