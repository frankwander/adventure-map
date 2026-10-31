---
name: review
description: Write or refresh AI reviews and Adventure Scores for places on the Adventure Map from recent public web sources. Use when the owner says "review", "score the places", "update reviews", or a "[Review]" issue is open.
---

# Review

Follow `CLAUDE.md` (research rules, score, publishing).

1. Read `data/places.json`. Choose the places to review:
   - the ones named in the request, or
   - otherwise local places with no `ai` review (newest first: `source` `you`, then `ai`, then
     `council`), then the oldest `ai.reviewedAt`. Default batch: 10 places.
2. For each place, search for recent write-ups (at least 2 sources; include the council page
   for council parks). Look for: what's there, ages, facilities, recent refurbishments or
   problems, anything special.
3. Write the `ai` object exactly as in `CLAUDE.md`, in your own words, with the score from
   the rubric. If you can't find 2 real sources, don't review it: report it instead.
4. Never change the owner's own `review`, `standout` or `age` fields.
5. Run `python3 scripts/build.py`, commit "Review: N places (…)" and push to `main`.
6. Report the places reviewed with their scores, and any you couldn't review and why.
