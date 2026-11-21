import { h } from './dom';
import './livecams.css';
import { CAMERA_REGIONS, CONTINENTS, nearestRegion, type CameraRegion, type Continent } from '../world/CameraRegions';

/**
 * Worldwide live camera wall. Cameras come from /api/cameras (official, openly licensed public feeds; see
 * functions/api/cameras.js). Stills load lazily, only while on screen, and refresh in place. A camera that
 * fails shows an honest offline state and retries; it never breaks the wall or the game.
 */
interface Cam { id: string; name: string; lat: number; lon: number; img: string; dir: string; page: string | null; at: string | null; km: number }
interface Provider { id: string; name: string; sourceUrl: string; licence: string; licenceUrl: string; attribution: string; refresh: number; rotating: boolean }
interface Listing { fetchedAt: string; provider: Provider; total: number; items: Cam[] }
const PAGE = 12, LISTING_TTL = 90_000;
const listings = new Map<string, { at: number; data: Listing }>();
const link = (text: string, href: string) => h('a', { text, href, target: '_blank', rel: 'noopener noreferrer' });
const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 5 ? 'just now' : s < 90 ? s + 's ago' : Math.round(s / 60) + ' min ago'; };
const bust = (url: string, rotating: boolean) => rotating ? url : url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
const every = (p: Provider) => Math.max(30, p.refresh) * 1000;

/** Fetches one picture off-screen and swaps it in only when it has arrived, so the old frame never flickers away. */
function fetchFrame(url: string, ok: (src: string) => void, fail: () => void): void {
  const im = new Image(); im.referrerPolicy = 'no-referrer'; im.decoding = 'async';
  im.onload = () => ok(im.src); im.onerror = fail; im.src = url;
}

class Tile {
  el: HTMLElement; img: HTMLImageElement; status: HTMLElement; loadedAt = 0; failedAt = 0; seen = false; busy = false;
  constructor(public cam: Cam, private prov: Provider, open: () => void) {
    this.img = h('img', { alt: cam.name + ' live traffic camera', decoding: 'async', referrerpolicy: 'no-referrer' }) as HTMLImageElement;
    this.status = h('span.lc-status', { text: 'Waiting…' });
    const retry = h('button.btn.lc-retry', { text: 'Retry', onclick: (e: Event) => { e.stopPropagation(); this.load(); } });
    this.el = h('article.lc-tile', null, [
      h('button.lc-thumb', { 'aria-label': 'Open ' + cam.name + ' full size', onclick: open }, [this.img, h('span.lc-off', null, [h('b', { text: 'Camera offline' }), h('small', { text: 'No picture right now. It will retry.' }), retry])]),
      h('div.lc-meta', null, [h('b', { text: cam.name }), h('small', { text: cam.dir || (cam.km + ' km from centre') }), this.status]),
    ]);
  }
  due(): boolean { return this.seen && !this.busy && (this.loadedAt ? Date.now() - this.loadedAt >= every(this.prov) : !this.failedAt || Date.now() - this.failedAt > 60_000); }
  load(): void {
    if (this.busy) return; this.busy = true;
    fetchFrame(bust(this.cam.img, this.prov.rotating), src => { this.img.src = src; this.loadedAt = Date.now(); this.failedAt = 0; this.busy = false; this.el.classList.remove('off'); this.paint(); },
      () => { this.failedAt = Date.now(); this.busy = false; if (!this.loadedAt) this.el.classList.add('off'); this.paint(); });
  }
  paint(): void { this.status.textContent = this.loadedAt ? '● Live · ' + ago(this.loadedAt) : this.failedAt ? '○ Offline' : 'Connecting…'; this.status.classList.toggle('bad', !this.loadedAt && !!this.failedAt); }
}

