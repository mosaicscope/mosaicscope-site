import { h } from "./dom";
import type { BrainConf, Settings } from "../persistence/Settings";
import { OLLAMA_DEFAULT_URL, OLLAMA_CLOUD_URL, OPENAI_COMPAT_PRESETS, CLAUDE_DEFAULT_MODEL, WEBLLM_DEFAULT_MODEL, listOllamaModels } from "../ai/llm/backends";

/** What the panel needs from the game. */
export interface BrainsHost {
  settings: Settings;
  /** Live status line per brain id ("connected", "connecting…", "not reachable", …). */
  status(id: string): string;
  ggufName(): string;
  setGguf(file: File | null): void;
  save(): void;
  reconnect(): void;
}

interface Section { id: string; title: string; blurb: string; fields: ("url" | "model" | "key")[]; urlHint?: string; modelHint?: string; keyHint?: string; link?: [string, string] }

const preset = (id: string) => OPENAI_COMPAT_PRESETS.find((p) => p.id === id)!;

const SECTIONS: Section[] = [
  { id: "ollama", title: "Ollama (free account, or on your computer with your GPU)", blurb: "Easiest: make a free account at ollama.com, create an API key there, and paste it below. No install, it uses Ollama's cloud models. Or leave the key blank to use the Ollama app on this computer (uses your GPU): pull a model (ollama pull llama3.2) and start it with OLLAMA_ORIGINS set to this site's address. Your own GGUF works too: ollama create mymodel -f Modelfile with FROM ./your.gguf.", fields: ["key", "model", "url"], keyHint: "blank = Ollama app on this computer", urlHint: "blank = ollama.com with a key, else " + OLLAMA_DEFAULT_URL, modelHint: "llama3.2 (or pick below)", link: ["Free account + API key", "https://ollama.com/settings/keys"] },
  { id: "claude", title: "Claude (Anthropic API key)", blurb: "A Claude.ai subscription can't be used here; this needs an API key from the Anthropic Console (pay as you go). The key is stored in this browser only.", fields: ["key", "model"], keyHint: "sk-ant-…", modelHint: CLAUDE_DEFAULT_MODEL, link: ["Get a key", "https://console.anthropic.com/settings/keys"] },
  { id: "openai", title: "ChatGPT (OpenAI API key)", blurb: "Needs an API key, not a ChatGPT Plus login. Stored in this browser only.", fields: ["key", "model"], keyHint: "sk-…", modelHint: preset("openai").model, link: ["Get a key", preset("openai").keyUrl] },
  { id: "gemini", title: "Gemini (Google AI Studio key)", blurb: "Free tier available. Stored in this browser only.", fields: ["key", "model"], modelHint: preset("gemini").model, link: ["Get a key", preset("gemini").keyUrl] },
  { id: "openrouter", title: "OpenRouter (hundreds of models, one key)", blurb: "One key for many providers. Pick any model id from their list.", fields: ["key", "model"], modelHint: "e.g. meta-llama/llama-3.2-3b-instruct", link: ["Get a key", preset("openrouter").keyUrl] },
  { id: "hfdirect", title: "Hugging Face (your access token)", blurb: "Uses Hugging Face Inference Providers with your own token. Pick a model that lists Inference Providers on its page.", fields: ["key", "model"], keyHint: "hf_…", modelHint: "meta-llama/Llama-3.2-1B-Instruct", link: ["Get a token", "https://huggingface.co/settings/tokens"] },
  { id: "gguf", title: "Drop a GGUF file", blurb: "Runs right in this page with wllama (on the CPU; browsers can't run GGUF on the GPU yet, so for GPU use Ollama above). Small models (1–3B, Q4) work best. You'll need to drop it again after a reload.", fields: [] },
  { id: "webllm", title: "In-browser on the GPU (WebLLM)", blurb: "Uses your GPU through WebGPU with pre-converted models. First run downloads about 1 GB.", fields: ["model"], modelHint: WEBLLM_DEFAULT_MODEL, link: ["Model list", "https://github.com/mlc-ai/web-llm"] },
  { id: "hf", title: "Site Worker (Hugging Face, owner's token)", blurb: "For the site owner: the Cloudflare Worker in game/llm-worker keeps the token on the server so visitors don't need one.", fields: ["url"], urlHint: "https://mosaics-llm.<you>.workers.dev" },
  { id: "local", title: "Local GGUF server (node-llama-cpp)", blurb: "Run game/scripts/llm-local.mjs with LLM_GGUF=/path/to/model.gguf.", fields: ["url"], urlHint: "http://127.0.0.1:8787/chat" },
];

