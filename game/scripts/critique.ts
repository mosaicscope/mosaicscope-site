import { reviewAll } from "../src/audio/Critique";
import { parseInspo } from "../src/audio/Score";
import inspo from "../src/audio/inspo.json";
for (const r of reviewAll(parseInspo(inspo))) console.log(r.scene.padEnd(10), String(r.total).padEnd(5), Object.values(r.scores).join(" "), r.notes.join("; "));
