// Pure helpers for the "model picks one option" protocol. The model only ever sees a short numbered
// menu of goals the sim has already scored as valid, and answers with one number.

export interface MenuItem { id: string; label: string }

export const SYSTEM_PROMPT = "You control one character in a small town sim. Pick the single best next goal for them. Reply with only the option number.";

export function buildMenu(items: MenuItem[]): string {
  return items.map((m, i) => `${i + 1}. ${m.label}`).join("\n");
}

/** First number in the reply, 1-based in the text, returned as a 0-based index. Anything else is null. */
export function parseChoice(text: string, n: number): number | null {
  const m = /(\d+)/.exec(String(text ?? ""));
  if (!m) return null;
  const k = Number(m[1]) - 1;
  return Number.isInteger(k) && k >= 0 && k < n ? k : null;
}
