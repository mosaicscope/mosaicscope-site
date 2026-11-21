import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

/** Local dev/preview: serve the main site's content.json at /content.json, like production does. */
const siteContent = {
  name: "site-content",
  configureServer(server: any) { server.middlewares.use(serve); },
  configurePreviewServer(server: any) { server.middlewares.use(serve); },
};
function serve(req: any, res: any, next: any) {
  if (req.url?.split("?")[0] !== "/content.json") return next();
  try { res.setHeader("Content-Type", "application/json"); res.end(fs.readFileSync(fileURLToPath(new URL("../content.json", import.meta.url)))); } catch { next(); }
}

/** Local dev/preview: run the same /api/cameras Pages Function the deployed site uses, so the camera directory works offline from the deploy. */
const cameraApi = {
  name: "camera-api",
  configureServer(server: any) { server.middlewares.use(cameras); },
  configurePreviewServer(server: any) { server.middlewares.use(cameras); },
};
async function cameras(req: any, res: any, next: any) {
  if (req.url?.split("?")[0] !== "/api/cameras") return next();
  try {
    const mod = await import(new URL("../functions/api/cameras.js", import.meta.url).href);
    const r: Response = await mod.onRequestGet({ request: new Request("http://localhost" + req.url) });
    res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(await r.text());
  } catch { res.statusCode = 503; res.end('{"error":"Camera directory unavailable"}'); }
}

// Local previews use the same public read-only city endpoints as the deployed game.
const cityProxy=Object.fromEntries(['/api/city-aerial','/api/city-address','/api/destination-map','/api/live-city'].map(path=>[path,{target:'https://mosaicscope.pages.dev',changeOrigin:true}]));

// The built game is committed to ../world so the static MosaicScope site serves it at /world/
// without any build step on Cloudflare. The main site never loads anything from here.
export default defineConfig({
  base: "/world/",
  plugins: [siteContent, cameraApi],
  build: {
    outDir: fileURLToPath(new URL("../world", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
  server: { port: 5173, proxy:cityProxy },
  preview: { proxy:cityProxy },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as any);