export function brainsBody(host: BrainsHost): HTMLElement[] {
  const s = host.settings;
  const conf = (id: string): BrainConf => (s.brains[id] ??= { on: false, url: "", model: "", key: "" });
  const statusEls = new Map<string, HTMLElement>();
  const commit = () => { host.save(); host.reconnect(); refresh(); };

  const sectionEl = (sec: Section): HTMLElement => {
    const c = conf(sec.id);
    const st = h("span.brain-status", { text: host.status(sec.id), "aria-live": "polite" });
    statusEls.set(sec.id, st);
    const input = (field: "url" | "model" | "key", hint = "") => h("label", null, [
      field === "key" ? "Key / token" : field === "url" ? "Address" : "Model",
      h("input", { type: field === "key" ? "password" : "text", value: c[field], placeholder: hint, autocomplete: "off", spellcheck: false,
        onchange: (e: Event) => { c[field] = (e.target as HTMLInputElement).value.trim(); commit(); } }),
    ]);
    const extra: HTMLElement[] = [];
    if (sec.id === "ollama") {
      const pick = h("select", { "aria-label": "Installed Ollama models", onchange: (e: Event) => { c.model = (e.target as HTMLSelectElement).value; commit(); } }, [h("option", { value: "", text: "Find my models first" })]) as HTMLSelectElement;
      const scan = async () => {
        try {
          const names = await listOllamaModels(c.url || (c.key ? OLLAMA_CLOUD_URL : OLLAMA_DEFAULT_URL), c.key || undefined);
          pick.replaceChildren(...(names.length ? names : ["(no models: run ollama pull llama3.2)"]).map((n) => h("option", { value: names.length ? n : "", text: n, selected: n === c.model })));
          if (names.length && !c.model) { c.model = names[0]; commit(); }
        } catch {
          pick.replaceChildren(h("option", { value: "", text: "Ollama isn't reachable from this page" }));
        }
      };
      extra.push(h("div.row", null, [h("button.btn", { onclick: scan, text: "Find my models" }), pick]));
      if (c.on) scan(); // self-updating: look as soon as the tab opens (only when Ollama is ticked)
    }
    if (sec.id === "gguf") {
      const name = h("span", { text: host.ggufName() || "No file yet" });
      const take = (f: File | undefined | null) => { if (!f) return; host.setGguf(f); name.textContent = `${f.name} (${(f.size / 1e9).toFixed(2)} GB)`; c.on = true; commit(); };
      const drop = h("div.brain-drop", {
        tabindex: 0, role: "button", "aria-label": "Drop a GGUF file here or press to choose one",
        ondragover: (e: DragEvent) => { e.preventDefault(); },
        ondrop: (e: DragEvent) => { e.preventDefault(); take(e.dataTransfer?.files?.[0]); },
        onclick: () => file.click(),
        onkeydown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } },
      }, [h("strong", { text: "Drop a .gguf file here" }), " or click to choose one. ", name]);
      const file = h("input", { type: "file", accept: ".gguf", hidden: true, onchange: (e: Event) => take((e.target as HTMLInputElement).files?.[0]) }) as HTMLInputElement;
      extra.push(drop, file);
    }
    return h("details.brain", { open: c.on }, [
      h("summary", null, [
        h("input", { type: "checkbox", checked: c.on, "aria-label": `Use ${sec.title}`, onclick: (e: Event) => e.stopPropagation(), onchange: (e: Event) => { c.on = (e.target as HTMLInputElement).checked; commit(); } }),
        " ", sec.title, " ", st,
      ]),
      h("p.muted", { text: sec.blurb }),
      ...(sec.link ? [h("p", null, [h("a", { href: sec.link[1], target: "_blank", rel: "noopener", text: sec.link[0] + " ↗" })])] : []),
      ...sec.fields.map((f) => input(f, f === "url" ? sec.urlHint : f === "model" ? sec.modelHint : sec.keyHint)),
      ...extra,
    ]);
  };

  const summary = h("p.brain-summary", { "aria-live": "polite" });
  const refresh = () => {
    let on = 0;
    for (const [id, el] of statusEls) { el.textContent = host.status(id); if (host.status(id).startsWith("connected")) on++; }
    summary.textContent = on ? `${on} brain${on > 1 ? "s" : ""} connected. Each Mosaic is given one of them; the rest of the town keeps its built-in brains.` : "No brains connected: everyone uses the built-in brains (fully offline).";
  };
  // self-updating while the tab is open; stops once the panel is closed and its elements leave the page
  const timer = setInterval(() => { if (!summary.isConnected) clearInterval(timer); else refresh(); }, 1500);
  refresh();

  return [
    h("p", { text: "Give the Mosaics real AI brains. Tick one or more; each Mosaic is given one of the connected models. Keys and tokens are saved in this browser only and sent only to the provider you chose." }),
    summary,
    ...SECTIONS.map(sectionEl),
    h("div.row", null, [h("button.btn", { onclick: () => { host.reconnect(); refresh(); }, text: "Reconnect all" })]),
  ];
}
