// Local model server for the game: serves POST /chat from a GGUF file through node-llama-cpp.
// Usage: LLM_GGUF=/path/to/model.gguf node scripts/llm-local.mjs   (then open the game with ?llm=local)
// node-llama-cpp is not a game dependency; install it yourself before running this script.
import http from "node:http";

const modelPath = process.env.LLM_GGUF;
if (!modelPath) { console.error("Set LLM_GGUF to a .gguf file path"); process.exit(1); }
const port = Number(process.env.LLM_PORT || 8787);

const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
const llama = await getLlama();
const model = await llama.loadModel({ modelPath });
const context = await model.createContext({ contextSize: 2048 });

let queue = Promise.resolve(); // one prompt at a time: the context is shared

async function pick(system, user) {
  const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: system });
  try {
    return await session.prompt(user, { maxTokens: 8, temperature: 0 });
  } finally {
    session.dispose();
  }
}

http.createServer((req, res) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.method !== "POST" || req.url !== "/chat") { res.writeHead(404, cors); return res.end(); }
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 16000) req.destroy(); });
  req.on("end", () => {
    let body;
    try { body = JSON.parse(raw); } catch { res.writeHead(400, cors); return res.end("bad json"); }
    queue = queue.then(async () => {
      try {
        const text = await pick(String(body.system ?? ""), String(body.user ?? ""));
        res.writeHead(200, { ...cors, "content-type": "application/json" });
        res.end(JSON.stringify({ text }));
      } catch (e) {
        res.writeHead(500, cors); res.end(String(e));
      }
    });
  });
}).listen(port, "127.0.0.1", () => console.log(`llm-local on http://127.0.0.1:${port}/chat`));
