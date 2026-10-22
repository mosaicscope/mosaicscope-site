# Casino floor, flight and betting follow-up — 22 October 2026

Source build: `a4049a8`. User annotation and later steering are preserved verbatim below.

## Original annotation

ccrash flgiht is sitll messed up, make this floow and roulette tabnle iso 3d tho full fledged casino broo with maosica other girls n shit

## Crash Flight steering

waht the fuck the crash game looks yuck af changte it to 2d but make it wayyyy bettter

## Roulette steering

and the casino roulette needs a better way for better, teh iso table is yuck lookign but you get the vision

## Final implementation

Crash Flight is **2D**. It uses side-profile aircraft with catalogue-based engine counts, cabin windows, wings, tails, liveries, floats, rotating propellers, retracting gear and navigation lights. Its three routes have scrolling city traffic/windows, coastline waves/boats/lighthouse, or layered mountains/snow/forest, with cloud parallax, trails, smoke and landing celebrations. The live multiplier, potential return, aircraft, route, stake, launch and cash-out fit together on desktop and phones. Portrait uses its own composition without stretching. Native Mosaic spectators react to the actual result. One idempotent settlement function handles the live scene, cash-out and resumed flights; the final multiplier and payout freeze at the decision or crash time. Cash-out cannot pay twice or win after the crash. The game remains a random play-money game; its existing distribution is retained.

The lobby is now a fitted isometric casino floor, with physical blackjack, poker, roulette, slots, video poker, flight cabinets, a cashier, bar and lounge. Tap a station to enter its actual game, use the destination selector, or tap the aisles to walk the floor avatar. A small navigation grid avoids the table and furniture footprints. Women and men from the actual Mosaic cast occupy the room, staff stations and social areas. Guest selection, conversations, drinks, credit and side bets use existing character identities, wallet/substance effects and casino state. The existing exterior remains accessible. Guest lists expand to twelve initially and up to twenty-four when selected; restoring a saved list also deep-copies its balances.

Roulette remains isometric. Its table is resized relative to native people, with darker timber, fitted padded rails, correctly shaped stitching and a raised wheel housing. A bar, cabinets, lounge, staff and additional selectable Mosaics surround it. A separate **Betting layout** view provides large flat number targets and twelve outside bets. Phones display twelve numbers at a time with an unobstructed range selector; zero and outside bets remain available. Visible wager amounts, pending split selection, cancel, exact last-chip undo, clear/refund and winning-number highlighting make placement readable. Spin switches to the physical wheel; the real round, payouts, guest wagers and side bets use the same engine. Changing casino areas closes service panels so they cannot carry over and obstruct the next game.

## Validation

- TypeScript and production Vite build pass.
- Full game suite: **851 tests across 99 files** pass, including nine new flight settlement, aisle routing, cast selection and guest-save isolation cases.
- `e2e/casino-floor-flight.mjs`: real floor movement/station navigation; distinct women and men; 60 aircraft and all three 2D routes; chip purchase, launch lock, cash-out, crash and single settlement; flat roulette numbers/splits/outside bets, exact undo and spin/payout; mobile range reachability and hit obstruction; selectable room guests and wallet-connected drinks; desktop/portrait/landscape and retina fit; no runtime errors.
- Existing isometric casino browser checks cover poker, exact projected roulette clicks, bankroll conservation and credit.
- Existing full casino/phone/vehicle browser flow and seven cabin compositions are checked with the release. The approved cabin artwork is preserved.
- Security and exact deployed-asset verification are recorded in the release pull request.

Rollback: revert the release squash commit and deploy the preceding main. Existing save fields and game rules are retained; guest capacity is the only expanded bound.
