#!/usr/bin/env python3
"""Turn an "[Add]" issue-form body into a new place in data/places.json.

Reads the issue body from the ISSUE_BODY environment variable (never from argv, so
nothing in it is interpreted by the shell). Prints a one-line result for the issue comment.
Places without coordinates are not added: the scheduled Claude run geocodes them.
"""
import datetime, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "places.json")
TYPES = {"playground": "playground", "park": "park", "nature": "nature", "city farm": "farm", "museum": "museum",
         "splash & swim": "water", "landmark": "landmark", "activity": "activity", "library": "library"}
PECKHAM, RADIUS_KM = (51.4734, -0.0690), 8.05


def fields(body):
    out, key = {}, None
    for line in body.replace("\r", "").split("\n"):
        m = re.match(r"^### (.+)$", line.strip())
        if m:
            key = m.group(1).strip().lower(); out[key] = []
        elif key is not None:
            out[key].append(line)
    clean = {}
    for k, v in out.items():
        t = "\n".join(v).strip()
        clean[k] = "" if t == "_No response_" else t[:600]
    return clean


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def ages_of(text):
    m = re.search(r"(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})", text or "")
    return [int(m.group(1)), int(m.group(2))] if m and int(m.group(1)) <= int(m.group(2)) <= 18 else None


def main():
    f = fields(os.environ.get("ISSUE_BODY", ""))
    name = f.get("name", "").strip()
    if not name:
        print("NOT ADDED: the form has no name."); sys.exit(2)
    try:
        lat, lon = float(f.get("latitude", "")), float(f.get("longitude", ""))
    except ValueError:
        print("WAITING: no map pin, so Claude will find the location from the address on its next run."); sys.exit(3)
    if not (49 < lat < 61 and -9 < lon < 3):
        print("NOT ADDED: those coordinates aren't in the UK."); sys.exit(2)
    data = json.load(open(SRC, encoding="utf-8"))
    places = data["places"]
    n = max(int(p["id"][1:]) for p in places if re.match(r"^p\d+$", p["id"])) + 1
    p = {"id": f"p{n:03d}", "name": name, "lat": round(lat, 5), "lon": round(lon, 5),
         "type": TYPES.get(f.get("type", "").lower(), "playground"),
         "area": f.get("address or directions", "") or "London",
         "scope": "local" if km(PECKHAM, (lat, lon)) <= RADIUS_KM else "far",
         "source": "you", "added": {"date": datetime.date.today().isoformat(), "issue": int(os.environ.get("ISSUE_NUMBER", "0") or 0)}}
    if f.get("what makes it good"): p["standout"] = f["what makes it good"]
    if f.get("ages it suits"):
        p["age"] = f["ages it suits"]
        if ages_of(f["ages it suits"]): p["ages"] = ages_of(f["ages it suits"])
    if f.get("website", "").startswith("http"): p["link"] = f["website"]
    places.append(p)
    json.dump(data, open(SRC, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ADDED: {name} is on the map as {p['id']}" + (" (outside the 5-mile area, so under “further afield”)" if p["scope"] == "far" else "") + ". Claude will review it on its next run.")


if __name__ == "__main__":
    main()
