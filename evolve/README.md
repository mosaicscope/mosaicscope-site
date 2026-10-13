# MosaicScope evolution engine

Small, safe improvements to the site, found and made automatically. Two agents compete to pick each one. Scripts do the work; the AI only makes a choice when there is one to make.

Dashboard: **/evolve/** (for example https://mosaicscope.pages.dev/evolve/). It isn't in the sitemap and is marked noindex.

## How a cycle works

A Cloudflare Worker cron (`*/2 * * * *`) runs one cycle every two minutes.

1. **Health.** It fetches the live site and records status, time and size. A failure within 30 minutes of a merged change counts as a regression:
   - the agent that proposed the change loses points
   - the engine opens an undo PR on `evolve/revert-<merge sha>`; CI only passes it if it restores the file exactly to its pre-merge version
   - the engine trips into a stopped state until someone resumes it
2. **Change in flight?** If a change is still waiting on CI or a merge, the cycle only checks its PR and stops. A merge counts as accepted and a close as rejected, and both update what the engine has learned.
3. **Local checks (no AI).** It runs `core/rules.js` over the editable pages. If the head commit hasn't changed since the last scan, no files are read at all.
4. **Rank.** Findings are ranked by rule weight × what's been learned. Anything already proposed, rejected in the last 24 h, or using a remedy that failed 3 times without ever landing is skipped.
5. **Verify.** Every candidate fix is applied in memory and must pass `core/validate.js` before an agent ever sees it.
6. **Compete.** Both agents get the same menu of up to 5 verified options, about 100 input tokens. Each answers with one code like `2a`, 2–4 output tokens with `max_tokens` = 8. The **Innovator** leans toward visitor benefit, accessibility and UX. The **Optimiser** leans toward performance, reliability and low risk; it sees A's pick and tries to beat it. If there's only one possible move, no AI is called at all.
7. **Score.** Both picks are scored by the deterministic formula in `core/score.js`: benefit, performance, accessibility, reliability, minus complexity and regression risk, times the learned multipliers. The higher score wins.
8. **Checkpoint.** The winning edit is committed to a new branch `evolve/<kind>-<id>` and a PR is opened. `main` is never written directly.
9. **CI** (`.github/workflows/evolve-ci.yml`). CI re-verifies the diff and runs the engine tests.
   - If they fail, the PR is closed and its branch is deleted (rollback).
   - If they pass, the change waits for you to merge it. With `EVOLVE_AUTO_MERGE=true` it merges itself instead.

When nothing needs fixing, the cycle ends at step 4: no AI, no writes.

**Weekly audit.** `.github/workflows/evolve-audit.yml` runs Lighthouse (mobile) on the live site every Sunday and saves the scores to `audit.json` on the `evolve-data` branch. The engine reads it every 6 hours. An area scoring under 0.9 gets its checks' priority ×1.5, and under 0.7 ×2. The dashboard shows the scores, LCP, CLS and TBT.

## What it can change

Agents never write code. They choose a finding and one of that finding's fixed remedies, and the remedy's code makes the edit. Today's checks:

| Check | Remedies |
|---|---|
| image without alt | `alt=""` / alt from the file name |
| eager below-the-fold image | `loading="lazy"` / plus `decoding="async"` |
| `target=_blank` without noopener | `rel="noopener"` / `rel="noopener noreferrer"` |
| page without lang | `en` / `en-NZ` |
| no viewport meta | standard viewport |
| indexable page without description | description from the title |
| unnamed button | aria-label from title / from id |
| unlabelled form field | aria-label from placeholder / from name |
| iframe without title | title from the embed's host |
| no theme colour | theme colour from the manifest |
| public page missing from the sitemap | add (monthly 0.5 / weekly 0.8) |
| render-blocking head script | `defer` |
| no `<meta charset>` | utf-8 charset |
| link with no accessible name | aria-label from title / from the link's site |
| indexable page without share title / image | `og:title` from the title / the site's `og.jpg` |
| stylesheet with no keyboard focus style | `:focus-visible` outline (appended to `styles.css`) |
| animations without a reduced-motion rule | reduced-motion block (appended to `styles.css`) |

It also reports things it won't fix (in-page links to missing ids, skipped heading levels, duplicate ids, missing h1, very heavy pages) under "Needs a person" on the dashboard.

Add a check by adding a rule to `core/rules.js` with its remedies; the test suite runs every remedy through validation.

## Evolution 3.0: the browser probe, learning, memory, security

The Cloudflare Worker can't run a browser, so anything that needs one runs in GitHub Actions. The results go to the `evolve-data` branch, which the Worker reads every cycle (one tiny request).

| Part | What it does | Where |
|---|---|---|
| **Browser probe** | Headless Chrome at 390 px and 1280 px on `/`, `/house/` and `/404.html`. It records page errors, console errors and failed requests, clicks every button and watches for new errors, and measures requests, KB, render-blocking files, LCP, CLS, long-task time, JS heap and DOM size. It also checks for horizontal overflow, tap targets under 24 px, text under 12 px, low contrast and invisible keyboard focus. | `evolve/probe.mjs`; `evolve-probe` workflow after every deploy and every 6 h |
| **Issues** | Probe results are graded critical / high / medium / low, and marked fixable or needs a person. | `core/issues.js` |
| **Critical recovery** | A critical issue on the live site (JS error on load, missing own JS/CSS, site down) pauses the engine and opens an undo PR for its latest change. | `core/cycle.js` |
| **UI fixes** | Probe-driven rules: a layout-neutral tap-target fix (padding plus matching negative margin) and focus outlines. Both are append-only CSS with a marker comment so they're never repeated. | `core/rules.js` |
| **Visual / performance / bug gate** | CI serves the base and the change side by side in Chrome. The change fails if it adds errors or failed requests, adds UI issues, adds requests, gets heavier, adds render-blocking files or layout shift, moves any text (animated text is filtered out by loading the base twice), or changes over 2% of pixels (15% for features). Before/after screenshots are uploaded as the PR's preview. | `probe.mjs gate`; `evolve-ci` |
| **Measured, not assumed** | A performance change must show a measured gain in the gate. After any change lands, the next probe measures it again: the perf cost metric (KB, render-blocking, CLS) or the UI-issue count. | `metricFor`, `recordEffect` |
| **Learning** | Landed/failed counts fade with a 14-day half-life. Measured effects raise or sink a fix type's priority. A remedy that never moves the numbers 3 times is retired. Each agent's own success per area steers its own picks. A head-to-head Elo rating moves on real outcomes. | `core/score.js` |
| **Competition rules** | The Optimiser is told to pick differently from A, and its local stand-in avoids A's pick when a near-equal option exists. Copying A earns nothing. Proposals scoring under `MIN_SCORE` are never offered. Rewards are capped and come only from CI, merges and probes, never from the agents. | `core/agents.js`, `core/cycle.js` |
| **Strategic memory** | One deduplicated backlog from checks, probe and security. It keeps first-seen dates, links each item to the latest attempt, ages out what's fixed or stale, and slowly raises long-unresolved items. Agents only ever see the top 5. | `core/memory.js` |
| **Micro-features** | Offered only on evidence: a skip link for a page with a header and `<main>` but none, and a back-to-top link for a page over 6 phone screens long. Each declares exactly which extra tags it adds and is marked `[needs approval]`. CI never auto-merges one; you approve it from the screenshots and the Cloudflare preview. | `core/rules.js` |
| **Security guard** | Scans for leaked keys (GitHub, Anthropic, OpenAI, AWS, private keys, Slack, Cloudflare), eval / new Function / document.write / string timers / innerHTML, http:// assets, tab-nabbing, risky workflow patterns, and unauthenticated writes in functions. Every engine edit is re-scanned. CI fails any PR that adds a high or critical finding. `npm audit` of `game/` runs daily. | `core/security.js`, `security.mjs` |
| **Zero-waste AI** | Identical questions reuse a cached answer for free. There's a monthly ceiling (`EVOLVE_MONTHLY_USD_LIMIT`, default $2) on top of the daily one. Nothing is re-read while the commit and the probe are unchanged. | `core/agents.js`, `core/budget.js` |
| **CI exactness** | `verify` only passes a diff that is byte-for-byte what one of the engine's own remedies produces, so hand edits on an `evolve/*` branch fail. | `cli.mjs verify` |

Running it locally with the full browser gate:

```sh
node evolve/probe.mjs report . probe.json      # probe a folder (or a URL)
EVOLVE_PROBE=probe.json EVOLVE_LOCAL_GATE=1 EVOLVE_CYCLE_DEADLINE_MS=300000 node evolve/cli.mjs cycle
node evolve/security.mjs scan
```

## Hard limits and safety

Defaults are in `core/config.js`; override any of them with an `EVOLVE_*` variable on the Worker. Budgets are checked **before** each call, using the worst-case cost of the call. Each call is then booked with the token counts the API reports.

| Setting | Default |
|---|---|
| `EVOLVE_INTERVAL_SECONDS` | 120 |
| `EVOLVE_MAX_INPUT_TOKENS` / `EVOLVE_MAX_OUTPUT_TOKENS` | 400 / 8 per call |
| `EVOLVE_DAILY_USD_LIMIT` | 0.10 (estimated) |
| `EVOLVE_MONTHLY_USD_LIMIT` | 2.00 |
| `EVOLVE_MIN_SCORE` | 4: weaker proposals are never offered |
| `EVOLVE_DAILY_CALL_LIMIT` | 200 |
| `EVOLVE_DAILY_CYCLE_LIMIT` | 720 |
| `EVOLVE_MAX_CHANGES_PER_CYCLE` / `EVOLVE_MAX_OPEN_CHANGES` | 1 / 1 |
| `EVOLVE_MAX_CONSECUTIVE_FAILURES` | 3, then the engine trips and waits for Resume |
| `EVOLVE_MAX_DIFF_LINES` | 12 |
| `EVOLVE_KILL=1` | global emergency stop; the dashboard can't undo it |
| `EVOLVE_MODEL_CHEAP` / `EVOLVE_MODEL_ESCALATE` | `claude-haiku-5-5` / `claude-sonnet-5-5` |

Calls are limited as follows:
- Each agent makes at most two calls per cycle: the cheap model, then one escalation only if the cheap model's answer can't be used.
- There are no other retries.
- No agent can start another agent.
- Cycles are cut off after 60 s, so two never overlap.

Only `index.html`, `404.html`, `house/index.html`, `stats/*.html`, `sitemap.xml` and `styles.css` can be edited. CSS edits may only append; they can't add `url()`, `@import` or expressions, and braces must balance. `functions/`, `evolve/`, `.github/`, `game/`, `world/`, `content.json`, images and all config are protected. An edit is also rejected if it does any of the following:
- adds a script, an inline handler, a `javascript:` or `http://` URL, a form, embed or base tag, or anything that looks like a credential
- changes the count of any tag except one added `<meta>`
- leaves the original finding in place
- creates any new finding

**Rough cost:** a competition is two calls of about 100 tokens in and about 3 out on Haiku, roughly $0.0001. Cycles with nothing to fix cost nothing. With one change in flight at a time, real spend is a few cents a month at most.

**Free-tier fit:**
- Worker: 720 cron runs a day.
- GitHub API: 1 small request per idle cycle.
- KV: about 100 writes a day. State is only saved when something changes, plus a 15-minute heartbeat; the free tier allows 1,000.

## Learning

`stats.kinds` and `stats.fixes` count landed and failed changes. Each count becomes a multiplier, `(ok+1)/(ok+fail+2)×2`, that does three things:
- moves a check kind up or down the priority list
- scales proposal scores, so it changes which agent wins
- drives the heuristic agents' own picks

A remedy that fails 3 times and never lands is retired. Rejected proposals are blocked for 24 h, and accepted ones are never proposed again.

Agent points:
- Accepted: plus the proposal's score.
- Rejected: −(5 + 3×risk).
- Regression: −10.

## Setup (one time)

What you need:
- A Cloudflare account with the existing `mosaicscope` Pages project.
- A GitHub fine-grained token for this repo only, with **Contents: read/write** and **Pull requests: read/write**.
- Optionally, an Anthropic API key. Without one, both agents use local heuristics shaped by their roles, so the engine still works and spends nothing. The dashboard shows `local` instead of a model name.

1. **KV id.** Find the namespace the Pages project binds as `EGG` (Cloudflare → Workers & Pages → KV) and put its id in `evolve/worker/wrangler.toml`.
2. **Deploy the Worker:**
   ```sh
   cd evolve/worker
   npx wrangler deploy
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put EVOLVE_ADMIN_TOKEN      # any long random string
   npx wrangler secret put ANTHROPIC_API_KEY       # optional
   ```
3. **Pages secret.** Add the same `EVOLVE_ADMIN_TOKEN` to the Pages project (Settings → Variables and Secrets) so the dashboard's Pause, Resume and Stop buttons work. Reading the dashboard needs no token.
4. **Optional auto-merge.** GitHub → Settings → Variables → Actions → `EVOLVE_AUTO_MERGE` = `true`. Without it, every change waits for you to merge its PR, and only one waits at a time.
5. **Kick off a first cycle:** open `https://mosaicscope-evolve.<you>.workers.dev/run?key=<EVOLVE_ADMIN_TOKEN>`. After that the cron takes over.

## Running it locally

```sh
node evolve/cli.mjs check          # what the checks see
node evolve/cli.mjs cycle --dry    # a full cycle without writing anything
node evolve/cli.mjs cycle          # a real cycle: commits on an evolve/* branch via a git worktree, verified, rolled back on failure
node evolve/cli.mjs status         # local state (evolve/.state/, git-ignored)
node --test evolve/test/engine.test.mjs
```
