/**
 * Optional local-model companion. Off by default and never required to play. It talks to any local server with an
 * OpenAI-compatible chat endpoint (llama.cpp's llama-server, or Ollama on port 11434). It only rewrites dialogue
 * wording; outcomes, tags and placeholders are never changed. Any failure returns null and the authored line is used.
 */
export interface CompanionConfig { enabled: boolean; url: string; model: string; timeoutMs: number }
export const COMPANION_DEFAULT: CompanionConfig = { enabled: false, url: "http://127.0.0.1:8080", model: "local", timeoutMs: 4000 };

const PLACEHOLDER = /\{\w+\}/g;

export async function companionRewrite(cfg: CompanionConfig, line: string): Promise<string | null> {
  if (!cfg.enabled) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(cfg.url.replace(/\/$/, "") + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 60,
        temperature: 0.8,
        messages: [
          { role: "system", content: "Rewrite the speech bubble in the same meaning, same length, same tone. Keep every {placeholder} exactly as written. Reply with the line only." },
          { role: "user", content: line },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = String(data?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (!out || out.length > 140) return null;
    const need = (line.match(PLACEHOLDER) ?? []).sort().join(" ");
    const got = (out.match(PLACEHOLDER) ?? []).sort().join(" ");
    return need === got ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
