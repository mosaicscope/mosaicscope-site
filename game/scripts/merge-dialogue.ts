// Editor pass: merge writer packs (src/dialogue/packs/lifeN.ts) into src/dialogue/packs/life.ts.
// Keeps only valid exchanges (known tags/placeholders, 2-4 lines, bubble-sized, no line repeated anywhere in the game).
// Usage: npx vite-node scripts/merge-dialogue.ts life4 life5 ...
import fs from "node:fs";
import { EXCHANGES, exchangesReady } from "../src/dialogue/director";
await exchangesReady;
import type { Exchange } from "../src/dialogue/exchanges";
const ROLES = "local student barista chef vendor shopkeeper cop thief graffiti cleaner dealer bouncer busker skater car_enthusiast office tourist mechanic musician photographer medic taxi driver gambler mobster smuggler comic mogul model vigilante villain skibunny zookeeper mosaic player".split(" ");
const MOODS = "happy sad angry scared tired hungry bored broke rich hurt".split(" ");
const PLACES = "street plaza park court studio stage market playground alley casino police food shops residential office dealership hospital gallery airport".split(" ");
const VALID = new Set<string>(["morning","day","evening","night","late","rain","storm","clear","friends","strangers","rivals","couple","crush","party","wanted","post",
  ...PLACES.map((p) => "@" + p), ...ROLES.flatMap((r) => ["a:" + r, "b:" + r]), ...MOODS.flatMap((m) => ["a:" + m, "b:" + m]),
  ...["crime","arrest","crash","fight","graffiti","kiss","shoot","collapse","casino_win","party"].map((e) => "after:" + e)]);
const PH = new Set(["{a}","{b}","{place}","{item}","{who}","{handle}","{rate}","{post}"]);
const seen = new Set(EXCHANGES.flatMap((e) => e.lines.map((l) => l.toLowerCase().trim())));
const ids = new Set(EXCHANGES.map((e) => e.id));
const out: Exchange[] = []; let dropped = 0;
const { LIFE } = await import(process.cwd() + "/src/dialogue/packs/life.ts");
out.push(...(LIFE as Exchange[]));
for (const name of process.argv.slice(2)) {
  const f = `src/dialogue/packs/${name}.ts`;
  if (!fs.existsSync(f)) { console.log("missing", f); continue; }
  const mod = await import(process.cwd() + "/" + f);
  const arr = Object.values(mod).find(Array.isArray) as Exchange[];
  let kept = 0;
  for (const e of arr) {
    const ok = e && typeof e.id === "string" && Array.isArray(e.tags) && Array.isArray(e.lines) && e.lines.length >= 2 && e.lines.length <= 4 && !ids.has(e.id)
      && e.tags.every((t) => VALID.has(t))
      && e.lines.every((l) => typeof l === "string" && l.replace(/\{\w+\}/g, "xxxxxxxx").length <= 80 && (l.match(/\{\w+\}/g) ?? []).every((m) => PH.has(m)) && !seen.has(l.toLowerCase().trim()))
      && (!e.lines.some((l) => l.includes("{who}")) || e.tags.some((t) => t.startsWith("after:") || t === "wanted"))
      && (!e.lines.some((l) => l.includes("{post}")) || e.tags.includes("post"))
      && new Set(e.lines.map((l) => l.toLowerCase())).size === e.lines.length;
    if (!ok) { dropped++; continue; }
    out.push(e); kept++; ids.add(e.id); for (const l of e.lines) seen.add(l.toLowerCase().trim());
  }
  console.log(name, "kept", kept, "of", arr.length);
}
const body = `import type { Exchange } from "../exchanges";\n\n/**\n * Life-and-lore dialogue: exchanges written per walk of life (thieves, cops, the Famiglia, creatives,\n * food and shop workers, nightlife, drivers, medics and office workers, locals and students, the crew\n * and the heroes), merged and checked by the editor pass (scripts/merge-dialogue.ts): valid tags only,\n * bubble-sized, no line repeated anywhere in the game.\n */\nexport const LIFE: Exchange[] = ${JSON.stringify(out, null, 0).replace(/\},\{/g, "},\n{")};\n`;
fs.writeFileSync("src/dialogue/packs/life.ts", body);
console.log("total", out.length, "exchanges /", out.reduce((s, e) => s + e.lines.length, 0), "lines; dropped", dropped);
