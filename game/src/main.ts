import "./ui/styles.css";
import { Game } from "./app/Game";
import { setMosaicData, MOSAIC } from "./content/mosaicscope";

/**
 * Pull the live business details from the main site (content.json) and the real Instagram feed
 * (Behold), so the crew talk about posts that actually exist. Cached for 6 hours like the site does.
 * If anything fails (offline, or running outside the site) the built-in defaults are used.
 */
async function loadMosaicScope(): Promise<void> {
  try {
    const r = await fetch("/content.json", { cache: "no-cache" });
    if (!r.ok) return;
    const d = await r.json();
    const site = d.site ?? {};
    const ig = (d.social ?? []).find((s: any) => /instagram/i.test(s.label));
    setMosaicData({
      owner: (site.owner ?? "Chris").split(" ")[0], handle: ig?.handle ?? MOSAIC.handle, instagram: ig?.url ?? MOSAIC.instagram, igDm: site.instagramDm ?? MOSAIC.igDm,
      soundcloud: site.soundcloudUrl ?? MOSAIC.soundcloud, location: site.location ?? MOSAIC.location, live: true,
      rates: Array.isArray(d.rates) && d.rates.length ? d.rates : MOSAIC.rates,
      services: Array.isArray(d.services) ? d.services.flatMap((s: any) => s.items ?? []) : MOSAIC.services,
    });
    if (!site.beholdFeed) return;
    const KEY = "mosaics-world:ig:" + site.beholdFeed;
    let json: any = null;
    try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); if (c && Date.now() - c.t < 6 * 3600e3) json = c.json; } catch { /* no storage */ }
    if (!json) { const f = await fetch(site.beholdFeed); if (!f.ok) return; json = await f.json(); try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), json })); } catch { /* full */ } }
    const list = Array.isArray(json) ? json : json?.posts ?? [];
    setMosaicData({ posts: list.map((p: any) => ({ link: p.permalink, caption: p.prunedCaption || p.caption || "", img: p.sizes?.medium?.mediaUrl || p.thumbnailUrl || p.mediaUrl || "", date: p.timestamp, video: p.mediaType === "VIDEO" })).filter((p: any) => p.link && p.img) });
  } catch { /* offline or blocked: defaults stay */ }
}

/** Entry point. Shows a readable message instead of a blank page if anything fails to start. */
function fatal(msg: string): void {
  const el = document.createElement("div");
  el.className = "fatal";
  el.innerHTML = `<div><h1 style="font:900 48px/1 'Big Shoulders Display',Impact,sans-serif;text-transform:uppercase;margin:0 0 12px">The Mosaics are <i style="font:italic 1em 'Instrument Serif',serif;color:#ec2a1c;text-transform:none">offline</i></h1><p></p><p><a href="/" style="color:#eee4d3">Back to MosaicScope</a></p></div>`;
  el.querySelector("p")!.textContent = msg;
  document.body.append(el);
}

try {
  const canvas = document.getElementById("world") as HTMLCanvasElement;
  const ui = document.getElementById("ui")!;
  if (!canvas.getContext("2d")) throw new Error("Your browser can't draw the world (canvas is unavailable).");
  const game = new Game(canvas, ui);
  game.start();
  loadMosaicScope();
  (window as any).__mosaics = game; // handy for debugging and the smoke test
  window.addEventListener("error", (e) => console.error("[mosaics]", e.message));
} catch (e) {
  console.error(e);
  fatal(e instanceof Error ? e.message : String(e));
}
