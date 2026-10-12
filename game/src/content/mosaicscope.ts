/**
 * MosaicScope business data. Defaults mirror the site's content.json so the world works offline;
 * at runtime the app loads the live /content.json and the Instagram feed (Behold) and calls
 * `setMosaicData`. NPCs only reference posts that actually exist in that feed.
 */
export interface InstaPost { link: string; caption: string; img: string; date: string; video: boolean }
export interface MosaicData {
  owner: string;
  handle: string;
  instagram: string;
  igDm: string;
  booking: string;          // link to the site's booking section
  site: string;
  soundcloud: string;
  rates: { title: string; price: string; unit: string; detail: string }[];
  services: string[];
  location: string;
  posts: InstaPost[];
  live: boolean;            // true once real content.json loaded
}

export const MOSAIC: MosaicData = {
  owner: "Chris", handle: "@mosaicscope", instagram: "https://www.instagram.com/mosaicscope/", igDm: "https://ig.me/m/mosaicscope",
  booking: "/#contact", site: "/", soundcloud: "https://soundcloud.com/orqrackcity/sets/mosaicscope",
  rates: [
    { title: "Photos", price: "$40", unit: "from", detail: "Unedited $40 · Edited in Lightroom $80" },
    { title: "Music videos", price: "$100", unit: "from", detail: "Shoot $100 · Edit $220 · Shoot + edit $300" },
    { title: "Events", price: "$60", unit: "per hour", detail: "Raves, gigs, car meets. Photos or video." },
  ],
  services: ["Artist and press portraits", "Nightlife and events", "Car meets and automotive", "Skate and street", "Personal portraits", "Music videos", "Event films", "Short-form and social content", "Automotive films"],
  location: "Christchurch · Aotearoa NZ",
  posts: [],
  live: false,
};

export function setMosaicData(d: Partial<MosaicData>): void { Object.assign(MOSAIC, d); }

/** First readable line of a caption, without hashtags/mentions (same rule as the main site). */
export function captionLine(cap: string): string {
  const line = (cap || "").split("\n")[0].replace(/[#@][\w.]+/g, " ").replace(/\s+/g, " ").trim().replace(/(\s*(and|with|w\/|x|&|ft\.?|feat\.?|,|\+|-))+$/i, "").trim();
  if (line.length < 3) return "";
  return line.length > 60 ? line.slice(0, 57).trim() + "…" : line;
}

/** Shoot types NPCs book, mapped to the real price list. */
export const SHOOTS: { id: string; label: string; price: number; who: string[]; place: string }[] = [
  { id: "portrait", label: "an edited portrait shoot", price: 80, who: ["musician", "student", "local", "tourist"], place: "studio" },
  { id: "press", label: "press portraits for a release", price: 80, who: ["musician"], place: "studio" },
  { id: "carmeet", label: "car meet photos", price: 60, who: ["car_enthusiast"], place: "dealership" },
  { id: "skate", label: "a skate session shoot", price: 40, who: ["skater"], place: "playground" },
  { id: "musicvideo", label: "a music video (shoot + edit, $300)", price: 300, who: ["musician"], place: "stage" },
  { id: "rave", label: "event coverage at After Hours", price: 60, who: ["bouncer", "musician"], place: "stage" },
  { id: "quick", label: "a quick unedited shoot", price: 40, who: ["student", "local", "office", "barista"], place: "plaza" },
];

/** Lines the crew use to talk up the business. {post} = a real caption, {rate} = a real price. */
export const PLUG_LINES = [
  "Chris shot my mate's car at the meet. Go look at @mosaicscope.",
  "If you need photos, MosaicScope. Photos start at {rate}.",
  "Did you see the new @mosaicscope post, \"{post}\"? Go check it out.",
  "That \"{post}\" post on @mosaicscope? Unreal.",
  "Kodak reckons @mosaicscope's latest is the best one yet: \"{post}\".",
  "Booking a shoot with MosaicScope this week. Just send a few reference pics, he said.",
  "Free to post anywhere, just tag @mosaicscope.",
  "Music video? Shoot plus edit is $300 at MosaicScope. Bargain.",
  "MosaicScope does car meets, raves, skate, portraits. The lot.",
  "Follow @mosaicscope, there's a new one up.",
];
