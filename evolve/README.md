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

## Hard limits and safety

Defaults are in `core/config.js`; override any of them with an `EVOLVE_*` variable on the Worker. Budgets are checked **before** each call, using the worst-case cost of the call. Each call is then booked with the token counts the API reports.

| Setting | Default |
|---|---|
| `EVOLVE_INTERVAL_SECONDS` | 120 |
| `EVOLVE_MAX_INPUT_TOKENS` / `EVOLVE_MAX_OUTPUT_TOKENS` | 400 / 8 per call |
| `EVOLVE_DAILY_USD_LIMIT` | 0.10 (estimated) |
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
