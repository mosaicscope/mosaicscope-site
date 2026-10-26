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

// Local previews use the same public read-only city endpoints as the deployed game.
const cityProxy=Object.fromEntries(['/api/city-address','/api/destination-map','/api/live-city'].map(path=>[path,{target:'https://mosaicscope.pages.dev',changeOrigin:true}]));

// The built game is committed to ../world so the static MosaicScope site serves it at /world/
// without any build step on Cloudflare. The main site never loads anything from here.
export default defineConfig({
  base: "/world/",
  plugins: [siteContent],
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
