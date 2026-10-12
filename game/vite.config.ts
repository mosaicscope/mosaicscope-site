import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// The built game is committed to ../world so the static MosaicScope site serves it at /world/
// without any build step on Cloudflare. The main site never loads anything from here.
export default defineConfig({
  base: "/world/",
  build: {
    outDir: fileURLToPath(new URL("../world", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
  },
  server: { port: 5173 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
} as any);
