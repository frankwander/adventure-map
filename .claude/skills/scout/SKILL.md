---
name: scout
description: Find new adventures for kids within 5 miles of Peckham that aren't on the Adventure Map yet, and add them with an AI review. Use when the owner says "scout", "find more adventures", "add more places", or a "[Scout]" issue is open.
---

# Scout

Follow `CLAUDE.md` (research rules, score, locations, publishing).

1. Read `data/places.json`. Note what's already covered (names and types) so you don't repeat it.
2. Decide what to look for: the request's focus if there is one, otherwise the types with the
   fewest entries. Default batch: 10 places.
3. Search the web for candidates within 5 miles of Peckham (Southwark, Lambeth, Lewisham,
   Greenwich and the City side of the river all fall partly inside). Good queries name the
   type and the neighbourhood, e.g. "adventure playground Lewisham", "city farm south east London".
4. For each candidate:
   - skip it if it's already in the data (same place, even under another name);
   - find coordinates from a source that states them; skip it if you can't;
   - research it (at least 2 recent sources) and write the `ai` review and score;
   - add it with `source: "ai"`, `scope: "local"`, the next free `pNNN` id, `type`, `area`.
5. Run `python3 scripts/build.py`. Fix anything it reports.
6. Commit "Scout: add N places (…names…)" and push to `main`.
7. Report: what was added with scores, and candidates skipped and why.
