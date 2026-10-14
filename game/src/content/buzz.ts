/**
 * What the real town is talking about: hot post titles from r/chch and r/newzealand, fetched by the browser from
 * /api/reddit (functions/api/reddit.js). Townspeople mention one now and then in small talk, the way people pass on
 * something they saw going round, without ever naming where it came from.
 *
 * Empty until the fetch lands, and always empty headless (tests, benchmarks), so the simulation stays deterministic.
 */
export interface Buzz { title: string; sub: string; score: number }

export const buzz: Buzz[] = [];

/** Fetch the current buzz once (browser only). Failures leave the list empty: the town just talks about other things. */
export function loadBuzz(): void {
  if (typeof fetch === "undefined" || typeof window === "undefined") return;
  fetch("/api/reddit").then((r) => (r.ok ? r.json() : null)).then((d: { posts?: Buzz[] } | null) => {
    const posts = (d?.posts ?? []).filter((p) => p && typeof p.title === "string" && p.title.length > 0).slice(0, 30);
    buzz.length = 0; buzz.push(...posts);
  }).catch(() => { /* offline or local dev: no buzz */ });
}

/** How someone would bring it up: a headline becomes hearsay, a question becomes "someone was asking". */
export function buzzOpener(t: string, pick: (n: number) => number): string {
  const s = t.replace(/[.!\s]+$/, "");
  if (/\?$/.test(s)) return ["My cousin was asking me the other day. " + s, "Random, but. " + s, "Been wondering. " + s][pick(3)];
  return [
    "Apparently " + lowerFirst(s) + ".",
    "Someone at work was saying " + lowerFirst(s) + ".",
    "Heard " + lowerFirst(s) + ".",
    "My flatmate reckons " + lowerFirst(s) + ".",
  ][pick(4)];
}

/** Keep names and acronyms ("NZ", "Christchurch") capitalised; lower only an ordinary first word. */
function lowerFirst(s: string): string {
  const w = s.split(" ")[0];
  if (/^[A-Z0-9]{2,}/.test(w) || /^(I|Christchurch|Chch|Ōtautahi|Otautahi|Canterbury|NZ|New|Auckland|Wellington|Kiwi|Kiwis|Māori|Maori)\b/.test(w)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export const BUZZ_REPLIES = {
  warm: ["Yeah, I saw that.", "No way, really?", "Ha, classic.", "Huh. Didn't know that.", "Everyone's been on about that.", "That's so Christchurch."],
  cold: ["Who cares.", "Sounds made up.", "Mate, that's old news.", "Can't believe people get worked up about that."],
};
