import type { Simulation } from "../sim/Simulation";
import type { Camera } from "../render/Camera";
import type { ModalHost } from "./Modals";
import { h, fmtHour } from "./dom";

/** Replay the recorded event chain and camera locations without mutating the saved simulation. */
export class EventReplay {
  private timer: ReturnType<typeof setInterval> | null = null;
  private restoreView: (() => void) | null = null;
  constructor(private sim: () => Simulation, private camera: () => Camera, private modal: ModalHost, private pause: () => () => void) {}
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.restoreView?.(); this.restoreView = null;
    document.querySelector(".replay-caption")?.remove();
  }
  show(): void {
    this.stop();
    const sim = this.sim(), events = sim.events.history.slice(-80);
    const roots = events.filter(e => e.cause < 0);
    this.modal.show("Event replay", [h("p", { text: "Revisit recorded event chains and their locations in today’s city. Playback pauses the simulation." }),
      ...roots.slice(-20).reverse().map(root => {
        const ids = new Set([root.id]);
        const chain = events.filter(e => { if (e.id === root.id || ids.has(e.cause)) { ids.add(e.id); return true; } return false; });
        return h("button.replay-entry", { onclick: () => {
          const cam = this.camera(), before = { x: cam.x, y: cam.y, follow: cam.follow }, resume = this.pause();
          this.restoreView = () => { cam.follow = before.follow; cam.lookAt(before.x, before.y); resume(); };
          this.modal.close();
          const caption = h("aside.replay-caption", null, [h("small", { text: "EVENT REPLAY" }), h("p"), h("button.btn", { text: "Stop replay", onclick: () => this.stop() })]);
          document.body.append(caption); let i = 0;
          const next = () => {
            if (i >= chain.length) { this.stop(); return; }
            const e = chain[i++]; cam.follow = -1; cam.lookAt(e.x, e.y);
            caption.querySelector("p")!.textContent = `${i}/${chain.length} · ${e.summary}`;
          };
          next(); this.timer = setInterval(next, 2500);
        } }, [h("small", { text: `${fmtHour((sim.env.startHour + root.tick / 3600) % 24)} · ${chain.length} event${chain.length === 1 ? "" : "s"}` }), h("strong", { text: root.summary })]);
      }), !roots.length ? h("p", { text: "Your story is just starting. Recorded events will appear here." }) : null,
    ], "replay-menu");
  }
}
