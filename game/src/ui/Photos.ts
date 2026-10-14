import "./photos.css";
import { h } from "./dom";
import { Album, FILTERS, FILTER_IDS, FRAMES, FRAME_IDS, MOMENTS, MomentGate, standing, tiltFor, wallFrameFor, WALL_COUNT, type FilterId, type FrameId, type Shot } from "../content/photos";
import { capture, framed, polaroid } from "../render/PolaroidArt";
import type { StorageProvider } from "../persistence/storage";

export interface PhotosHost {
  world(): HTMLCanvasElement;
  /** The walk-in interior's canvas while one is open, otherwise null. */
  interior(): HTMLCanvasElement | null;
  show(title: string, body: (HTMLElement | null)[], cls?: string): void;
  close(): void;
  toast(text: string, kind?: string): void;
  /** Where the player is, for default captions ("Colombo Street"). */
  where(): string;
  /** The sim's own -1..1 public standing for the player. */
  simRep(): number;
  /** The Mosaics in the shot right now, nearest the middle of the frame first. */
  subjects?(): Subject[];
}

/** A Mosaic caught in a photo, with the lore that drops when you snap them. */
export interface Subject { id: number; name: string; nickname: string; bio: string; catchphrase: string; likes: string[]; style: string }

const LORE_KEY = "lore-found";

/** Which Mosaics you have photographed (their lore is unlocked). Lives in the album's storage so it survives new worlds. */
export class LoreBook {
  found = new Set<number>();
  constructor(private store: StorageProvider | null = null) {
    try { const raw = store?.get(LORE_KEY); if (raw) for (const id of JSON.parse(raw) as number[]) this.found.add(id); } catch { /* bad save: start fresh */ }
  }
  /** Record a sighting; true the first time this Mosaic is caught. */
  catch(id: number): boolean {
    if (this.found.has(id)) return false;
    this.found.add(id); this.store?.set(LORE_KEY, JSON.stringify([...this.found]));
    return true;
  }
}

const stampNow = (): string => new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
const load = (src: string, then: (im: HTMLImageElement) => void): void => { const im = new Image(); im.onload = () => then(im); im.src = src; };

/**
 * Photo mode (O, or the Photo button), the polaroid spot in the gallery, the reputation wall in your
 * flat and the gallery wall. The album lives under its own storage key so it survives new worlds.
 */
export class Photos {
  album: Album;
  lore: LoreBook;
  private gate = new MomentGate();
  constructor(private host: PhotosHost, store: StorageProvider | null) { this.album = new Album(store); this.lore = new LoreBook(store); }

  private source(): HTMLCanvasElement { return this.host.interior() ?? this.host.world(); }

  /** Photo mode. `spot` is the gallery's polaroid spot: the same panel, framed as a polaroid with the place on it. */
  open(spot = false, place = ""): void {
    const src = this.source();
    if (!src.width || !src.height) { this.host.toast("Nothing to photograph yet."); return; }
    let raw: HTMLCanvasElement;
    try { raw = capture(src, src.width, src.height, "none"); } catch { this.host.toast("The camera jammed. Try again."); return; }
    // who is in the shot is fixed at the moment the shutter opens, like the picture itself
    const who = this.host.interior() ? [] : this.host.subjects?.() ?? [];
    const where = spot ? place : this.host.where();
    const st = { filter: "none" as FilterId, frame: "cream" as FrameId, caption: who.length ? `${who[0].name}${where ? " · " + where : ""}` : where };
    const prev = h("div.ph-prev"), name = h("small.ph-name");
    let out: HTMLCanvasElement | null = null;
    const redraw = () => {
      const pic = capture(raw, raw.width, raw.height, st.filter);
      out = polaroid(pic, st.frame, st.caption, stampNow(), 1);
      out.className = "ph-canvas"; out.setAttribute("role", "img"); out.setAttribute("aria-label", `Preview: ${FRAMES[st.frame].name} frame, ${FILTERS[st.filter].name} filter`);
      prev.replaceChildren(out);
      name.textContent = `${FRAMES[st.frame].name}: ${FRAMES[st.frame].blurb}`;
    };
    const chips = <T extends string>(ids: T[], label: (id: T) => string, get: () => T, set: (id: T) => void): HTMLElement => {
      const btns: HTMLButtonElement[] = ids.map((id) => h("button.ph-chip", { type: "button", "aria-pressed": String(get() === id), text: label(id), onclick: () => { set(id); btns.forEach((b, i) => b.setAttribute("aria-pressed", String(ids[i] === get()))); redraw(); } }) as HTMLButtonElement);
      return h("div.ph-chips", { role: "group" }, btns);
    };
    const cap = h("input", { type: "text", maxlength: 28, value: st.caption, placeholder: "Caption", "aria-label": "Caption", oninput: (e: Event) => { st.caption = (e.target as HTMLInputElement).value; redraw(); } });
    redraw();
    this.host.show(spot ? "Polaroid spot" : "Photo mode", [
      h("p.ph-lede", { text: spot ? "Stand on the red mat. Pick a frame. Say cheese." : "Pick a filter and a frame, then snap it. Pictures pin to your reputation wall at home." }),
      prev, name,
      h("h3", { text: "Frame" }), chips(FRAME_IDS, (id) => FRAMES[id].name, () => st.frame, (id) => { st.frame = id; }),
      h("h3", { text: "Filter" }), chips(FILTER_IDS, (id) => FILTERS[id].name, () => st.filter, (id) => { st.filter = id; }),
      h("label.ph-cap", null, ["Caption", cap]),
      h("div.row", null, [
        h("button.btn.red", { type: "button", text: "Snap it", onclick: () => {
          const pic = capture(raw, raw.width, raw.height, st.filter);
          let img = ""; try { img = pic.toDataURL("image/jpeg", 0.8); } catch { /* tainted or blocked */ }
          if (!img) { this.host.toast("Couldn't develop that one."); return; }
          this.album.add({ kind: "photo", frame: st.frame, filter: st.filter, caption: st.caption, score: MOMENTS.photo.score, deed: "photo", img });
          this.host.toast(spot ? "Developed and pinned. It's on your reputation wall." : "Snapped. Pinned to your reputation wall.", "acid");
          this.host.close();
          if (who.length) this.loreDrop(who);
        } }),
        h("button.btn", { type: "button", text: "Save PNG", onclick: () => this.download(out, st.caption) }),
      ]),
    ], "photo");
  }

