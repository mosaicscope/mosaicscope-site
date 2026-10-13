/**
 * Screen reader narration for nearby world events (catalogue item 42).
 * Events go into one visually hidden polite live region. Repeats and bursts are dropped
 * so a crowd fight doesn't read out forty lines in a row.
 */

export const ANNOUNCE_GAP_MS = 2500;

/** Pure rule: announce only if the text is new, or the same text is due again after the gap. */
export function shouldAnnounce(text: string, now: number, last: { text: string; at: number }): boolean {
  if (!text.trim()) return false;
  if (now - last.at < ANNOUNCE_GAP_MS) return false;
  return text !== last.text || now - last.at >= ANNOUNCE_GAP_MS * 4;
}

export class Announcer {
  readonly el: HTMLElement;
  private last = { text: "", at: -Infinity };

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "sr-only";
    this.el.setAttribute("role", "status");
    this.el.setAttribute("aria-live", "polite");
    this.el.setAttribute("aria-atomic", "true");
  }

  /** Read a line aloud if the throttle allows it. Returns true when it was announced. */
  announce(text: string, now = Date.now()): boolean {
    if (!shouldAnnounce(text, now, this.last)) return false;
    this.last = { text, at: now };
    this.el.textContent = text;
    return true;
  }
}
