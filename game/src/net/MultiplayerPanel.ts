import { DEFAULT_URL, Multiplayer } from "./Multiplayer";
import type { Simulation } from "../sim/Simulation";

/** A small "World PIN" button and panel: type a PIN (the same one as your friends), join, meet up, chat. Works on phones and desktops. */
const KEY_PIN = "mosaics-world:mp-pin", KEY_URL = "mosaics-world:mp-url";
const store = { get: (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

export function mountMultiplayer(sim: () => Simulation | undefined): Multiplayer {
  const mp = new Multiplayer(sim);
  const css = document.createElement("style");
  css.textContent = `.mp-btn,.mp-panel,.mp-panel *{font-family:inherit;box-sizing:border-box}
.mp-btn{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:25;background:#1b1818;color:#f1ece6;border:1px solid #b3343c;border-radius:10px;padding:9px 13px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.mp-btn.live{background:#7d2229}
.mp-panel{position:fixed;left:12px;bottom:calc(56px + env(safe-area-inset-bottom));z-index:26;width:min(330px,calc(100vw - 24px));max-height:calc(100dvh - 90px - env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch;background:#151313;color:#e9e4de;border:1px solid #3a3030;border-radius:12px;padding:14px;font-size:13px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.mp-panel[hidden]{display:none}.mp-panel h3{margin:0 0 6px;font-size:15px}
.mp-panel input{width:100%;background:#0e0c0c;color:#fff;border:1px solid #4a3a3a;border-radius:8px;padding:10px;margin:4px 0 8px;font-size:16px}
.mp-panel button{background:#b3343c;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;margin:0 6px 6px 0;touch-action:manipulation}
.mp-panel button.alt{background:#2a2323}.mp-status{margin:6px 0;color:#bfb6ad;min-height:18px}.mp-panel details{margin-top:8px;color:#9f958b}.mp-panel small{color:#8d837a}
.mp-list button{display:block;width:100%;text-align:left;background:#241d1d;margin:0 0 5px}.mp-list b{color:#fff}
@media (pointer:fine) and (min-width:701px){.mp-btn{left:50%;bottom:auto;top:calc(22px + env(safe-area-inset-top));transform:translateX(-50%)}.mp-panel{left:50%;bottom:auto;top:calc(66px + env(safe-area-inset-top));transform:translateX(-50%);max-height:calc(100dvh - 90px)}}
@media (pointer:coarse),(max-width:700px){.mp-btn{left:50%;transform:translateX(-50%);padding:8px 11px}.mp-panel{left:50%;transform:translateX(-50%)}}`;
  document.head.appendChild(css);
  const btn = document.createElement("button"); btn.className = "mp-btn"; btn.textContent = "🌐 World PIN"; btn.setAttribute("aria-label", "Multiplayer world PIN");
  const panel = document.createElement("div"); panel.className = "mp-panel"; panel.hidden = true;
  panel.innerHTML = `<h3>Play together</h3><small>Type the same PIN as your friends and you will land next to them.</small>
<input class="mp-name" placeholder="Your name" maxlength="24" autocomplete="off" autocapitalize="words"/>
<input class="mp-pin" placeholder="World PIN (e.g. 4821)" maxlength="32" autocomplete="off" inputmode="text"/>
<div><button class="mp-join">Join</button><button class="alt mp-meet">Meet up</button><button class="alt mp-leave">Leave</button></div><div class="mp-status"></div>
<div class="mp-list"></div>
<input class="mp-say" placeholder="Say something nearby, press Enter" maxlength="120" autocomplete="off" hidden/>
<details><summary>Server</summary><input class="mp-url" placeholder="${DEFAULT_URL}"/><small>Only change this if you run your own server.</small></details>`;
  document.body.append(btn, panel);
  const $ = <T extends HTMLElement>(s: string) => panel.querySelector(s) as T;
  const pin = $<HTMLInputElement>(".mp-pin"), url = $<HTMLInputElement>(".mp-url"), say = $<HTMLInputElement>(".mp-say"), name = $<HTMLInputElement>(".mp-name"), status = $(".mp-status"), list = $(".mp-list");
  pin.value = store.get(KEY_PIN); url.value = store.get(KEY_URL); name.value = store.get("mosaics-world:mp-name");
  const render = () => {
    btn.classList.toggle("live", mp.status === "live");
    btn.textContent = mp.status === "live" ? `🌐 ${mp.pin} · ${mp.total || mp.nearby + 1} here` : "🌐 World PIN";
    status.textContent = mp.status === "off" ? "Not connected" : mp.status === "live" ? (mp.message || `In world ${mp.pin} · ${mp.total || mp.nearby + 1} Mosaics here, ${mp.nearby} near you`) : mp.message;
    say.hidden = mp.status !== "live";
    list.replaceChildren();
    const s = sim(); const me = s?.player;
    for (const o of mp.others.slice(0, 12)) {
      const b = document.createElement("button"), d = me ? Math.round(Math.hypot(o.x - me.x, o.y - me.y)) : 0;
      const strong = document.createElement("b"); strong.textContent = o.name; b.append("Go to ", strong, ` · ${d} tiles`); b.onclick = () => { mp.goTo(o.x, o.y); panel.hidden = true; }; list.append(b);
    }
  };
  mp.onChange(render); render();
  btn.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) { render(); } };
  const join = () => { const v = pin.value.trim(); if (!v) return; mp.setName(name.value); store.set(KEY_PIN, v); store.set(KEY_URL, url.value.trim()); mp.join(v, url.value.trim() || undefined); };
  $(".mp-join").onclick = join; $(".mp-meet").onclick = () => { if (!mp.meetNearest()) { mp.message = "Nobody else is in this world yet"; render(); } else panel.hidden = true; };
  $(".mp-leave").onclick = () => { mp.leave(); store.set(KEY_PIN, ""); };
  for (const el of [pin, url, say, name]) { el.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") { if (el === say) { mp.chat(say.value); say.value = ""; } else join(); } }; el.onkeyup = (e) => e.stopPropagation(); el.onkeypress = (e) => e.stopPropagation(); }
  // rejoin the last PIN on its own, once the game is up
  if (pin.value) { const wait = setInterval(() => { if (sim()) { clearInterval(wait); mp.join(pin.value, url.value.trim() || undefined); } }, 500); }
  return mp;
}
