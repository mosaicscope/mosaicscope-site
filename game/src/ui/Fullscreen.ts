/**
 * Full screen without browser bars. Android and iPad go truly full screen on the first touch (and a small button toggles it);
 * iPhone Safari has no fullscreen API for pages, so there the page pins itself to the visible area, tucks the address bar away,
 * and offers a one-time "Add to Home Screen" tip, which launches with no bars at all. Installed apps are already full screen.
 */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const standalone = (): boolean => { try { return window.matchMedia("(display-mode: fullscreen)").matches || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; } };
const isFull = (): boolean => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);
const canFull = (): boolean => !!(document.documentElement.requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen) && document.fullscreenEnabled !== false;
const enter = (): void => { const e = document.documentElement as FsEl; try { const p = e.requestFullscreen ? e.requestFullscreen({ navigationUI: "hide" }) : e.webkitRequestFullscreen?.(); (p as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* not allowed */ } };
const leave = (): void => { try { if (document.exitFullscreen) void document.exitFullscreen(); else (document as FsDoc).webkitExitFullscreen?.(); } catch { /* fine */ } };

export function mountFullscreen(): void {
  const root = document.documentElement;
  // the layout always follows the visible area, so a retracting address bar or a rotation never leaves a gap or a scroll
  const fit = (): void => {
    const vv = window.visualViewport, h = Math.round(vv?.height ?? window.innerHeight);
    root.style.setProperty("--app-h", `${h}px`);
    if (!isFull() && !standalone() && window.scrollY > 0) window.scrollTo(0, 0);
  };
  fit();
  window.visualViewport?.addEventListener("resize", fit);
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", () => { setTimeout(fit, 120); setTimeout(fit, 450); });
  document.addEventListener("fullscreenchange", fit);
  // stop the page rubber-banding or pull-to-refreshing under the game
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  if (standalone()) { root.classList.add("is-app"); return; }
  const touch = (): boolean => { try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; } };
  if (!touch()) return;

  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "fs-btn"; btn.setAttribute("aria-label", "Toggle full screen"); btn.textContent = "⛶";
  btn.addEventListener("click", (e) => { e.stopPropagation(); if (isFull()) leave(); else enter(); });
  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  const sync = (): void => { btn.classList.toggle("on", isFull()); };
  document.addEventListener("fullscreenchange", sync); document.addEventListener("webkitfullscreenchange", sync);

  if (canFull()) {
    document.body.append(btn);
    // the first touch anywhere is the user gesture the browser needs
    const first = (): void => { window.removeEventListener("pointerup", first, true); window.removeEventListener("touchend", first, true); if (!isFull()) enter(); };
    window.addEventListener("pointerup", first, true); window.addEventListener("touchend", first, true);
  } else {
    // iPhone Safari: pin to the visible area and offer the home-screen route once
    root.classList.add("no-fs-api");
    let seen = false; try { seen = localStorage.getItem("fs-tip") === "1"; } catch { /* private mode */ }
    if (!seen) {
      const tip = document.createElement("div"); tip.className = "fs-tip"; tip.setAttribute("role", "status");
      tip.innerHTML = "For full screen with no bars: tap <b>Share</b> then <b>Add to Home Screen</b>, and open it from there. <button type=\"button\">Got it</button>";
      tip.querySelector("button")!.addEventListener("click", () => { tip.remove(); try { localStorage.setItem("fs-tip", "1"); } catch { /* fine */ } });
      document.body.append(tip);
      setTimeout(() => tip.remove(), 14000);
    }
    const hide = (): void => { setTimeout(() => window.scrollTo(0, 1), 60); };
    window.addEventListener("load", hide); window.addEventListener("orientationchange", hide);
  }
}
