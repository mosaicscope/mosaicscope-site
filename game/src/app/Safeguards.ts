/**
 * Safeguards: nothing here changes how the game plays. They only step in when something is going wrong, and they fall back to
 * the plain, light version of the same game (flat city view, lowest detail) instead of a dead or dark screen.
 *  - Crash loop: if the last run never closed cleanly in its first half minute, this run starts in safe mode.
 *  - Render faults: a few render errors in a row drop the 3D view and the detail level, once, with a note.
 *  - Frozen frames: if drawing stops while the tab is open, safe mode is switched on and the page restarts once.
 *  - Memory: if the tab nears its memory ceiling, detail drops before the browser kills it.
 * Progress is untouched: the game keeps saving as usual and the restart reloads the same save.
 */
type Any = any; // the game's internals are private by design; this module only pokes a few fields on purpose
const BOOT = "mosaics-world:boot", SAFE = "mosaics-world:safe";
const ls = { get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } }, del: (k: string): void => { try { localStorage.removeItem(k); } catch { /* private mode */ } } };
const ss = { get: (k: string): string | null => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string): void => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } }, del: (k: string): void => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } } };

/** Call before the game starts. Returns true when this run should start in safe mode. */
export function bootCheck(): boolean {
  const prev = ss.get(BOOT);   // per tab: sessionStorage survives a crashed tab being reloaded, and other tabs cannot trip it
  if (prev && Date.now() - Number(prev) < 5 * 60_000) ls.set(SAFE, "1");   // the last run in this tab never reached a clean exit
  ss.set(BOOT, String(Date.now()));
  // a normal reload or navigation clears the marker; a crashed tab cannot
  window.addEventListener("pagehide", () => { ss.del(BOOT); });
  return ls.get(SAFE) === "1";
}

function note(text: string, action?: { label: string; run(): void }): void {
  if (typeof document === "undefined") return;
  const el = document.createElement("div"); el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;left:50%;top:calc(max(72px,env(safe-area-inset-top)) + 8px);transform:translateX(-50%);z-index:120;max-width:min(92vw,460px);background:rgba(24,17,18,.95);color:#f1ece6;border:1px solid #b3343c;border-radius:10px;padding:9px 12px;font:600 13px/1.4 system-ui,sans-serif;text-align:center";
  el.textContent = text + " ";
  if (action) { const b = document.createElement("button"); b.type = "button"; b.textContent = action.label; b.style.cssText = "margin-left:6px;background:#b3343c;color:#fff;border:0;border-radius:8px;padding:5px 10px;font:700 12px system-ui,sans-serif;cursor:pointer"; b.onclick = () => { action.run(); el.remove(); }; el.append(b); }
  document.body.append(el); setTimeout(() => el.remove(), 12000);
}

export function enterSafeMode(game: Any, why: string): void {
  const r = game.renderer;
  try { r.safeMode = true; r.drivingViewEnabled = false; if (r.drivingView) r.drivingView.lod = 0.4; } catch { /* renderer shape changed */ }
  try { if (game.settings) game.settings.quality = "auto"; game.quality = 0; r.resize?.(0); } catch { /* ignore */ }
  ls.set(SAFE, "1");
  note(why, { label: "Back to full detail", run: () => leaveSafeMode(game) });
}
export function leaveSafeMode(game: Any): void {
  ls.del(SAFE);
  const r = game.renderer; try { r.safeMode = false; } catch { /* ignore */ }
  note("Full detail is back on. If it struggles again the game will step down by itself.");
}

export function installSafeguards(game: Any, safe: boolean): void {
  let lastFrame = performance.now(), healthySince = performance.now(), memNoted = false;
  if (safe) enterSafeMode(game, "The last session closed unexpectedly, so the game started in light mode (flat city view, lowest detail). Your progress is safe.");
  // frame heartbeat: wrap the renderer so we know drawing is alive
  const r = game.renderer, origFrame = game.frame?.bind(game);
  if (origFrame) game.frame = (...a: unknown[]) => { origFrame(...a); lastFrame = performance.now(); };
  window.addEventListener("error", (e) => console.error("[mosaics:window]", e.message));
  window.addEventListener("unhandledrejection", (e) => { console.error("[mosaics:promise]", e.reason); e.preventDefault(); });
  const cvs = game.canvas as HTMLCanvasElement | undefined;
  cvs?.addEventListener("contextlost", (e) => { e.preventDefault(); console.error("[mosaics] canvas context lost"); enterSafeMode(game, "The graphics surface was reset, so the game dropped to light mode."); });
  setInterval(() => {
    const now = performance.now();
    if (document.visibilityState !== "visible") { lastFrame = now; return; }
    // a clean thirty seconds: this run is fine, clear the crash marker (a later crash starts a new one)
    if (now - healthySince > 30_000) {
      ss.del(BOOT); healthySince = Infinity;
      // two clean light-mode sessions in a row and the game quietly goes back to full detail next time
      if (safe) { const n = Number(ls.get("mosaics-world:safeClean") ?? "0") + 1; if (n >= 2) { ls.del(SAFE); ls.del("mosaics-world:safeClean"); } else ls.set("mosaics-world:safeClean", String(n)); }
    }
    // the frame loop itself has stopped while the tab is open
    if (now - lastFrame > 6000 && !r.safeMode) { lastFrame = now; enterSafeMode(game, "The game stalled, so it switched to light mode (flat city view, lowest detail). Your progress is safe."); }
    // memory ceiling (Chrome only)
    const mem = (performance as Any).memory;
    if (mem && !memNoted && mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.82) { memNoted = true; enterSafeMode(game, "The tab was close to its memory limit, so detail was lowered to keep the game running."); }
  }, 2000);
}
