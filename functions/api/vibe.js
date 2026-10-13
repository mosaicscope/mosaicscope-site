// Cloudflare Pages Function: /api/vibe
// GET: current Christchurch conditions for the game's score (Lil Wooski). Free, no API key: Open-Meteo.
// Audio only: the game never feeds this into the simulation. Nothing about the visitor is read or sent
// (no cookies, no IP, no query), the same answer goes to everyone and is cached for 10 minutes.
// If the weather service is down this answers from the clock instead, so the music never depends on it.

const json = (o, ttl) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=" + ttl } });

function nzHour(d = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
    return (+p.find((x) => x.type === "hour").value % 24) + +p.find((x) => x.type === "minute").value / 60;
  } catch (e) { return d.getUTCHours() + d.getUTCMinutes() / 60; }
}

// WMO weather codes -> the four the score understands
const kind = (c) => (c >= 95 ? "storm" : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? "rain" : c >= 2 ? "cloudy" : "clear");

export async function onRequestGet() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=-43.53&longitude=172.64&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=Pacific%2FAuckland";
  try {
    const r = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) throw new Error("upstream " + r.status);
    const c = (await r.json()).current;
    const hour = nzHour();
    return json({ weather: kind(c.weather_code), isDay: !!c.is_day, temp: Math.round(c.temperature_2m), wind: Math.round(c.wind_speed_10m), hour, source: "open-meteo" }, 600);
  } catch (e) {
    const hour = nzHour();
    return json({ weather: "clear", isDay: hour >= 6.5 && hour < 19, temp: 14, wind: 10, hour, source: "clock" }, 60);
  }
}
