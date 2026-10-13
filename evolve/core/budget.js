// The usage ledger and the checks that run before every AI call and every cycle.

import { PRICES } from "./config.js";

export const today = (now) => new Date(now).toISOString().slice(0, 10);

/** Roll the ledger over at UTC midnight, keeping past days for the dashboard. */
export function rollLedger(state, now) {
  const d = today(now);
  if (state.ledger.day === d) return;
  if (state.ledger.day) state.days.unshift({ ...state.ledger });
  state.ledger = { day: d, calls: 0, inTok: 0, outTok: 0, usd: 0, cycles: 0, skipped: 0 };
}

export function price(model, inTok, outTok) {
  const p = PRICES[model] || PRICES["claude-sonnet-5-5"];
  return (inTok * p.in + outTok * p.out) / 1e6;
}

/** Rough token count before a call (about 4 characters a token, rounded up). */
export const estimateTokens = (s) => Math.ceil(String(s).length / 3.6) + 4;

/** May we make this call? Returns "" when yes, or the reason it's blocked. */
export function canCall(state, cfg, model, inTok) {
  if (cfg.KILL || state.mode === "stopped") return "emergency stop";
  if (inTok > cfg.MAX_INPUT_TOKENS) return `prompt ${inTok} tokens > limit ${cfg.MAX_INPUT_TOKENS}`;
  if (state.ledger.calls >= cfg.DAILY_CALL_LIMIT) return "daily call limit";
  const worst = price(model, inTok, cfg.MAX_OUTPUT_TOKENS);
  if (state.ledger.usd + worst > cfg.DAILY_USD_LIMIT) return "daily spend limit";
  return "";
}

/** Book a finished call with the usage the API reported (or the estimate when it didn't). */
export function bookCall(state, model, inTok, outTok) {
  state.ledger.calls++;
  state.ledger.inTok += inTok;
  state.ledger.outTok += outTok;
  state.ledger.usd = Math.round((state.ledger.usd + price(model, inTok, outTok)) * 1e6) / 1e6;
}

/** May a cycle run at all? */
export function canCycle(state, cfg) {
  if (cfg.KILL) return "emergency stop (env)";
  if (state.mode === "stopped") return "emergency stop";
  if (state.mode === "paused") return "paused";
  if (state.mode === "tripped") return "tripped: " + state.modeReason;
  if (state.ledger.cycles >= cfg.DAILY_CYCLE_LIMIT) return "daily cycle limit";
  return "";
}
