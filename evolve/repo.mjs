// Read the repository's tracked text files (Node only). Shared by the security, maintenance and docs runners.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = /^(world\/assets\/|game\/node_modules\/|game\/public\/|images\/|.*\.(png|jpe?g|webp|gif|mp3|mp4|ico|woff2?|lock)$|.*package-lock\.json$)/;
const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });

/** { path: text } for every tracked text file, at a ref ("" = the working tree). */
export function filesAt(ref = "") {
  const list = (ref ? git(["ls-tree", "-r", "--name-only", ref]) : git(["ls-files"])).split("\n").filter((p) => p && !SKIP.test(p));
  const out = {};
  for (const p of list) {
    try {
      const t = ref ? git(["show", `${ref}:${p}`]) : readFileSync(join(ROOT, p), "utf8");
      if (t.length < 2_000_000 && !t.includes("\u0000")) out[p] = t;
    } catch { /* deleted or binary */ }
  }
  return out;
}
