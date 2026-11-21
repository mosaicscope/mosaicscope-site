import { h } from '../dom';
import type { FeltBridge, FeltHandle } from './RoyalFelt';

/** What the casino gives the poker room: its chip wallet and its results book. */
export interface FeltHost {
  chips(): number;
  setChips(n: number): void;
  buyChips(n: number): boolean;
  record(net: number, game: string): void;
  changed(): void;
  opponents(): { id: number; name: string; style: 'patient' | 'pressure' | 'tricky' | 'loose' }[];
  drawPerson(id: number, g: CanvasRenderingContext2D, x: number, y: number, k: number, t: number, doing: string): void;
}

/**
 * The Poker tables room. The 3D table (Royal Felt) is loaded the first time the tab opens and then lives for
 * the whole casino visit, so re-rendering the casino panel never rebuilds the scene or drops a hand in play.
 */
export class FeltRoom {
  readonly el: HTMLElement;
  private stage: HTMLElement;
  private handle: FeltHandle | null = null;
  private loading = false;
  /** Set when the 3D table cannot start (no WebGL, chunk failed); the casino falls back to the classic table. */
  failed = false;

  constructor(private host: FeltHost) {
    this.stage = h('div');
    this.el = h('section.iso-game.iso-felt', { 'aria-label': 'Royal Felt 3D Texas hold’em table' }, [this.stage]);
  }

  private bridge(): FeltBridge {
    const host = this.host;
    return {
      chips: () => host.chips(),
      spend: (n) => {
        if (!Number.isFinite(n) || n <= 0 || n > host.chips() + 1e-9) return false;
        host.setChips(host.chips() - n);
        return true;
      },
      deposit: (n) => { if (Number.isFinite(n) && n > 0) host.setChips(host.chips() + n); },
      buyChips: (n) => host.buyChips(n),
      settled: (net, game) => host.record(net, game),
      changed: () => host.changed(),
      opponents: () => host.opponents(),
      drawPerson: (id, g, x, y, k, t, doing) => host.drawPerson(id, g, x, y, k, t, doing),
    };
  }

  /** The element to place in the casino body; starts loading the table on first use. */
  view(): HTMLElement {
    if (!this.handle && !this.loading && !this.failed) void this.load();
    else this.handle?.refresh();
    return this.el;
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const mod = await import('./RoyalFelt');
      this.handle = mod.mountRoyalFelt(this.stage, this.bridge());
    } catch (err) {
      console.error('Royal Felt failed to start, using the classic table', err);
      this.failed = true;
      this.host.changed();
    } finally {
      this.loading = false;
    }
  }

  /** A hand (or a tournament) is in play: the casino must not close or change tables. */
  locked(): boolean { return !!this.handle?.locked(); }
  /** Chips currently sitting in front of the player at the table. */
  stack(): number { return this.handle?.stack() ?? 0; }
  /** Cash the player out on the way out of the casino (cash tables only settle between hands). */
  leave(): void { this.handle?.leave(); }
}
