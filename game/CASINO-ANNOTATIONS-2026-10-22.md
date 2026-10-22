# Casino table annotations — 22 October 2026

Source: user comments on build `8f23924`. These two comments are preserved verbatim.

## Comment 1

what  baout this tell you its a polker table its so fucking shit bro

## Comment 2

needs to be more iso metric and realsitic and we can see everything, it looks completly wrogn from waht i wanted

## Result

Poker previously hid its actual playing scene until entry and showed the detached spectator strip in the empty state. It now shows an isometric poker room immediately, including the empty player chair. Explicit chip purchase and entry are one action when the player needs chips; only the shortfall is charged. The preview does not debit any character. Cash and tournament play retain their real hand, bankroll, payout and persistence logic.

Both tables use the world's two-to-one projection. Raised felt and timber rails, visible legs and plinths, seated native Mosaics, oriented chairs, dealer, glassware, chip racks, physical card backs/faces and cutaway room furniture share world coordinates and depth order. Poker's five community cards, pot, individual stacks, dealer button and action state follow the actual hand. Standing dealer labels clear their heads.

Roulette's animated wheel is embedded in the same tabletop plane as the cloth. Native dealer and guests surround the table. Every number and outside area has a real HTML button clipped to its projected polygon; the shared canvas fitting transform also positions its hit regions. Resize, letterboxing and device pixel density keep visible targets and input aligned. Chip stacks sit on the actual number, split boundary, street edge, corner, six-line edge or outside region. A compact wager slip retains the full amounts and payout ratios. Large number/type/outside selectors provide a precise alternative on phones. The original wheel odds, result settlement, side bets, drinks, conversations and fixed-term credit remain wired to the same game state.

The table and control rail fit together inside the viewport. Portrait phones use horizontal game tabs and a lower control rail; landscape phones put the scene beside the controls and retain game navigation. Player profiles and table services open over the scene on demand. Browser layout checks require zero frame/body overflow; the landscape controls and optional service panels can scroll internally on short screens. The world and cabin artwork are unchanged.

## Validation

- TypeScript and Vite production build pass.
- Game suite: 842 tests in 97 files pass.
- `e2e/isometric-casino.mjs`: empty-state preview; no preview charge; exact shortfall and failed-entry payment cases; actual cash poker and bankroll conservation; active and empty poker at phone sizes; projected roulette number/outside targets; straight, zero, split, street, corner and six-line coverage; itemized wagers; refunds; animation and result settlement; credit and repayment; desktop, portrait, landscape and enlarged CSS viewport checks with retina backing and no runtime errors.
- `e2e/world-casino-annotations.mjs`: casino drinks, credit, side-bet settlement, cash/tournament poker, profiles, crash flight, phone/Snake, restored movement and native vehicle/world rendering pass.
- `e2e/cabin-art.mjs`: seven economy/first-class/window/aisle desktop/mobile combinations pass, with retina backing, viewport fit and no state mutation.
- Deployment checks and public smoke results are recorded on the release pull request.

Rollback: revert this release squash commit and redeploy the preceding main. No save-schema migration is introduced.
