// Cloudflare Pages Function: /api/youtube?channel=UC...
// Lists a channel's latest videos without an API key. You never need to edit this file.
// It tries the channel's public RSS feed first, then the channel's videos page,
// and fills in each title with YouTube's public oEmbed endpoint. Results are cached for an hour.

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; MosaicScopeSite/1.0)",
  "Accept-Language": "en",
  "Cookie": "CONSENT=YES+1; SOCS=CAI"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function fromRss(channel) {
  const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channel, { headers: HEADERS });
  if (!r.ok) return [];
  const xml = await r.text();
  const out = [];
  const entries = xml.split("<entry>").slice(1);
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    out.push({
      id,
      title: decode((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]),
      published: (e.match(/<published>(.*?)<\/published>/) || [])[1] || ""
    });
  }
  return out;
}

async function fromPage(channel) {
  const r = await fetch("https://www.youtube.com/channel/" + channel + "/videos", { headers: HEADERS });
  if (!r.ok) return [];
  const html = await r.text();
  const ids = [];
  const re = /"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(html)) && ids.length < 24) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids.map((id) => ({ id, title: "", published: "" }));
}

async function withTitle(v) {
  if (v.title) return v;
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent("https://www.youtube.com/watch?v=" + v.id), { headers: HEADERS });
    if (r.ok) {
      const o = await r.json();
      return Object.assign({}, v, { title: o.title || "" });
    }
  } catch (e) { /* keep going */ }
  return v;
}

export async function onRequestGet({ request }) {
  const channel = new URL(request.url).searchParams.get("channel") || "";
  if (!/^UC[\w-]{22}$/.test(channel)) return json({ videos: [], error: "Add a channel id that starts with UC" }, 400);
  let list = [];
  try { list = await fromRss(channel); } catch (e) { list = []; }
  if (!list.length) { try { list = await fromPage(channel); } catch (e) { list = []; } }
  list = list.slice(0, 12);
  const videos = (await Promise.all(list.map(withTitle))).map((v) => ({
    id: v.id,
    title: v.title,
    published: v.published,
    url: "https://www.youtube.com/watch?v=" + v.id,
    thumb: "https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg"
  }));
  return json({ videos });
}
