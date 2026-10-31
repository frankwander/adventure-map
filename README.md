# Adventure Map

Kids' adventures within 5 miles of Peckham: playgrounds, parks, farms, nature, museums and
hidden gems. Live at https://frankwander.github.io/adventure-map/

A static site (plain HTML, CSS and JavaScript, no server) with four pages:

- **Next 10** (`/`): pick a starting point and your kids' ages, and get a list of up to 10
  places you haven't been to yet. Up to 6 are within a 30-minute walk, best and nearest
  first; up to 4 are the best-rated places further out. Tick them off, swap them, add notes,
  and share or print the list.
- **Near me** (`/near/`): the 5 closest places on an OpenStreetMap map.
- **All places** (`/list/`): everything, with search, type and age filters, and sort by
  distance or score.
- **Add & ask** (`/add/`): add a place, or ask Claude to scout or review.

## How the map grows

| Feature | How it works |
|---|---|
| **Add** | The form opens a pre-filled GitHub issue (`[Add] …`). The `add-adventure` Action adds it to `data/places.json` within a minute. It only acts on issues opened by the repo owner. If you gave no map pin, Claude finds the location on its next run. |
| **Scout** | `[Scout] …` issues, or saying "scout" in a Claude Code session on this repo. Claude searches the web for new places within 5 miles of Peckham and adds them with an AI review. |
| **Review** | `[Review] …` issues, or saying "review". Claude writes an AI review with an Adventure Score out of 10 from recent public sources. |
| **High density search** | Claude sweeps the area in 500 m squares, searching every street, to find small places like nature gardens, pocket parks and murals. See `docs/high-density-search.md`; the Map page can show which squares are done. |

A scheduled Claude run processes open requests once a day, and also scouts and reviews a
small batch on its own. The rules Claude follows are in `CLAUDE.md`; the steps are in
`.claude/skills/scout` and `.claude/skills/review`.

**About AI reviews.** They are written by Claude from recent public web sources (council
pages, local news, parent blogs, listings), in its own words, with links to those sources.
They are not visits, and they don't use Google Maps reviews or photos, which can't be accessed
here and which Google's terms don't allow copying.

## Data

- `data/places.json` is the source of truth. `data.js` is generated from it:
  `python3 scripts/build.py` validates the data (fields, the 5-mile area, duplicates, at
  least 2 sources per AI review) and rewrites `data.js`. CI runs `build.py --check`.
- Southwark park playgrounds come from Southwark Council's play-area list. Their British
  National Grid references were converted to latitude and longitude.
- Everything a visitor does (location, ticks, notes, target) stays in their own browser.

Walking times are estimates: straight-line distance plus 30%, at 80 m a minute.

Postcode and street data (`data/hds/gazetteer.json.gz`): contains OS data © Crown copyright and
database right 2026; Royal Mail data © Royal Mail copyright and database right 2026; National
Statistics data © Crown copyright and database right 2026 (Open Government Licence v3.0).
