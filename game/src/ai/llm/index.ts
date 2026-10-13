import { MenuItem, SYSTEM_PROMPT, buildMenu, parseChoice } from "./choice";
import { Chooser, hfWorkerChooser, localGgufChooser, webLlmChooser } from "./backends";

export type { MenuItem } from "./choice";

export interface LlmBudget {
  /** Model calls allowed in any rolling 60 seconds, across all principals. */
  maxPerMinute: number;
  /** A reply older than this many sim ticks is discarded: the situation has moved on. */
  maxAgeTicks: number;
}

export const DEFAULT_BUDGET: LlmBudget = { maxPerMinute: 20, maxAgeTicks: 60 * 30 };

/**
 * Asks a model to choose one of the goals the sim already considers valid, and keeps the answer until the
 * sim asks for it. Requests are asynchronous: the sim never waits, and the heuristic keeps running in the
 * meantime. Each character has at most one request in flight.
 */
export class LlmBrain {
  private pending = new Map<number, { goalId: string; at: number }>();
  private inflight = new Set<number>();
  private calls: number[] = [];

  constructor(private chooser: Chooser, private budget: LlmBudget = DEFAULT_BUDGET, private now: () => number = Date.now) {}

  request(id: number, items: MenuItem[], tick: number): void {
    if (items.length < 2 || this.inflight.has(id)) return;
    const t = this.now();
    this.calls = this.calls.filter((x) => t - x < 60_000);
    if (this.calls.length >= this.budget.maxPerMinute) return;
    this.calls.push(t);
    this.inflight.add(id);
    const user = `${buildMenu(items)}\nReply with one number.`;
    this.chooser(SYSTEM_PROMPT, user)
      .then((text) => {
        const k = parseChoice(text, items.length);
        if (k !== null) this.pending.set(id, { goalId: items[k].id, at: tick });
      })
      .catch(() => { /* network or model failure: the heuristic already has this covered */ })
      .finally(() => this.inflight.delete(id));
  }

  /** The model's pick for this character if it is fresh and still a valid option; otherwise null. */
  take(id: number, tick: number, allowed: Set<string>): string | null {
    const p = this.pending.get(id);
    if (!p) return null;
    this.pending.delete(id);
    if (tick - p.at > this.budget.maxAgeTicks || !allowed.has(p.goalId)) return null;
    return p.goalId;
  }
}

/** The active brain, or null. Null means the sim is fully deterministic and offline. */
let active: LlmBrain | null = null;
export function getLlm(): LlmBrain | null { return active; }
export function setLlm(b: LlmBrain | null): void { active = b; }

/**
 * Reads ?llm=hf|local|webllm from the page URL. Optional: llmUrl overrides the endpoint, llmModel picks the
 * WebLLM model. Returns null (and changes nothing) when the parameter is missing or unknown.
 */
export async function llmFromQuery(search: string): Promise<LlmBrain | null> {
  const q = new URLSearchParams(search);
  const kind = q.get("llm");
  if (!kind) return null;
  try {
    // hf needs the Worker's own URL: it is deployed separately from the Pages site, so there is no safe default
    if (kind === "hf") {
      const url = q.get("llmUrl");
      return url ? new LlmBrain(hfWorkerChooser(url)) : null;
    }
    if (kind === "local") return new LlmBrain(localGgufChooser(q.get("llmUrl") ?? undefined));
    if (kind === "webllm") return new LlmBrain(await webLlmChooser(q.get("llmModel") ?? undefined));
  } catch {
    return null;
  }
  return null;
}
