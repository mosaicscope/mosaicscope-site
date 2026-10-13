// The two competing agents. Each sees the same short menu of verified opportunities and answers
// with one code like "2a" (option 2, remedy a), about 2-4 output tokens. With no API key, or when the
// budget says no, each agent falls back to a local heuristic that reflects its role, so the
// competition still runs and the dashboard says which way each pick was made.

import { canCall, bookCall, estimateTokens } from "./budget.js";
import { learned, fixKey } from "./score.js";

export const ROLES = {
  innovator: {
    system: "You are INNOVATOR for a photographer's website. Favour visitor benefit, accessibility and UX. Pick ONE option. Reply only with its code, like 2a.",
    weights: { benefit: 3, a11y: 3, perf: 1, rel: 1, complexity: -1, risk: -2 },
    areas: { a11y: 2, ux: 2 },
  },
  optimiser: {
    system: "You are OPTIMISER for a photographer's website. Favour performance, reliability and low regression risk, and beat A's pick if you can. Pick ONE option. Reply only with its code, like 2a.",
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

/** The local stand-in for an agent: its role's weights plus what's been learned. */
export function heuristicPick(role, options, state) {
  const R = ROLES[role];
  let best = null;
  options.forEach((o) => o.remedies.forEach((r) => {
    let s = R.areas[o.area] || 0;
    for (const [k, w] of Object.entries(R.weights)) s += w * (r.meta[k] || 0);
    s *= learned(state.stats.kinds[o.finding.kind]) * learned(state.stats.fixes[fixKey(o.finding.kind, r.id)]);
    if (!best || s > best.s) best = { o, r, s };
  }));
  return best && { o: best.o, r: best.r };
}

/**
 * Ask one agent. Returns { o, r, via, model, note }.
 * At most two calls: the cheap model, and one escalation if its answer can't be used. No other retries.
 */
export async function ask(role, options, state, cfg, llm, rival) {
  const user = menu(options) + (rival ? `\nA picked ${rival}.` : "");
  const sys = ROLES[role].system;
  const notes = [];
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
      if (pick) return { ...pick, via: "ai", model, answer: String(res.text).trim().slice(0, 12), note: notes.join("; ") };
      notes.push(`${model} answered "${String(res.text).trim().slice(0, 12)}"`);
    }
  }
  const pick = heuristicPick(role, options, state);
  return pick && { ...pick, via: "local", model: "", answer: "", note: notes.join("; ") || (llm ? "" : "no API key") };
}
