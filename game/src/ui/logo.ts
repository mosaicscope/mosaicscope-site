import { h } from "./dom";

/** The Mosaics banner. One file, used wherever the game shows its name (top bar, welcome card, loading). */
export const LOGO_URL = import.meta.env.BASE_URL + "art/mosaics-logo.webp";

/** The banner as an <img>. `cls` is the extra class that sizes it for the place it sits. */
export function logoImg(cls: string): HTMLElement {
  return h("img.logo-img." + cls, { src: LOGO_URL, alt: "The Mosaics", draggable: "false", decoding: "async" });
}
