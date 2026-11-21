import { DEFAULT_URL, Multiplayer } from "./Multiplayer";
import type { Simulation } from "../sim/Simulation";

/** A small "World PIN" button and panel, always on top: type a PIN (the same one as your friends), join, chat. */
const KEY_PIN = "mosaics-world:mp-pin", KEY_URL = "mosaics-world:mp-url";
const store = { get: (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

export function mountMultiplayer(sim: () => Simulation | undefined): Multiplayer {
  const mp = new Multiplayer(sim);
  const css = document.createElement("style");
  css.textContent = `.mp-btn{position:fixed;left:12px;bottom:12px;z-index:60;background:#1b1818;color:#f1ece6;border:1px solid #b3343c;border-radius:10px;padding:9px 13px;font:600 13px system-ui;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.5)}
.mp-btn.live{background:#7d2229}.mp-panel{position:fixed;left:12px;bottom:56px;z-index:60;width:min(320px,calc(100vw - 24px));background:#151313;color:#e9e4de;border:1px solid #3a3030;border-radius:12px;padding:14px;font:13px system-ui;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.mp-panel[hidden]{display:none}.mp-panel h3{margin:0 0 8px;font-size:15px}.mp-panel input{width:100%;box-sizing:border-box;background:#0e0c0c;color:#fff;border:1px solid #4a3a3a;border-radius:8px;padding:9px;margin:4px 0 8px;font:14px system-ui}
.mp-panel button{background:#b3343c;color:#fff;border:0;border-radius:8px;padding:9px 12px;font:600 13px system-ui;cursor:pointer;margin-right:6px}.mp-panel button.alt{background:#2a2323}
.mp-status{margin:8px 0;color:#bfb6ad;min-height:18px}.mp-panel details{margin-top:8px;color:#9f958b}.mp-panel small{color:#8d837a}`;
  document.head.appendChild(css);
  const btn = document.createElement("button"); btn.className = "mp-btn"; btn.textContent = "🌐 World PIN"; btn.setAttribute("aria-label", "Multiplayer world PIN");
  const panel = document.createElement("div"); panel.className = "mp-panel"; panel.hidden = true;
  panel.innerHTML = `<h3>Play together</h3><small>Type the same PIN as your friends to share one world. Anyone with the PIN can join.</small>
<input class="mp-pin" placeholder="World PIN (e.g. 4821)" maxlength="32" autocomplete="off"/>
<div><button class="mp-join">Join</button><button class="alt mp-leave">Leave</button></div><div class="mp-status"></div>
<input class="mp-say" placeholder="Say something nearby, press Enter" maxlength="120" autocomplete="off" hidden/>
<details><summary>Server</summary><input class="mp-url" placeholder="${DEFAULT_URL}"/><small>Set this once after deploying the realtime server.</small></details>`;
  document.body.append(btn, panel);
  const $ = <T extends HTMLElement>(s: string) => panel.querySelector(s) as T;
  const pin = $<HTMLInputElement>(".mp-pin"), url = $<HTMLInputElement>(".mp-url"), say = $<HTMLInputElement>(".mp-say"), status = $(".mp-status");
  pin.value = store.get(KEY_PIN); url.value = store.get(KEY_URL);
  const render = () => {
    btn.classList.toggle("live", mp.status === "live");
    btn.textContent = mp.status === "live" ? `🌐 ${mp.pin} · ${mp.nearby} nearby` : "🌐 World PIN";
    status.textContent = mp.status === "off" ? "Not connected" : mp.status === "live" ? `Connected to world ${mp.pin} · ${mp.nearby} Mosaics near you` : mp.message;
    say.hidden = mp.status !== "live";
  };
  mp.onChange(render); render();
  btn.onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) pin.focus(); };
  const join = () => { const v = pin.value.trim(); if (!v) return; store.set(KEY_PIN, v); store.set(KEY_URL, url.value.trim()); mp.join(v, url.value.trim() || undefined); };
  $(".mp-join").onclick = join; $(".mp-leave").onclick = () => { mp.leave(); store.set(KEY_PIN, ""); };
  pin.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") join(); };
  url.onkeydown = (e) => e.stopPropagation();
  say.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") { mp.chat(say.value); say.value = ""; } };
  for (const el of [pin, url, say]) { el.onkeyup = (e) => e.stopPropagation(); el.onkeypress = (e) => e.stopPropagation(); }
  // rejoin the last PIN on its own, once the game is up
  if (pin.value) { const wait = setInterval(() => { if (sim()) { clearInterval(wait); mp.join(pin.value, url.value.trim() || undefined); } }, 500); }
  return mp;
}
