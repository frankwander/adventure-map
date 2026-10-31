# High Density Search (HDS)

How the Adventure Map finds small, nearby attractions: the wildlife garden round the
corner, a community garden behind a school, a sculpture on a street corner.

## Why the normal scout misses them
Searches like "best playgrounds south London" return lists of famous places. Small places
rarely appear in those lists. They are documented instead in council tables, conservation
inventories, walking-route leaflets and local news, and those pages are found by searching
for **the street they're on**, not for "attractions".

## The method
1. **Grid.** The 5-mile circle around Peckham is split into 864 squares of 500 m. Every named
   street (OS Open Names) and postcode (ONS Postcode Directory) is assigned to its square.
   About 11 streets per square on average.
2. **Street sweep.** For each square, nearest first, search every street name, four streets per
   query, together with words that surface small places (garden, nature, wildlife, park, mural,
   statue). Then search the square's main postcode sectors ("SE15 4") with community garden,
   nature garden, pocket park and wildlife area.
3. **Address resolution.** Each find's postcode or street is turned into coordinates offline from
   the gazetteer: about 15 households of precision for a postcode. No web geocoding needed.
4. **Verification.** Two independent sources → added to the map with an AI review. One source
   or doubt about access → a lead in `data/hds/leads.json`, rechecked on later runs.
5. **Coverage.** Each square records when it was searched, how many queries it took and what it
   found. The Map page can show searched squares, so progress is visible.

## The pilot (31 Oct 2026)
One square around Costa Street, Peckham (`x+0y-1`), four searches:
- found **McDermott Community Gardens** (via "Costa Street") and the **Centre for Wildlife
  Gardening** (via the "SE15 4" sector query), the two examples it was designed to catch;
- also found Holly Grove Shrubbery, Gormley's Bellenden Road bollards, Bellenden Road Nature
  Garden, Kirkwood Road Nature Garden and Choumert Square (the last three recorded as leads).

## Cost
About 6–8 searches per square. The 2 km around Peckham (49 squares) is roughly 350 searches;
the whole area (864 squares) is roughly 6,000. With about 200 searches per run, the inner ring
takes 2 runs and the full area several weeks of nightly runs, nearest squares first.

## Directories worth sweeping
Lists that document small places directly. Each entry is a candidate for steps 3–4.
- **Southwark Council: Other parks and gardens**, a table of small parks and gardens with locations:
  https://services.southwark.gov.uk/parks-and-open-spaces/parks/other-parks-and-gardens?chapter=6
- **London Gardens Trust inventory**: a record for each historic or community garden by borough
  (e.g. SOU039 Holly Grove Shrubbery): https://londongardenstrust.org/conservation/inventory/
- **Southwark SINC citations**: every Site of Importance for Nature Conservation, with descriptions:
  https://services.southwark.gov.uk/assets/attach/13068/Southwark-SINC-citations-2017.pdf
- **GiGL (Greenspace Information for Greater London)**: local wildlife site records: https://www.gigl.org.uk/
- **Council walking-route leaflets** (e.g. Southwark's Art, literature and green spaces walk),
  which describe small gardens and public art stop by stop.
- **London Wildlife Trust reserves**: https://www.wildlondon.org.uk/
- **Neighbouring boroughs' equivalents** (Lambeth, Lewisham, Greenwich, Tower Hamlets, City).

## Data and licences
`data/hds/gazetteer.json.gz` holds the postcodes and streets within the area, extracted from the
ONS Postcode Directory (Feb 2026) and OS Open Names (Apr 2026), both under the Open Government
Licence v3.0, via the npm package `uk-address-lookup`. Contains OS data © Crown copyright and
database right 2026; contains Royal Mail data © Royal Mail copyright and database right 2026;
contains National Statistics data © Crown copyright and database right 2026.
Rebuild with `python3 scripts/hds_build.py path/to/uk-address.json.gz` (search progress is kept).
