import type { Live } from "./Score";

/**
 * Real-world Christchurch conditions for the score. Audio only: nothing here touches the simulation, and
 * nothing about the player is sent (a bare GET with no parameters). If the Pages Function or the network is
 * unavailable, the clock-only fallback keeps the score working offline.
 */
export const VIBE_URL = "/api/vibe";
export const VIBE_REFRESH_MS = 15 * 60 * 1000;

/** Local Christchurch hour (0..24) and a rough daylight guess from the clock alone. */
export function clockVibe(now: Date = new Date()): Live {
  let hour = now.getUTCHours() + now.getUTCMinutes() / 60;
  try {
    const parts = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
    const h = +(parts.find((p) => p.type === "hour")?.value ?? NaN), m = +(parts.find((p) => p.type === "minute")?.value ?? NaN);
    if (Number.isFinite(h) && Number.isFinite(m)) hour = (h % 24) + m / 60;
  } catch { /* old browser: UTC hour is fine for a mood */ }
  return { weather: "clear", isDay: hour >= 6.5 && hour < 19, temp: 14, wind: 10, hour, source: "clock" };
}

/** Validates whatever came back; anything odd is rejected so the fallback is used. */
export function parseVibe(raw: unknown): Live | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const w = o.weather;
  if (w !== "clear" && w !== "cloudy" && w !== "rain" && w !== "storm") return null;
  const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
  const temp = num(o.temp, -40, 60), wind = num(o.wind, 0, 300), hour = num(o.hour, 0, 24);
  if (temp === null || wind === null || hour === null) return null;
  return { weather: w, isDay: o.isDay !== false, temp, wind, hour, source: "live" };
}

export async function fetchVibe(f: typeof fetch = fetch, url: string = VIBE_URL): Promise<Live> {
  try {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : null;
    try {
      const r = await f(url, { cache: "no-store", credentials: "omit", signal: ctl?.signal });
      if (r.ok) { const v = parseVibe(await r.json()); if (v) return v; }
    } finally { if (timer) clearTimeout(timer); }
  } catch { /* offline, blocked or no function in dev: fall through */ }
  return clockVibe();
}
