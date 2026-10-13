/**
 * Refreshes the "changes" half of src/content/terrance-feed.json from git history (merged PR subjects).
 * "drama" is hand-kept by Terrance's routine from the team issues, so it is preserved as-is.
 * Usage: npm run terrance
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../src/content/terrance-feed.json", import.meta.url);
const feed = JSON.parse(readFileSync(path, "utf8")) as { updated: string; changes: string[]; drama: string[] };
const log = execSync("git log -n 8 --no-merges --format=%s", { encoding: "utf8" }).split("\n").map((s) => s.trim()).filter(Boolean);
const shipped = log.map((s) => s.replace(/\s*\(#\d+\)$/, "").slice(0, 140));
feed.changes = [...feed.changes.filter((c) => c.startsWith("Open and waiting") || c.startsWith("Terrance")), ...shipped].slice(0, 8);
feed.updated = new Date().toISOString().slice(0, 10);
writeFileSync(path, JSON.stringify(feed, null, 2) + "\n");
console.log(`terrance-feed: ${feed.changes.length} changes, ${feed.drama.length} drama`);
