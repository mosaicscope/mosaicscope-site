// The two competing agents. Each sees the same short menu of verified opportunities and answers
// with one code like "2a" (option 2, remedy a), about 2-4 output tokens. With no API key, or when the
// budget says no, each agent falls back to a local heuristic that reflects its role, so the
// competition still runs and the dashboard says which way each pick was made.

import { canCall, bookCall, estimateTokens } from "./budget.js";
import { learned, fixKey } from "./score.js";
import { hash } from "./html.js";

export const ROLES = {
  innovator: {
    system: "You are INNOVATOR for a photographer's website. Favour visitor benefit, accessibility and UX. Pick ONE option. Reply only with its code, like 2a.",
    weights: { benefit: 3, a11y: 3, perf: 1, rel: 1, complexity: -1, risk: -2 },
    areas: { a11y: 2, ux: 2 },
  },
  optimiser: {
    system: "You are OPTIMISER for a photographer's website. Favour performance, reliability and low regression risk. Pick a DIFFERENT option from A unless A's is clearly best. Pick ONE option. Reply only with its code, like 2a.",
    weights: { benefit: 1, a11y: 1, perf: 3, rel: 3, complexity: -2, risk: -4 },
    areas: { perf: 2, rel: 2, seo: 1 },
  },
};

/** One line per opportunity; remedies listed as id=label. Kept tiny on purpose. */
export function menu(options) {
  return options.map((o, n) => `${n + 1} ${o.finding.kind} ${o.finding.path}:${o.finding.line} ` + o.remedies.map((r) => `${r.id}=${r.label}`).join(" ")).join("\n");
}

export function parsePick(text, options) {
  const m = /(\d+)\s*([a-z])/i.exec(String(text || ""));
  if (!m) return null;
  const o = options[Number(m[1]) - 1];
  const r = o?.remedies.find((x) => x.id === m[2].toLowerCase());
  return o && r ? { o, r } : null;
}

/**
 * The local stand-in for an agent: its role's weights, what's been learned overall, and its OWN track
 * record per area (so each agent's strategy drifts toward the areas where its picks have landed).
 * avoid: the rival's pick, which the Optimiser skips unless nothing else comes close.
 */
export function heuristicPick(role, options, state, avoid = null, now) {
  const R = ROLES[role];
  const mine = state.agents?.[role]?.areas || {};
  const scored = [];
  options.forEach((o) => o.remedies.forEach((r) => {
    let s = R.areas[o.area] || 0;
    for (const [k, w] of Object.entries(R.weights)) s += w * (r.meta[k] || 0);
    s *= learned(state.stats.kinds[o.finding.kind], now) * learned(state.stats.fixes[fixKey(o.finding.kind, r.id)], now) * learned(mine[o.area], now);
    scored.push({ o, r, s });
  }));
  scored.sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  if (avoid) {
    const alt = scored.find((x) => !(x.o === avoid.o && x.r === avoid.r));
    if (alt && alt.s >= scored[0].s * 0.8) return { o: alt.o, r: alt.r };
  }
  return { o: scored[0].o, r: scored[0].r };
}

/**
 * Ask one agent. Returns { o, r, via, model, note }.
 * At most two calls: the cheap model, and one escalation if its answer can't be used. No other retries.
 */
export async function ask(role, options, state, cfg, llm, rival, rivalPick = null, now = Date.now()) {
  const user = menu(options) + (rival ? `\nA picked ${rival}.` : "");
  const sys = ROLES[role].system;
  const notes = [];
  // the same question asked before gets the same answer, free (the menu changes whenever anything does)
  const key = hash(role + "|" + user);
  const hit = state.cache?.[key];
  if (hit) {
    const pick = parsePick(hit.answer, options);
    if (pick) { hit.at = now; return { ...pick, via: "cache", model: hit.model, answer: hit.answer, note: "cached answer, no call" }; }
  }
  if (llm) {
    for (const model of [cfg.MODEL_CHEAP, cfg.MODEL_ESCALATE]) {
      const est = estimateTokens(sys) + estimateTokens(user);
      const why = canCall(state, cfg, model, est);
      if (why) { notes.push(why); break; }
      let res;
      try { res = await llm({ model, system: sys, user, maxTokens: cfg.MAX_OUTPUT_TOKENS }); }
      catch (e) { bookCall(state, model, est, 0); notes.push("api error: " + String(e?.message || e).slice(0, 60)); break; }
      bookCall(state, model, res.inTok ?? est, res.outTok ?? cfg.MAX_OUTPUT_TOKENS);
      const pick = parsePick(res.text, options);
      if (pick) {
        (state.cache ||= {})[key] = { answer: String(res.text).trim().slice(0, 12), model, at: now };
        return { ...pick, via: "ai", model, answer: String(res.text).trim().slice(0, 12), note: notes.join("; ") };
      }
      notes.push(`${model} answered "${String(res.text).trim().slice(0, 12)}"`);
    }
  }
  const pick = heuristicPick(role, options, state, rivalPick, now);
  return pick && { ...pick, via: "local", model: "", answer: "", note: notes.join("; ") || (llm ? "" : "no API key") };
}