  /** Name the Mosaic in the shot; the first time you catch one, their lore drops. */
  private loreDrop(who: Subject[]): void {
    const m = who[0], first = this.lore.catch(m.id);
    for (const o of who.slice(1)) this.lore.catch(o.id);
    const also = who.length > 1 ? `Also in the shot: ${who.slice(1).map((o) => o.name).join(", ")}.` : "";
    if (!first) { this.host.toast(`📷 That's ${m.name}. ${also}`.trim(), ""); return; }
    this.host.show(`Lore unlocked: ${m.name}`, [
      h("p.ph-lede", null, [h("b", { text: m.nickname ? `"${m.nickname}"` : m.name }), ` · ${this.lore.found.size} Mosaics caught on camera`]),
      m.bio ? h("p", { text: m.bio }) : null,
      m.catchphrase ? h("p", null, [h("i", { text: `"${m.catchphrase}"` })]) : null,
      m.likes.length ? h("p", { style: { color: "var(--dim)" }, text: `Into: ${m.likes.join(", ")} · moves: ${m.style}` }) : null,
      also ? h("p", { style: { color: "var(--dim)" }, text: also }) : null,
    ], "photo");
  }

  private download(c: HTMLCanvasElement | null, caption: string): void {
    if (!c) return;
    try {
      c.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a"), url = URL.createObjectURL(b);
        a.href = url; a.download = `mosaics-${(caption || "polaroid").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "polaroid"}.png`;
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, "image/png");
    } catch { this.host.toast("Saving isn't available here."); }
  }

  /** A notable thing just happened to the player: take a picture of it (rate-limited) and file it. */
  moment(deed: string, street = "", other = "", now = Date.now()): void {
    const def = MOMENTS[deed];
    if (!def || deed === "photo" || !this.gate.allow(deed, now)) return;
    try {
      const src = this.source();
      if (!src.width || !src.height) return;
      const pic = capture(src, src.width, src.height, "none"), id = this.album.shots.length + now;
      const frame = FRAME_IDS[id % FRAME_IDS.length];
      this.album.add({ kind: "moment", frame, filter: "none", caption: def.caption(street || "the street", other), score: def.score, deed, img: pic.toDataURL("image/jpeg", 0.78) });
      this.host.toast("📷 Moment saved to your walls", "");
    } catch { /* no canvas, no picture: fine */ }
  }

  /** The wall in your flat: the last things you did, as polaroids. */
  reputationWall(): void {
    const shots = this.album.latest(WALL_COUNT), s = standing(this.album, this.host.simRep());
    const grid = h("div.ph-wall");
    this.host.show("Reputation wall", [
      h("p.ph-lede", null, [h("b", { text: s.title }), ` · ${s.points} points · ${this.album.shots.length} pictures`]),
      shots.length ? grid : h("p", { style: { color: "var(--dim)" }, text: "Nothing pinned yet. Take a photo (O) or do something worth remembering, and it turns up here." }),
      h("p", { style: { color: "var(--dim)" }, text: "The wall keeps your last eight. The best ones hang in the MosaicScope Gallery." }),
    ], "photo");
    for (const sh of shots) this.pin(grid, sh, (im) => polaroid(im, sh.frame, sh.caption, new Date(sh.t).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }), sh.id), true);
  }

  /** The gallery wall: your best moments as framed pictures, best in gold. */
  galleryWall(): void {
    const shots = this.album.best(WALL_COUNT);
    const grid = h("div.ph-wall.framed");
    this.host.show("Your best moments", [
      h("p.ph-lede", { text: shots.length ? "Hung by the gallery, best first." : "The wall is bare. The gallery is waiting for you to do something worth framing." }),
      shots.length ? grid : null,
    ], "photo");
    shots.forEach((sh, rank) => this.pin(grid, sh, (im) => framed(im, wallFrameFor(rank), sh.caption || "Untitled"), false));
  }

  private pin(grid: HTMLElement, sh: Shot, draw: (im: HTMLImageElement) => HTMLCanvasElement, removable: boolean): void {
    const card = h("figure.ph-card", { style: { "--tilt": tiltFor(sh.id).toFixed(2) + "deg" } });
    grid.append(card);
    load(sh.img, (im) => {
      const c = draw(im); c.setAttribute("role", "img"); c.setAttribute("aria-label", sh.caption || "Photo");
      card.prepend(c);
      if (removable) card.append(h("button.ph-x", { type: "button", "aria-label": `Take down: ${sh.caption || "photo"}`, text: "×", onclick: () => { this.album.remove(sh.id); card.remove(); } }));
    });
  }
}