export class LiveCameras {
  private wrap: HTMLElement | null = null; private prevFocus: Element | null = null;
  private region!: CameraRegion; private listing: Listing | null = null; private tiles: Tile[] = [];
  private shown = PAGE; private filter = ''; private continent: Continent | 'All' = 'All'; private regionFilter = '';
  private timer = 0; private observer: IntersectionObserver | null = null; private viewer: { i: number; at: number } | null = null; private viewerTimer = 0;
  private grid!: HTMLElement; private note!: HTMLElement; private foot!: HTMLElement; private chips!: HTMLElement; private more!: HTMLElement; private stage!: HTMLElement;
  private token = 0; private onKey: ((e: KeyboardEvent) => void) | null = null;
  constructor(private host: { mount?: () => HTMLElement | null; toast?: (t: string) => void } = {}) {}
  get open(): boolean { return !!this.wrap; }

  show(home?: { lat: number; lon: number }): void {
    if (this.wrap) return;
    this.prevFocus = document.activeElement;
    this.region = home ? nearestRegion(home.lat, home.lon) : CAMERA_REGIONS[0];
    this.grid = h('div.lc-grid', { 'aria-live': 'polite' }); this.note = h('p.lc-note', { role: 'status' });
    this.foot = h('footer.lc-foot'); this.chips = h('div.lc-chips', { role: 'group', 'aria-label': 'Cities and regions' });
    this.more = h('button.btn.lc-more', { text: 'Show more cameras', onclick: () => { this.shown += PAGE; this.renderGrid(); } });
    this.stage = h('div.lc-stage', { hidden: true });
    const search = h('input', { type: 'search', placeholder: 'Find a city or country', 'aria-label': 'Find a city or country', oninput: (e: Event) => { this.regionFilter = (e.target as HTMLInputElement).value.trim().toLowerCase(); this.renderChips(); } });
    const cams = h('input', { type: 'search', placeholder: 'Filter these cameras by road or name', 'aria-label': 'Filter cameras', oninput: (e: Event) => { this.filter = (e.target as HTMLInputElement).value.trim().toLowerCase(); this.shown = PAGE; this.renderGrid(); } });
    const conts = h('div.lc-conts', null, (['All', ...CONTINENTS] as const).map(c => h('button.btn', { text: c, 'aria-pressed': String(c === this.continent), onclick: (e: Event) => { this.continent = c; (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); this.renderChips(); } })));
    const body = h('div.modal-body', null, [
      h('p.lc-lead', { text: 'Real public cameras from road authorities and open-data programmes. They are still pictures that refresh on their own while you look, not recordings, and they are separate from the simulated game world.' }),
      h('div.lc-tools', null, [search, conts]), this.chips, h('div.lc-tools', null, [cams]), this.note, this.grid, this.more, this.foot,
    ]);
    const box = h('section.panel.modal.livecams', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Live cameras worldwide' }, [
      h('header.modal-header', null, [h('h2', { text: 'Live cameras · worldwide' }), h('button.x', { 'aria-label': 'Close', text: '×', onclick: () => this.close() })]), body, this.stage,
    ]);
    this.wrap = h('div.modal-wrap.lc-wrap', { onclick: (e: MouseEvent) => { if (e.target === this.wrap) this.close(); } }, [box]);
    // Captured at the window so Escape and the arrows work even if focus has drifted, and game hotkeys stay quiet while the wall is open.
    this.onKey = e => { if (e.type === 'keydown') this.keys(e, box); else e.stopPropagation(); };
    addEventListener('keydown', this.onKey, true); addEventListener('keyup', this.onKey, true);
    const root = this.host.mount?.() ?? document.getElementById('ui') ?? document.body; root.append(this.wrap);
    this.observer = new IntersectionObserver(es => { for (const e of es) { const t = this.tiles.find(x => x.el === e.target); if (t) { t.seen = e.isIntersecting; if (t.seen && t.due()) t.load(); } } }, { root: body, rootMargin: '160px' });
    this.renderChips(); void this.pick(this.region); this.timer = window.setInterval(() => this.tick(), 5000);
    (search as HTMLElement).focus();
  }

  close(): void {
    if (!this.wrap) return; if (this.onKey) { removeEventListener('keydown', this.onKey, true); removeEventListener('keyup', this.onKey, true); } clearInterval(this.timer); clearInterval(this.viewerTimer); this.observer?.disconnect(); this.token++;
    this.wrap.remove(); this.wrap = null; this.tiles = []; this.viewer = null;
    if (this.prevFocus?.isConnected) (this.prevFocus as HTMLElement).focus?.(); this.prevFocus = null;
  }

  private keys(e: KeyboardEvent, box: HTMLElement): void {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (this.viewer) this.closeViewer(); else this.close(); return; }
    if (this.viewer && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); this.step(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key !== 'Tab') return;
    const scope = this.viewer ? this.stage : box, c = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')].filter(x => x.getClientRects().length), f = c[0], l = c[c.length - 1];
    if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l?.focus(); } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f?.focus(); }
  }

  private renderChips(): void {
    const list = CAMERA_REGIONS.filter(r => (this.continent === 'All' || r.continent === this.continent) && (!this.regionFilter || (r.name + ' ' + r.country).toLowerCase().includes(this.regionFilter)));
    this.chips.replaceChildren(...(list.length ? list.map(r => h('button.btn.lc-chip', { text: r.name, title: r.country, 'aria-pressed': String(r.id === this.region.id), onclick: () => void this.pick(r) })) : [h('span.lc-none', { text: 'No matching city. More regions are added as open camera feeds are found.' })]));
  }

  private async pick(r: CameraRegion): Promise<void> {
    this.region = r; this.shown = PAGE; this.renderChips(); const token = ++this.token;
    this.tiles = []; this.grid.replaceChildren(); this.more.hidden = true; this.foot.replaceChildren(); this.note.textContent = 'Connecting to cameras in ' + r.name + '…';
    try { const data = await this.fetchListing(r); if (token !== this.token) return; this.listing = data; this.build(); }
    catch { if (token !== this.token) return; this.listing = null; this.note.replaceChildren('Camera directory unavailable for ' + r.name + ' right now. ', h('button.btn', { text: 'Try again', onclick: () => void this.pick(r) })); }
  }

  private async fetchListing(r: CameraRegion, force = false): Promise<Listing> {
    const hit = listings.get(r.id); if (!force && hit && Date.now() - hit.at < LISTING_TTL) return hit.data;
    const q = new URLSearchParams({ provider: r.provider, lat: String(r.lat), lon: String(r.lon), r: String(r.r), limit: '200' }); if (r.d) q.set('d', String(r.d));
    const res = await fetch('/api/cameras?' + q); if (!res.ok) throw Error('cameras ' + res.status);
    const data = await res.json() as Listing; if (!Array.isArray(data.items) || !data.provider) throw Error('bad listing');
    data.items = data.items.filter(c => typeof c.img === 'string' && c.img.startsWith('https://'));
    listings.set(r.id, { at: Date.now(), data }); return data;
  }

  private build(): void {
    const l = this.listing!; this.tiles = l.items.map((c, i) => new Tile(c, l.provider, () => this.openViewer(i)));
    const p = l.provider;
    this.foot.replaceChildren(h('p', { text: p.attribution }), h('p', null, ['Source: ', link(p.name, p.sourceUrl), ' · Licence: ', link(p.licence, p.licenceUrl), ' · Directory checked ' + new Date(l.fetchedAt).toLocaleTimeString() + '.']),
      h('p', { text: 'Pictures load straight from the publisher and are not stored by this game. Operators refresh stills about every ' + (p.refresh >= 120 ? Math.round(p.refresh / 60) + ' minutes' : 'minute') + '.' }));
    this.renderGrid();
  }

  private visible(): Tile[] { return this.filter ? this.tiles.filter(t => (t.cam.name + ' ' + t.cam.dir).toLowerCase().includes(this.filter)) : this.tiles; }

  private renderGrid(): void {
    const all = this.visible(), shown = all.slice(0, this.shown);
    this.observer?.disconnect(); this.grid.replaceChildren(...shown.map(t => t.el)); for (const t of shown) { t.seen = false; this.observer?.observe(t.el); }
    this.more.hidden = all.length <= shown.length; this.more.textContent = 'Show more cameras (' + (all.length - shown.length) + ' left)';
    const n = this.tiles.length;
    this.note.textContent = !n ? 'No public cameras are published within range of ' + this.region.name + '. Try another city.' : all.length ? all.length + ' camera' + (all.length === 1 ? '' : 's') + ' near ' + this.region.name + ', closest first.' : 'No cameras match that filter.';
  }

  private tick(): void {
    if (document.hidden) return;
    const l = this.listing;
    if (l?.provider.rotating && !this.busyList && Date.now() - (listings.get(this.region.id)?.at ?? 0) > 60_000) { // rotating-URL feeds publish a fresh picture address each cycle
      this.busyList = true; const token = this.token;
      this.fetchListing(this.region, true).then(d => { if (token !== this.token) return; const by = new Map(d.items.map(c => [c.id, c])); for (const t of this.tiles) { const c = by.get(t.cam.id); if (c) t.cam = c; } if (this.viewer) this.refreshViewer(); }).catch(() => { }).finally(() => { this.busyList = false; });
    }
    for (const t of this.tiles) { if (t.due()) t.load(); else if (t.loadedAt) t.paint(); }
  }
  private busyList = false;

  // ---- full-size viewer ----
  private openViewer(i: number): void { this.viewer = { i, at: 0 }; this.paintViewer(); clearInterval(this.viewerTimer); this.viewerTimer = window.setInterval(() => { if (!document.hidden) this.refreshViewer(); }, 20_000); }
  private closeViewer(): void { const i = this.viewer?.i ?? 0; this.viewer = null; clearInterval(this.viewerTimer); this.stage.hidden = true; this.stage.replaceChildren(); this.visible()[i]?.el.querySelector('button')?.focus(); }
  private step(d: number): void { const n = this.visible().length; if (!this.viewer || !n) return; this.viewer.i = (this.viewer.i + d + n) % n; this.paintViewer(); }
  private paintViewer(): void {
    const v = this.viewer, t = v && this.visible()[v.i], p = this.listing?.provider; if (!v || !t || !p) return;
    const c = t.cam, big = h('img.lc-big', { alt: c.name + ' live traffic camera, full size', referrerpolicy: 'no-referrer' }) as HTMLImageElement, state = h('span.lc-status', { text: 'Connecting…' });
    const err = h('p.lc-note', { hidden: true, text: 'This camera has no picture right now. It may be offline or being serviced.' });
    this.stage.hidden = false; this.stage.replaceChildren(
      h('div.lc-stage-bar', null, [h('button.btn', { text: '‹ Back to wall', onclick: () => this.closeViewer() }), h('button.btn', { text: '‹ Prev', onclick: () => this.step(-1) }), h('button.btn', { text: 'Next ›', onclick: () => this.step(1) }), h('button.btn', { text: 'Refresh now', onclick: () => this.refreshViewer() })]),
      h('h3', { text: c.name }), h('div.lc-frame', null, [big]), err, state,
      h('p', { text: [c.dir, c.km + ' km from ' + this.region.name + ' centre'].filter(Boolean).join(' · ') }),
      h('p', null, [p.attribution + ' ', link(p.licence, p.licenceUrl), ' · ', link('Source', p.sourceUrl), c.page ? ' · ' : '', c.page ? link('Camera page', c.page) : '', ' · ', link('Map', `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=16/${c.lat}/${c.lon}`)]),
    );
    this.viewerEls = { big, state, err }; this.refreshViewer(); (this.stage.querySelector('button.btn:nth-child(2)') as HTMLElement | null)?.focus();
  }
  private viewerEls: { big: HTMLImageElement; state: HTMLElement; err: HTMLElement } | null = null;
  private refreshViewer(): void {
    const v = this.viewer, e = this.viewerEls, t = v && this.visible()[v.i], p = this.listing?.provider; if (!v || !e || !t || !p) return;
    const i = v.i; fetchFrame(bust(t.cam.img, p.rotating), src => { if (this.viewer?.i !== i) return; e.big.src = src; e.err.hidden = true; v.at = Date.now(); e.state.textContent = '● Live · updated ' + ago(v.at) + ' (checks every 20 s)'; e.state.classList.remove('bad'); },
      () => { if (this.viewer?.i !== i) return; if (!v.at) { e.err.hidden = false; e.state.textContent = '○ Offline'; e.state.classList.add('bad'); } });
  }
}
