import { MenuItem, SYSTEM_PROMPT, buildMenu, parseChoice } from "./choice";
import { Chooser, hfWorkerChooser, localGgufChooser, webLlmChooser, ollamaChooser, hfDirectChooser, ggufFileChooser, claudeChooser, openAiCompatChooser, OLLAMA_CLOUD_URL } from "./backends";

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

  /** Ask for this character's next pick. `context` is the character card (who they are, how they feel, where they are). */
  request(id: number, items: MenuItem[], tick: number, context = ""): void {
    if (items.length < 2 || this.inflight.has(id)) return;
    const t = this.now();
    this.calls = this.calls.filter((x) => t - x < 60_000);
    if (this.calls.length >= this.budget.maxPerMinute) return;
    this.calls.push(t);
    this.inflight.add(id);
    const user = `${context ? context + "\n\n" : ""}What do you do next?\n${buildMenu(items)}\nReply with one number.`;
    this.chooser(SYSTEM_PROMPT, user)
      .then((text) => {
        const k = parseChoice(text, items.length);
        if (k !== null) this.pending.set(id, { goalId: items[k].id, at: tick });
      })
      .catch(() => { /* network or model failure: the heuristic already has this covered */ })
      .finally(() => this.inflight.delete(id));
  }

  /** Check the backend answers. Does not count against the budget. */
  test(): Promise<boolean> { return testLlm(this.chooser); }

  /** The model's pick for this character if it is fresh and still a valid option; otherwise null. */
  take(id: number, tick: number, allowed: Set<string>): string | null {
    const p = this.pending.get(id);
    if (!p) return null;
    this.pending.delete(id);
    if (tick - p.at > this.budget.maxAgeTicks || !allowed.has(p.goalId)) return null;
    return p.goalId;
  }
}

/**
 * The connected brains. Each principal is given one of them (by id), so several models can run the town at once.
 * Empty means the sim is fully deterministic and offline.
 */
let pool: LlmBrain[] = [];
export function getLlm(id = 0): LlmBrain | null { return pool.length ? pool[Math.abs(id) % pool.length] : null; }
export function setLlm(b: LlmBrain | null): void { pool = b ? [b] : []; }
export function setLlmPool(brains: LlmBrain[]): void { pool = brains.slice(); }
export function llmPoolSize(): number { return pool.length; }

export type LlmKind = "off" | "ollama" | "claude" | "openai" | "gemini" | "openrouter" | "hfdirect" | "gguf" | "local" | "webllm" | "hf";
export interface LlmChoice { kind: LlmKind; url?: string; model?: string; token?: string; file?: Blob }

/** Build a brain for the chosen backend. Null when off, misconfigured, or the backend fails to load. */
export async function llmFromChoice(c: LlmChoice): Promise<LlmBrain | null> {
  const url = c.url?.trim() || undefined;
  try {
    // hf needs the Worker's own URL: it is deployed separately from the Pages site, so there is no safe default
    if (c.kind === "hf") return url ? new LlmBrain(hfWorkerChooser(url)) : null;
    if (c.kind === "ollama") return c.model?.trim() ? new LlmBrain(ollamaChooser(c.model.trim(), url ?? (c.token?.trim() ? OLLAMA_CLOUD_URL : undefined), c.token?.trim() || undefined)) : null;
    if (c.kind === "hfdirect") return c.token?.trim() && c.model?.trim() ? new LlmBrain(hfDirectChooser(c.token.trim(), c.model.trim())) : null;
    if (c.kind === "claude") return c.token?.trim() ? new LlmBrain(await claudeChooser(c.token.trim(), c.model?.trim() || undefined)) : null;
    if (c.kind === "openai" || c.kind === "gemini" || c.kind === "openrouter") return url && c.token?.trim() && c.model?.trim() ? new LlmBrain(openAiCompatChooser(url, c.token.trim(), c.model.trim())) : null;
    if (c.kind === "gguf") return c.file ? new LlmBrain(await ggufFileChooser(c.file)) : null;
    if (c.kind === "local") return new LlmBrain(localGgufChooser(url));
    if (c.kind === "webllm") return new LlmBrain(await webLlmChooser(c.model?.trim() || undefined));
  } catch {
    return null;
  }
  return null;
}

/**
 * Reads ?llm=hf|local|webllm from the page URL (llmUrl and llmModel optional). Null when absent or unknown.
 * A URL parameter overrides the Settings choice, which is handy for testing.
 */
export function choiceFromQuery(search: string): LlmChoice | null {
  const q = new URLSearchParams(search);
  const kind = q.get("llm");
  if (kind !== "hf" && kind !== "local" && kind !== "webllm" && kind !== "ollama") return null;
  return { kind, url: q.get("llmUrl") ?? undefined, model: q.get("llmModel") ?? undefined };
}

export async function llmFromQuery(search: string): Promise<LlmBrain | null> {
  const c = choiceFromQuery(search);
  return c ? llmFromChoice(c) : null;
}

/** One tiny request to check the backend answers in the expected format. */
export async function testLlm(chooser: (system: string, user: string) => Promise<string>): Promise<boolean> {
  try { return parseChoice(await chooser(SYSTEM_PROMPT, "1. wander\n2. rest\nReply with one number."), 2) !== null; } catch { return false; }
}
