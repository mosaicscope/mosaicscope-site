// @ts-nocheck
/**
 * Royal Felt 3D, ported into the Mosaics world.
 *
 * Source: "royal_felt_3d_poker_table.html" (a single-file Three.js r128 Texas hold'em table with a 6-max
 * engine, AI personalities, poker coach and animated seated characters). It is mounted here as a scoped
 * module inside the casino panel so the page chrome is never touched:
 *   - every document.getElementById / window.innerWidth is scoped to the host element
 *   - the stakes scale to the buy-in the player chooses; buy-in, rebuy and cash-out go through the casino
 *     wallet (see FeltBridge) instead of a free bankroll
 *   - six methods that the supplied file called but never defined were restored (tweens, camera modes,
 *     seat highlight, pointer handling)
 * Three.js is the r128 build the file was written for (npm alias "three128"), loaded only when the poker
 * tab is first opened.
 */
import * as THREE from 'three128';
import { FELT_TEMPLATE } from './feltTemplate';
import './felt.css';

export interface FeltBridge {
  chips(): number;
  spend(n: number): boolean;
  deposit(n: number): void;
  buyChips(n: number): boolean;
  settled(net: number, game: string): void;
  changed(): void;
  /** Mosaic guests who take the other seats (up to five), with how they play. */
  opponents?(): { id: number; name: string; style: 'patient' | 'pressure' | 'tricky' | 'loose' }[];
  /** Draw one Mosaic (seated, betting, cheering...) with the game's own figure renderer. */
  drawPerson?(id: number, g: CanvasRenderingContext2D, x: number, y: number, k: number, t: number, doing: string): void;
}
export interface FeltHandle {
  locked(): boolean;
  stack(): number;
  seated(): boolean;
  leave(): void;
  refresh(): void;
  destroy(): void;
}

