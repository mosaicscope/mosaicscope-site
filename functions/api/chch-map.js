// Cloudflare Pages Function: /api/chch-map
// Real street, river, park and building outlines for central Christchurch (inside the Four Avenues),
// from OpenStreetMap via the public Overpass API, simplified and cached at the edge for a week.
// The Mosaics' world (/world/) draws its full-screen map (M) from this. No key needed.
// Data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).

const BBOX = "-43.5440,172.6100,-43.5190,172.6560"; // south,west,north,east
// Named landmarks: Christchurch Cathedral (beside Cathedral Square) and the Botanic Gardens sit outside the
// street box to the west, so they get their own search area.
const LANDMARK = /^(Christchurch Cathedral|Cathedral Square|Christchurch Botanic Gardens)$/;
const LANDMARK_BBOX = "-43.5400,172.6000,-43.5200,172.6420";
const QUERY = `[out:json][timeout:25];(
  way["highway"~"^(primary|secondary|tertiary|residential|unclassified|pedestrian)$"](${BBOX});
  way["waterway"="river"](${BBOX});
  way["leisure"="park"](${BBOX});
  way["building"](${BBOX});
  nwr["name"~"^(Christchurch Cathedral|Cathedral Square|Christchurch Botanic Gardens)$"](${LANDMARK_BBOX});
);out geom;`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=604800", "Access-Control-Allow-Origin": "*" },
});

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/chch-map?v=1", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(QUERY), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MosaicScopeSite/1.0 (mosaics world map)" } });
    if (!r.ok) return json({ ways: [], error: "upstream " + r.status }, 502);
    const d = await r.json();
    const round = (n) => Math.round(n * 1e5) / 1e5;
    const ways = [];
    for (const el of d.elements || []) {
      const t = el.tags || {};
      if (t.name && LANDMARK.test(t.name)) {
        // a node is one point; a way or area is its outline
        const lp = el.type === "node" ? [[round(el.lat), round(el.lon)]] : (el.geometry || []).map((g) => [round(g.lat), round(g.lon)]);
        if (lp.length) ways.push({ k: "landmark", p: lp, n: t.name });
      }
      if (el.type !== "way" || !el.geometry) continue;
      const k = t.waterway ? "water" : t.leisure === "park" ? "park" : t.building ? "building" : /^(primary|secondary)$/.test(t.highway) ? "major" : "street";
      // light simplification: drop points closer than ~3 m to the last kept one
      const p = [];
      for (const g of el.geometry) { const q = [round(g.lat), round(g.lon)]; const l = p[p.length - 1]; if (!l || Math.abs(l[0] - q[0]) + Math.abs(l[1] - q[1]) > 0.00003) p.push(q); }
      if (p.length > 1) ways.push({ k, p, n: t.name || undefined });
    }
    // draw order: parks, water, buildings, then streets on top, landmarks last
    const order = { park: 0, water: 1, building: 2, street: 3, major: 4, landmark: 5 };
    ways.sort((a, b) => order[a.k] - order[b.k]);
    const res = json({ ways, attribution: "Map data © OpenStreetMap contributors (ODbL)" });
    waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return json({ ways: [], error: "unreachable" }, 502);
  }
}
