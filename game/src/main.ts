import "./ui/styles.css";
import { Game } from "./app/Game";

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
  (window as any).__mosaics = game; // handy for debugging and the smoke test
  window.addEventListener("error", (e) => console.error("[mosaics]", e.message));
} catch (e) {
  console.error(e);
  fatal(e instanceof Error ? e.message : String(e));
}
