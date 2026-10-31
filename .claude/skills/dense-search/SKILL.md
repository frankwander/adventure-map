---
name: dense-search
description: High Density Search (HDS) — sweep the Adventure Map's 5-mile area square by square and street by street for small, hidden attractions (nature gardens, pocket parks, community gardens, wildlife sites, murals, statues, little libraries). Use when the owner says "dense search", "high density search", "search street by street", "find small places", or a "[Scout]" issue asks for hidden gems or small places.
---

# High Density Search

The normal scout finds famous places. HDS finds the small ones nobody lists in "top 10"
articles, by searching every street. Follow `CLAUDE.md` for research rules, scoring and
publishing; the method and its reasoning are in `docs/high-density-search.md`.

## The grid
`data/hds/cells.json` splits the area into 864 squares of 500 m (about a 6-minute walk
across), nearest to Peckham first. Each square lists every named street in it and its
postcode sectors, from the ONS Postcode Directory and OS Open Names (`data/hds/gazetteer.json.gz`).

## One run
1. `python3 scripts/hds.py status`, then `python3 scripts/hds.py next 5` for the next squares
   and their ready-made queries (every street, four per query, plus the main postcode sectors).
   Budget about 6–8 searches per square.
2. Run each query with web search. From the results, note every **public, free-to-visit,
   kid-worthy** small place: nature gardens and reserves, community gardens, pocket parks,
   orchards, ponds, wildlife areas, adventure playgrounds, murals and street art, statues and
   sculptures, little free libraries, curious landmarks. Skip private gardens (unless they
   open regularly), shops, cafés, schools and places only open one day a year.
   A street query often surfaces neighbours (another garden one street over): keep those too.
3. **Resolve the address.** Find a postcode or street in the sources, then
   `python3 scripts/hds.py geocode "SE15 4EE"` (postcode, best) or
   `python3 scripts/hds.py geocode "Costa Street, SE15"` (street centre). Use a source's own
   coordinates if it gives them. Write how you located it in `locationNote`.
4. **Verify.** With 2 or more real sources, add the place (`source: "ai"`) with an `ai`
   review as in `CLAUDE.md`; small places usually score 4–7. With only 1 source, or doubts
   about whether it still exists or is public, record a lead instead:
   `python3 scripts/hds.py lead "Name" LAT LON URL "what's uncertain"`.
   Check `data/hds/leads.json` first: a new source may confirm an old lead (then add the
   place and delete the lead).
5. Mark each square: `python3 scripts/hds.py done CELL QUERIES pNNN pNNN…` (the ids added or
   confirmed there; none is fine: an empty square is still progress).
6. `python3 scripts/build.py`, then commit `data/` and `data.js`:
   "HDS: N squares, added …". Report squares searched, places added, leads recorded.

## Directory sweep (once in a while)
Some lists document small places directly. When a run has spare searches, work through one
and treat each entry as a candidate (then steps 3–4): see `docs/high-density-search.md`.
