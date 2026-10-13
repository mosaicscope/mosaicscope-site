import { h } from "./dom";
import { ModalHost } from "./Modals";
import { ENDING_TEXT, HeistState, choose, currentScene, newHeist } from "../sim/Heist";

/** Velvet Heist Night, shown in the existing modal. Keeps its own state for the session. */
export class HeistUI {
  private state: HeistState = newHeist();

  constructor(private modal: ModalHost) {}

  /** Open the mission at its current act. */
  open(): void { this.render(); }

  reset(): void { this.state = newHeist(); }

  private pick(id: string): void {
    this.state = choose(this.state, id);
    this.render();
  }

  private render(): void {
    const scene = currentScene(this.state);
    const body: HTMLElement[] = [];
    if (scene) {
      body.push(h("p", { text: scene.text }));
      body.push(h("div.heist-choices", null, scene.choices.map((c) =>
        h("button.btn", { onclick: () => this.pick(c.id), text: c.label }))));
    } else {
      const ending = this.state.ending ?? "messy";
      body.push(h("p", { text: ENDING_TEXT[ending] }));
      body.push(h("p", { style: { color: "var(--dim)" }, text: `Heat ${this.state.heat} · Trust ${this.state.trust} · Loot ${this.state.loot}` }));
      body.push(h("button.btn.red", { text: "Play again", onclick: () => { this.reset(); this.render(); } }));
    }
    if (this.state.picks.length) body.push(h("p", { style: { color: "var(--dim)" }, text: `So far: ${this.state.picks.join(" → ")}` }));
    this.modal.show("Velvet Heist Night", body, "heist");
  }
}
