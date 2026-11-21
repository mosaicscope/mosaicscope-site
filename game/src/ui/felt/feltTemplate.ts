// Markup of the Royal Felt HUD (header, pot, coach, felt/card picker, bet controls, modals).
export const FELT_TEMPLATE = `<div id="canvas-container"></div>
<div id="seat-overlay"></div>
<div id="event-banner-container" class="fixed inset-0 pointer-events-none z-40"></div>

  <header class="fixed top-0 left-0 right-0 z-30 flex items-start justify-between px-4 pt-3 pointer-events-none">
    <button id="btn-open-modes" title="Change table" class="pointer-events-auto text-left text-[11px] text-white/40 hover:text-white/80 transition">
      <span id="hud-mode-label">Classic Cash • $10/$20</span>, hand <span id="hud-hand-num">#1</span><span id="hud-ante-wrap" class="hidden">, ante <span id="hud-ante-val">$25</span></span>
    </button>
    <div class="flex items-center pointer-events-auto">
      <button id="btn-leave-table" title="Leave the table and return your stack to your chips" class="hidden ghost ghost-gold rounded-md px-2.5 py-1 mr-2 text-[10px] tracking-wide">Cash out</button>
      <button id="btn-cam-cycle" title="Camera" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span id="cam-mode-text" class="hidden sm:inline">POV</span></button>
      <button id="btn-open-style" title="Felt and cards" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/></svg></button>
      <button id="btn-toggle-coach" title="Coach" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg></button>
      <button id="btn-open-help" title="Hand rankings" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button>
      <button id="btn-toggle-sound" title="Sound" class="icon-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="wave" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>
    </div>
  </header>

  <div class="fixed top-3 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none leading-tight">
    <div id="hud-pot-amount" class="font-casino text-base text-amber-200/80">$0</div>
    <div id="hud-street-badge" class="street-label text-[10px] tracking-widest text-white/35">PREFLOP</div>
  </div>

  <aside id="coach-panel" class="hidden fixed right-4 top-14 z-20 w-60 casino-glass rounded-xl p-3">
    <div class="flex items-baseline justify-between gap-2">
      <span id="coach-hand-name" class="text-[13px] font-semibold text-white/90">Waiting for deal...</span>
      <span id="coach-strength-tier" class="lowercase text-[10px] text-emerald-300">READY</span>
    </div>
    <div id="coach-draws" class="mt-1 text-[10px] text-white/45 flex flex-wrap gap-x-2"></div>
    <div class="mt-3">
      <div class="flex justify-between text-[10px] text-white/40 mb-1"><span>equity</span><span id="coach-equity-pct" class="text-white/70">--%</span></div>
      <div class="h-[2px] w-full bg-white/10 rounded-full overflow-hidden"><div id="coach-equity-bar" class="h-full bg-amber-300/70 transition-all duration-500" style="width:0%"></div></div>
    </div>
    <div class="mt-2 flex justify-between text-[10px] text-white/40"><span>pot odds <span id="coach-pot-odds" class="text-white/70">Free</span></span><span>to call <span id="coach-to-call" class="text-white/70">$0</span></span></div>
    <p id="coach-advice" class="mt-2.5 text-[11px] leading-relaxed text-white/55">Deal a hand to see strength, draws and odds.</p>
  </aside>

  <aside id="style-panel" class="hidden fixed left-4 top-12 z-30 w-72 casino-glass rounded-xl p-3">
    <div class="flex items-center justify-between text-[10px] text-white/40 mb-1.5"><span>Felt</span><button id="btn-felt-default" class="hover:text-white/80">mode default</button></div>
    <div id="felt-swatches" class="flex flex-wrap gap-1.5 items-center"></div>
    <div class="text-[10px] text-white/40 mt-3 mb-1.5">Cards <span id="card-style-name" class="text-white/70"></span></div>
    <div id="card-style-grid" class="grid grid-cols-6 gap-1.5 max-h-56 overflow-y-auto custom-scroll"></div>
  </aside>

  <div id="table-log" class="fixed left-4 bottom-24 z-20 hidden lg:flex flex-col gap-0.5 w-64 pointer-events-none"></div>

  <footer id="bottom-controls" class="fixed bottom-0 left-0 right-0 z-30 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 px-4 pb-3 pointer-events-none">
    <div class="flex items-center gap-3 pointer-events-auto self-start sm:self-end">
      <div id="hud-player-cards" class="flex items-center gap-1"><div class="hud-card ghosted"></div><div class="hud-card ghosted"></div></div>
      <div class="leading-tight">
        <div class="flex items-center gap-1.5">
          <span id="hud-player-stack" class="font-casino text-base text-white/90">$2,000</span>
          <span id="hud-player-dealer" class="hidden text-[9px] px-1 rounded-full border border-amber-300/60 text-amber-200">D</span>
        </div>
        <div id="hud-player-hand-mini" class="text-[11px] text-white/40 truncate max-w-[140px]">Ready</div>
      </div>
    </div>

    <div id="betting-panel" class="pointer-events-auto flex flex-col gap-2 w-full sm:w-auto sm:min-w-[400px] max-w-md">
      <div id="raise-controls-row" class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-[10px] text-white/55">
          <button data-sizing="min" class="quick-size-btn hover:text-amber-200 disabled:opacity-30">min</button>
          <button data-sizing="half" class="quick-size-btn hover:text-amber-200 disabled:opacity-30">½</button>
          <button data-sizing="pot" class="quick-size-btn hover:text-amber-200 disabled:opacity-30">pot</button>
          <button data-sizing="allin" class="quick-size-btn hover:text-red-300 disabled:opacity-30">all-in</button>
        </div>
        <input id="bet-slider" type="range" min="20" max="2000" step="10" value="40" class="bet-slider flex-1" />
        <span id="bet-slider-val" class="text-[11px] text-amber-200/80 min-w-[44px] text-right tabular-nums">$40</span>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <button id="btn-fold" class="ghost ghost-red rounded-lg py-2 text-[13px]">Fold</button>
        <button id="btn-call" class="ghost rounded-lg py-2 text-[13px]">Check</button>
        <button id="btn-raise" class="ghost ghost-gold rounded-lg py-2 text-[13px]">Bet $40</button>
      </div>
      <div id="between-hands-bar" class="hidden flex items-center justify-between gap-3">
        <span id="between-hands-msg" class="text-[11px] text-white/45">Hand complete.</span>
        <div class="flex gap-2">
          <button id="btn-rebuy" class="hidden ghost ghost-gold rounded-lg py-1.5 px-3 text-xs">Rebuy</button>
          <button id="btn-next-hand" class="ghost ghost-gold rounded-lg py-1.5 px-4 text-xs">Deal</button>
        </div>
      </div>
    </div>
  </footer>

  <div id="modal-modes" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="max-w-md w-full relative">
      <button id="btn-close-modes" class="hidden icon-btn absolute -top-8 right-0">✕</button>
      <h1 class="font-casino text-2xl text-white/90 tracking-[0.2em] text-center mb-3">Royal Felt</h1>
      <div class="text-center mb-6">
        <label class="text-[11px] text-white/55">Buy-in <input id="felt-buyin" type="number" min="100" step="50" value="200" class="felt-input ml-2 w-28 rounded-md px-2 py-1 text-center text-sm" /></label>
        <p id="felt-buyin-note" class="mt-2 text-[11px] text-white/45"></p>
      </div>
      <div class="flex flex-col divide-y divide-white/10 border-y border-white/10">
        <button data-mode="cash" class="mode-card group text-left py-4 flex items-center gap-3"><span class="w-2 h-2 rounded-full" style="background:#0a4029"></span><span class="font-casino text-white/85 group-hover:text-amber-200 transition">Classic Cash</span><span data-min class="ml-auto text-[11px] text-white/35">$10/$20, rebuys</span></button>
        <button data-mode="tournament" class="mode-card group text-left py-4 flex items-center gap-3"><span class="w-2 h-2 rounded-full" style="background:#0c2a52"></span><span class="font-casino text-white/85 group-hover:text-amber-200 transition">Turbo Tournament</span><span data-min class="ml-auto text-[11px] text-white/35">rising blinds, no rebuys</span></button>
        <button data-mode="vip" class="mode-card group text-left py-4 flex items-center gap-3"><span class="w-2 h-2 rounded-full" style="background:#4d0b18"></span><span class="font-casino text-white/85 group-hover:text-amber-200 transition">High-Roller VIP</span><span data-min class="ml-auto text-[11px] text-white/35">$50/$100, antes</span></button>
        <button data-mode="shortdeck" class="mode-card group text-left py-4 flex items-center gap-3"><span class="w-2 h-2 rounded-full" style="background:#2c1048"></span><span class="font-casino text-white/85 group-hover:text-amber-200 transition">Short Deck 6+</span><span data-min class="ml-auto text-[11px] text-white/35">36 cards, flush beats full house</span></button>
      </div>
    </div>
  </div>

  <div id="modal-help" class="fixed inset-0 z-50 hidden bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="casino-glass rounded-2xl max-w-xl w-full p-5 max-h-[88vh] overflow-y-auto custom-scroll">
      <div class="flex items-start justify-between mb-3">
        <div><h2 class="font-casino text-lg text-white/90">Hand rankings</h2><p id="help-mode-note" class="text-[11px] text-white/40 mt-0.5"></p></div>
        <button id="btn-close-help" class="icon-btn">✕</button>
      </div>
      <div id="help-shortdeck-banner" class="hidden mb-3 text-[11px] text-purple-200/80">Short deck: 2s to 5s removed, flush beats full house, A-6-7-8-9 is a straight.</div>
      <div id="help-rankings-list" class="divide-y divide-white/10"></div>
    </div>
  </div>

  <div id="modal-result" class="fixed inset-0 z-50 hidden bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="text-center max-w-sm w-full">
      <div id="result-icon" class="hidden"></div>
      <h2 id="result-title" class="font-casino text-2xl text-amber-200/90 mb-2">CHAMPION!</h2>
      <p id="result-desc" class="text-sm text-white/50 mb-6"></p>
      <div class="flex justify-center gap-3">
        <button id="btn-result-restart" class="ghost ghost-gold rounded-lg py-2 px-5 text-xs">Play again</button>
        <button id="btn-result-modes" class="ghost rounded-lg py-2 px-5 text-xs">Change mode</button>
      </div>
    </div>
  </div>
`;
