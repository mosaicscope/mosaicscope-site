export interface ScratchTicket { design?:number; stake: number; payout: number; symbols: number[]; mask: number; paid: boolean }
export interface ArcadeResult { game: string; values: number[]; labels: string[]; stake: number; payout: number; result: string; at: number }

/** Stake-inclusive payout and the printed ticket are fixed at purchase, never while scratching. */
export function makeScratch(stake: number, jackpot: number, rng = Math.random, design=0): ScratchTicket {
  if (!Number.isFinite(stake) || stake < 1 || stake > 500) throw new Error("Choose a stake from $1 to $500.");
  const roll = Math.floor(Math.max(0, Math.min(0.999999, rng())) * 1000);
  const multiplier = roll === 0 ? -1 : roll < 10 ? 20 : roll < 60 ? 5 : roll < 200 ? 2 : 0;
  const symbol = multiplier === -1 ? 0 : multiplier === 20 ? 1 : multiplier === 5 ? 2 : 3;
  const first = 1 + Math.floor(rng() * 5);
  return { design:Math.max(0,Math.min(99,Math.floor(design))), stake, payout: multiplier === -1 ? jackpot : stake * multiplier, symbols: multiplier ? [symbol, symbol, symbol] : [first, (first + 1) % 6, (first + 3) % 6], mask: 0, paid: false };
}
/** Reveal progress survives saves; claiming a finished ticket is idempotent. */
export function revealScratch(ticket: ScratchTicket, panel: number): number {
  if (ticket.paid || !Number.isInteger(panel) || panel < 0 || panel > 2) return 0;
  ticket.mask |= 1 << panel;
  if (ticket.mask !== 7) return 0;
  ticket.paid = true;
  return ticket.payout;
}
export function dealBaccarat(rng = Math.random): { player: number[]; banker: number[]; p: number; b: number } {
  const card = () => 1 + Math.floor(rng() * 13), val = (n: number) => n >= 10 ? 0 : n;
  const player = [card(), card()], banker = [card(), card()];
  let p = player.reduce((a, n) => a + val(n), 0) % 10, b = banker.reduce((a, n) => a + val(n), 0) % 10;
  if (p < 8 && b < 8) {
    let third = -1;
    if (p <= 5) { const n = card(); player.push(n); third = val(n); p = (p + third) % 10; }
    if (third < 0 ? b <= 5 : b <= 2 || b === 3 && third !== 8 || b === 4 && third >= 2 && third <= 7 || b === 5 && third >= 4 && third <= 7 || b === 6 && third >= 6 && third <= 7) { const n = card(); banker.push(n); b = (b + val(n)) % 10; }
  }
  return { player, banker, p, b };
}
