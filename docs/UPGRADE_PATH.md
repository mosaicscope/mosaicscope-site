# Upgrade path

A step-by-step plan for the next round of upgrades to the MosaicScope site and the
Mosaics' world (`game/`). Each phase lists what is done, what is open, how to check it,
and what to do if it goes wrong. Nothing here changes the live site until it is merged.

---

## 0. Where things stand

| Area | State | Evidence |
|---|---|---|
| Game toolchain | Upgraded: vite 8.3.4, vitest 5.0.4, typescript 7.0.2, vite-node 6.0.0, @types/node 26.6.5, playwright-core 1.64.0 | `game/package.json`, commits `91209aa` and `b0d6cdb` |
| Typecheck, tests, build | Passing: 38 test files, 519 tests | last run before the footer change |
| Footer crew | Changed: visitors now see the full crew (up to the screen-width cap) from the first visit | `main.js`, the `start` and `want` lines in the stage code |
| Footer dance | Not verified: the code exists, but no broken line has been found | `main.js` `react` and party mode; `game/src/ai/*` |
| Music | Candidate found, not wired in | tallbeard Music Loop Bundle (CC0 per developer devlog) |
| Sprites | Candidate found, not wired in | Devil's Work.shop Isometric Road Blocks (CC0) |
| Pull request | Open: #83, base `main`, not merged | github.com/mosaicscope/mosaicscope-site/pull/83 |
| Branch name | Assigned by the session: `claude/amazing-tesla-xv0jib` | cannot be renamed without a new branch and PR |

---

## 1. Verify the current state before changing anything

1. Check out the branch and confirm it is clean.
2. In `game/`, run `npm ci` so the lockfile is used exactly.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Run `node --check main.js` in the repo root for the footer script.
5. Check the PR's Cloudflare preview and CI state.

**Done when:** all of the above pass on the commit being shipped. If one fails, stop and
fix it on the branch first. Do not stack new work on a red base.

---

## 2. Footer: crew and people

**What changed:** the starting crew used to be `2 + floor(hung / 12)`, so a new visitor
saw 2 people and the crew grew by one every 12 visible seconds. It now starts at the
screen-width cap (`max`: 5 on phones under 420px, 7 on medium screens, 10 on wide
screens), and the crew stays at that count.

**How to check:**

1. Open the site in a private window on a phone-width viewport. Expect 5 people in the
   footer stage straight away.
2. Open it on a desktop-width viewport. Expect up to 10.
3. Confirm the label reads `n/max here`, with `n` equal to `max`.

**If it goes wrong:** revert the two lines to:

```js
var start = Math.min(max, 2 + Math.floor(hung / 12));
var want = Math.min(max, 2 + Math.floor(hung / 12));
```

**Open question:** the original ramp (new people arrive over time) may have been the
intended design. If so, keep the change small and put the ramp back for returning visitors
only. Ask before doing that.

---

## 3. Footer: dance and movement

**Status:** not confirmed as broken. The code paths are:

- `main.js` `react` and the party branch, which set `is-party` and the dance pose.
- `game/src/ai/steps.ts` `case "dance"`, which keeps dancers on the dance floor.
- `game/src/ai/brain.ts`, which sets the dance pose near the stage point during a party.

**To settle it:** get a screen recording of the footer on a real phone and on a desktop.
Note which people are missing or still and what they should be doing. Then match each
symptom to one of the paths above.

**Do not** change the dance logic in `game/` to fix a footer symptom. The footer and the
world are separate code.

---

## 4. Music

**Candidate:** tallbeard, *Music Loop Bundle* (itch.io, over 200 seamless loops, CC0 per
the developer's devlog).

**Steps:**

1. Download the bundle at a $0 price. Keep the license text with the files.
2. Pick a small set of loops that fit the mood (lofi, slow, warm). The game's own music
   is set up by scene; swap a few loops in one scene first.
3. Put the files under `game/public/audio/` (or the path the audio loader uses), and keep
   the licence file beside them.
4. Check the audio loader in `game/src/audio/` loads the new files. Confirm the mute and
   volume controls still work.
5. Run the build and the tests. Listen in a browser on desktop and on a phone.

**Keep** the synthesized sound effects. The swap is for music only.

**Licence rule:** the developer changed a licence once before. Check the licence on the
download page on the day you download, not from memory.

---

## 5. Sprites

**Candidate:** Devil's Work.shop, *Isometric Road Blocks* (60 PNG assets, 128×128, CC0).

**Fit:** good for roads and blocks, not for full buildings. The game draws its buildings
in code, so these would replace only the road and block tiles.

**Steps:**

1. Download and check the licence file.
2. Pick the tile set that matches the current palette. Test three tiles in one district
   first.
3. Keep the existing code-drawn art as the fallback, so a missing file never shows a blank
   tile.
4. Check the 2D street view (`render/Street2D.ts`) and the 3D view still line up.

**Do not** replace all art at once. A partial swap that works is worth more than a full
swap that breaks the view.

---

## 6. Branch, author, and pull request

- The branch name `claude/amazing-tesla-xv0jib` was assigned by the session. Renaming it
  means a new branch, a new PR, and closing #83. Do this only if you ask for it.
- Commits are authored as `Claude <noreply@anthropic.com>`. To change the author, set
  `git config user.name` and `user.email` before the next commit, and say so in the PR.
- Merging to `main` publishes the site (Cloudflare Pages). Merge only after the checks in
  section 1 pass and the preview has been looked at.

---

## 7. Release and rollback

1. Open or update the PR with a summary of every change in this document.
2. Wait for the Cloudflare preview. Look at the footer on phone and desktop widths.
3. Merge to `main` once you are happy.
4. If the live site is wrong, revert the merge commit on `main` with a new commit. Do not
   force-push `main`.

**Rollback order:** footer change (section 2) first, since it is two lines. Then music and
sprites, which are separate assets. Dependency upgrades (section 0) last, since reverting
them touches the lockfile.

---

## 8. Known risks

- **Vite 8 and TypeScript 7** are new majors. Typecheck, tests and the build pass, but
  the game has not been checked in a browser since the upgrade.
- **Bundle size:** the build warns that the main chunk is over 500 kB. Splitting it is a
  separate task and is not part of this plan.
- **Peer dependencies:** `vitest` 5 needed `vite` 6 or newer. Keep them in step if either
  is upgraded.
- **Licences** can change after a download is found. Re-check before each release.

---

## 9. Done checklist

- [ ] Section 1 checks pass on the shipping commit.
- [ ] Footer crew matches the agreed behaviour on phone and desktop.
- [ ] Footer dance symptoms are either fixed or written up with a recording.
- [ ] Music loops are wired in, with licence files kept beside them.
- [ ] Sprite tiles are wired in for the test district, with the code-drawn fallback kept.
- [ ] PR updated with a summary of every change.
- [ ] Preview checked on phone and desktop.
- [ ] Merged, or left open with a note on what is still blocking.
