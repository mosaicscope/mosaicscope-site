/** Regenerates docs/feature-catalogue.json and the summary table in FEATURE_CATALOGUE.md. */
import fs from "node:fs";
import { buildCatalogue, validateCatalogue, CATEGORIES } from "../src/content/catalogue";
const list = buildCatalogue();
const errs = validateCatalogue(list);
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/feature-catalogue.json", JSON.stringify(list, null, 1));
const by = (s: string) => list.filter((f) => f.status === s).length;
const rows = CATEGORIES.map((c) => { const fs_ = list.filter((f) => f.category === c); return `| ${c} | ${fs_.filter((f) => f.status === "implemented").length} | ${fs_.filter((f) => f.status === "partial").length} | ${fs_.filter((f) => f.status === "planned").length} |`; });
const md = fs.readFileSync("FEATURE_CATALOGUE.md", "utf8");
const table = `<!-- catalogue:start -->\nGenerated ${new Date().toISOString().slice(0, 10)} · **${list.length} entries** · ${by("implemented")} implemented · ${by("partial")} partial · ${by("planned")} planned\n\n| Category | Implemented | Partial | Planned |\n|---|---|---|---|\n${rows.join("\n")}\n<!-- catalogue:end -->`;
fs.writeFileSync("FEATURE_CATALOGUE.md", md.replace(/<!-- catalogue:start -->[\s\S]*<!-- catalogue:end -->/, table));
console.log(`${list.length} entries (${by("implemented")} implemented, ${by("partial")} partial, ${by("planned")} planned), 0 validation errors`);
