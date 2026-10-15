# Exploring, farming, racing and university

The top bar now has Explore, Betting, Racing, Farm and UC. On phones these are in the menu. Each activity screen also has navigation to the other four screens. The casino's **More games & racing** button opens the same betting app after cashing out existing chips.

## Exploring

There are exactly 40 individually authored encounters in `src/content/encounters.ts`. After at least 20 tiles of travel on foot, and once the initial half-hour/game-hour cooldown has passed, one unseen scene becomes available near the player. Each has two choices with cash and reputation consequences and an explicit outcome. A pending scene and completed scene IDs are saved. They do not repeat within a saved game. They are choice scenes; they do not add buildings or additional physical actors to the map.

## Betting and racing

All stakes use existing in-game cash. The mobile app adds baccarat (including third-card rules), pass-line craps, a big wheel, scratchies, five-pick keno, timed Crash cash-outs, and horse, greyhound and chook racing. There is also a non-graphic cartoon chook bout. Race bets are win, top-two place, or an explicitly described exacta pair. Returns and rules are displayed before betting. Loyalty points and the scratch jackpot are saved.

Unfinished craps stakes and Crash flights are transient: closing their panel retains them in the current session, but reloading forfeits them. No real money or external wagering services are involved. Race lanes use CSS animation and respect reduced motion.

Buy a named horse for $800, train once per game hour, feed/rest it, and enter rival-trainer races. Skill and fitness affect the result; wins advance club, regional and championship tiers. The Horncastle meet is a fictional game venue accessible from Racing, rather than a regenerated map building.

## Farming

Three land tiers support 12 kinds of stock and 31 machines, implements and farm structures. Every purchased item affects a production prerequisite, capacity, output, or running cost. Animals need feed, care and their relevant facilities before generating sales. Crop and hay jobs require implements and can run once per game day. Seasons change every seven game days; season and rain affect sales or yield.

One game hour is one real minute at 1×. Farm accounts settle every 24 game hours after purchase. Sales, costs and net income are announced. Upkeep continues even without production. Reopening a panel cannot trigger a second settlement. These are management actions, not drivable farm machinery or roaming livestock on the town map.

## University

Eight subjects have easy mock tests with visible study hints and free retries. Nine passed courses complete the three-year bachelor arc. Six further courses earn a master's degree; nine more earn a doctorate. Graduation is presented through the Town Hall action. Each qualification level adds 20% to the existing player wage calculation, up to 1.6×. Titles and completed qualifications appear on the HUD. Tests advance course years; they do not require waiting three simulated calendar years. These are fictional credentials for the game.

## Vehicle damage

The existing impact zones now damage tyres, engine, glazing and trim independently. Flat tyres lower grip and speed and pull to one side. Badly damaged engines overheat while driven and cool when stopped. Continuing can start a fire followed by a brief cartoon explosion and burnt-out state. Drivers leave dangerous cars; NPC wrecks are moved to the garage after a game hour. Player-owned wrecks remain for repair. Visual cues include flattened tyres, fractured glazing, leaks, debris, smoke and flames. The garage repairs the component state as well as the aggregate damage, fixing the old persistent-dent issue.

## Saves and verification

The expansion is stored inside existing save slots, not in separate account-wide storage. Old saves receive fresh defaults. New component fields travel with the existing vehicle save data.

- `npm run typecheck`
- `npm test -- --testTimeout=60000`
- `npm run build` (regenerates committed `world/` output)
- `CHROMIUM=/path/to/chrome node e2e/expansion.mjs`

The browser check launches its own Vite server and exercises desktop and phone layouts, stock purchases, nine courses and graduation, horse training cooldown, baccarat, keno, racing and scroll preservation. Screenshots are temporary, under `E2E_OUT` or `/tmp`.
