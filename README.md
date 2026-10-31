# Adventure Map

A small static site that helps parents pick their next playground: a hand-picked
**Next 10** list, a **Near me** map, and a table of **All places**. It is plain HTML, CSS
and JavaScript, with no build step and no server.

- `index.html`: Next 10. Pick a starting point and the kids' ages. The page suggests
  up to 6 unvisited park playgrounds within about 3.5 km plus up to 4 of our picks, and
  counts new places visited this month against a target.
- `near/`: the 5 closest places, shown on an OpenStreetMap map (Leaflet 1.9.4,
  stored in `vendor/`).
- `list/`: every place, with search, filter and sort. You can also export notes here.
- `data.js`: all places. Park playgrounds are Southwark Council's 59 park play areas.
  Their British National Grid references were converted to latitude/longitude, so the
  markers sit on the real sites. Our picks come from our own Google Maps reviews.
- `assets/app.js`, `assets/style.css`: shared code and styles.

Everything a visitor does (their location, ticks, notes, target) stays in their own
browser's `localStorage`. Nothing is sent anywhere.

## Adding a review

1. After a visit, tap **Add notes** on the card (ages, the one standout thing, extras).
2. On **All places**, tap **Export my notes** and copy the JSON.
3. Add those fields (`age`, `ages: [min, max]`, `standout`, `extras`) to that place in
   `data.js` so everyone sees them.

## Walking times

Walking times are estimates: straight-line distance plus 30% for streets, at 80 m a
minute. Over 30 minutes, the page shows kilometres instead.