export function mountRoyalFelt(host: HTMLElement, bridge: FeltBridge): FeltHandle {
  host.classList.add('felt3d');
  host.innerHTML = FELT_TEMPLATE;

  // ---- host plumbing (replaces the page-level globals of the standalone file) ----
  const __root = host;
  const $ = (id) => __root.querySelector('#' + id);
  const vw = () => Math.max(1, __root.clientWidth || 800);
  const vh = () => Math.max(1, __root.clientHeight || 500);
  let leaveArmed = false;
  const feltNote = (text) => { const el = $('felt-buyin-note'); if (el) el.textContent = text; $('modal-modes').classList.remove('hidden'); };
  const NICE = [2, 4, 5, 10, 20, 25, 40, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000];
  const chipStep = (bb) => (bb >= 100 ? 25 : bb >= 10 ? 5 : 1);
  const stakesFor = (base, buyIn) => {
    const stack = Math.max(base.minBuyIn, Math.floor(buyIn));
    const target = (stack * base.bb) / base.startStack;
    let bb = NICE[0];
    for (const v of NICE) { if (Math.abs(v - target) < Math.abs(bb - target)) bb = v; }
    const sb = Math.max(1, Math.round(bb / 2));
    const ante = base.ante > 0 ? Math.max(1, Math.round(bb * (base.ante / base.bb))) : 0;
    return { stack, sb, bb, ante };
  };

  const __api = (function () {
    'use strict';
    /* =========================================================================
       1. CONSTANTS, MODES & AI PERSONALITIES
       ========================================================================= */

    const SUITS = ['s', 'h', 'd', 'c'];
    const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
    const SUIT_COLOR = { s: '#14171c', h: '#c81d25', d: '#c81d25', c: '#14171c' };
    const RANK_LABEL = {
      2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
      11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    };
    const RANK_NAME_PLURAL = {
      2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens',
      8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces'
    };

    const GAME_MODES = {
      cash: {
        id: 'cash',
        name: 'Classic Cash',
        shortDeck: false,
        startStack: 2000,
        sb: 10,
        bb: 20,
        ante: 0,
        allowRebuy: true,
        blindInterval: 0,
        aiAggroBoost: 0,
        feltPrimary: '#0a4029',
        feltDark: '#031a10',
        accentHex: '#10b981',
        badgeText: 'CLASSIC CASH'
      },
      tournament: {
        id: 'tournament',
        name: 'Turbo Tournament',
        shortDeck: false,
        startStack: 1500,
        sb: 15,
        bb: 30,
        ante: 0,
        allowRebuy: false,
        blindInterval: 3,
        aiAggroBoost: 0.08,
        feltPrimary: '#0c2a52',
        feltDark: '#040f20',
        accentHex: '#3b82f6',
        badgeText: 'TURBO SIT & GO'
      },
      vip: {
        id: 'vip',
        name: 'High-Roller VIP',
        shortDeck: false,
        startStack: 10000,
        sb: 50,
        bb: 100,
        ante: 25,
        allowRebuy: true,
        blindInterval: 0,
        aiAggroBoost: 0.16,
        feltPrimary: '#4d0b18',
        feltDark: '#1d0409',
        accentHex: '#e5c158',
        badgeText: 'HIGH-ROLLER VIP'
      },
      shortdeck: {
        id: 'shortdeck',
        name: 'Short Deck 6+',
        shortDeck: true,
        startStack: 3000,
        sb: 20,
        bb: 40,
        ante: 10,
        allowRebuy: true,
        blindInterval: 0,
        aiAggroBoost: 0.12,
        feltPrimary: '#2c1048',
        feltDark: '#0f0419',
        accentHex: '#a855f7',
        badgeText: 'SHORT DECK 6+'
      }
    };

    GAME_MODES.cash.minBuyIn = 100;
    GAME_MODES.tournament.minBuyIn = 100;
    GAME_MODES.vip.minBuyIn = 1000;
    GAME_MODES.shortdeck.minBuyIn = 200;

    const AI_PROFILES = [
      {
        name: 'Viper',
        style: 'LAG Shark',
        color: '#10b981',
        tightness: 0.34,
        aggression: 0.78,
        bluffRate: 0.38,
        trapRate: 0.18,
        mistakeRate: 0.04,
        tiltSensitivity: 0.25,
        tells: {
          bluff: ['*stares you down coldly*', 'You really want to call that?', 'Time to fold, champ.', '*riffling chips aggressively*'],
          value: ['Let’s make this interesting.', 'Pay to see the river.', '*slides chips in smoothly*'],
          fold: ['Fine. Take the crumbs.', 'Not worth my time.'],
          caught: ['Heh… nice hero call.', 'Alright, you caught me!']
        }
      },
      {
        name: 'The Professor',
        style: 'TAG Trapper',
        color: '#3b82f6',
        tightness: 0.64,
        aggression: 0.56,
        bluffRate: 0.14,
        trapRate: 0.52,
        mistakeRate: 0.02,
        tiltSensitivity: 0.10,
        tells: {
          bluff: ['*adjusts glasses calmly*', 'Mathematically, you should fold.', 'Interesting board texture…'],
          value: ['*quietly taps the felt*', 'Check… for now.', 'The odds favor me here.'],
          trap: ['Springing the trap.', 'Right into my range.'],
          fold: ['Negative EV. I fold.', 'Disciplined laydown.'],
          caught: ['Statistically improbable call!', 'Well played, student.']
        }
      },
      {
        name: 'Lucky Lou',
        style: 'Loose & Chaotic',
        color: '#f59e0b',
        tightness: 0.18,
        aggression: 0.45,
        bluffRate: 0.22,
        trapRate: 0.08,
        mistakeRate: 0.28,
        tiltSensitivity: 0.35,
        tells: {
          bluff: ['*taps chips nervously*', 'I got a good feeling about this!', 'Feeling lucky today!'],
          value: ['Ooh, I like my cards!', 'Let’s gamble, baby!'],
          mistake: ['Wait—did I misread the board?', 'Oops, miscounted the pot…', 'I thought I had a straight!'],
          fold: ['Aw shucks, missed my card.', 'Next one’s mine!'],
          caught: ['Haha, worth a shot right?!', 'Busted! You got X-ray vision?']
        }
      },
      {
        name: 'Duchess',
        style: 'Mind-Game Pro',
        color: '#ec4899',
        tightness: 0.48,
        aggression: 0.68,
        bluffRate: 0.28,
        trapRate: 0.30,
        mistakeRate: 0.03,
        tiltSensitivity: 0.15,
        tells: {
          bluff: ['*cool, unreadable smile*', 'Are you sure you’re ahead?', 'Pressure makes diamonds.'],
          value: ['Your move, darling.', 'Let’s test your nerve.', '*places chips with poise*'],
          fold: ['I’ll pick a better spot.', 'Enjoy that pot.'],
          caught: ['Touché. Very sharp read.', 'Impressive composure.']
        }
      },
      {
        name: 'Mad Dog',
        style: 'Tilt Maniac',
        color: '#ef4444',
        tightness: 0.24,
        aggression: 0.85,
        bluffRate: 0.34,
        trapRate: 0.10,
        mistakeRate: 0.14,
        tiltSensitivity: 0.88,
        tells: {
          bluff: ['SHIP IT! Scared money don’t win!', '*slams chips down*', 'Let’s go ALL THE WAY!'],
          tilt: ['I’M DONE FOLDING! ALL-IN!', '*fuming on tilt*', 'YOU CAN’T BEAT ME EVERY HAND!'],
          value: ['BOOM! Call me if you dare!', 'Pay the toll!'],
          fold: ['Ugh! Trash cards!', '*grumbles angrily*'],
          caught: ['NO WAY YOU CALLED THAT!', 'RIGGED DECK!!']
        }
      }
    ];

    /* =========================================================================
       2. WEB AUDIO API CASINO SOUND ENGINE
       ========================================================================= */

    class SoundEngine {
      constructor() {
        this.ctx = null;
        this.muted = false;
      }

      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }

      toggleMute() {
        this.muted = !this.muted;
        return this.muted;
      }

      _noiseBuffer(duration = 0.2) {
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * duration);
        const buf = this.ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1);
        }
        return buf;
      }

      playCardSlide() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer(0.14);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(600, now + 0.12);
        filter.Q.value = 1.6;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        src.connect(filter).connect(gain).connect(this.ctx.destination);
        src.start(now);
      }

      playCardFlip() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer(0.07);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2200, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        src.connect(filter).connect(gain).connect(this.ctx.destination);
        src.start(now);
      }

      playChipClack(count = 2) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const n = Math.min(5, Math.max(1, count));
        for (let i = 0; i < n; i++) {
          const t = this.ctx.currentTime + i * 0.042;
          // Ceramic ping
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          const baseFreq = 2600 + Math.random() * 900;
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t + 0.035);
          gain.gain.setValueAtTime(0.13, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          osc.connect(gain).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.045);

          // Click transient
          const src = this.ctx.createBufferSource();
          src.buffer = this._noiseBuffer(0.02);
          const f = this.ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 3800;
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(0.14, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
          src.connect(f).connect(g2).connect(this.ctx.destination);
          src.start(t);
        }
      }

      playCheckKnock() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        [0, 0.11].forEach((offset, idx) => {
          const t = this.ctx.currentTime + offset;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 125 : 108, t);
          osc.frequency.exponentialRampToValueAtTime(48, t + 0.08);
          gain.gain.setValueAtTime(0.28, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
          osc.connect(gain).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.1);
        });
      }

      playFold() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer(0.18);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(900, now);
        f.frequency.exponentialRampToValueAtTime(220, now + 0.17);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        src.connect(f).connect(g).connect(this.ctx.destination);
        src.start(now);
      }

      playAllInRiser() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        // Dramatic sub bass swell
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, now);
        filter.frequency.exponentialRampToValueAtTime(750, now + 0.65);
        osc.frequency.setValueAtTime(55, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.65);
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc.connect(filter).connect(gain).connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
      }

      playWinChime() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
        notes.forEach((freq, i) => {
          const t = this.ctx.currentTime + i * 0.08;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
          osc.connect(gain).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.6);
        });
      }

      playBluffCaught() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        const notes = [392, 466.16, 587.33];
        notes.forEach((freq, i) => {
          const t = this.ctx.currentTime + i * 0.09;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 1400;
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(filter).connect(gain).connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.38);
        });
      }
    }

    const sound = new SoundEngine();

    /* =========================================================================
       3. EXACT POKER HAND EVALUATOR (STANDARD + SHORT DECK 6+) & MONTE CARLO
       ========================================================================= */

    /**
     * Evaluates a 5-card hand.
     * Supports both standard Texas Hold'em and Short Deck 6+ (Flush > Full House, A-6-7-8-9 straight).
     */
    function evaluate5Cards(cards, shortDeck = false) {
      const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
      const suits = cards.map(c => c.suit);
      const isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];

      // Count rank frequencies
      const counts = {};
      for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
      const groups = Object.entries(counts)
        .map(([r, c]) => ({ rank: parseInt(r, 10), count: c }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

      // Straight check
      let isStraight = false;
      let straightHigh = 0;
      if (groups.length === 5) {
        if (ranks[0] - ranks[4] === 4) {
          isStraight = true;
          straightHigh = ranks[0];
        } else if (!shortDeck && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
          isStraight = true;
          straightHigh = 5; // Wheel A-2-3-4-5
        } else if (shortDeck && ranks[0] === 14 && ranks[1] === 9 && ranks[2] === 8 && ranks[3] === 7 && ranks[4] === 6) {
          isStraight = true;
          straightHigh = 9; // Short Deck wheel A-6-7-8-9
        }
      }

      // Category mapping (Short Deck swaps Flush=6 and Full House=5)
      const CAT_FLUSH = shortDeck ? 6 : 5;
      const CAT_FULL_HOUSE = shortDeck ? 5 : 6;

      let category = 0;
      let tiebreakers = [];
      let name = '';

      if (isStraight && isFlush) {
        if (straightHigh === 14) {
          category = 9;
          tiebreakers = [14];
          name = 'Royal Flush';
        } else {
          category = 8;
          tiebreakers = [straightHigh];
          name = `Straight Flush — ${RANK_LABEL[straightHigh]} High`;
        }
      } else if (groups[0].count === 4) {
        category = 7;
        tiebreakers = [groups[0].rank, groups[1].rank];
        name = `Four of a Kind — ${RANK_NAME_PLURAL[groups[0].rank]}`;
      } else if (groups[0].count === 3 && groups[1].count === 2) {
        category = CAT_FULL_HOUSE;
        tiebreakers = [groups[0].rank, groups[1].rank];
        name = `Full House — ${RANK_NAME_PLURAL[groups[0].rank]} full of ${RANK_NAME_PLURAL[groups[1].rank]}`;
      } else if (isFlush) {
        category = CAT_FLUSH;
        tiebreakers = ranks;
        name = `Flush — ${RANK_LABEL[ranks[0]]} High`;
      } else if (isStraight) {
        category = 4;
        tiebreakers = [straightHigh];
        name = `Straight — ${RANK_LABEL[straightHigh]} High`;
      } else if (groups[0].count === 3) {
        category = 3;
        tiebreakers = [groups[0].rank, groups[1].rank, groups[2].rank];
        name = `Three of a Kind — ${RANK_NAME_PLURAL[groups[0].rank]}`;
      } else if (groups[0].count === 2 && groups[1].count === 2) {
        category = 2;
        tiebreakers = [groups[0].rank, groups[1].rank, groups[2].rank];
        name = `Two Pair — ${RANK_NAME_PLURAL[groups[0].rank]} & ${RANK_NAME_PLURAL[groups[1].rank]}`;
      } else if (groups[0].count === 2) {
        category = 1;
        tiebreakers = [groups[0].rank, groups[1].rank, groups[2].rank, groups[3].rank];
        name = `One Pair — ${RANK_NAME_PLURAL[groups[0].rank]}`;
      } else {
        category = 0;
        tiebreakers = ranks;
        name = `High Card — ${RANK_LABEL[ranks[0]]}`;
      }

      // Encode deterministic base-15 score for instant comparisons
      let score = category;
      for (let i = 0; i < 5; i++) {
        score = score * 15 + (tiebreakers[i] || 0);
      }

      return { category, score, name, bestCards: cards };
    }

    /**
     * Evaluates best 5-card hand out of 2 to 7 cards.
     */
    function evaluateBestHand(cards, shortDeck = false) {
      if (!cards || cards.length === 0) {
        return { category: -1, score: -1, name: 'No Cards', bestCards: [] };
      }
      if (cards.length < 5) {
        // Preflop (2 cards) descriptive evaluation
        const sorted = [...cards].sort((a, b) => b.rank - a.rank);
        if (sorted.length === 2 && sorted[0].rank === sorted[1].rank) {
          return {
            category: 1,
            score: 1 * 15 + sorted[0].rank,
            name: `Pocket ${RANK_NAME_PLURAL[sorted[0].rank]}`,
            bestCards: sorted
          };
        }
        const suited = sorted.length === 2 && sorted[0].suit === sorted[1].suit ? ' Suited' : '';
        return {
          category: 0,
          score: sorted[0].rank,
          name: `${RANK_LABEL[sorted[0].rank]}-${RANK_LABEL[sorted[1]?.rank || 2]}${suited} High`,
          bestCards: sorted
        };
      }
      if (cards.length === 5) {
        return evaluate5Cards(cards, shortDeck);
      }

      // Generate all 5-card combinations (max 21 for 7 cards)
      let best = null;
      const n = cards.length;
      for (let a = 0; a < n - 4; a++) {
        for (let b = a + 1; b < n - 3; b++) {
          for (let c = b + 1; c < n - 2; c++) {
            for (let d = c + 1; d < n - 1; d++) {
              for (let e = d + 1; e < n; e++) {
                const res = evaluate5Cards([cards[a], cards[b], cards[c], cards[d], cards[e]], shortDeck);
                if (!best || res.score > best.score) {
                  best = res;
                }
              }
            }
          }
        }
      }
      return best;
    }

    /**
     * Detects Flush & Straight draws on Flop/Turn for the Poker Coach.
     */
    function detectDraws(holeCards, communityCards, shortDeck = false) {
      const draws = [];
      if (communityCards.length < 3 || communityCards.length >= 5) return draws;
      const all = [...holeCards, ...communityCards];

      // Flush draw (4 of same suit)
      const suitCount = { s: 0, h: 0, d: 0, c: 0 };
      all.forEach(c => suitCount[c.suit]++);
      if (Object.values(suitCount).some(v => v === 4)) {
        draws.push('Flush Draw');
      }

      // Straight draw check
      const uniq = [...new Set(all.map(c => c.rank))].sort((a, b) => a - b);
      if (uniq.includes(14)) uniq.unshift(shortDeck ? 5 : 1);
      let maxRun = 1, curRun = 1;
      for (let i = 1; i < uniq.length; i++) {
        if (uniq[i] === uniq[i - 1] + 1) {
          curRun++;
          maxRun = Math.max(maxRun, curRun);
        } else {
          curRun = 1;
        }
      }
      if (maxRun === 4) {
        draws.push('Open-Ended Straight Draw');
      } else {
        // Check gutshot (4 cards within a span of 5)
        for (let i = 0; i <= uniq.length - 4; i++) {
          if (uniq[i + 3] - uniq[i] === 4) {
            draws.push('Gutshot Straight Draw');
            break;
          }
        }
      }
      return draws;
    }

    /**
     * Fast Monte Carlo Win Equity Estimator (runs ~200 iterations in <5ms).
     */
    function estimateWinEquity(holeCards, communityCards, numOpponents, shortDeck = false, iterations = 200) {
      if (!holeCards || holeCards.length < 2 || numOpponents <= 0) return 1.0;

      const minRank = shortDeck ? 6 : 2;
      const used = new Set([...holeCards, ...communityCards].map(c => `${c.rank}${c.suit}`));
      const remainingDeck = [];
      for (const s of SUITS) {
        for (let r = minRank; r <= 14; r++) {
          if (!used.has(`${r}${s}`)) remainingDeck.push({ rank: r, suit: s });
        }
      }

      const needBoard = 5 - communityCards.length;
      const opps = Math.min(5, Math.max(1, numOpponents));
      let wins = 0;

      for (let it = 0; it < iterations; it++) {
        // Partial Fisher-Yates shuffle for only the cards we need
        const needed = needBoard + opps * 2;
        for (let i = 0; i < needed; i++) {
          const j = i + Math.floor(Math.random() * (remainingDeck.length - i));
          const tmp = remainingDeck[i];
          remainingDeck[i] = remainingDeck[j];
          remainingDeck[j] = tmp;
        }

        const board = communityCards.slice();
        for (let b = 0; b < needBoard; b++) board.push(remainingDeck[b]);

        const myScore = evaluateBestHand([...holeCards, ...board], shortDeck).score;
        let bestOpp = -1;
        let tied = false;

        for (let o = 0; o < opps; o++) {
          const idx = needBoard + o * 2;
          const oppScore = evaluateBestHand([remainingDeck[idx], remainingDeck[idx + 1], ...board], shortDeck).score;
          if (oppScore > bestOpp) bestOpp = oppScore;
        }

        if (myScore > bestOpp) {
          wins += 1;
        } else if (myScore === bestOpp) {
          wins += 0.5;
        }
      }

      return wins / iterations;
    }

    /* =========================================================================
       4. PROCEDURAL HIGH-RESOLUTION TEXTURES (FELT, WOOD, LEATHER, CARDS, CHIPS)
       ========================================================================= */

    const cardTextureCache = new Map();
    let cardBackTexture = null;
    const chipTextureCache = new Map();

    let customFelt = null;
    function _rand(a, b) { return a + Math.random() * (b - a); }

    function createFeltTexture(modeConfig) {
      const W = 2048, H = 1024, cx = W / 2, cy = H / 2;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const ellFill = (r0, r1, stops) => {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, H / W);
        const g = ctx.createRadialGradient(0, 0, r0, 0, 0, r1);
        stops.forEach(([t, c]) => g.addColorStop(t, c));
        ctx.fillStyle = g; ctx.fillRect(-W, -W, W * 2, W * 2); ctx.restore();
      };
      // Deep pile colour sinking to near-black at the rim
      const prim = customFelt ? customFelt.p : modeConfig.feltPrimary, dark = customFelt ? customFelt.d : modeConfig.feltDark;
      ellFill(60, W * 0.58, [[0, prim], [0.5, prim], [1, dark]]);
      // Uneven nap: soft clouds
      for (let i = 0; i < 320; i++) {
        const x = _rand(0, W), y = _rand(0, H), r = _rand(50, 220);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, Math.random() > 0.45 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.035)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Woven warp & weft
      for (let x = 0; x < W; x += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x, 0, 1, H);
        ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x + 2, 0, 1, H);
      }
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.11)'; ctx.fillRect(0, y, W, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, y + 2, W, 1);
      }
      // Loose fibres
      ctx.lineWidth = 1;
      for (let i = 0; i < 16000; i++) {
        const x = _rand(0, W), y = _rand(0, H), a = _rand(0, 6.283), l = _rand(3, 11);
        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      // Dealer-hand wear sweeps
      for (let i = 0; i < 26; i++) {
        const a0 = _rand(0, 6.283);
        ctx.strokeStyle = 'rgba(255,255,255,0.018)'; ctx.lineWidth = _rand(6, 14);
        ctx.beginPath(); ctx.ellipse(cx + _rand(-120, 120), cy + _rand(-60, 60), _rand(300, 800), _rand(150, 380), 0, a0, a0 + _rand(0.3, 0.8)); ctx.stroke();
      }
      // Rim shading
      ellFill(W * 0.2, W * 0.5, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0.14)'], [1, 'rgba(0,0,0,0.6)']]);

      // Printed lines, pressed into the cloth
      const ink = (draw, color, lw, dash) => {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = lw;
        if (dash) ctx.setLineDash(dash);
        ctx.translate(2, 3); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; draw(); ctx.stroke(); ctx.translate(-2, -3);
        ctx.strokeStyle = color; draw(); ctx.stroke(); ctx.restore();
      };
      ink(() => drawOvalPath(ctx, cx, cy, 780, 370), 'rgba(201,167,78,0.55)', 5);
      ink(() => drawOvalPath(ctx, cx, cy, 758, 348), 'rgba(201,167,78,0.22)', 2);
      ink(() => drawOvalPath(ctx, cx, cy, 700, 300), 'rgba(201,167,78,0.16)', 3, [2, 12]);

      ctx.save();
      ctx.textAlign = 'center';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
      ctx.font = '700 54px Cinzel, serif';
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText('ROYAL FELT', cx + 2, 322);
      ctx.fillStyle = 'rgba(201,167,78,0.2)'; ctx.fillText('ROYAL FELT', cx, 320);
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillStyle = 'rgba(201,167,78,0.22)'; ctx.fillText(`${modeConfig.badgeText}   NO LIMIT`, cx, 716);
      ctx.restore();

      const cardW = 108, cardH = 152, gap = 24;
      const startX = cx - (5 * cardW + 4 * gap) / 2, startY = cy - cardH / 2;
      for (let i = 0; i < 5; i++) {
        const x = startX + i * (cardW + gap);
        roundRect(ctx, x, startY, cardW, cardH, 12); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill();
        ink(() => roundRect(ctx, x, startY, cardW, cardH, 12), 'rgba(201,167,78,0.32)', 3);
      }
      for (let i = 0; i < 40000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
        ctx.fillRect(_rand(0, W), _rand(0, H), 1, 1);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 8;
      return tex;
    }

    function createFeltBumpTexture() {
      const W = 1024, H = 512;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 2) { ctx.fillStyle = (x / 2) % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'; ctx.fillRect(x, 0, 1, H); }
      for (let y = 0; y < H; y += 2) { ctx.fillStyle = (y / 2) % 2 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, W, 1); }
      ctx.lineWidth = 1;
      for (let i = 0; i < 9000; i++) {
        const x = _rand(0, W), y = _rand(0, H), a = _rand(0, 6.283), l = _rand(2, 7);
        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
    }

    function drawOvalPath(ctx, cx, cy, rx, ry) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    /** Dark lacquered walnut: tonal bands, wavy grain, pores and knots. Doubles as its own bump map. */
    function createWoodTexture() {
      const S = 1024;
      const c = document.createElement('canvas'); c.width = c.height = S;
      const ctx = c.getContext('2d');
      const wrapY = fn => [-S, 0, S].forEach(o => { ctx.save(); ctx.translate(0, o); fn(); ctx.restore(); });
      ctx.fillStyle = '#150a05'; ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 14; i++) {
        const y = _rand(0, S), h = _rand(40, 160);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, Math.random() > 0.5 ? 'rgba(70,36,16,0.35)' : 'rgba(0,0,0,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        wrapY(() => { ctx.fillStyle = g; ctx.fillRect(0, y, S, h); });
      }
      for (let i = 0; i < 520; i++) {
        const y = _rand(0, S), amp = _rand(2, 14), k = Math.round(_rand(1, 4)), ph = _rand(0, 6.283);
        const a = _rand(0.1, 0.5), r = Math.random();
        const col = r < 0.55 ? `rgba(6,2,1,${a})` : r < 0.8 ? `rgba(92,48,22,${a * 0.8})` : `rgba(140,82,40,${a * 0.35})`;
        wrapY(() => {
          ctx.strokeStyle = col; ctx.lineWidth = _rand(0.6, 3.4); ctx.beginPath();
          for (let x = 0; x <= S; x += 16) {
            const yy = y + amp * Math.sin(2 * Math.PI * k * x / S + ph);
            x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
          }
          ctx.stroke();
        });
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let i = 0; i < 7000; i++) ctx.fillRect(_rand(0, S), _rand(0, S), _rand(2, 8), 1);
      for (let k = 0; k < 3; k++) {
        const x = _rand(90, S - 90), y = _rand(90, S - 90);
        for (let r = 4; r < 40; r += 3) {
          ctx.strokeStyle = `rgba(0,0,0,${0.22 - r / 260})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0, 0, 6.283); ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(0.35, 0.35);
      tex.anisotropy = 8;
      return tex;
    }

    /** Near-black pebbled leather with creases; doubles as its own bump map. */
    function createLeatherTexture() {
      const S = 1024;
      const c = document.createElement('canvas'); c.width = c.height = S;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0c0908'; ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 5200; i++) {
        const x = _rand(0, S), y = _rand(0, S), r = _rand(4, 10);
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(255,240,225,0.085)'); g.addColorStop(0.6, 'rgba(120,100,90,0.02)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 60; i++) {
        let x = _rand(0, S), y = _rand(0, S);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 0; j < 8; j++) { x += _rand(6, 22); y += _rand(-8, 8); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i < 9000; i++) ctx.fillRect(_rand(0, S), _rand(0, S), 1.5, 1.5);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(0.35, 0.35);
      tex.anisotropy = 8;
      return tex;
    }

    /* ---- 26 card designs (matching back + face) ---- */
    const CARD_TYPES = ['lattice','hex','scales','waves','stars','sunburst','deco','checker','dots','circuit','guilloche','florals','triangles'];
    const CARD_FONTS = ['Cinzel, serif', 'Georgia, serif', 'Inter, sans-serif'];
    const CARD_STYLES = [
      ['Oxblood Gold','#4a0b17','#c7a24a','#e5c158','#efe9da','#15171c','#b3192a'],
      ['Midnight Navy','#0b1b3a','#9db7e8','#d8e2ff','#eceff3','#0e1424','#c2263a'],
      ['Emerald Court','#0b3d2c','#c7a24a','#e0c36a','#eee9d8','#10201a','#a8202f'],
      ['Noir','#0b0b0d','#8a8a92','#d8d8de','#e6e4df','#0b0b0d','#a31d2b'],
      ['Royal Violet','#2c1048','#c9a8f0','#e6d4ff','#eeeaf2','#1b1030','#b1224f'],
      ['Ivory Rose','#e9dccb','#b5506a','#7a2e45','#f6efe4','#2a1a20','#b3243f'],
      ['Copper Forge','#3a1d10','#d08a4e','#f0b070','#efe4d2','#24150c','#b3321f'],
      ['Arctic','#dfe9ee','#4a7c93','#1f4e66','#f4f7f8','#12222b','#c0392b'],
      ['Jade Dynasty','#0e3b36','#d4b25a','#f0d88a','#eef0e3','#0f2a26','#b0222c'],
      ['Crimson Deco','#5c0f1c','#e2c276','#f6dfa0','#f1e8d6','#1b1215','#9e1b2c'],
      ['Sapphire Silver','#10285a','#c8cfdc','#ffffff','#eef1f6','#0d1630','#c0243a'],
      ['Sunset','#7a2a1a','#f2a65a','#ffd29a','#f5ead8','#2a150e','#c0391f'],
      ['Forest Moss','#1b3016','#a8c27a','#d6e8a8','#ece9d6','#14210f','#a33a22'],
      ['Rosewood','#3d1420','#d9a0a8','#f1c8cf','#f1e6e4','#26121a','#b02a45'],
      ['Steel Blue','#22303f','#7fa6c9','#bcd6ee','#e9eef2','#111a24','#c23a3a'],
      ['Amber Honey','#5a3a0a','#f0c040','#ffe08a','#f4ecd4','#2a1d08','#b5361c'],
      ['Teal Lagoon','#0a3f48','#6fd0c8','#b8f0ea','#eaf3f1','#0b252a','#c0392b'],
      ['Plum Velvet','#3b1030','#e0a0d0','#f8c8ec','#f0e6ee','#25101f','#b3205a'],
      ['Bone and Ink','#e8e0d0','#2a2a30','#111114','#f7f2e6','#101012','#a82020'],
      ['Ruby Onyx','#150608','#d63a4a','#ff7080','#ece6e4','#150608','#b3192a'],
      ['Gold Leaf','#6b4f12','#f4d77a','#fff0b0','#f4edd9','#2a210a','#a8261a'],
      ['Slate Mint','#26363a','#9fe0c0','#d0fbe6','#eaf0ee','#122024','#c23a4a'],
      ['Burnt Orange','#6a2a0a','#f08a3a','#ffc08a','#f4e8d6','#2a1408','#c0301a'],
      ['Indigo Dusk','#1c1a4a','#a0a0ff','#d0d0ff','#eceaf4','#14123a','#c0244a'],
      ['Pearl','#f0ece6','#b8a88a','#8a7650','#fbf8f2','#1c1a18','#b3253a'],
      ['Obsidian Gold','#08080a','#d4af37','#f4d770','#e9e5da','#0a0a0c','#a31d2b']
    ].map((a, i) => ({ name: a[0], bg: a[1], line: a[2], accent: a[3], paper: a[4], ink: a[5], red: a[6],
      type: CARD_TYPES[i % 13], frame: i % 5, font: CARD_FONTS[i % 3], glyph: ['♠', '♥', '♦', '♣'][i % 4] }));
    let cardStyleIdx = 0;
    const cardBackCache = new Map(), patternCache = new Map();

    const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const rgba = (h, a) => `rgba(${_rgb(h).join(',')},${a})`;
    const lum = h => { const [r, g, b] = _rgb(h); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
    const mixHex = (a, b, t) => { const x = _rgb(a), y = _rgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };

    function drawPattern(ctx, type, W, H, L, A, F) {
      const cx = W / 2, cy = H / 2, TAU = 6.283;
      ctx.strokeStyle = L; ctx.lineWidth = 1.6;
      const dot = (x, y, r) => { ctx.fillStyle = A; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
      if (type === 'lattice') {
        for (let i = -H; i < W + H; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.moveTo(i + H, 0); ctx.lineTo(i, H); ctx.stroke(); }
        for (let m = -30; m <= 30; m++) for (let n = -30; n <= 30; n++) if ((m + n) % 2 === 0) dot(360 + 16 * m, 360 + 16 * n, 2.5);
      } else if (type === 'hex') {
        const r = 30, h = r * Math.sqrt(3);
        for (let row = -1; row < H / h + 1; row++) for (let col = -1; col < W / (r * 1.5) + 1; col++) {
          const x = col * r * 1.5, y = row * h + (col % 2 ? h / 2 : 0);
          ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(x + r * Math.cos(k * 1.0472), y + r * Math.sin(k * 1.0472));
          ctx.closePath(); ctx.stroke(); dot(x, y, 3);
        }
      } else if (type === 'scales') {
        for (let y = 0; y < H + 18; y += 18) { const o = (y / 18) % 2 ? 18 : 0; for (let x = -36; x < W + 36; x += 36) for (const r of [18, 12, 6]) { ctx.beginPath(); ctx.arc(x + o, y, r, 0, Math.PI); ctx.stroke(); } }
      } else if (type === 'waves') {
        for (let y = 0; y < H + 30; y += 15) { const o = (y / 15) % 2 ? 30 : 0; for (let x = -30; x < W + 60; x += 60) for (let r = 30; r > 5; r -= 6) { ctx.beginPath(); ctx.arc(x + o, y, r, Math.PI, 0); ctx.stroke(); } }
      } else if (type === 'stars') {
        for (let y = 32; y < H; y += 64) for (let x = 32; x < W; x += 64) {
          ctx.beginPath(); for (let k = 0; k < 16; k++) { const r = k % 2 ? 10 : 24; ctx.lineTo(x + r * Math.cos(k * 0.3927), y + r * Math.sin(k * 0.3927)); }
          ctx.closePath(); ctx.stroke(); dot(x + 32, y + 32, 2.5);
        }
      } else if (type === 'sunburst') {
        for (let k = 0; k < 72; k++) { const a = k * 0.0873; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); ctx.lineTo(cx + Math.cos(a) * 900, cy + Math.sin(a) * 900); ctx.stroke(); }
        for (let r = 60; r < 600; r += 34) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); dot(cx + r, cy, 3); }
      } else if (type === 'deco') {
        for (let y = 32; y < H + 32; y += 64) for (let x = 32; x < W + 32; x += 64) {
          for (const r of [28, 20, 12]) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke(); }
          dot(x, y, 3); dot(x + 32, y + 32, 2);
        }
      } else if (type === 'checker') {
        for (let r = -1; r < H / 36 + 1; r++) for (let c = -1; c < W / 48 + 1; c++) {
          const x = c * 48 + (r % 2 ? 24 : 0), y = r * 36;
          ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x + 24, y); ctx.lineTo(x, y + 36); ctx.lineTo(x - 24, y); ctx.closePath();
          if ((r + c) % 2) { ctx.fillStyle = F; ctx.fill(); } ctx.stroke();
        }
      } else if (type === 'dots') {
        ctx.fillStyle = L;
        for (let y = 14; y < H; y += 24) for (let x = 14; x < W; x += 24) { const d = Math.min(1, Math.hypot(x - cx, (y - cy) * 0.7) / 450); ctx.beginPath(); ctx.arc(x, y, Math.max(1, 9 * (1 - d)), 0, TAU); ctx.fill(); }
      } else if (type === 'circuit') {
        ctx.lineWidth = 2;
        for (let i = 0; i < 70; i++) {
          let x = Math.round(_rand(0, W) / 24) * 24, y = Math.round(_rand(0, H) / 24) * 24; const n = 2 + Math.floor(Math.random() * 3);
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < n; k++) { if (Math.random() < 0.5) x += 24 * Math.round(_rand(-4, 4)); else y += 24 * Math.round(_rand(-4, 4)); ctx.lineTo(x, y); }
          ctx.stroke(); dot(x, y, 5);
        }
      } else if (type === 'guilloche') {
        for (const [px, py, R] of [[cx, cy, 230], [cx, 120, 110], [cx, H - 120, 110]]) for (let k = 0; k < 48; k++) {
          ctx.save(); ctx.translate(px, py); ctx.rotate(k * 0.1309); ctx.beginPath(); ctx.ellipse(R * 0.3, 0, R * 0.7, R * 0.3, 0, 0, TAU); ctx.stroke(); ctx.restore();
        }
      } else if (type === 'florals') {
        for (let y = 0; y < H + 60; y += 60) for (let x = 0; x < W + 60; x += 60) {
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.5708) * 10, y + Math.sin(k * 1.5708) * 10, 11, 0, TAU); ctx.stroke(); }
          dot(x, y, 3); dot(x + 30, y + 30, 2);
        }
      } else {
        const sz = 44, h = sz * 0.866;
        for (let r = 0; r < H / h + 1; r++) for (let c = -1; c < W / sz + 2; c++) {
          const x = c * sz + (r % 2 ? sz / 2 : 0), y = r * h;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sz / 2, y + h); ctx.lineTo(x - sz / 2, y + h); ctx.closePath();
          if ((r + c) % 3 === 0) { ctx.fillStyle = F; ctx.fill(); } ctx.stroke();
        }
      }
    }

    function getPatternCanvas(st, mode) {
      const key = st.name + mode;
      if (patternCache.has(key)) return patternCache.get(key);
      const c = document.createElement('canvas'); c.width = 512; c.height = 720;
      const ctx = c.getContext('2d');
      const b = mode === 'b';
      drawPattern(ctx, st.type, 512, 720, rgba(b ? st.line : st.ink, b ? 0.42 : 0.09), rgba(b ? st.accent : st.red, b ? 0.55 : 0.13), rgba(b ? st.line : st.ink, b ? 0.14 : 0.04));
      patternCache.set(key, c);
      return c;
    }

    function _grain(ctx, n, a, w = 512, h = 720) {
      for (let i = 0; i < n; i++) { ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    }

    function getCardBackTexture(i = cardStyleIdx) {
      if (cardBackCache.has(i)) return cardBackCache.get(i);
      const st = CARD_STYLES[i], TAU = 6.283;
      const c = document.createElement('canvas'); c.width = 512; c.height = 720;
      const ctx = c.getContext('2d');
      ctx.fillStyle = st.paper; ctx.fillRect(0, 0, 512, 720);
      const g = ctx.createRadialGradient(256, 360, 40, 256, 360, 480);
      g.addColorStop(0, mixHex(st.bg, '#ffffff', 0.08)); g.addColorStop(1, mixHex(st.bg, '#000000', 0.35));
      ctx.fillStyle = g; roundRect(ctx, 26, 26, 460, 668, 20); ctx.fill();
      ctx.save(); roundRect(ctx, 42, 42, 428, 636, 14); ctx.clip(); ctx.drawImage(getPatternCanvas(st, 'b'), 0, 0); ctx.restore();
      // frames, rope dots and corner fans
      ctx.strokeStyle = st.accent; ctx.lineWidth = 5; roundRect(ctx, 40, 40, 432, 640, 14); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; roundRect(ctx, 54, 54, 404, 612, 8); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = st.accent;
      for (let x = 74; x < 450; x += 16) { ctx.beginPath(); ctx.arc(x, 47, 2, 0, TAU); ctx.arc(x, 673, 2, 0, TAU); ctx.fill(); }
      for (let y = 74; y < 650; y += 16) { ctx.beginPath(); ctx.arc(47, y, 2, 0, TAU); ctx.arc(465, y, 2, 0, TAU); ctx.fill(); }
      [[54, 54, 0], [458, 54, 1.5708], [458, 666, 3.1416], [54, 666, 4.7124]].forEach(([x, y, r]) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.lineWidth = 2;
        for (const rad of [14, 24, 34]) { ctx.beginPath(); ctx.arc(0, 0, rad, 0, 1.5708); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.restore();
      });
      // medallion
      ctx.fillStyle = mixHex(st.bg, '#000000', 0.2); ctx.beginPath(); ctx.arc(256, 360, 104, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(st.bg, 0.0);
      ctx.strokeStyle = st.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(256, 360, 96, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(256, 360, 80, 0, TAU); ctx.stroke();
      for (let k = 0; k < 36; k++) { const a = k * 0.1745; ctx.beginPath(); ctx.moveTo(256 + Math.cos(a) * 100, 360 + Math.sin(a) * 100); ctx.lineTo(256 + Math.cos(a) * 108, 360 + Math.sin(a) * 108); ctx.stroke(); }
      ctx.fillStyle = st.accent; ctx.font = '800 92px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(st.glyph, 256, 364);
      _grain(ctx, 3500, 0.04);
      const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
      cardBackCache.set(i, t);
      return t;
    }

    function _pipLayout(rank) {
      const L = 180, C = 256, R = 332;
      const side = ks => ks.flatMap(k => [[L, k], [R, k]]);
      return {
        2: [[C, 0], [C, 1]], 3: [[C, 0], [C, 0.5], [C, 1]], 4: side([0, 1]), 5: [...side([0, 1]), [C, 0.5]],
        6: side([0, 0.5, 1]), 7: [...side([0, 0.5, 1]), [C, 0.25]], 8: [...side([0, 0.5, 1]), [C, 0.25], [C, 0.75]],
        9: [...side([0, 1 / 3, 2 / 3, 1]), [C, 0.5]], 10: [...side([0, 1 / 3, 2 / 3, 1]), [C, 1 / 6], [C, 5 / 6]]
      }[rank] || [];
    }

    function getCardFrontTexture(rank, suit) {
      const key = `${cardStyleIdx}:${rank}${suit}`;
      if (cardTextureCache.has(key)) return cardTextureCache.get(key);
      const st = CARD_STYLES[cardStyleIdx], TAU = 6.283;
      const c = document.createElement('canvas'); c.width = 512; c.height = 720;
      const ctx = c.getContext('2d');
      const col = (suit === 'h' || suit === 'd') ? st.red : st.ink, sym = SUIT_SYMBOL[suit], label = RANK_LABEL[rank];
      const fc = lum(st.line) < lum(st.bg) ? st.line : st.bg;
      const pg = ctx.createLinearGradient(0, 0, 512, 720); pg.addColorStop(0, st.paper); pg.addColorStop(1, mixHex(st.paper, '#8a7a5a', 0.16));
      ctx.fillStyle = pg; ctx.fillRect(0, 0, 512, 720);
      ctx.save(); roundRect(ctx, 36, 36, 440, 648, 18); ctx.clip(); ctx.drawImage(getPatternCanvas(st, 'f'), 0, 0); ctx.restore();
      _grain(ctx, 3000, 0.03);

      // frame variants
      ctx.strokeStyle = fc; ctx.fillStyle = fc;
      if (st.frame === 0) { ctx.lineWidth = 3; roundRect(ctx, 20, 20, 472, 680, 22); ctx.stroke(); }
      else if (st.frame === 1) { ctx.lineWidth = 5; roundRect(ctx, 18, 18, 476, 684, 24); ctx.stroke(); ctx.lineWidth = 1.5; roundRect(ctx, 30, 30, 452, 660, 16); ctx.stroke(); }
      else if (st.frame === 2) {
        ctx.lineWidth = 5; ctx.lineCap = 'round';
        [[22, 22, 1, 1], [490, 22, -1, 1], [490, 698, -1, -1], [22, 698, 1, -1]].forEach(([x, y, dx, dy]) => { ctx.beginPath(); ctx.moveTo(x + dx * 90, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 90); ctx.stroke(); ctx.beginPath(); ctx.arc(x + dx * 18, y + dy * 18, 4, 0, TAU); ctx.fill(); });
        ctx.lineWidth = 1.5; roundRect(ctx, 22, 22, 468, 676, 4); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (st.frame === 3) {
        ctx.lineWidth = 3; const n = 26, a = 20, b = 492, d = 698;
        ctx.beginPath(); ctx.moveTo(a + n, a); ctx.lineTo(b - n, a); ctx.lineTo(b - n, a + 8); ctx.lineTo(b - 8, a + 8); ctx.lineTo(b - 8, a + n); ctx.lineTo(b, a + n);
        ctx.lineTo(b, d - n); ctx.lineTo(b - 8, d - n); ctx.lineTo(b - 8, d - 8); ctx.lineTo(b - n, d - 8); ctx.lineTo(b - n, d); ctx.lineTo(a + n, d);
        ctx.lineTo(a + n, d - 8); ctx.lineTo(a + 8, d - 8); ctx.lineTo(a + 8, d - n); ctx.lineTo(a, d - n); ctx.lineTo(a, a + n); ctx.lineTo(a + 8, a + n); ctx.lineTo(a + 8, a + 8); ctx.lineTo(a + n, a + 8); ctx.closePath(); ctx.stroke();
      } else {
        ctx.lineWidth = 2; roundRect(ctx, 20, 20, 472, 680, 22); ctx.stroke();
        ctx.setLineDash([2, 9]); ctx.lineWidth = 3; ctx.lineCap = 'round'; roundRect(ctx, 32, 32, 448, 656, 14); ctx.stroke(); ctx.setLineDash([]);
        [[26, 26], [486, 26], [486, 694], [26, 694]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); });
      }

      // corner indices
      const idx = () => {
        ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `800 ${label === '10' ? 84 : 100}px ${st.font}`; ctx.fillText(label, 82, 96);
        ctx.font = '900 66px Inter, sans-serif'; ctx.fillText(sym, 82, 176);
      };
      idx(); ctx.save(); ctx.translate(512, 720); ctx.rotate(Math.PI); idx(); ctx.restore();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col;
      if (rank <= 10) {
        const size = rank <= 6 ? 96 : 84;
        _pipLayout(rank).forEach(([x, k]) => {
          const y = 185 + 350 * k;
          ctx.save(); ctx.translate(x, y); if (k > 0.5) ctx.rotate(Math.PI);
          ctx.font = `900 ${size}px Inter, sans-serif`; ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
          ctx.fillText(sym, 0, 0); ctx.restore();
        });
      } else if (rank === 14) {
        ctx.strokeStyle = fc; ctx.lineWidth = 3;
        for (const r of [158, 146]) { ctx.beginPath(); ctx.arc(256, 360, r, 0, TAU); ctx.stroke(); }
        for (let k = 0; k < 48; k++) { const a = k * 0.1309; ctx.beginPath(); ctx.moveTo(256 + Math.cos(a) * 158, 360 + Math.sin(a) * 158); ctx.lineTo(256 + Math.cos(a) * 170, 360 + Math.sin(a) * 170); ctx.stroke(); }
        ctx.font = '900 230px Inter, sans-serif'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; ctx.fillText(sym, 256, 366);
      } else {
        // Court card: mirrored halves inside a double-framed panel
        ctx.fillStyle = rgba(col, 0.06); ctx.fillRect(146, 180, 220, 360);
        ctx.strokeStyle = fc; ctx.lineWidth = 4; ctx.strokeRect(146, 180, 220, 360); ctx.lineWidth = 1.5; ctx.strokeRect(156, 190, 200, 340);
        const half = () => {
          ctx.fillStyle = fc; ctx.font = '700 62px serif'; ctx.fillText(rank === 13 ? '♔' : rank === 12 ? '♕' : '♘', 256, 226);
          ctx.fillStyle = col; ctx.font = `900 108px ${st.font}`; ctx.fillText(label, 256, 306);
          ctx.font = '900 48px Inter, sans-serif'; ctx.fillText(sym, 256, 354 + 6);
          ctx.strokeStyle = fc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(166, 200, 14, 0, 1.5708); ctx.stroke(); ctx.beginPath(); ctx.arc(346, 200, 14, 1.5708, 3.1416); ctx.stroke();
        };
        half(); ctx.save(); ctx.translate(512, 720); ctx.rotate(Math.PI); half(); ctx.restore();
        ctx.strokeStyle = fc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(156, 360); ctx.lineTo(356, 360); ctx.stroke();
        ctx.fillStyle = fc; ctx.beginPath(); ctx.moveTo(256, 348); ctx.lineTo(268, 360); ctx.lineTo(256, 372); ctx.lineTo(244, 360); ctx.fill();
      }
      const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
      cardTextureCache.set(key, tex);
      return tex;
    }

    function applyCardStyle(i) {
      cardStyleIdx = i;
      cardTextureCache.forEach(t => t.dispose()); cardTextureCache.clear();
      if (typeof table3D !== 'undefined' && table3D) table3D.activeCardMeshes.forEach(m => {
        const d = m.userData.card; if (!d || !Array.isArray(m.material)) return;
        m.material[2].map = getCardFrontTexture(d.rank, d.suit); m.material[3].map = getCardBackTexture();
        m.material[2].needsUpdate = m.material[3].needsUpdate = true;
      });
    }

    /**
     * Generates procedural casino chip textures (top & striped edge) per denomination.
     */
    function getChipMaterials(denom) {
      if (chipTextureCache.has(denom)) return chipTextureCache.get(denom);

      const palette = {
        1:    { main: '#3d6ea8', stripe: '#e8e6df', text: '#ffffff' },
        5:    { main: '#8f151c', stripe: '#e8e6df', text: '#ffffff' },
        25:   { main: '#0f5f2d', stripe: '#d9c04a', text: '#ffffff' },
        100:  { main: '#101013', stripe: '#c7a24a', text: '#fef08a' },
        500:  { main: '#4a1675', stripe: '#f0abfc', text: '#ffffff' },
        1000: { main: '#a16a0c', stripe: '#18181b', text: '#18181b' }
      }[denom] || { main: '#c81d25', stripe: '#ffffff', text: '#ffffff' };

      // Top face
      const cTop = document.createElement('canvas');
      cTop.width = 256;
      cTop.height = 256;
      const ctx = cTop.getContext('2d');
      ctx.fillStyle = palette.main;
      ctx.fillRect(0, 0, 256, 256);

      // Edge dashes around perimeter
      ctx.save();
      ctx.translate(128, 128);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = palette.stripe;
        ctx.fillRect(-14, -128, 28, 26);
      }
      ctx.restore();

      // Inner inlay circle
      ctx.beginPath();
      ctx.arc(128, 128, 76, 0, Math.PI * 2);
      ctx.fillStyle = '#d8d2c2';
      ctx.fill();
      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#111827';
      ctx.font = '800 42px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${denom}`, 128, 128);

      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(128, 128, 64, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(128, 128, 120, 0, 6.283); ctx.stroke();
      for (let i = 0; i < 2500; i++) { ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
      const topTex = new THREE.CanvasTexture(cTop);

      // Side edge stripes
      const cSide = document.createElement('canvas');
      cSide.width = 256;
      cSide.height = 32;
      const sctx = cSide.getContext('2d');
      sctx.fillStyle = palette.main;
      sctx.fillRect(0, 0, 256, 32);
      sctx.fillStyle = palette.stripe;
      for (let x = 0; x < 256; x += 32) {
        sctx.fillRect(x, 0, 12, 32);
      }
      const sideTex = new THREE.CanvasTexture(cSide);

      const mats = [
        new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.3, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.3, metalness: 0.1 })
      ];
      chipTextureCache.set(denom, mats);
      return mats;
    }

    function createDealerButtonTexture() {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 256);
      ctx.beginPath();
      ctx.arc(128, 128, 110, 0, Math.PI * 2);
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = '900 48px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DEALER', 128, 128);
      return new THREE.CanvasTexture(c);
    }

    /* =========================================================================
       5. THREE.JS 3D CASINO SCENE, TABLE, SEAT ANCHORS & ANIMATIONS
       ========================================================================= */

    /* ---- Individual characters ---- */
    const CHAR_DESIGNS = [
      { kind: 'viper', skin: '#c68a5e', hair: '#0d0d10', cloth: '#0f3d2e', shirt: '#15151a' },
      { kind: 'prof', skin: '#e7b998', hair: '#c4c8cd', cloth: '#5b4430', shirt: '#e9e4d6' },
      { kind: 'lou', skin: '#d9a066', hair: '#3a2414', cloth: '#e08a1e', shirt: '#f4e2b8' },
      { kind: 'duchess', skin: '#f0c8a8', hair: '#7a2e1f', cloth: '#5a2a82', shirt: '#e8d8f0' },
      { kind: 'dog', skin: '#b07a52', hair: '#c01818', cloth: '#7e1818', shirt: '#1a1a1a' }
    ];

    function buildCharacter(i) {
      const D = CHAR_DESIGNS[i % CHAR_DESIGNS.length];
      const group = new THREE.Group();
      const M = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const skin = M(D.skin, 0.55), cloth = M(D.cloth, 0.7), shirt = M(D.shirt, 0.6), hair = M(D.hair, 0.5);
      const dark = M('#111111', 0.4), white = M('#f4f4f4', 0.4), gold = M('#d4af37', 0.3, 0.8);
      const add = (par, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; par.add(m); return m;
      };
      const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
      const torso = new THREE.Group(); group.add(torso);
      add(torso, new THREE.CylinderGeometry(0.24, 0.3, 0.56, 20), cloth, 0, 0.36, 0, 1.1, 1, 0.64);
      add(torso, S(0.3), cloth, 0, 0.63, 0, 1.15, 0.42, 0.66);
      add(torso, new THREE.BoxGeometry(0.15, 0.3, 0.02), shirt, 0, 0.52, 0.185);
      add(torso, new THREE.CylinderGeometry(0.065, 0.075, 0.14, 12), skin, 0, 0.72, 0);

      const head = new THREE.Group(); head.position.set(0, 0.74, 0); group.add(head);
      add(head, S(0.2, 24, 18), skin, 0, 0.2, 0, 1, 1.12, 1);
      [-1, 1].forEach(sx => {
        add(head, S(0.04), skin, sx * 0.2, 0.2, 0, 0.6, 1, 1);
        add(head, S(0.03), white, sx * 0.075, 0.24, 0.17);
        add(head, S(0.017), dark, sx * 0.075, 0.24, 0.195);
        add(head, new THREE.BoxGeometry(0.075, 0.014, 0.02), hair, sx * 0.075, 0.29, 0.18);
      });
      add(head, S(0.03), skin, 0, 0.19, 0.2, 1, 1.1, 1);
      add(head, new THREE.BoxGeometry(0.08, 0.014, 0.02), M('#6a2a2a'), 0, 0.12, 0.185);

      if (D.kind === 'viper') {
        add(head, S(0.21, 20, 14), hair, 0, 0.27, -0.03, 1, 0.8, 1.05);
        add(head, new THREE.BoxGeometry(0.36, 0.075, 0.03), M('#050505', 0.15, 0.4), 0, 0.24, 0.19);
        add(torso, new THREE.TorusGeometry(0.12, 0.012, 8, 24), gold, 0, 0.58, 0.16, 1, 1, 0.6).rotation.x = 1.2;
      } else if (D.kind === 'prof') {
        [-1, 1].forEach(sx => { add(head, S(0.07), hair, sx * 0.17, 0.2, -0.02); add(head, new THREE.TorusGeometry(0.06, 0.009, 8, 20), gold, sx * 0.075, 0.24, 0.195); });
        add(head, S(0.2, 20, 12), hair, 0, 0.2, -0.07, 1, 0.9, 0.7);
        add(head, new THREE.BoxGeometry(0.1, 0.02, 0.025), hair, 0, 0.145, 0.2);
        add(torso, new THREE.BoxGeometry(0.1, 0.04, 0.03), M('#a01818'), 0, 0.66, 0.2);
        add(torso, S(0.02), M('#a01818'), 0, 0.66, 0.21);
      } else if (D.kind === 'lou') {
        add(head, new THREE.CylinderGeometry(0.22, 0.23, 0.07, 20), M('#2f6b3a'), 0, 0.37, 0);
        add(head, new THREE.BoxGeometry(0.22, 0.02, 0.12), M('#2f6b3a'), 0, 0.35, 0.2);
        add(head, new THREE.BoxGeometry(0.14, 0.03, 0.03), hair, 0, 0.145, 0.2);
        add(torso, S(0.03), M('#c0392b'), 0.06, 0.5, 0.19);
      } else if (D.kind === 'duchess') {
        add(head, S(0.21, 20, 14), hair, 0, 0.24, -0.04, 1, 0.95, 1);
        add(head, S(0.09), hair, 0, 0.45, -0.05);
        add(head, new THREE.TorusGeometry(0.14, 0.012, 8, 24, Math.PI), gold, 0, 0.36, 0.0).rotation.set(0.2, 0, 0);
        [-1, 1].forEach(sx => add(head, S(0.016), gold, sx * 0.2, 0.12, 0.02));
        add(head, new THREE.BoxGeometry(0.075, 0.016, 0.02), M('#b0203a'), 0, 0.12, 0.186);
        add(torso, new THREE.TorusGeometry(0.115, 0.012, 8, 24), M('#f4f0e8', 0.3), 0, 0.64, 0.05).rotation.x = Math.PI / 2;
      } else {
        for (let k = 0; k < 5; k++) add(head, new THREE.ConeGeometry(0.03, 0.14 - Math.abs(k - 2) * 0.02, 6), hair, 0, 0.4, 0.12 - k * 0.07);
        add(head, S(0.17, 16, 12), M('#1e1410', 0.8), 0, 0.09, 0.05, 1, 0.65, 0.85);
        add(head, new THREE.BoxGeometry(0.012, 0.07, 0.01), M('#d8b0a0'), 0.08, 0.26, 0.205).rotation.z = 0.5;
        [-1, 1].forEach(sx => add(torso, new THREE.ConeGeometry(0.03, 0.08, 6), M('#c0c0c8', 0.3, 0.8), sx * 0.3, 0.7, 0));
      }

      const arm = (sx) => {
        const up = new THREE.Group(); up.position.set(sx * 0.28, 0.62, 0); up.rotation.order = 'YXZ'; group.add(up);
        const g1 = new THREE.CylinderGeometry(0.06, 0.055, 0.3, 12); g1.translate(0, -0.15, 0); add(up, g1, cloth);
        const fo = new THREE.Group(); fo.position.set(0, -0.3, 0); up.add(fo);
        const g2 = new THREE.CylinderGeometry(0.055, 0.05, 0.34, 12); g2.translate(0, -0.17, 0); add(fo, g2, cloth);
        add(fo, S(0.055), skin, 0, -0.36, 0);
        return { up, fo };
      };
      group.scale.setScalar(1.3);
      return { group, torso, head, armR: arm(1), armL: arm(-1) };
    }

    class PokerTable3D {
      constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030406);
        this.scene.fog = new THREE.FogExp2(0x030406, 0.048);

        this.camera = new THREE.PerspectiveCamera(42, vw() / vh(), 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(vw(), vh());
        this.pr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.renderer.setPixelRatio(this.pr);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.autoUpdate = false; // refreshed only while things move (see update())
        this.renderer.shadowMap.needsUpdate = true;
        this.perfLevel = 0; this._ema = 0.0167; this._slow = 0; this._shadowAcc = 0;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.88;
        container.appendChild(this.renderer.domElement);

        // Camera Modes: 'pov', 'action', 'orbit'
        this.camMode = 'pov';
        this.orbitTheta = 0;
        this.orbitPhi = 0.88;
        this.orbitRadius = 9.8;
        this.camTarget = new THREE.Vector3(0, 0.15, 0.45);
        this.camDesiredPos = new THREE.Vector3(0, 5.4, 7.2);
        this.camDesiredTarget = new THREE.Vector3(0, 0.15, 0.55);
        this.actionFocusPoint = new THREE.Vector3(0, 0.1, 0);
        this.actionZoomActive = false;

        // Pointer / Orbit / Hover Peek
        this.isDragging = false;
        this.lastPointer = { x: 0, y: 0 };
        this.raycaster = new THREE.Raycaster();
        this.mouseNDC = new THREE.Vector2(-99, -99);
        this.hoveredPlayerCards = false;

        // Animated objects
        this.tweens = [];
        this.activeCardMeshes = [];
        this.playerHoleMeshes = [];
        this.communityMeshes = [];
        this.potChipGroup = new THREE.Group();
        this.flyingChips = [];
        this.physChips = [];
        this.seatAnchors = [];
        this.seatChipGroups = [];
        this.seatBetGroups = [];

        this.cardGeo = new THREE.BoxGeometry(0.66, 0.014, 0.94);
        this.cardEdgeMat = new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: 0.5 });
        this.chipGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.042, 24);

        this._buildEnvironment();
        this._buildTable();
        this._buildSeats();
        this._buildDealerButton();
        this.scene.add(this.potChipGroup);

        this._setupInteractions();
      }

      _buildEnvironment() {
        // Warm casino ambient
        const ambient = new THREE.AmbientLight(0x9fb4d8, 0.16);
        this.scene.add(ambient);

        // Main Overhead Casino Spotlight
        const spot = new THREE.SpotLight(0xfff0cc, 2.6, 30, Math.PI / 4.4, 0.75, 1.1);
        spot.position.set(0, 9.5, 0.5);
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        spot.shadow.bias = -0.0005;
        this.scene.add(spot);

        // Subtle cool rim light from back & warm fill from front
        const rimLeft = new THREE.PointLight(0x38bdf8, 0.22, 22);
        rimLeft.position.set(-7.5, 4.5, -5.5);
        this.scene.add(rimLeft);

        const rimRight = new THREE.PointLight(0xf59e0b, 0.22, 22);
        rimRight.position.set(7.5, 4.5, -5.5);
        this.scene.add(rimRight);

        const frontFill = new THREE.PointLight(0xfff1d6, 0.18, 16);
        frontFill.position.set(0, 3.8, 6.2);
        this.scene.add(frontFill);

        // Moody Casino Floor
        const floorGeo = new THREE.CircleGeometry(28, 48);
        const floorMat = new THREE.MeshStandardMaterial({
          color: 0x050609,
          roughness: 0.95,
          metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2.45;
        floor.receiveShadow = true;
        this.scene.add(floor);
      }

      _createOvalShape(rx, ry) {
        const shape = new THREE.Shape();
        shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
        return shape;
      }

      _buildTable() {
        this.tableGroup = new THREE.Group();
        this.scene.add(this.tableGroup);

        // 1. Inner Felt Surface (Elliptical plane)
        const feltShape = this._createOvalShape(4.05, 2.18);
        const feltGeo = new THREE.ShapeGeometry(feltShape, 64);
        // Normalize UVs to [0, 1] for our 1024x512 felt texture
        const pos = feltGeo.attributes.position;
        const uvs = [];
        for (let i = 0; i < pos.count; i++) {
          const u = (pos.getX(i) / (4.05 * 2)) + 0.5;
          const v = (pos.getY(i) / (2.18 * 2)) + 0.5;
          uvs.push(u, v);
        }
        feltGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        feltGeo.rotateX(-Math.PI / 2);

        this.feltMat = new THREE.MeshStandardMaterial({
          map: createFeltTexture(GAME_MODES.cash),
          roughness: 0.95,
          metalness: 0.02
        });
        const feltMesh = new THREE.Mesh(feltGeo, this.feltMat);
        feltMesh.receiveShadow = true;
        this.tableGroup.add(feltMesh);

        // 2. Lacquered Dark Walnut Racetrack Ring
        const woodOuter = this._createOvalShape(4.55, 2.66);
        const woodHole = new THREE.Path();
        woodHole.absellipse(0, 0, 3.98, 2.12, 0, Math.PI * 2, true, 0);
        woodOuter.holes.push(woodHole);

        const woodGeo = new THREE.ExtrudeGeometry(woodOuter, {
          depth: 0.14,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.03,
          bevelSegments: 3,
          curveSegments: 64
        });
        woodGeo.rotateX(-Math.PI / 2);
        const woodTex = createWoodTexture();
        const woodMat = new THREE.MeshStandardMaterial({
          map: woodTex,
          roughness: 0.3,
          metalness: 0.12
        });
        const woodMesh = new THREE.Mesh(woodGeo, woodMat);
        woodMesh.position.y = -0.06;
        woodMesh.receiveShadow = true;
        woodMesh.castShadow = true;
        this.tableGroup.add(woodMesh);

        // 3. Padded Stitched Leather Armrest Rail
        const railOuter = this._createOvalShape(5.05, 3.16);
        const railHole = new THREE.Path();
        railHole.absellipse(0, 0, 4.46, 2.58, 0, Math.PI * 2, true, 0);
        railOuter.holes.push(railHole);

        const railGeo = new THREE.ExtrudeGeometry(railOuter, {
          depth: 0.24,
          bevelEnabled: true,
          bevelThickness: 0.12,
          bevelSize: 0.11,
          bevelSegments: 5,
          curveSegments: 64
        });
        railGeo.rotateX(-Math.PI / 2);
        const leatherTex = createLeatherTexture();
        const leatherMat = new THREE.MeshStandardMaterial({
          map: leatherTex,
          roughness: 0.55,
          metalness: 0.08
        });
        const railMesh = new THREE.Mesh(railGeo, leatherMat);
        railMesh.position.y = -0.02;
        railMesh.castShadow = true;
        railMesh.receiveShadow = true;
        this.tableGroup.add(railMesh);

        // Gold accent trim ring between wood & rail
        const trimOuter = this._createOvalShape(4.52, 2.63);
        const trimHole = new THREE.Path();
        trimHole.absellipse(0, 0, 4.45, 2.56, 0, Math.PI * 2, true, 0);
        trimOuter.holes.push(trimHole);
        const trimGeo = new THREE.ExtrudeGeometry(trimOuter, { depth: 0.02, bevelEnabled: false, curveSegments: 64 });
        trimGeo.rotateX(-Math.PI / 2);
        const brassMat = new THREE.MeshStandardMaterial({
          color: 0xa8872c,
          roughness: 0.32,
          metalness: 0.85
        });
        const trimMesh = new THREE.Mesh(trimGeo, brassMat);
        trimMesh.position.y = 0.095;
        this.tableGroup.add(trimMesh);

        // 4. Table Under-Apron & Twin Pedestal Legs
        const apronShape = this._createOvalShape(4.65, 2.75);
        const apronGeo = new THREE.ExtrudeGeometry(apronShape, { depth: 0.42, bevelEnabled: false, curveSegments: 48 });
        apronGeo.rotateX(-Math.PI / 2);
        const apronMesh = new THREE.Mesh(apronGeo, woodMat);
        apronMesh.position.y = -0.48;
        this.tableGroup.add(apronMesh);

        const legGeo = new THREE.CylinderGeometry(0.45, 0.72, 2.0, 24);
        [-2.2, 2.2].forEach(lx => {
          const leg = new THREE.Mesh(legGeo, woodMat);
          leg.position.set(lx, -1.45, 0);
          leg.castShadow = true;
          this.tableGroup.add(leg);
        });

        // 5. Metallic Brass Cup Holders (6 around the walnut racetrack)
        const cupPositions = [
          [1.25, 2.38], [-3.75, 1.55], [-3.75, -1.55],
          [-1.25, -2.38], [3.75, -1.55], [3.75, 1.55]
        ];
        const cupOuterGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.06, 24);
        const cupInnerGeo = new THREE.CylinderGeometry(0.15, 0.14, 0.065, 24);
        const cupDarkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
        cupPositions.forEach(([cx, cz]) => {
          const rim = new THREE.Mesh(cupOuterGeo, brassMat);
          rim.position.set(cx, 0.09, cz);
          this.tableGroup.add(rim);
          const hole = new THREE.Mesh(cupInnerGeo, cupDarkMat);
          hole.position.set(cx, 0.094, cz);
          this.tableGroup.add(hole);
        });

        // 6. Dealer Chip Rack (sleekly positioned on top-right racetrack)
        this._buildDealerChipRack(brassMat);
      }

      _buildDealerChipRack(brassMat) {
        const rack = new THREE.Group();
        rack.position.set(2.05, 0.14, -2.18);
        rack.rotation.y = -0.35;

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(1.45, 0.12, 0.52),
          new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.35, metalness: 0.4 })
        );
        rack.add(base);

        // Decorative chip rows inside the dealer tray
        const denoms = [5, 25, 100, 500, 1000];
        denoms.forEach((d, idx) => {
          const mats = getChipMaterials(d);
          for (let c = 0; c < 6; c++) {
            const chip = new THREE.Mesh(this.chipGeo, mats);
            chip.rotation.x = Math.PI / 2;
            chip.scale.set(0.68, 0.68, 0.68);
            chip.position.set(-0.52 + idx * 0.26, 0.08, -0.15 + c * 0.055);
            rack.add(chip);
          }
        });

        this.tableGroup.add(rack);
      }

      _buildSeats() {
        // 6-Max symmetric oval seating:
        // Seat 0 = Human Player (Bottom Center)
        // Seats 1-5 = AI Opponents clockwise
        const seatConfigs = [
          { x: 0.0,   z: 3.72,  cardX: 0.0,   cardZ: 1.72, betX: 0.0,   betZ: 1.08, stackX: -1.15, stackZ: 1.62, isPlayer: true,  color: '#e5c158', name: 'YOU' },
          { x: -4.85, z: 1.85,  cardX: -3.15, cardZ: 0.92, betX: -2.35, betZ: 0.68, stackX: -3.45, stackZ: 0.15, isPlayer: false, color: AI_PROFILES[0].color, name: AI_PROFILES[0].name },
          { x: -4.85, z: -1.85, cardX: -3.15, cardZ: -0.92,betX: -2.35, betZ: -0.68,stackX: -3.45, stackZ: -1.62,isPlayer: false, color: AI_PROFILES[1].color, name: AI_PROFILES[1].name },
          { x: 0.0,   z: -3.72, cardX: 0.0,   cardZ: -1.65,betX: 0.0,   betZ: -1.05,stackX: -1.15, stackZ: -1.62,isPlayer: false, color: AI_PROFILES[2].color, name: AI_PROFILES[2].name },
          { x: 4.85,  z: -1.85, cardX: 3.15,  cardZ: -0.92,betX: 2.35,  betZ: -0.68,stackX: 3.45,  stackZ: -1.62,isPlayer: false, color: AI_PROFILES[3].color, name: AI_PROFILES[3].name },
          { x: 4.85,  z: 1.85,  cardX: 3.15,  cardZ: 0.92, betX: 2.35,  betZ: 0.68, stackX: 3.45,  stackZ: 0.15, isPlayer: false, color: AI_PROFILES[4].color, name: AI_PROFILES[4].name }
        ];

        seatConfigs.forEach((cfg, idx) => {
          const anchor = new THREE.Group();
          anchor.name = `SeatAnchor_${idx}`;
          anchor.position.set(cfg.x, 0, cfg.z);
          const facingY = Math.atan2(-cfg.x, -cfg.z);
          anchor.rotation.y = facingY;
          this.scene.add(anchor);

          // Character Socket (where external TypeScript 3D characters attach)
          const characterSocket = new THREE.Group();
          characterSocket.name = `CharacterSocket_${idx}`;
          anchor.add(characterSocket);

          // Default Stylized Glowing Holo-Bust & Medallion (only visible for AI seats or until external char attached)
          const placeholder = new THREE.Group();
          const accentColor = new THREE.Color(cfg.color);

          // Pedestal ring
          const ringMat = new THREE.MeshStandardMaterial({
            color: accentColor,
            emissive: accentColor,
            emissiveIntensity: 0.35,
            roughness: 0.25,
            metalness: 0.7
          });
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 32), ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.08;
          placeholder.add(ring);

          let char = null;
          let mosaic = null;
          if (!cfg.isPlayer) {
            const prof = AI_PROFILES[idx - 1];
            if (prof.mosaicId !== undefined && bridge.drawPerson) { mosaic = makeMosaicBillboard(prof.mosaicId); placeholder.add(mosaic.sprite); }
            else { char = buildCharacter(idx - 1); placeholder.add(char.group); }
          }

          anchor.add(placeholder);

          // Chip stack group & bet stack group on felt
          const stackGroup = new THREE.Group();
          stackGroup.position.set(cfg.stackX, 0.02, cfg.stackZ);
          this.scene.add(stackGroup);

          const betGroup = new THREE.Group();
          betGroup.position.set(cfg.betX, 0.02, cfg.betZ);
          this.scene.add(betGroup);

          this.seatChipGroups.push(stackGroup);
          this.seatBetGroups.push(betGroup);

          this.seatAnchors.push({
            seatIndex: idx,
            name: cfg.name,
            isPlayer: cfg.isPlayer,
            anchor,
            socket: characterSocket,
            placeholder,
            ringMat,
            baseColor: accentColor.clone(),
            char, mosaic, mood: 'idle', thinkT: 0, thinkGoal: 0,
            customCharacter: null,
            facingRotationY: facingY,
            cardPos: new THREE.Vector3(cfg.cardX, 0.03, cfg.cardZ),
            betPos: new THREE.Vector3(cfg.betX, 0.04, cfg.betZ),
            tagWorldPos: new THREE.Vector3(cfg.x, cfg.isPlayer ? 0.4 : 1.52, cfg.z)
          });
        });
      }

      _buildDealerButton() {
        const tex = createDealerButtonTexture();
        const mats = [
          new THREE.MeshStandardMaterial({ color: 0xe5c158, roughness: 0.3, metalness: 0.6 }),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 })
        ];
        this.dealerBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.055, 28), mats);
        this.dealerBtn.position.set(0.7, 0.04, 1.5);
        this.dealerBtn.castShadow = true;
        this.scene.add(this.dealerBtn);
      }

      setModeTheme(modeConfig) {
        if (this.feltMat.map) this.feltMat.map.dispose();
        this.feltMat.map = createFeltTexture(modeConfig);
        this.feltMat.needsUpdate = true;
      }

      moveDealerButton(seatIndex) {
        const seat = this.seatAnchors[seatIndex];
        if (!seat) return;
        const targetX = seat.cardPos.x * 0.78 + (seatIndex === 0 ? 0.95 : 0.45);
        const targetZ = seat.cardPos.z * 0.78;
        this.addTween(this.dealerBtn.position, { x: targetX, y: 0.04, z: targetZ }, 450, 'easeOutCubic');
      }

      /**
       * Creates a 3D playing card mesh with front & back textures.
       */
      createCardMesh(cardData) {
        const frontTex = getCardFrontTexture(cardData.rank, cardData.suit);
        const backTex = getCardBackTexture();
        const frontMat = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.35, metalness: 0.04 });
        const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.4, metalness: 0.06 });

        // BoxGeometry face order: +x, -x, +y (top/front), -y (bottom/back), +z, -z
        const mats = [
          this.cardEdgeMat, this.cardEdgeMat,
          frontMat, backMat,
          this.cardEdgeMat, this.cardEdgeMat
        ];
        const mesh = new THREE.Mesh(this.cardGeo, mats);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { card: cardData, basePos: new THREE.Vector3(), baseRot: new THREE.Euler(), isPlayerHole: false };
        this.scene.add(mesh);
        this.activeCardMeshes.push(mesh);
        return mesh;
      }

      clearTableCards() {
        this.activeCardMeshes.forEach(m => {
          this.scene.remove(m);
        });
        this.activeCardMeshes = [];
        this.playerHoleMeshes = [];
        this.communityMeshes = [];
      }

      /**
       * Animates dealing a card from the dealer origin to a seat with realistic arc & rotation.
       */
      dealHoleCard(seatIndex, cardSlot, cardData, faceUp = false, delayMs = 0) {
        const seat = this.seatAnchors[seatIndex];
        const mesh = this.createCardMesh(cardData);

        // Start at dealer rack position
        mesh.position.set(1.5, 0.25, -1.9);
        mesh.rotation.set(Math.PI, 0, 0); // face down

        const offset = (cardSlot === 0 ? -0.34 : 0.34);
        const dir = seat.facingRotationY;
        let targetPos, targetRot;

        if (seat.isPlayer) {
          // Angle player hole cards cleanly upward toward the camera for effortless 3D readability
          targetPos = new THREE.Vector3(offset * 1.18, 0.46, 2.28);
          targetRot = new THREE.Euler(0.92, offset * -0.14, 0);
          mesh.userData.isPlayerHole = true;
          mesh.userData.basePos.copy(targetPos);
          mesh.userData.baseRot.copy(targetRot);
          this.playerHoleMeshes.push(mesh);
        } else {
          const rx = Math.cos(dir) * offset;
          const rz = -Math.sin(dir) * offset;
          targetPos = new THREE.Vector3(seat.cardPos.x + rx, 0.03 + cardSlot * 0.015, seat.cardPos.z + rz);
          targetRot = new THREE.Euler(faceUp ? 0 : Math.PI, dir, 0);
        }

        setTimeout(() => {
          sound.playCardSlide();
          this.addArcTween(mesh, targetPos, targetRot, 380, 0.65);
        }, delayMs);

        return mesh;
      }

      /**
       * Deals and flips a community card (index 0..4) into the center slots.
       */
      dealCommunityCard(slotIndex, cardData, delayMs = 0) {
        const mesh = this.createCardMesh(cardData);
        mesh.position.set(1.5, 0.28, -1.9);
        mesh.rotation.set(Math.PI, 0, 0);

        const targetPos = new THREE.Vector3(-1.56 + slotIndex * 0.78, 0.03, 0.0);
        const targetRot = new THREE.Euler(0, 0, 0);

        this.communityMeshes[slotIndex] = mesh;

        setTimeout(() => {
          sound.playCardSlide();
          this.addArcTween(mesh, targetPos, targetRot, 420, 0.85, () => {
            sound.playCardFlip();
          });
        }, delayMs);

        return mesh;
      }

      /**
       * Reveals an AI player's hole cards smoothly at Showdown.
       */
      flipCardFaceUp(mesh, delayMs = 0) {
        if (!mesh) return;
        setTimeout(() => {
          sound.playCardFlip();
          const upPos = mesh.position.clone();
          upPos.y = 0.04;
          this.addArcTween(mesh, upPos, new THREE.Euler(0, mesh.rotation.y, 0), 340, 0.35);
        }, delayMs);
      }

      /**
       * Highlights and lifts the winning 5-card combination at Showdown.
       */
      highlightWinningCards(bestCards) {
        if (!bestCards || !bestCards.length) return;
        const winKeys = new Set(bestCards.map(c => `${c.rank}${c.suit}`));
        this.activeCardMeshes.forEach(mesh => {
          const c = mesh.userData.card;
          if (c && winKeys.has(`${c.rank}${c.suit}`)) {
            const liftY = mesh.userData.isPlayerHole ? 0.68 : 0.24;
            this.addTween(mesh.position, { x: mesh.position.x, y: liftY, z: mesh.position.z }, 420, 'easeOutCubic');
            // Subtle warm gold emissive glow on the front face
            if (mesh.material[2]) {
              mesh.material[2].emissive = new THREE.Color(0x5a4410);
              mesh.material[2].emissiveIntensity = 0.55;
            }
          }
        });
      }

      /**
       * Rebuilds a 3D chip stack mesh group for a given dollar amount.
       */
      renderChipStack(group, amount, maxChips = 18) {
        this.physChips = this.physChips.filter(c => c.mesh.parent !== group);
        const prev = group.userData.count || 0;
        while (group.children.length > 0) group.remove(group.children[0]);
        group.userData.count = 0;
        if (amount <= 0) return;

        const denoms = [1000, 500, 100, 25, 5, 1];
        const chips = [];
        let rem = Math.floor(amount);
        for (const d of denoms) {
          while (rem >= d && chips.length < maxChips) { chips.push(d); rem -= d; }
        }
        if (chips.length === 0 && amount > 0) chips.push(1);
        group.userData.count = chips.length;

        const perCol = 7;
        chips.forEach((d, idx) => {
          const col = Math.floor(idx / perCol), row = idx % perCol;
          const mesh = new THREE.Mesh(this.chipGeo, getChipMaterials(d));
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          const angle = col * 2.1, rad = col === 0 ? 0 : 0.38;
          const target = new THREE.Vector3(
            Math.cos(angle) * rad + (Math.random() - 0.5) * 0.015,
            row * 0.043 + 0.021,
            Math.sin(angle) * rad + (Math.random() - 0.5) * 0.015
          );
          mesh.position.copy(target);
          group.add(mesh);
          if (idx >= prev) {
            // New chip: released above the stack, falls, bounces and tumbles flat
            mesh.position.set(target.x + _rand(-0.1, 0.1), target.y + 0.7, target.z + _rand(-0.1, 0.1));
            mesh.rotation.set(_rand(-0.6, 0.6), _rand(0, 6.28), _rand(-0.6, 0.6));
            mesh.visible = false;
            this.physChips.push({
              mesh, target, vel: new THREE.Vector3(0, -_rand(0.3, 1.5), 0),
              ang: new THREE.Vector3(_rand(-5, 5), _rand(-3, 3), _rand(-5, 5)),
              delay: Math.min(idx - prev, 8) * 0.05
            });
          }
        });
      }

      updateSeatChips(seatIndex, stackAmount, betAmount) {
        this.renderChipStack(this.seatChipGroups[seatIndex], stackAmount, 16);
        this.renderChipStack(this.seatBetGroups[seatIndex], betAmount, 10);
      }

      updatePotChips(potAmount) {
        this.potChipGroup.position.set(0, 0.02, -0.78);
        this.renderChipStack(this.potChipGroup, potAmount, 24);
      }

      /**
       * Launches animated 3D chips arcing from startPos to endPos (e.g. bet -> pot or pot -> winner).
       */
      animateChipFlight(fromPos, toPos, count = 4) {
        const denoms = [100, 25, 500, 5];
        for (let i = 0; i < count; i++) {
          const chip = new THREE.Mesh(this.chipGeo, getChipMaterials(denoms[i % denoms.length]));
          chip.castShadow = false;
          const from = fromPos.clone();
          from.x += _rand(-0.1, 0.1); from.z += _rand(-0.1, 0.1); from.y += 0.1;
          const to = toPos.clone();
          to.x += _rand(-0.18, 0.18); to.z += _rand(-0.18, 0.18);
          chip.position.copy(from); chip.visible = false;
          this.scene.add(chip);
          const T = 0.5 + Math.random() * 0.15;
          const vel = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 8 * T, (to.z - from.z) / T);
          this.physChips.push({
            mesh: chip, vel, floorY: to.y, delay: i * 0.055, removeAfter: 0.6,
            ang: new THREE.Vector3(_rand(-9, 9), _rand(-12, 12), _rand(-9, 9))
          });
        }
      }

      _chipClack() {
        const n = performance.now();
        if (n - (this._lastClack || 0) < 70) return;
        this._lastClack = n;
        try { sound.playChipClack(1); } catch (e) {}
      }

      _stepChips(dt) {
        const g = 16, wrap = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        for (let i = this.physChips.length - 1; i >= 0; i--) {
          const c = this.physChips[i], m = c.mesh;
          if (c.delay > 0) { c.delay -= dt; if (c.delay <= 0) m.visible = true; continue; }
          const floor = c.target ? c.target.y : c.floorY;
          if (!c.rest) {
            c.vel.y -= g * dt;
            m.position.addScaledVector(c.vel, dt);
            m.rotation.x += c.ang.x * dt; m.rotation.y += c.ang.y * dt; m.rotation.z += c.ang.z * dt;
            if (c.target) {
              const k = Math.min(1, dt * 6);
              m.position.x += (c.target.x - m.position.x) * k;
              m.position.z += (c.target.z - m.position.z) * k;
            }
            if (m.position.y <= floor && c.vel.y < 0) {
              m.position.y = floor;
              if (-c.vel.y > 0.9) {
                c.vel.y *= -0.4; c.vel.x *= 0.7; c.vel.z *= 0.7; c.ang.multiplyScalar(0.5);
                m.rotation.x = wrap(m.rotation.x); m.rotation.z = wrap(m.rotation.z);
                this._chipClack();
              } else { c.vel.set(0, 0, 0); c.ang.set(0, 0, 0); c.rest = true; }
            }
          } else {
            const k = Math.min(1, dt * 14);
            const tx = Math.round(m.rotation.x / Math.PI) * Math.PI, tz = Math.round(m.rotation.z / Math.PI) * Math.PI;
            m.rotation.x += (tx - m.rotation.x) * k; m.rotation.z += (tz - m.rotation.z) * k;
            if (Math.abs(m.rotation.x - tx) + Math.abs(m.rotation.z - tz) < 0.02) {
              m.rotation.x = tx; m.rotation.z = tz;
              if (c.target) m.position.copy(c.target);
              if (c.removeAfter == null) { this.physChips.splice(i, 1); continue; }
              c.removeAfter -= dt;
              if (c.removeAfter <= 0) { this.scene.remove(m); this.physChips.splice(i, 1); }
            }
          }
        }
      }

      _animateCharacters(dt, now) {
        this.seatAnchors.forEach(sa => {
          if (sa.mosaic) {
            const m = sa.mosaic;
            m.doing = sa.mood === 'win' ? 'cheer' : sa.mood === 'turn' ? 'bet' : 'sit';
            m.mat.opacity += ((sa.mood === 'folded' ? 0.5 : 1) - m.mat.opacity) * Math.min(1, dt * 6);
            paintMosaic(m, now);
            return;
          }
          const ch = sa.char;
          if (!ch) return;
          sa.thinkT += ((sa.thinkGoal || 0) - sa.thinkT) * Math.min(1, dt * 3);
          const t = sa.thinkT, ph = now * 0.001 + sa.seatIndex * 1.7;
          const breathe = Math.sin(ph * 1.6) * 0.012, sway = Math.sin(ph * 0.9);
          const lerp = (a, b) => a + (b - a) * t;
          ch.torso.scale.y = 1 + breathe;
          // Thinking: right hand rises to the chin, head tips toward it and lowers slightly
          ch.head.rotation.set(0.1 * t + 0.03 * Math.sin(ph * 0.7), (1 - t) * 0.1 * sway - 0.12 * t, -0.16 * t - 0.02 * t * sway);
          ch.armR.up.rotation.set(lerp(-0.9, -1.2), lerp(0, -0.5), 0);
          ch.armR.fo.rotation.x = lerp(-0.6, -2.1);
          ch.armL.up.rotation.set(-0.9 + breathe * 2, 0, 0);
          ch.armL.fo.rotation.x = -0.6;
        });
      }

      update(now) {
        const dt = Math.min(0.05, Math.max(0, (now - (this._lastNow || now)) / 1000));
        const rawDt = Math.max(0.001, Math.min(0.5, (now - (this._lastNow || now)) / 1000));
        this._lastNow = now;
        this._governor(rawDt);
        this._shadowAcc += dt;
        const moving = this.tweens.length > 0 || this.physChips.length > 0 || this.flyingChips.length > 0;
        if ((moving && this._shadowAcc > 0.034) || this._shadowAcc > 0.6) { this.renderer.shadowMap.needsUpdate = true; this._shadowAcc = 0; }
        this._stepChips(dt);
        this._animateCharacters(dt, now);
        // 1. Step tweens
        for (let i = this.tweens.length - 1; i >= 0; i--) {
          const tw = this.tweens[i];
          const tRaw = Math.min(1, (now - tw.start) / tw.duration);
          const t = 1 - Math.pow(1 - tRaw, 3); // easeOutCubic

          if (tw.type === 'linear') {
            for (const k of Object.keys(tw.to)) {
              tw.target[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * t;
            }
          } else if (tw.type === 'arc') {
            tw.mesh.position.lerpVectors(tw.fromPos, tw.toPos, t);
            tw.mesh.position.y += Math.sin(tRaw * Math.PI) * tw.arcHeight;
            tw.mesh.rotation.x = tw.fromRot.x + (tw.toRot.x - tw.fromRot.x) * t;
            tw.mesh.rotation.y = tw.fromRot.y + (tw.toRot.y - tw.fromRot.y) * t;
            tw.mesh.rotation.z = tw.fromRot.z + (tw.toRot.z - tw.fromRot.z) * t;
          }

          if (tRaw >= 1) {
            this.tweens.splice(i, 1);
            if (tw.onComplete) tw.onComplete();
          }
        }

        // 2. Player Hole Card Hover-Lift Peek Effect
        if (this.playerHoleMeshes.length > 0) {
          this.raycaster.setFromCamera(this.mouseNDC, this.camera);
          const hits = this.raycaster.intersectObjects(this.playerHoleMeshes);
          this.hoveredPlayerCards = hits.length > 0;
          this.playerHoleMeshes.forEach(mesh => {
            if (!mesh.userData.basePos) return;
            const targetY = mesh.userData.basePos.y + (this.hoveredPlayerCards ? 0.32 : 0);
            const targetZ = mesh.userData.basePos.z + (this.hoveredPlayerCards ? 0.25 : 0);
            const targetRx = mesh.userData.baseRot.x + (this.hoveredPlayerCards ? 0.16 : 0);
            mesh.position.y += (targetY - mesh.position.y) * 0.14;
            mesh.position.z += (targetZ - mesh.position.z) * 0.14;
            mesh.rotation.x += (targetRx - mesh.rotation.x) * 0.14;
          });
        }

        // 3. Smooth Camera Framing
        const isMobile = vw() < 768;
        if (this.camMode === 'orbit') {
          this.camDesiredPos.set(
            Math.sin(this.orbitTheta) * Math.sin(this.orbitPhi) * this.orbitRadius,
            Math.cos(this.orbitPhi) * this.orbitRadius,
            Math.cos(this.orbitTheta) * Math.sin(this.orbitPhi) * this.orbitRadius
          );
          this.camDesiredTarget.set(0, 0.1, 0);
        } else if (this.camMode === 'action' || this.actionZoomActive) {
          this.camDesiredPos.set(
            this.actionFocusPoint.x * 0.35,
            isMobile ? 5.6 : 4.25,
            isMobile ? 7.2 : 5.55
          );
          this.camDesiredTarget.set(this.actionFocusPoint.x * 0.25, 0.15, 0.15);
        } else {
          // Player POV (Crisp default view of hole cards & full table)
          // frame every seat (the Mosaics sit around the rail), whatever shape the casino panel is
          const asp = vw() / vh(), halfH = Math.atan(Math.tan(21 * Math.PI / 180) * asp);
          const dist = Math.min(15.5, Math.max(8.4, 5.4 / Math.tan(halfH) + 1.2)), pitch = isMobile ? 0.78 : 0.6;
          this.camDesiredPos.set(0, 0.5 + Math.sin(pitch) * dist, 0.2 + Math.cos(pitch) * dist);
          this.camDesiredTarget.set(0, 0.45, 0.2);
        }

        this.camera.position.lerp(this.camDesiredPos, 0.07);
        this.camTarget.lerp(this.camDesiredTarget, 0.08);
        this.camera.lookAt(this.camTarget);

        this.renderer.render(this.scene, this.camera);
      }


      /* ---- restored: these were called but missing from the supplied file ---- */
      addTween(target, to, duration, easing) {
        const from = {};
        for (const k of Object.keys(to)) from[k] = target[k];
        this.tweens.push({ type: 'linear', target, from, to, start: performance.now(), duration: Math.max(1, duration), easing });
      }

      addArcTween(mesh, toPos, toRot, duration, arcHeight = 0.5, onComplete = null) {
        this.tweens.push({
          type: 'arc', mesh,
          fromPos: mesh.position.clone(), toPos: toPos.clone ? toPos.clone() : new THREE.Vector3(toPos.x, toPos.y, toPos.z),
          fromRot: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
          toRot: { x: toRot.x, y: toRot.y, z: toRot.z },
          arcHeight, onComplete, start: performance.now(), duration: Math.max(1, duration)
        });
      }

      setSeatHighlight(seatIndex, state) {
        const sa = this.seatAnchors[seatIndex];
        if (!sa || !sa.ringMat) return;
        sa.mood = state;
        const m = sa.ringMat, base = sa.baseColor;
        if (state === 'turn') { m.color.set(0xe5c158); m.emissive.set(0xe5c158); m.emissiveIntensity = 1.15; }
        else if (state === 'win') { m.color.set(0xfff1a8); m.emissive.set(0xffd54a); m.emissiveIntensity = 1.6; }
        else if (state === 'tilt') { m.color.set(0xef4444); m.emissive.set(0xef4444); m.emissiveIntensity = 0.9; }
        else if (state === 'folded') { m.color.copy(base).multiplyScalar(0.35); m.emissive.copy(base).multiplyScalar(0.35); m.emissiveIntensity = 0.08; }
        else { m.color.copy(base); m.emissive.copy(base); m.emissiveIntensity = 0.35; }
      }

      triggerActionZoom(point, ms = 2000) {
        if (point) this.actionFocusPoint.copy(point);
        this.actionZoomActive = true;
        clearTimeout(this._zoomTimer);
        this._zoomTimer = setTimeout(() => { this.actionZoomActive = false; }, ms);
      }

      cycleCameraMode() {
        const order = ['pov', 'action', 'orbit'];
        this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length];
        if (this.camMode === 'orbit') { this.orbitTheta = 0; this.orbitPhi = 0.88; }
        return this.camMode;
      }

      _setupInteractions() {
        const el = this.renderer.domElement;
        this._onDown = (e) => { this.isDragging = true; this.lastPointer = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch (_) {} };
        this._onMove = (e) => {
          const r = el.getBoundingClientRect();
          this.mouseNDC.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          if (!this.isDragging || this.camMode !== 'orbit') return;
          this.orbitTheta -= (e.clientX - this.lastPointer.x) * 0.006;
          this.orbitPhi = Math.min(1.45, Math.max(0.25, this.orbitPhi - (e.clientY - this.lastPointer.y) * 0.005));
          this.lastPointer = { x: e.clientX, y: e.clientY };
        };
        this._onUp = (e) => { this.isDragging = false; try { el.releasePointerCapture(e.pointerId); } catch (_) {} };
        this._onLeave = () => { this.mouseNDC.set(-99, -99); this.isDragging = false; };
        this._onWheel = (e) => {
          if (this.camMode !== 'orbit') return;
          e.preventDefault();
          this.orbitRadius = Math.min(14, Math.max(5.5, this.orbitRadius + e.deltaY * 0.006));
        };
        el.addEventListener('pointerdown', this._onDown);
        el.addEventListener('pointermove', this._onMove);
        el.addEventListener('pointerup', this._onUp);
        el.addEventListener('pointercancel', this._onUp);
        el.addEventListener('pointerleave', this._onLeave);
        el.addEventListener('wheel', this._onWheel, { passive: false });
        // keep the renderer matched to its host element (the casino panel resizes)
        this.resize = () => {
          const w = vw(), h = vh();
          this.renderer.setSize(w, h);
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
        };
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(__root);
        this.resize();
      }

      /** Keeps the table smooth on any machine: if frames run slow, quietly lower the cost (resolution, then shadows). */
      _governor(rawDt) {
        if (rawDt > 0.2) return; // a pause (hidden tab), not a slow frame
        this._ema += (rawDt - this._ema) * 0.08;
        if (this._ema > 0.024) this._slow++; else this._slow = Math.max(0, this._slow - 2);
        if (this._slow < 50 || this.perfLevel >= 3) return;
        this._slow = 0; this._ema = 0.0167; this.perfLevel++;
        if (this.perfLevel === 1) { this.pr = 1; this.renderer.setPixelRatio(1); }
        else if (this.perfLevel === 2) { this.scene.traverse((o) => { if (o.isSpotLight) o.castShadow = false; }); this.renderer.shadowMap.enabled = false; this.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } }); }
        else { this.pr = 0.75; this.renderer.setPixelRatio(0.75); }
      }

      dispose() {
        try { this.ro && this.ro.disconnect(); } catch (_) {}
        clearTimeout(this._zoomTimer);
        this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        this.renderer.dispose();
        this.renderer.forceContextLoss && this.renderer.forceContextLoss();
        if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }

      /**
       * Projects a 3D world position to 2D viewport screen coordinates (relative to the stage).
       */
      projectToScreen(vec3) {
        const v = vec3.clone().project(this.camera);
        return {
          x: (v.x * 0.5 + 0.5) * vw(),
          y: (-v.y * 0.5 + 0.5) * vh(),
          visible: v.z < 1
        };
      }
    }

    /* =========================================================================
       6. CORE POKER GAME ENGINE, AI MIND-GAMES & TYPESCRIPT API
       ========================================================================= */

    class PokerGameController {
      constructor(table3D) {
        this.table3D = table3D;
        this.mode = GAME_MODES.cash;
        this.handNumber = 0;
        this.dealerIndex = 0;
        this.deck = [];
        this.communityCards = [];
        this.pot = 0;
        this.street = 'IDLE'; // IDLE, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN
        this.currentBet = 0;
        this.minRaise = 20;
        this.turnIndex = -1;
        this.handInProgress = false;
        this.sb = 10;
        this.bb = 20;
        this.ante = 0;

        // Track human player tendencies for AI exploitation (Duchess & Viper)
        this.humanStats = { handsPlayed: 0, foldsToBet: 0, facedBets: 0 };

        // External Event Subscribers (for TypeScript Character API)
        this.eventListeners = new Set();

        // Players array (Seat 0 = Human, Seats 1-5 = AIs)
        this.players = [];
        this._initPlayers();
        this._buildSeatOverlayDOM();
        this._exposeGlobalAPI();
      }

      _initPlayers() {
        this.players = [];
        // Seat 0: Human Player
        this.players.push({
          seatIndex: 0,
          name: 'YOU',
          isHuman: true,
          profile: null,
          stack: this.mode.startStack,
          holeCards: [],
          holeMeshes: [],
          betThisStreet: 0,
          totalContribution: 0,
          folded: false,
          allIn: false,
          eliminated: false,
          actedThisStreet: false,
          lastActionText: '',
          tellText: '',
          tellTimeout: null,
          tilt: 0,
          isBluffingThisHand: false,
          madeMistakeThisHand: false
        });

        // Seats 1-5: Unique AI Opponents
        AI_PROFILES.forEach((prof, i) => {
          this.players.push({
            seatIndex: i + 1,
            name: prof.name,
            isHuman: false,
            profile: prof,
            stack: this.mode.startStack,
            holeCards: [],
            holeMeshes: [],
            betThisStreet: 0,
            totalContribution: 0,
            folded: false,
            allIn: false,
            eliminated: false,
            actedThisStreet: false,
            lastActionText: '',
            tellText: '',
            tellTimeout: null,
            tilt: 0,
            isBluffingThisHand: false,
            madeMistakeThisHand: false
          });
        });
      }

      /* --- External TypeScript Character Integration API --- */

      emitEvent(type, payload = {}) {
        const evt = { type, timestamp: Date.now(), payload };
        this.eventListeners.forEach(cb => {
          try { cb(evt); } catch (e) { console.error('[PokerTableEngine] Listener error:', e); }
        });
      }

      _exposeGlobalAPI() {
        const self = this;
        __root.__pokerApi = {
          getSeatAnchors() {
            return self.table3D.seatAnchors.map(s => {
              const worldPosition = new THREE.Vector3();
              s.socket.getWorldPosition(worldPosition);
              return {
                seatIndex: s.seatIndex,
                name: s.name,
                isPlayer: s.isPlayer,
                socket: s.socket,
                worldPosition: { x: +worldPosition.x.toFixed(2), y: +worldPosition.y.toFixed(2), z: +worldPosition.z.toFixed(2) },
                facingRotationY: +s.facingRotationY.toFixed(3)
              };
            });
          },
          attachCharacter(seatIndex, threeObject3D) {
            const seat = self.table3D.seatAnchors[seatIndex];
            if (!seat || !threeObject3D) {
              console.warn('[PokerTableEngine] Invalid seatIndex or Object3D.');
              return false;
            }
            if (seat.customCharacter) {
              seat.socket.remove(seat.customCharacter);
            }
            seat.placeholder.visible = false;
            seat.customCharacter = threeObject3D;
            seat.socket.add(threeObject3D);
            return true;
          },
          detachCharacter(seatIndex) {
            const seat = self.table3D.seatAnchors[seatIndex];
            if (!seat) return false;
            if (seat.customCharacter) {
              seat.socket.remove(seat.customCharacter);
              seat.customCharacter = null;
            }
            seat.placeholder.visible = true;
            return true;
          },
          onEvent(callback) {
            if (typeof callback === 'function') {
              self.eventListeners.add(callback);
              return () => self.eventListeners.delete(callback);
            }
            return () => {};
          },
          offEvent(callback) {
            self.eventListeners.delete(callback);
          },
          getGameState() {
            return {
              mode: self.mode.id,
              handNumber: self.handNumber,
              street: self.street,
              pot: self.pot,
              communityCards: self.communityCards.map(c => ({ ...c })),
              players: self.players.map(p => ({
                seatIndex: p.seatIndex,
                name: p.name,
                stack: p.stack,
                bet: p.betThisStreet,
                folded: p.folded,
                allIn: p.allIn,
                eliminated: p.eliminated,
                tilt: p.tilt
              }))
            };
          }
        };
      }

      /* --- Mode Setup & Hand Lifecycle --- */

      startMode(modeKey, buyIn) {
        const base = GAME_MODES[modeKey] || GAME_MODES.cash;
        const st = stakesFor(base, buyIn || base.startStack);
        // each seat sits down with the chosen buy-in; blinds scale so the table plays the same at any size
        this.mode = Object.assign({}, base, { startStack: st.stack, sb: st.sb, bb: st.bb, ante: st.ante });
        this.buyIn = st.stack;
        this.bought = st.stack;
        this.finished = false;
        this.handNumber = 0;
        this.dealerIndex = 0;
        this.sb = this.mode.sb;
        this.bb = this.mode.bb;
        this.ante = this.mode.ante;
        this.humanStats = { handsPlayed: 0, foldsToBet: 0, facedBets: 0 };

        this.table3D.setModeTheme(this.mode);
        this._initPlayers();
        this._updateHelpCardModal();
        this.startNewHand();
      }

      _buildDeck() {
        const minRank = this.mode.shortDeck ? 6 : 2;
        const deck = [];
        for (const s of SUITS) {
          for (let r = minRank; r <= 14; r++) {
            deck.push({ rank: r, suit: s });
          }
        }
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
      }

      _activePlayers() {
        return this.players.filter(p => !p.eliminated);
      }

      _inHandPlayers() {
        return this.players.filter(p => !p.eliminated && !p.folded);
      }

      _nextSeat(fromIndex, filterFn) {
        for (let step = 1; step <= 6; step++) {
          const idx = (fromIndex + step) % 6;
          if (filterFn(this.players[idx])) return idx;
        }
        return -1;
      }

      startNewHand() {
        // Check rebuy / tournament end conditions
        const human = this.players[0];
        const aiAlive = this.players.filter(p => !p.isHuman && p.stack > 0);

        if (human.stack <= 0) {
          if (this.mode.allowRebuy) {
            // a rebuy costs real chips from the casino wallet (the cashier tops chips up from cash)
            const need = this.buyIn;
            if (bridge.chips() >= need || bridge.buyChips(need - bridge.chips())) {
              bridge.spend(need);
              this.bought += need;
              human.stack = need;
              human.eliminated = false;
              this.addLog('You rebought for $' + need.toLocaleString() + '.', 'text-amber-300');
            } else {
              this.finished = true;
              this._showResultModal('💸', 'OUT OF CHIPS', 'You cannot cover another buy-in. Cash out at the cashier, or pick a smaller table.');
              return;
            }
          } else {
            this.finished = true;
            this._showResultModal('💀', 'BUSTED OUT', 'You were eliminated from the tournament. Take another seat when you are ready.');
            return;
          }
        }

        // In Cash/VIP/ShortDeck, top up busted AIs occasionally so table stays lively; in Tournament, they stay eliminated
        this.players.forEach(p => {
          if (!p.isHuman && p.stack <= 0) {
            if (this.mode.allowRebuy) {
              p.stack = this.mode.startStack;
              p.eliminated = false;
              p.tilt = 0.25;
              this.setTell(p.seatIndex, 'Reloaded chips. I’m back!');
            } else {
              p.eliminated = true;
            }
          }
        });

        const aliveAfter = this._activePlayers();
        if (aliveAfter.length === 1 && aliveAfter[0].isHuman) {
          this.finished = true;
          this._showResultModal('🏆', 'TOURNAMENT CHAMPION!', 'You knocked out all 5 rivals. Your winnings go back to your chips when you leave the table.');
          sound.playWinChime();
          return;
        }

        this.handNumber++;
        // Turbo Tournament blind escalation every 3 hands
        if (this.mode.blindInterval > 0 && this.handNumber > 1 && (this.handNumber - 1) % this.mode.blindInterval === 0) {
          this.sb *= 2;
          this.bb *= 2;
          this.showBanner(`BLINDS UP! $${this.sb} / $${this.bb}`, 'from-blue-600 to-indigo-700');
        }

        // Advance dealer button to next active seat
        this.dealerIndex = this._nextSeat(this.dealerIndex, p => !p.eliminated);
        if (this.dealerIndex === -1) this.dealerIndex = 0;

        this.handInProgress = true;
        this.street = 'PREFLOP';
        this.deck = this._buildDeck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.minRaise = this.bb;
        this.turnIndex = -1;

        this.table3D.clearTableCards();
        this.table3D.moveDealerButton(this.dealerIndex);

        this.players.forEach(p => {
          p.holeCards = [];
          p.holeMeshes = [];
          p.betThisStreet = 0;
          p.totalContribution = 0;
          p.folded = p.eliminated;
          p.allIn = false;
          p.actedThisStreet = false;
          p.lastActionText = '';
          p.isBluffingThisHand = false;
          p.madeMistakeThisHand = false;
          this.table3D.setSeatHighlight(p.seatIndex, p.eliminated ? 'folded' : (p.tilt >= 0.65 ? 'tilt' : 'idle'));
        });

        // Hide between-hands bar
        $('between-hands-bar').classList.add('hidden');
        $('raise-controls-row').classList.remove('hidden');

        this.emitEvent('hand_start', {
          handNumber: this.handNumber,
          dealerIndex: this.dealerIndex,
          blinds: { sb: this.sb, bb: this.bb, ante: this.ante }
        });

        // 1. Post Antes (if applicable)
        if (this.ante > 0) {
          this._activePlayers().forEach(p => {
            const amt = Math.min(p.stack, this.ante);
            p.stack -= amt;
            p.totalContribution += amt;
            this.pot += amt;
            if (p.stack === 0) p.allIn = true;
          });
        }

        // 2. Post Small Blind & Big Blind (handles Heads-Up properly)
        const activeCount = this._activePlayers().length;
        const sbIndex = activeCount === 2
          ? this.dealerIndex
          : this._nextSeat(this.dealerIndex, p => !p.eliminated);
        const bbIndex = this._nextSeat(sbIndex, p => !p.eliminated);

        this._postBlind(sbIndex, this.sb, 'SB');
        this._postBlind(bbIndex, this.bb, 'BB');
        this.currentBet = this.bb;
        this.minRaise = this.bb;

        sound.playChipClack(3);
        this.syncAll3DChips();
        this.updateHUD();

        // 3. Deal 2 Hole Cards to each active player with smooth casino stagger
        const activeOrder = [];
        let cursor = this.dealerIndex;
        for (let i = 0; i < activeCount; i++) {
          cursor = this._nextSeat(cursor, p => !p.eliminated);
          activeOrder.push(cursor);
        }

        let dealDelay = 80;
        for (let round = 0; round < 2; round++) {
          for (const seatIdx of activeOrder) {
            const p = this.players[seatIdx];
            const card = this.deck.pop();
            p.holeCards.push(card);
            const mesh = this.table3D.dealHoleCard(seatIdx, round, card, p.isHuman, dealDelay);
            p.holeMeshes.push(mesh);
            dealDelay += 110;
          }
        }

        this.emitEvent('deal', { street: 'PREFLOP', activeSeats: activeOrder });

        // First to act preflop is UTG (left of BB)
        const firstToAct = this._nextSeat(bbIndex, p => !p.eliminated && !p.folded && !p.allIn);

        setTimeout(() => {
          this.updatePlayerCardMirror();
          this.updateCoach();
          if (firstToAct === -1) {
            this.advanceStreet();
          } else {
            this.setTurn(firstToAct);
          }
        }, dealDelay + 260);
      }

      _postBlind(seatIndex, amount, label) {
        const p = this.players[seatIndex];
        if (!p) return;
        const paid = Math.min(p.stack, amount);
        p.stack -= paid;
        p.betThisStreet += paid;
        p.totalContribution += paid;
        this.pot += paid;
        p.lastActionText = `${label} $${paid}`;
        if (p.stack === 0) p.allIn = true;
      }

      /* --- Turn Management & Player Actions --- */

      setTurn(seatIndex) {
        this.turnIndex = seatIndex;
        this.players.forEach(p => {
          if (p.folded || p.eliminated) {
            this.table3D.setSeatHighlight(p.seatIndex, 'folded');
          } else if (p.seatIndex === seatIndex) {
            this.table3D.setSeatHighlight(p.seatIndex, 'turn');
          } else {
            this.table3D.setSeatHighlight(p.seatIndex, p.tilt >= 0.65 ? 'tilt' : 'idle');
          }
        });

        this.updateHUD();
        this.updateCoach();

        const player = this.players[seatIndex];
        if (!player.isHuman) {
          this._setHumanControlsEnabled(false);
          const thinkTime = 680 + Math.random() * 680;
          setTimeout(() => {
            if (this.handInProgress && this.turnIndex === seatIndex) {
              this._executeAITurn(player);
            }
          }, thinkTime);
        } else {
          this._setHumanControlsEnabled(true);
        }
      }

      applyAction(seatIndex, actionType, raiseTotal = 0) {
        if (!this.handInProgress || this.turnIndex !== seatIndex) return;
        const p = this.players[seatIndex];
        const toCall = Math.max(0, this.currentBet - p.betThisStreet);

        if (p.isHuman && toCall > 0) {
          this.humanStats.facedBets++;
          if (actionType === 'fold') this.humanStats.foldsToBet++;
        }

        if (actionType === 'fold') {
          p.folded = true;
          p.actedThisStreet = true;
          p.lastActionText = 'FOLD';
          sound.playFold();
          // Slide cards slightly toward center & dim
          p.holeMeshes.forEach(m => {
            this.table3D.addTween(m.position, { x: m.position.x * 0.72, y: 0.02, z: m.position.z * 0.72 }, 320);
          });
          this.addLog(`${p.name} folds.`, 'text-gray-400');
          if (!p.isHuman && Math.random() < 0.45) {
            this.setTell(seatIndex, this._pick(p.profile.tells.fold));
          }
        } else if (actionType === 'check') {
          p.actedThisStreet = true;
          p.lastActionText = 'CHECK';
          sound.playCheckKnock();
          this.addLog(`${p.name} checks.`, 'text-blue-200');
        } else if (actionType === 'call') {
          const paid = Math.min(p.stack, toCall);
          p.stack -= paid;
          p.betThisStreet += paid;
          p.totalContribution += paid;
          this.pot += paid;
          p.actedThisStreet = true;
          if (p.stack === 0) {
            p.allIn = true;
            p.lastActionText = `ALL-IN $${p.betThisStreet}`;
            this._triggerAllInDrama(p);
          } else {
            p.lastActionText = `CALL $${paid}`;
            sound.playChipClack(2);
          }
          this.addLog(`${p.name} calls $${paid}.`, 'text-sky-300');
        } else if (actionType === 'raise') {
          const targetBet = Math.min(p.betThisStreet + p.stack, Math.max(this.currentBet + this.minRaise, raiseTotal));
          const delta = Math.max(0, targetBet - p.betThisStreet);
          const actualDelta = Math.min(p.stack, delta);
          p.stack -= actualDelta;
          p.betThisStreet += actualDelta;
          p.totalContribution += actualDelta;
          this.pot += actualDelta;

          const raiseBy = p.betThisStreet - this.currentBet;
          if (raiseBy > 0) {
            if (raiseBy >= this.minRaise) this.minRaise = raiseBy;
            this.currentBet = p.betThisStreet;
            // Re-open action for all other active non-all-in players
            this.players.forEach(other => {
              if (other.seatIndex !== seatIndex && !other.folded && !other.allIn && !other.eliminated) {
                other.actedThisStreet = false;
              }
            });
          }
          p.actedThisStreet = true;

          if (p.stack === 0) {
            p.allIn = true;
            p.lastActionText = `ALL-IN $${p.betThisStreet}`;
            this._triggerAllInDrama(p);
            this.addLog(`${p.name} goes ALL-IN ($${p.betThisStreet})!`, 'text-red-400 font-bold');
          } else {
            const verb = toCall === 0 ? 'BET' : 'RAISE';
            p.lastActionText = `${verb} $${p.betThisStreet}`;
            sound.playChipClack(Math.min(5, Math.ceil(actualDelta / (this.bb * 2)) + 1));
            this.addLog(`${p.name} ${verb.toLowerCase()}s to $${p.betThisStreet}.`, 'text-amber-300');
          }
        }

        this.emitEvent('player_action', {
          seatIndex,
          name: p.name,
          action: actionType,
          bet: p.betThisStreet,
          pot: this.pot,
          allIn: p.allIn
        });

        this.syncAll3DChips();
        this.updateHUD();
        this._advanceTurnOrStreet();
      }

      _triggerAllInDrama(player) {
        sound.playAllInRiser();
        this.showBanner(`${player.name.toUpperCase()} IS ALL-IN!`, 'from-red-600 via-rose-600 to-amber-500');
        this.table3D.triggerActionZoom(this.table3D.seatAnchors[player.seatIndex].betPos, 2200);
        this.emitEvent('all_in', { seatIndex: player.seatIndex, name: player.name, amount: player.betThisStreet });
      }

      _advanceTurnOrStreet() {
        const remaining = this._inHandPlayers();
        if (remaining.length === 1) {
          // Everyone else folded — award pot immediately!
          this._awardUncontestedPot(remaining[0]);
          return;
        }

        // Find next player who still needs to act
        const nextIdx = this._nextSeat(this.turnIndex, p =>
          !p.eliminated && !p.folded && !p.allIn && (!p.actedThisStreet || p.betThisStreet < this.currentBet)
        );

        if (nextIdx !== -1) {
          this.setTurn(nextIdx);
        } else {
          // Betting round complete — sweep chips into pot and move to next street
          this._sweepBetsToPot();
          setTimeout(() => this.advanceStreet(), 520);
        }
      }

      _sweepBetsToPot() {
        const potPos = new THREE.Vector3(0, 0.08, -0.78);
        let anyBet = false;
        this.players.forEach(p => {
          if (p.betThisStreet > 0) {
            anyBet = true;
            this.table3D.animateChipFlight(this.table3D.seatAnchors[p.seatIndex].betPos, potPos, 3);
            p.betThisStreet = 0;
          }
          p.actedThisStreet = false;
          if (!p.folded && !p.allIn) p.lastActionText = '';
        });
        if (anyBet) sound.playChipClack(3);
        this.currentBet = 0;
        this.minRaise = this.bb;
        this.syncAll3DChips();
      }

      advanceStreet() {
        const canBetCount = this._inHandPlayers().filter(p => !p.allIn).length;

        if (this.street === 'PREFLOP') {
          this.street = 'FLOP';
          for (let i = 0; i < 3; i++) {
            const c = this.deck.pop();
            this.communityCards.push(c);
            this.table3D.dealCommunityCard(i, c, i * 190);
          }
          this.emitEvent('deal', { street: 'FLOP', cards: this.communityCards.slice() });
          this.addLog(`— FLOP: ${this.communityCards.map(c => RANK_LABEL[c.rank] + SUIT_SYMBOL[c.suit]).join(' ')} —`, 'text-amber-200 font-semibold');
        } else if (this.street === 'FLOP') {
          this.street = 'TURN';
          const c = this.deck.pop();
          this.communityCards.push(c);
          this.table3D.dealCommunityCard(3, c, 120);
          this.emitEvent('deal', { street: 'TURN', card: c });
          this.addLog(`— TURN: ${RANK_LABEL[c.rank] + SUIT_SYMBOL[c.suit]} —`, 'text-amber-200 font-semibold');
        } else if (this.street === 'TURN') {
          this.street = 'RIVER';
          const c = this.deck.pop();
          this.communityCards.push(c);
          this.table3D.dealCommunityCard(4, c, 120);
          this.emitEvent('deal', { street: 'RIVER', card: c });
          this.addLog(`— RIVER: ${RANK_LABEL[c.rank] + SUIT_SYMBOL[c.suit]} —`, 'text-amber-200 font-semibold');
        } else if (this.street === 'RIVER') {
          this._resolveShowdown();
          return;
        }

        this.updateHUD();
        this.updateCoach();

        // If 0 or 1 players can still bet (All-In runout), auto-deal next street dramatically
        if (canBetCount <= 1) {
          this._setHumanControlsEnabled(false);
          this.table3D.triggerActionZoom(new THREE.Vector3(0, 0.1, 0), 2500);
          setTimeout(() => this.advanceStreet(), 1150);
          return;
        }

        const firstPostflop = this._nextSeat(this.dealerIndex, p => !p.eliminated && !p.folded && !p.allIn);
        setTimeout(() => {
          if (firstPostflop === -1) {
            this.advanceStreet();
          } else {
            this.setTurn(firstPostflop);
          }
        }, this.street === 'FLOP' ? 820 : 620);
      }

      /* --- AI DECISION ENGINE (BLUFFS, TRAPS, MISTAKES & TILT) --- */

      _executeAITurn(ai) {
        const prof = ai.profile;
        const toCall = Math.max(0, this.currentBet - ai.betThisStreet);
        const shortDeck = this.mode.shortDeck;
        const activeOpps = Math.max(1, this._inHandPlayers().length - 1);

        // Estimate hand strength [0..1]
        let strength = 0.5;
        if (this.street === 'PREFLOP') {
          strength = this._preflopStrength(ai.holeCards, shortDeck);
        } else {
          strength = estimateWinEquity(ai.holeCards, this.communityCards, activeOpps, shortDeck, 90);
        }

        const draws = detectDraws(ai.holeCards, this.communityCards, shortDeck);
        const hasStrongDraw = draws.includes('Flush Draw') || draws.includes('Open-Ended Straight Draw');

        // Human fold-exploitation factor (Duchess & Viper punish tight players)
        const humanFoldRate = this.humanStats.facedBets >= 3
          ? (this.humanStats.foldsToBet / this.humanStats.facedBets)
          : 0.4;
        const exploitBluffBonus = (prof.persona === 'Duchess' || prof.persona === 'Viper') && humanFoldRate > 0.55 ? 0.16 : 0;

        // Board scariness (flush/paired/broadway makes bluffs more credible)
        const boardScary = this._isBoardScary(this.communityCards);

        const aggro = Math.min(0.98, prof.aggression + this.mode.aiAggroBoost + ai.tilt * 0.32);
        const bluffChance = Math.min(0.75, prof.bluffRate + (boardScary ? 0.12 : 0) + exploitBluffBonus + ai.tilt * 0.25);

        // 1. TILT MANIAC SHOVE (especially Mad Dog when tilted)
        if (ai.tilt >= 0.7 && Math.random() < 0.42 && ai.stack > 0) {
          ai.isBluffingThisHand = strength < 0.45;
          this.setTell(ai.seatIndex, this._pick(prof.tells.tilt || prof.tells.bluff));
          if (ai.isBluffingThisHand) {
            this.emitEvent('ai_bluff', { seatIndex: ai.seatIndex, name: ai.name, reason: 'tilt_shove' });
          }
          this.applyAction(ai.seatIndex, 'raise', ai.betThisStreet + ai.stack);
          return;
        }

        // 2. HUMAN-LIKE MISTAKE (especially Lucky Lou)
        if (Math.random() < prof.mistakeRate) {
          ai.madeMistakeThisHand = true;
          this.emitEvent('ai_mistake', { seatIndex: ai.seatIndex, name: ai.name, street: this.street });
          if (prof.tells.mistake && Math.random() < 0.75) {
            this.setTell(ai.seatIndex, this._pick(prof.tells.mistake));
          }
          // Mistake types: over-calling with junk, or bizarre min-raise / huge overbet with mediocre hand
          if (toCall > 0 && toCall < ai.stack * 0.6) {
            this.applyAction(ai.seatIndex, 'call');
            return;
          } else if (ai.stack > this.bb * 2) {
            const badSize = Math.random() < 0.5
              ? this.currentBet + this.minRaise
              : Math.min(ai.betThisStreet + ai.stack, Math.round(this.currentBet + this.pot * 1.6));
            ai.isBluffingThisHand = strength < 0.42;
            this.applyAction(ai.seatIndex, 'raise', badSize);
            return;
          }
        }

        // 3. MONSTER HAND: Trap / Slow-play vs Value Bet (Professor loves trapping!)
        if (strength >= 0.74) {
          if (this.street === 'FLOP' && toCall === 0 && Math.random() < prof.trapRate) {
            this.setTell(ai.seatIndex, this._pick(prof.tells.value));
            this.applyAction(ai.seatIndex, 'check');
            return;
          }
          if (toCall > 0 && this.street !== 'PREFLOP' && Math.random() < prof.trapRate * 0.65) {
            // Smooth-call to trap
            this.applyAction(ai.seatIndex, 'call');
            return;
          }
          // Value Bet / Raise
          const mult = 0.55 + Math.random() * 0.55;
          const target = this._roundChip(Math.max(this.currentBet + this.minRaise, this.currentBet + this.pot * mult));
          if (prof.tells.trap && toCall > 0 && Math.random() < 0.5) {
            this.setTell(ai.seatIndex, this._pick(prof.tells.trap));
          } else if (Math.random() < 0.45) {
            this.setTell(ai.seatIndex, this._pick(prof.tells.value));
          }
          this.applyAction(ai.seatIndex, 'raise', target);
          return;
        }

        // 4. SEMI-BLUFF / PURE BLUFF
        const canBluff = (strength < 0.46 && (hasStrongDraw || Math.random() < bluffChance));
        if (canBluff && ai.stack > this.bb * 2 && (toCall === 0 || (toCall < this.pot * 0.55 && Math.random() < aggro * 0.45))) {
          ai.isBluffingThisHand = !hasStrongDraw;
          const bluffMult = 0.5 + Math.random() * 0.65;
          const bluffSize = this._roundChip(Math.max(this.currentBet + this.minRaise, this.currentBet + Math.max(this.bb * 2, this.pot * bluffMult)));
          this.emitEvent('ai_bluff', { seatIndex: ai.seatIndex, name: ai.name, street: this.street, semiBluff: hasStrongDraw });
          if (Math.random() < 0.7) {
            this.setTell(ai.seatIndex, this._pick(prof.tells.bluff));
          }
          this.applyAction(ai.seatIndex, 'raise', bluffSize);
          return;
        }

        // 5. MEDIUM STRENGTH / DRAW PLAY
        const potOdds = toCall > 0 ? toCall / (this.pot + toCall) : 0;
        const looseFactor = (1 - prof.tightness) * 0.18;

        if (toCall === 0) {
          if (strength > 0.55 && Math.random() < aggro * 0.65) {
            const betAmt = this._roundChip(Math.max(this.bb, this.pot * (0.4 + Math.random() * 0.35)));
            this.applyAction(ai.seatIndex, 'raise', betAmt);
          } else {
            this.applyAction(ai.seatIndex, 'check');
          }
        } else {
          if (strength + looseFactor >= potOdds || (hasStrongDraw && potOdds <= 0.36)) {
            this.applyAction(ai.seatIndex, 'call');
          } else {
            this.applyAction(ai.seatIndex, 'fold');
          }
        }
      }

      _preflopStrength(hole, shortDeck) {
        if (!hole || hole.length < 2) return 0.3;
        const r1 = Math.max(hole[0].rank, hole[1].rank);
        const r2 = Math.min(hole[0].rank, hole[1].rank);
        const suited = hole[0].suit === hole[1].suit;
        const pair = r1 === r2;
        const gap = r1 - r2;

        let score = (r1 + r2) / 28; // 0.14..1.0
        if (pair) score += 0.28 + (r1 / 50);
        if (suited) score += 0.07;
        if (gap === 1) score += 0.06;
        if (gap === 2) score += 0.03;
        if (shortDeck && r2 >= 10) score += 0.08;
        return Math.min(0.96, Math.max(0.12, score));
      }

      _isBoardScary(board) {
        if (board.length < 3) return false;
        const suits = {};
        const ranks = {};
        board.forEach(c => {
          suits[c.suit] = (suits[c.suit] || 0) + 1;
          ranks[c.rank] = (ranks[c.rank] || 0) + 1;
        });
        return Object.values(suits).some(v => v >= 3) || Object.values(ranks).some(v => v >= 2);
      }

      _roundChip(val) {
        const step = chipStep(this.bb);
        return Math.max(this.bb, Math.round(val / step) * step);
      }

      /* --- SHOWDOWN, SIDE POTS & BLUFF REVEALS --- */

      _awardUncontestedPot(winner) {
        this._sweepBetsToPot();
        this.handInProgress = false;
        this.street = 'SHOWDOWN';
        this.turnIndex = -1;
        this._setHumanControlsEnabled(false);

        const won = this.pot;
        winner.stack += won;
        this.pot = 0;

        this.table3D.animateChipFlight(new THREE.Vector3(0, 0.1, -0.78), this.table3D.seatAnchors[winner.seatIndex].cardPos, 5);
        this.table3D.setSeatHighlight(winner.seatIndex, 'win');
        sound.playWinChime();

        // Update AI tilt
        this._updateAITiltAfterHand([winner.seatIndex]);

        this.addLog(`${winner.name} wins $${won} (uncontested).`, 'text-emerald-300 font-bold');
        this.showBanner(`${winner.name.toUpperCase()} WINS $${won}!`, 'from-emerald-600 to-teal-700');
        this.emitEvent('hand_winner', { winners: [{ seatIndex: winner.seatIndex, name: winner.name, amount: won, handName: 'Uncontested' }] });

        this.syncAll3DChips();
        this.updateHUD();
        this._showBetweenHandsBar(`${winner.name} took down the $${won} pot.`);
      }

      _resolveShowdown() {
        this._sweepBetsToPot();
        this.handInProgress = false;
        this.street = 'SHOWDOWN';
        this.turnIndex = -1;
        this._setHumanControlsEnabled(false);

        const contenders = this._inHandPlayers();
        const shortDeck = this.mode.shortDeck;

        // Flip all contenders' hole cards face up in 3D
        this.table3D.triggerActionZoom(new THREE.Vector3(0, 0.1, 0), 3200);
        contenders.forEach((p, idx) => {
          if (!p.isHuman) {
            p.holeMeshes.forEach((m, ci) => this.table3D.flipCardFaceUp(m, idx * 140 + ci * 70));
          }
          p.evalResult = evaluateBestHand([...p.holeCards, ...this.communityCards], shortDeck);
        });

        this.emitEvent('showdown', {
          contenders: contenders.map(p => ({
            seatIndex: p.seatIndex,
            name: p.name,
            handName: p.evalResult.name,
            score: p.evalResult.score
          }))
        });

        // Construct accurate Side Pots from totalContribution
        const sidePots = this._buildSidePots();
        const winningsMap = new Map();
        let topWinningEval = null;

        sidePots.forEach(sp => {
          const eligible = contenders.filter(p => sp.eligibleSeats.includes(p.seatIndex));
          if (eligible.length === 0) return;

          let bestScore = -1;
          eligible.forEach(p => { if (p.evalResult.score > bestScore) bestScore = p.evalResult.score; });
          const potWinners = eligible.filter(p => p.evalResult.score === bestScore);

          if (!topWinningEval || bestScore > topWinningEval.score) {
            topWinningEval = potWinners[0].evalResult;
          }

          const share = Math.floor(sp.amount / potWinners.length);
          let remainder = sp.amount - share * potWinners.length;

          potWinners.forEach(w => {
            const extra = remainder > 0 ? 1 : 0;
            if (remainder > 0) remainder--;
            winningsMap.set(w.seatIndex, (winningsMap.get(w.seatIndex) || 0) + share + extra);
          });
        });

        const winnerIndices = [...winningsMap.keys()];
        const summaryParts = [];

        // Check if any AI got CAUGHT BLUFFING!
        let bluffCaughtAI = null;
        contenders.forEach(p => {
          if (!p.isHuman && p.isBluffingThisHand && !winnerIndices.includes(p.seatIndex) && p.evalResult.category <= 1) {
            bluffCaughtAI = p;
          }
        });

        setTimeout(() => {
          winnerIndices.forEach(sIdx => {
            const w = this.players[sIdx];
            const amt = winningsMap.get(sIdx);
            w.stack += amt;
            this.table3D.setSeatHighlight(sIdx, 'win');
            this.table3D.animateChipFlight(new THREE.Vector3(0, 0.1, -0.78), this.table3D.seatAnchors[sIdx].cardPos, 6);
            summaryParts.push(`${w.name} won $${amt} (${w.evalResult.name})`);
            this.addLog(`🏆 ${w.name} wins $${amt} with ${w.evalResult.name}!`, 'text-amber-300 font-bold');
          });

          if (topWinningEval) {
            this.table3D.highlightWinningCards(topWinningEval.bestCards);
          }

          if (bluffCaughtAI) {
            sound.playBluffCaught();
            this.setTell(bluffCaughtAI.seatIndex, this._pick(bluffCaughtAI.profile.tells.caught));
            this.showBanner(`BLUFF CAUGHT! ${bluffCaughtAI.name.toUpperCase()} BUSTED!`, 'from-fuchsia-600 via-purple-600 to-amber-500');
            this.addLog(`🎭 ${bluffCaughtAI.name} was caught bluffing with ${bluffCaughtAI.evalResult.name}!`, 'text-fuchsia-300 font-semibold');
          } else {
            sound.playWinChime();
            const headline = winnerIndices.length > 1
              ? `SPLIT POT!`
              : `${this.players[winnerIndices[0]].name.toUpperCase()} WINS!`;
            this.showBanner(headline, 'from-amber-500 via-yellow-500 to-emerald-500');
          }

          this.pot = 0;
          this._updateAITiltAfterHand(winnerIndices);
          this.emitEvent('hand_winner', {
            winners: winnerIndices.map(sIdx => ({
              seatIndex: sIdx,
              name: this.players[sIdx].name,
              amount: winningsMap.get(sIdx),
              handName: this.players[sIdx].evalResult.name
            }))
          });

          this.syncAll3DChips();
          this.updateHUD();
          this._showBetweenHandsBar(summaryParts.join(' • '));
        }, 550);
      }

      _buildSidePots() {
        const contribPlayers = this.players.filter(p => p.totalContribution > 0);
        const levels = [...new Set(contribPlayers.map(p => p.totalContribution))].sort((a, b) => a - b);
        const pots = [];
        let prev = 0;

        for (const lvl of levels) {
          const slice = lvl - prev;
          const contributors = contribPlayers.filter(p => p.totalContribution >= lvl);
          const amount = slice * contributors.length;
          const eligibleSeats = contributors.filter(p => !p.folded).map(p => p.seatIndex);
          if (amount > 0) {
            pots.push({ amount, eligibleSeats });
          }
          prev = lvl;
        }
        return pots;
      }

      _updateAITiltAfterHand(winnerIndices) {
        this.players.forEach(p => {
          if (p.isHuman || p.eliminated) return;
          if (winnerIndices.includes(p.seatIndex)) {
            p.tilt = Math.max(0, p.tilt - 0.35);
          } else if (p.totalContribution > this.bb * 3) {
            const stackRatio = p.stack / Math.max(1, this.mode.startStack);
            const delta = p.profile.tiltSensitivity * (stackRatio < 0.75 ? 0.42 : 0.22);
            p.tilt = Math.min(1, p.tilt + delta);
          }
        });
      }

      /* --- POKER COACH (LIVE HAND STRENGTH, DRAWS & POT ODDS) --- */

      updateCoach() {
        const human = this.players[0];
        const nameEl = $('coach-hand-name');
        const drawsEl = $('coach-draws');
        const eqEl = $('coach-equity-pct');
        const barEl = $('coach-equity-bar');
        const oddsEl = $('coach-pot-odds');
        const callEl = $('coach-to-call');
        const adviceEl = $('coach-advice');
        const tierEl = $('coach-strength-tier');
        const miniEl = $('hud-player-hand-mini');

        if (!human.holeCards.length || human.folded) {
          nameEl.textContent = human.folded ? 'Hand Folded' : 'Waiting for deal...';
          drawsEl.innerHTML = '';
          eqEl.textContent = '--%';
          barEl.style.width = '0%';
          oddsEl.textContent = '--';
          callEl.textContent = '$0';
          tierEl.textContent = human.folded ? 'FOLDED' : 'READY';
          miniEl.textContent = human.folded ? 'Folded' : 'Ready';
          return;
        }

        const evalRes = evaluateBestHand([...human.holeCards, ...this.communityCards], this.mode.shortDeck);
        const draws = detectDraws(human.holeCards, this.communityCards, this.mode.shortDeck);
        const activeOpps = Math.max(1, this._inHandPlayers().length - 1);
        const equity = estimateWinEquity(human.holeCards, this.communityCards, activeOpps, this.mode.shortDeck, 210);
        const eqPct = Math.round(equity * 100);

        const toCall = Math.max(0, this.currentBet - human.betThisStreet);
        const potOdds = toCall > 0 ? Math.round((toCall / (this.pot + toCall)) * 100) : 0;

        nameEl.textContent = evalRes.name;
        miniEl.textContent = evalRes.name;
        eqEl.textContent = `${eqPct}%`;
        barEl.style.width = `${eqPct}%`;
        callEl.textContent = `$${toCall}`;
        oddsEl.textContent = toCall > 0 ? `${potOdds}%` : 'Free Check';

        drawsEl.innerHTML = draws.map(d =>
          `<span>+ ${d}</span>`
        ).join('');

        // Tier badge & Tactical Advice
        let tier = 'MARGINAL', tierCls = 'bg-amber-500/20 text-amber-300 border-amber-400/30', tip = '';

        if (eqPct >= 72) {
          tier = 'MONSTER';
          tierCls = 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40';
          tip = toCall > 0
            ? 'Crushing equity! Value-raise to build the pot or flat-call to trap aggressive sharks.'
            : 'Monster hand — lead out for value or check-raise if Viper/Mad Dog is behind you.';
        } else if (eqPct >= 52) {
          tier = 'STRONG';
          tierCls = 'bg-sky-500/25 text-sky-300 border-sky-400/40';
          tip = toCall > 0 && eqPct > potOdds
            ? `Solid edge (${eqPct}% equity vs ${potOdds}% pot odds). Comfortable call or thin value raise.`
            : 'Strong holding — bet for value and protect against draws.';
        } else if (draws.length > 0) {
          tier = 'DRAW';
          tierCls = 'bg-purple-500/25 text-purple-200 border-purple-400/40';
          tip = toCall === 0
            ? 'Good semi-bluff candidate! Firing a bet can win the pot now or disguise your draw.'
            : (eqPct >= potOdds - 6
              ? `Profitable draw odds (${eqPct}% vs ${potOdds}% needed). Worth calling to hit.`
              : `Steep price (${potOdds}% pot odds) for your draw. Consider folding unless implied odds are huge.`);
        } else if (eqPct >= 34) {
          tier = 'MARGINAL';
          tierCls = 'bg-amber-500/20 text-amber-200 border-amber-400/30';
          tip = toCall === 0
            ? 'Marginal showdown value — checking to control pot size is smart here.'
            : (eqPct >= potOdds ? 'Pot odds justify a cautious call; watch out for bluffs.' : 'Tough spot — facing heavy pressure with marginal equity. Folding saves chips.');
        } else {
          tier = 'WEAK';
          tierCls = 'bg-red-500/20 text-red-300 border-red-400/30';
          tip = toCall === 0
            ? 'Weak hand. Check for a free card—or fire a bold bluff if the board looks scary.'
            : 'Unfavorable odds. Discipline pays off—fold and wait for a stronger spot.';
        }

        tierEl.textContent = tier;
        tierEl.className = `lowercase text-[10px] ${tierCls.split(' ').filter(c => c.startsWith('text-')).join(' ')}`;
        adviceEl.textContent = tip;
      }

      /* --- UI / HUD SYNCHRONIZATION --- */

      _buildSeatOverlayDOM() {
        const container = $('seat-overlay');
        container.innerHTML = '';
        this.seatTagEls = [];

        this.players.forEach(p => {
          if (p.isHuman) {
            this.seatTagEls.push(null);
            return;
          }
          const el = document.createElement('div');
          el.className = 'seat-tag';
          el.innerHTML = `
            <div class="flex flex-col items-center gap-1">
              <div class="tell-bubble hidden max-w-[170px] px-2 py-1 rounded-lg bg-black/60 text-[10px] italic text-white/70 text-center leading-snug"></div>
              <div class="seat-card text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" style="background:${p.profile.color}"></span>
                  <span class="text-[11px] font-medium text-white/80">${p.name}</span>
                  <span class="dealer-pip hidden text-[8px] px-1 rounded-full border border-amber-300/60 text-amber-200">D</span>
                  <span class="tilt-pip hidden text-[9px] text-red-300/80">tilt</span>
                </div>
                <div class="stack-val text-[11px] text-amber-200/70 tabular-nums">$${p.stack}</div>
                <div class="action-badge hidden lowercase text-[10px] text-sky-200/70"></div>
              </div>
            </div>
          `;
          container.appendChild(el);
          this.seatTagEls.push(el);
        });
      }

      updateSeatOverlayPositions() {
        this.players.forEach((p, idx) => {
          const el = this.seatTagEls[idx];
          if (!el) return;
          const anchor = this.table3D.seatAnchors[idx];
          const proj = this.table3D.projectToScreen(anchor.tagWorldPos);

          if (!proj.visible || p.eliminated) {
            el.style.opacity = p.eliminated ? '0.28' : '0';
          } else {
            el.style.opacity = p.folded ? '0.52' : '1';
          }
          const tx = Math.round(Math.max(68, Math.min(vw() - 68, proj.x))), ty = Math.round(Math.max(66, Math.min(vh() - 130, proj.y)));
          if (el.__x !== tx || el.__y !== ty) { el.__x = tx; el.__y = ty; el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%)'; }

          const card = el.querySelector('.seat-card');
          { const sv = el.querySelector('.stack-val'), tv = p.eliminated ? 'OUT' : '$' + p.stack.toLocaleString(); if (sv.textContent !== tv) sv.textContent = tv; }
          el.querySelector('.dealer-pip').classList.toggle('hidden', this.dealerIndex !== idx);
          el.querySelector('.tilt-pip').classList.toggle('hidden', p.tilt < 0.65 || p.eliminated);

          card.classList.toggle('active-turn-ring', this.turnIndex === idx && this.handInProgress);
          card.classList.toggle('tilt-glow', p.tilt >= 0.65 && !p.eliminated);

          const badge = el.querySelector('.action-badge');
          if (p.lastActionText) {
            if (badge.textContent !== p.lastActionText) badge.textContent = p.lastActionText;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        });
      }

      setTell(seatIndex, text) {
        const el = this.seatTagEls[seatIndex];
        if (!el || !text) return;
        const bubble = el.querySelector('.tell-bubble');
        bubble.textContent = text;
        bubble.classList.remove('hidden');
        const p = this.players[seatIndex];
        clearTimeout(p.tellTimeout);
        p.tellTimeout = setTimeout(() => {
          bubble.classList.add('hidden');
        }, 3200);
      }

      syncAll3DChips() {
        this.players.forEach(p => {
          this.table3D.updateSeatChips(p.seatIndex, p.stack, p.betThisStreet);
        });
        this.table3D.updatePotChips(this.pot);
      }

      updatePlayerCardMirror() {
        const wrap = $('hud-player-cards');
        const human = this.players[0];
        if (!human.holeCards.length) {
          wrap.innerHTML = `<div class="hud-card ghosted"></div><div class="hud-card ghosted"></div>`;
          return;
        }
        wrap.innerHTML = human.holeCards.map(c => {
          const col = (c.suit === 'h' || c.suit === 'd') ? 'text-red-600' : 'text-gray-900';
          return `
            <div class="hud-card ${col}"><div class="text-[11px]">${RANK_LABEL[c.rank]}</div><div class="text-[15px]">${SUIT_SYMBOL[c.suit]}</div>
            </div>`;
        }).join('');
      }

      updateHUD() {
        const human = this.players[0];
        $('hud-mode-label').textContent = `${this.mode.name} • $${this.sb}/$${this.bb}`;
        $('hud-hand-num').textContent = `#${this.handNumber}`;
        $('hud-pot-amount').textContent = `$${this.pot.toLocaleString()}`;
        $('hud-street-badge').textContent = this.street;
        $('hud-player-stack').textContent = `$${human.stack.toLocaleString()}`;
        $('hud-player-dealer').classList.toggle('hidden', this.dealerIndex !== 0);

        const anteWrap = $('hud-ante-wrap');
        if (this.ante > 0) {
          anteWrap.classList.remove('hidden');
          $('hud-ante-val').textContent = `$${this.ante}`;
        } else {
          anteWrap.classList.add('hidden');
        }

        // Update Call / Bet / Slider bounds for human
        const toCall = Math.max(0, this.currentBet - human.betThisStreet);
        const callBtn = $('btn-call');
        if (toCall === 0) {
          callBtn.textContent = 'Check';
        } else if (toCall >= human.stack) {
          callBtn.textContent = `All-In $${human.stack}`;
        } else {
          callBtn.textContent = `Call $${toCall}`;
        }

        const slider = $('bet-slider');
        const minTotal = Math.min(human.betThisStreet + human.stack, Math.max(this.bb, this.currentBet + this.minRaise));
        const maxTotal = human.betThisStreet + human.stack;
        slider.min = minTotal;
        slider.max = Math.max(minTotal, maxTotal);
        slider.step = chipStep(this.bb);
        if (parseInt(slider.value, 10) < minTotal || parseInt(slider.value, 10) > maxTotal) {
          slider.value = minTotal;
        }
        this._updateRaiseButtonLabel();
      }

      _updateRaiseButtonLabel() {
        const human = this.players[0];
        const val = parseInt($('bet-slider').value, 10) || this.bb;
        $('bet-slider-val').textContent = `$${val}`;
        const raiseBtn = $('btn-raise');
        const maxTotal = human.betThisStreet + human.stack;
        if (val >= maxTotal && maxTotal > 0) {
          raiseBtn.textContent = `All-In $${maxTotal}`;
        } else {
          raiseBtn.textContent = this.currentBet === 0 ? `Bet $${val}` : `Raise $${val}`;
        }
      }

      _setHumanControlsEnabled(enabled) {
        const human = this.players[0];
        const canRaise = enabled && human.stack > Math.max(0, this.currentBet - human.betThisStreet);
        $('btn-fold').disabled = !enabled;
        $('btn-call').disabled = !enabled;
        $('btn-raise').disabled = !canRaise;
        $('bet-slider').disabled = !canRaise;
        __root.querySelectorAll('.quick-size-btn').forEach(b => b.disabled = !canRaise);
      }

      _showBetweenHandsBar(msg) {
        bridge.changed();
        $('raise-controls-row').classList.add('hidden');
        const bar = $('between-hands-bar');
        bar.classList.remove('hidden');
        $('between-hands-msg').textContent = msg;
        const needsRebuy = this.players[0].stack <= 0 && this.mode.allowRebuy;
        $('btn-rebuy').classList.toggle('hidden', !needsRebuy);
        $('btn-next-hand').classList.toggle('hidden', needsRebuy);
      }

      _showResultModal(icon, title, desc) {
        $('result-icon').textContent = icon;
        $('result-title').textContent = title;
        $('result-desc').textContent = desc;
        $('modal-result').classList.remove('hidden');
      }

      showBanner(text) {
        const host = $('event-banner-container');
        const div = document.createElement('div');
        div.className = 'banner-animate fixed left-1/2 top-1/3 font-casino text-sm sm:text-lg tracking-[0.28em] text-amber-100/90 whitespace-nowrap border-b border-amber-200/30 pb-1';
        div.style.textShadow = '0 2px 12px rgba(0,0,0,0.9)';
        div.textContent = text;
        host.innerHTML = '';
        host.appendChild(div);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 2450);
      }

      addLog(text) {
        const log = $('table-log');
        const row = document.createElement('div');
        row.className = 'log-row text-[11px] text-white/50';
        row.textContent = text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
        row.addEventListener('animationend', () => row.remove());
        log.appendChild(row);
        while (log.children.length > 3) log.removeChild(log.firstChild);
      }

      _updateHelpCardModal() {
        const isSD = this.mode.shortDeck;
        $('help-shortdeck-banner').classList.toggle('hidden', !isSD);
        $('help-mode-note').textContent = isSD
          ? 'Short Deck 6+ Rankings (Flush beats Full House!)'
          : 'Standard Texas Hold’em Rankings (strongest to weakest).';

        const rows = [
          { name: 'Royal Flush', ex: 'A♠ K♠ Q♠ J♠ 10♠', desc: 'A-K-Q-J-10 all of the same suit.' },
          { name: 'Straight Flush', ex: '9♥ 8♥ 7♥ 6♥ 5♥', desc: 'Five consecutive cards of the same suit.' },
          { name: 'Four of a Kind', ex: 'K♠ K♥ K♦ K♣ 9♠', desc: 'All four cards of the same rank.' },
          isSD
            ? { name: 'Flush (Beats Full House!)', ex: 'A♦ J♦ 9♦ 8♦ 6♦', desc: 'Any five cards of the same suit (higher in 6+).' }
            : { name: 'Full House', ex: 'Q♠ Q♥ Q♦ 8♣ 8♠', desc: 'Three of a kind plus a pair.' },
          isSD
            ? { name: 'Full House', ex: 'Q♠ Q♥ Q♦ 8♣ 8♠', desc: 'Three of a kind plus a pair.' }
            : { name: 'Flush', ex: 'A♦ J♦ 9♦ 6♦ 3♦', desc: 'Any five cards of the same suit.' },
          { name: 'Straight', ex: isSD ? '9♣ 8♦ 7♥ 6♠ A♣' : '10♣ 9♦ 8♥ 7♠ 6♣', desc: isSD ? 'Five consecutive ranks (A-6-7-8-9 counts!).' : 'Five consecutive cards of mixed suits.' },
          { name: 'Three of a Kind', ex: 'J♠ J♥ J♦ A♣ 7♠', desc: 'Three cards of the same rank.' },
          { name: 'Two Pair', ex: 'A♠ A♦ 10♣ 10♥ K♠', desc: 'Two different pairs.' },
          { name: 'One Pair', ex: '10♠ 10♦ A♣ K♥ 8♠', desc: 'Two cards of the same rank.' },
          { name: 'High Card', ex: 'A♠ Q♦ 10♣ 8♥ 6♠', desc: 'Highest card plays when no hand is made.' }
        ];

        const list = $('help-rankings-list');
        list.innerHTML = rows.map(r => `
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <div class="min-w-0"><div class="text-[13px] text-white/85">${r.name}</div><div class="text-[11px] text-white/35">${r.desc}</div></div>
            <div class="font-mono text-xs text-white/60 whitespace-nowrap">${r.ex}</div>
          </div>`).join('');
      }

      _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      }
    }

    /* =========================================================================
       7. BOOTSTRAP & DOM EVENT WIRING (STARTS ON window.onload)
       ========================================================================= */

    let table3D = null;
    let game = null;

    // ---- Mosaic opponents: the game's own characters, drawn with its figure renderer onto billboards ----
    function makeMosaicBillboard(id) {
      const W = 256, H = 256, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      mat.color.setScalar(0.92);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(2.0, 2.0, 1);
      sprite.position.set(0, 1.22, 0.6);
      return { id, cv, g: cv.getContext('2d'), tex, mat, sprite, W, H, doing: 'sit', last: -1e9 };
    }
    function paintMosaic(m, now) {
      if (now - m.last < 85) return; // about 12 redraws a second is plenty for a seated figure
      m.last = now;
      m.g.clearRect(0, 0, m.W, m.H);
      try { bridge.drawPerson(m.id, m.g, m.W / 2, m.H + 130, 2.6, now / 1000, m.doing); } catch (_) {}
      m.tex.needsUpdate = true;
    }
    // map each Mosaic guest onto the seat personality that suits their play style
    const PERSONA_PREF = { patient: ['The Professor', 'Viper'], pressure: ['Viper', 'Mad Dog'], tricky: ['Duchess', 'Lucky Lou'], loose: ['Lucky Lou', 'Mad Dog'] };
    AI_PROFILES.forEach((p) => { p.persona = p.persona || p.name; delete p.mosaicId; });
    {
      const used = new Set();
      for (const o of (bridge.opponents ? bridge.opponents() : []).slice(0, 5)) {
        const order = (PERSONA_PREF[o.style] || []).concat(AI_PROFILES.map((p) => p.persona));
        const persona = order.find((n) => !used.has(n));
        const prof = AI_PROFILES.find((p) => p.persona === persona);
        if (!prof) continue;
        used.add(persona); prof.name = o.name; prof.mosaicId = o.id;
      }
    }

    function wireUI() {
      // Mode selection cards
      __root.querySelectorAll('.mode-card').forEach(btn => {
        btn.addEventListener('click', () => {
          sound.init();
          const modeKey = btn.getAttribute('data-mode');
          if (game.handInProgress) { feltNote('Finish the current hand before changing tables.'); return; }
          const base = GAME_MODES[modeKey];
          const min = base.minBuyIn;
          const want = Math.floor(Number($('felt-buyin').value) || 0);
          if (want < min) { feltNote('The ' + base.name + ' table starts at $' + min.toLocaleString() + '.'); return; }
          // changing tables cashes the old seat out first
          if (game.seated()) api.cashOut(true);
          if (bridge.chips() < want && !bridge.buyChips(want - bridge.chips())) { feltNote('You need $' + want.toLocaleString() + ' in chips or cash for this seat.'); return; }
          bridge.spend(want);
          $('modal-modes').classList.add('hidden');
          $('btn-close-modes').classList.remove('hidden');
          $('modal-result').classList.add('hidden');
          game.startMode(modeKey, want);
          bridge.changed();
          refreshSeatUi();
        });
      });

      $('btn-open-modes').addEventListener('click', () => {
        if (game.handInProgress) { feltNote('Finish the current hand first.'); return; }
        openModes();
      });
      $('btn-leave-table').addEventListener('click', () => {
        if (game.handInProgress) { feltNote('Finish the current hand first.'); return; }
        if (game.mode.id === 'tournament' && !game.finished && !leaveArmed) {
          leaveArmed = true; $('btn-leave-table').textContent = 'Forfeit?';
          setTimeout(() => { leaveArmed = false; refreshSeatUi(); }, 3500); return;
        }
        api.cashOut(false);
        openModes();
      });
      $('btn-close-modes').addEventListener('click', () => {
        $('modal-modes').classList.add('hidden');
      });

      // Camera cycle
      $('btn-cam-cycle').addEventListener('click', () => {
        const mode = table3D.cycleCameraMode();
        const labels = { pov: 'POV', action: 'Action', orbit: 'Orbit' };
        $('cam-mode-text').textContent = labels[mode];
      });

      // Toggle Poker Coach
      $('btn-toggle-coach').addEventListener('click', () => {
        const panel = $('coach-panel');
        panel.classList.toggle('hidden');
        $('btn-toggle-coach').classList.toggle('on', !panel.classList.contains('hidden'));
      });

      // Help Card Modal
      $('btn-open-help').addEventListener('click', () => {
        $('modal-help').classList.remove('hidden');
      });
      $('btn-close-help').addEventListener('click', () => {
        $('modal-help').classList.add('hidden');
      });

      // Sound Toggle
      $('btn-toggle-sound').addEventListener('click', (e) => {
        const muted = sound.toggleMute();
        e.currentTarget.classList.toggle('is-muted', muted);
      });

      // Betting Actions
      $('btn-fold').addEventListener('click', () => game.applyAction(0, 'fold'));
      $('btn-call').addEventListener('click', () => {
        const toCall = Math.max(0, game.currentBet - game.players[0].betThisStreet);
        game.applyAction(0, toCall === 0 ? 'check' : 'call');
      });
      $('btn-raise').addEventListener('click', () => {
        const val = parseInt($('bet-slider').value, 10);
        game.applyAction(0, 'raise', val);
      });

      const slider = $('bet-slider');
      slider.addEventListener('input', () => game._updateRaiseButtonLabel());

      __root.querySelectorAll('.quick-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-sizing');
          const human = game.players[0];
          const minV = parseInt(slider.min, 10);
          const maxV = parseInt(slider.max, 10);
          let target = minV;
          if (type === 'min') target = minV;
          else if (type === 'half') target = Math.max(minV, Math.round((game.currentBet + game.pot * 0.5) / 5) * 5);
          else if (type === 'pot') target = Math.max(minV, Math.round((game.currentBet + game.pot) / 5) * 5);
          else if (type === 'allin') target = maxV;
          slider.value = Math.min(maxV, Math.max(minV, target));
          game._updateRaiseButtonLabel();
        });
      });

      // Next Hand & Rebuy
      $('btn-next-hand').addEventListener('click', () => game.startNewHand());
      $('btn-rebuy').addEventListener('click', () => game.startNewHand());

      // Felt colour + card designs
      const setFelt = hex => {
        const n = parseInt(hex.slice(1), 16);
        customFelt = { p: hex, d: '#' + [16, 8, 0].map(sh => Math.round(((n >> sh) & 255) * 0.4).toString(16).padStart(2, '0')).join('') };
        table3D.setModeTheme(game.mode);
      };
      const feltBox = $('felt-swatches');
      ['#0a4029', '#0b3b3f', '#0c2a52', '#4d0b18', '#2c1048', '#1b1d22', '#3a2416', '#1f3a14', '#2a3440', '#0a0a0a'].forEach(hex => {
        const b = document.createElement('button'); b.className = 'w-5 h-5 rounded-full border border-white/20'; b.style.background = hex;
        b.addEventListener('click', () => setFelt(hex)); feltBox.appendChild(b);
      });
      const picker = document.createElement('input'); picker.type = 'color'; picker.value = '#0a4029';
      picker.className = 'w-6 h-6 bg-transparent border-0 p-0 cursor-pointer'; picker.addEventListener('input', () => setFelt(picker.value)); feltBox.appendChild(picker);
      $('btn-felt-default').addEventListener('click', () => { customFelt = null; table3D.setModeTheme(game.mode); });
      const grid = $('card-style-grid'), nameEl = $('card-style-name');
      let gridBuilt = false;
      const mark = () => { nameEl.textContent = CARD_STYLES[cardStyleIdx].name; [...grid.children].forEach((b, i) => b.classList.toggle('border-amber-300', i === cardStyleIdx)); };
      $('btn-open-style').addEventListener('click', () => {
        const panel = $('style-panel'); panel.classList.toggle('hidden');
        if (!gridBuilt && !panel.classList.contains('hidden')) {
          gridBuilt = true;
          CARD_STYLES.forEach((st, i) => {
            const b = document.createElement('button'); b.title = st.name; b.className = 'rounded overflow-hidden border-2 border-transparent hover:border-white/40';
            const cv = document.createElement('canvas'); cv.width = 36; cv.height = 50; cv.className = 'block w-full';
            cv.getContext('2d').drawImage(getCardBackTexture(i).image, 0, 0, 36, 50);
            b.appendChild(cv); b.addEventListener('click', () => { applyCardStyle(i); mark(); }); grid.appendChild(b);
          });
          mark();
        }
      });

      // Result Modal buttons
      $('btn-result-restart').addEventListener('click', () => {
        // settle the finished seat, then offer a fresh buy-in at the same table
        $('modal-result').classList.add('hidden');
        api.cashOut(true);
        openModes();
      });
      $('btn-result-modes').addEventListener('click', () => {
        $('modal-result').classList.add('hidden');
        api.cashOut(true);
        openModes();
      });
    }



    /* =========================================================================
       7. HOST WIRING (settlement with the casino wallet, lifecycle)
       ========================================================================= */
    let raf = 0, alive = true;
    const handle = { };

    const api = {
      cashOut(quiet) {
        if (!game || !game.bought) { return 0; }
        const human = game.players[0];
        const forfeit = game.mode.id === 'tournament' && !game.finished;
        const returned = forfeit ? 0 : Math.max(0, Math.floor(human.stack));
        const net = returned - game.bought;
        if (returned > 0) bridge.deposit(returned);
        bridge.settled(net, forfeit ? 'Hold’em tournament' : 'Hold’em');
        game.bought = 0; game.buyIn = 0;
        human.stack = 0; human.holeCards = []; human.folded = false;
        game.handInProgress = false;
        game.finished = true;
        game.mode = Object.assign({}, game.mode);
        refreshSeatUi();
        bridge.changed();
        return returned;
      }
    };

    const refreshSeatUi = () => {
      const seated = !!(game && game.seated());
      const b = $('btn-leave-table');
      if (b) { b.classList.toggle('hidden', !seated); b.textContent = game && game.mode.id === 'tournament' && !game.finished ? 'Forfeit' : 'Cash out'; }
      const blurbs = { cash: 'rebuys', tournament: 'rising blinds, no rebuys', vip: 'antes, rebuys', shortdeck: '6+ deck, antes, rebuys' };
      for (const [k, v] of Object.entries(GAME_MODES)) {
        const m = __root.querySelector('[data-mode="' + k + '"] [data-min]');
        if (m) m.textContent = blurbs[k] + ' · from $' + v.minBuyIn.toLocaleString();
      }
      const note = $('felt-buyin-note');
      if (note && !game.handInProgress) note.textContent = 'Chips available: $' + Math.floor(bridge.chips()).toLocaleString() + ' · cash tops chips up automatically';
    };
    const openModes = () => { refreshSeatUi(); $('modal-modes').classList.remove('hidden'); };

    table3D = new PokerTable3D($('canvas-container'));
    game = new PokerGameController(table3D);
    game.bought = 0; game.buyIn = 0; game.finished = true;
    __root.__felt = { table3D, game };
    game.seated = function () { return this.bought > 0 && !!this.players[0]; };
    wireUI();
    refreshSeatUi();

    let last = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!alive || !__root.isConnected) return;
      // pause when the stage is hidden or off screen
      if (__root.offsetParent === null || document.hidden) return;
      table3D.update(now || performance.now());
      game.updateSeatOverlayPositions();
      last = now;
    };
    raf = requestAnimationFrame(frame);

    // build the card faces and upload them to the GPU in idle time so the deal never hitches
    {
      const todo = [];
      for (const su of SUITS) for (let r = 2; r <= 14; r++) todo.push([r, su]);
      const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 40));
      const warm = (dl) => {
        if (!alive) return;
        let n = 0;
        while (todo.length && n < 2 && (dl.timeRemaining ? dl.timeRemaining() > 4 : true)) {
          const [r, su] = todo.shift();
          try { const t = getCardFrontTexture(r, su); table3D.renderer.initTexture && table3D.renderer.initTexture(t); } catch (_) {}
          n++;
        }
        if (todo.length) idle(warm);
      };
      idle(warm);
    }

    Object.assign(handle, {
      locked: () => !!game && game.seated() && (game.handInProgress || (game.mode.id === 'tournament' && !game.finished)),
      stack: () => (game && game.seated() ? Math.max(0, Math.floor(game.players[0].stack)) : 0),
      seated: () => !!game && game.seated(),
      leave: () => { if (game && game.seated() && !game.handInProgress) api.cashOut(true); },
      refresh: refreshSeatUi,
      destroy: () => { alive = false; cancelAnimationFrame(raf); try { table3D.dispose(); } catch (_) {} },
    });
    return handle;

  })();
  return __api;
}
