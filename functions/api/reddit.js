// Cloudflare Pages Function: /api/reddit
// What Christchurch and New Zealand are talking about right now: the hot post titles from r/chch and r/newzealand,
// for the townspeople in the world game to mention in passing. You never need to edit this file.
// No API key. Tries Reddit's public JSON, falls back to the RSS feed. NSFW, pinned, link-dump and grim posts are
// dropped. Cached for 30 minutes so Reddit is asked at most twice an hour.

const SUBS = "chch+newzealand";
const UA = "Mozilla/5.0 (compatible; MosaicScopeSite/1.0; +https://mosaicscope.pages.dev)";
// a cheerful street game: leave out the news nobody wants a stick figure to chirp about
const GRIM = /\b(died|dies|dead|death|killed|kill|murder|suicide|assault|abuse|rape|stabb|shooting|shot|crash victim|missing|funeral|tragedy|terror|overdose|cancer)\b/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=1800",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** A title someone could say out loud: one line, no links, not too long, nothing grim. */
function speakable(t) {
  t = decode(t).replace(/\s+/g, " ").replace(/\[[^\]]*\]|\([^)]*\)/g, "").trim();
  if (t.length < 12 || t.length > 110) return "";
  if (/https?:|www\.|r\/|u\/|@/i.test(t) || GRIM.test(t)) return "";
  return t;
}

async function fromJson() {
  const r = await fetch(`https://www.reddit.com/r/${SUBS}/hot.json?limit=60&raw_json=1`, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.data?.children || []).map((c) => c.data).filter((p) => p && !p.over_18 && !p.stickied && !p.spoiler)
    .map((p) => ({ title: speakable(p.title), sub: p.subreddit, score: p.score | 0 }));
}

async function fromRss() {
  const r = await fetch(`https://www.reddit.com/r/${SUBS}/hot/.rss?limit=60`, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const xml = await r.text();
  return xml.split("<entry>").slice(1).map((e) => ({
    title: speakable((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]),
    sub: ((e.match(/<category[^>]*term="([^"]+)"/) || [])[1] || "").replace(/^r\//, ""),
    score: 0
  }));
}

export async function onRequestGet(ctx) {
  const cache = caches.default, key = new Request(new URL("/api/reddit", ctx.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let posts = [];
  try { posts = await fromJson(); } catch { posts = []; }
  if (!posts.length) { try { posts = await fromRss(); } catch { posts = []; } }
  const seen = new Set();
  posts = posts.filter((p) => p.title && !seen.has(p.title) && seen.add(p.title)).sort((a, b) => b.score - a.score).slice(0, 30);
  const res = json({ updated: new Date().toISOString(), posts });
  if (posts.length) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
