# Real destination geometry

These JSON snapshots contain OpenStreetMap building footprints, road geometry, names and venue tags, retrieved through the official OpenStreetMap map API. Data © OpenStreetMap contributors, licensed under the [Open Database License](https://www.openstreetmap.org/copyright). Each snapshot records its retrieval time and origin. The original OSM element IDs are retained. These are bounded starting neighbourhoods, rather than complete cities.

Building data uses mapped height or level tags when present; otherwise the height is marked estimated. All destinations render with the main world's existing building renderer, house roofs, palettes, windows and materials. Footprints are adapted to that renderer's tile grid and storey range; facade details and interior rooms are authored game interpretations, not surveyed or Google-scraped replicas. The API streams additional 400-metre neighbourhood tiles on demand. The client retains a bounded cache and displays source attribution.

From `game/`, run `python scripts/snapshot-destinations.py` followed by `node scripts/convert-destinations.mjs` to refresh the bundled starting districts. The first script uses curl and Python's standard XML parser; no account or key is needed. The runtime endpoint uses the official map API with an Overpass fallback. This does not import Google imagery or data.
