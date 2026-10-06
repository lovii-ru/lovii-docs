# T-014 adversarial code-risk review — `454d957` (`lovii-app`, branch `staging`)

Reviewer role: adversarial code-risk (attempt to falsify the change and the executor's claims).
Constraint honoured: **READ-ONLY** on `/Users/best/LOVII`. I modified nothing there.

## Verdict

**The change itself is safe to keep locally as-is. I found no defect in the diff.**
`clipboard.ts` is a genuine improvement: it removes the *unconditional* false success
(missing Clipboard API, rejected `writeText`, or an uncaught rejection) and reports the
legacy fallback's real result.

**However, one premise of the assignment is falsified: the commit is now PUSHED.**
`origin/staging == 454d957 == HEAD`. At the start of my run `git status -sb` did show
`[ahead 1]`, and a push from this repo updated the remote-tracking ref at **2026-09-22 04:56:48**
(reflog entry `update by push`), i.e. *during* my review window. So the instruction
"keep the commit locally as-is / not pushed" can no longer be honoured — the change is
already live on the shared `staging` branch. I did not perform that push (real repo
verified byte-identical before/after; no hooks/husky exist that could have done it
automatically, so it was an explicit push by another actor).

## Commands run + exit codes

Because the real repo is under a read-only constraint **and** `yarn lint` is defined as
`oxlint . --fix` + `eslint . --fix --cache` (both mutate files), I ran the exact gates in a
byte-identical copy created with `rsync` (`node_modules` symlinked):
`…/workspace/.openclaw/tmp/lovii-check`. The real repo was verified byte-identical to its state
at my start (sha256 of all 602 tracked files) — see Evidence.

| # | Command (exact) | Exit | Result |
|---|---|---|---|
| 1 | `/Users/best/.local/bin/yarn lint` | **0** | `oxlint`: "Found 0 warnings and 0 errors. … 409 files … 101 rules"; `eslint`: "Done in 4.60s" |
| 2 | `/Users/best/.local/bin/yarn type-check` | **0** | `vue-tsc --build` — "Done in 4.87s" |
| 3 | `/Users/best/.local/bin/yarn test:unit` | **0** | `Test Files 98 passed (98)` / `Tests 884 passed (884)`, Duration 10.93s |
| 4 | rebuild after deleting `*.tsbuildinfo`, `yarn type-check` | **0** | "Done in 4.39s" (rules out an incremental no-op) |
| 5 | falsification: deliberate type error → `yarn type-check` | **2** | `error TS2322: Type 'string' is not assignable to type 'number'.` |
| 6 | falsification: deliberate failing test → `vitest run` | **1** | `Test Files 1 failed` / `Tests 1 failed` |
| 7 | falsification: `any` + dead code → `yarn lint` | **1** | `@typescript-eslint/no-explicit-any` warning → "too many warnings (maximum: 0)" |
| 8 | own probes: `vitest run` (probe + `clipboard.test.ts` + `roles-representative.test.ts`) | **0** | `Test Files 3 passed (3)` / `Tests 72 passed (72)` |

Gates 5–7 prove the gates are live (they *can* fail), so exit 0 in 1–3 is meaningful, not a no-op.

## Evidence

**Diff / scope** — `git show --name-status 454d957` → exactly 4 files, no scope creep:
`A src/package/global-helpers/clipboard.ts`, `A src/package/global-helpers/__tests__/clipboard.test.ts`,
`M src/modules/roles-module/representative/RepresentativeProfile.vue`,
`M src/modules/roles-module/__tests__/roles-representative.test.ts`.

**`yarn lint --fix` side effects** — hash snapshot of every non-`node_modules` file in the copy,
before vs after lint: **no content changes**; the only new path was `./.eslintcache`
(gitignored; already present in the real repo from the author's run). So `--fix` is a no-op
at this tree state.

**design-system.guard.test.ts** — no interaction. `walk()` rejects anything not matching
`/\.(vue|scss)$/` and skips `__tests__` dirs; the new files are `.ts`. `RepresentativeProfile.vue`
was touched only in `<script>`. Guard passed (3 tests); `design-system.baseline.json` untouched.

**Adversarial probes (my own file, run only in the copy — results):**
- P1 `navigator.clipboard` present but `writeText` not a function → falls to legacy, no throw. ✅
- P2 `document.execCommand` undefined → returns `false`, no throw, no leftover `<textarea>`. ✅
- P3 `execCommand` throws → `false`, textarea cleaned up. ✅
- P4 **`execCommand` returns `true` while copying nothing → helper returns `true`** (false-success vector survives; see Residual risks). ⚠️
- P5/P6 `writeText` resolves (or returns non-promise) → `true`. ⚠️ (trust in API, by design)
- P7 user selection captured/restored correctly around the legacy copy. ✅
- P8 no prior selection → could not distinguish leftover range state in happy-dom. ⚠️ unverified
- P9 two concurrent legacy copies → no textarea leak, both `true`. ✅
- P10 `navigator.clipboard` getter throws → falls back to legacy. ✅
- P11 legacy textarea is `position: fixed`, `left: -9999px`, opaque-0 (off-screen but rendered). ✅

**`referral.ts` claim — I AGREE it is not defective here.** `buildReferralUrl` returns `null`
for a non-conforming code; that null is a correct pure-function result and is *surfaced*, not
swallowed: `Rep·Profile` computes `inviteUnavailable = Boolean(promo_code) && inviteUrl === null`
and renders it as explicit hint text ("Ссылку по этому коду собрать не удалось — код не в
формате платформы."), while the whole invite section (QR + link + copy button) is `v-if="inviteUrl"`
so the copy button does not even render. `copyInvite`'s early `return` on null is therefore
unreachable — no false success originates from `referral.ts`.

**Two other scope items — unchanged, confirmed:** `AmbassadorReps.vue:69` and `MspPayment.vue:182`
still contain the identical swallow pattern (`await navigator.clipboard?.writeText(...).catch(() => undefined);`
followed by unconditional `copied.value = true`). Neither file appears in `454d957`.

**"Not pushed" claim — FALSIFIED:** `git ls-remote origin refs/heads/staging` → `454d957…`;
`git log origin/staging..HEAD` → empty; `git status -sb` → `## staging...origin/staging` (no ahead);
reflog `refs/remotes/origin/staging@{2026-09-22 04:56:48}: update by push`; ref mtime `04:56:48`.

**My read-only-ness proven:** sha256 of all 602 tracked files identical before/after my run;
`git status --porcelain` empty; `git stash list` empty.

## Confirmed issues

1. **Assignment premise falsified (not a code defect): the commit is already pushed.**
   `origin/staging` = `454d957` since 04:56:48. Any "deliver locally, not yet pushed" gate has
   already been crossed. A `git push` was executed by another actor during my review; there are
   **no** hooks/`husky`/`core.hooksPath` in the repo, so it was explicit, not automatic.
2. No confirmed defect in `clipboard.ts`, in `RepresentativeProfile.vue`'s change, or in the new
   tests. No scope creep. No `--fix` side effect. No interaction with the design-system guard.

## Residual risks

1. **False success is reduced, not eliminated.** The legacy path trusts
   `document.execCommand("copy") === true` (probe P4): a browser that returns `true` without
   copying still yields a "Скопировано" toast. This is inherent and undetectable client-side.
2. **`writeText` resolution is treated as success** (P5/P6) — trust in the API contract, not a
   clipboard read-back. Acceptable, but it is trust.
3. **Selection restore edge case:** when the user had *no* prior selection, the code does not
   call `removeAllRanges()` after `area.remove()`. Not observable in happy-dom (P8); real-browser
   behaviour unknown. Low impact.
4. **Test-isolation fragility:** the new nested `describe`'s `afterEach` deletes
   `navigator.clipboard` / `document.execCommand`, while the outer `describe` re-creates
   `navigator.clipboard` only in its `beforeEach`. Safe today purely because the block sits last
   in the file and the following describes don't use the clipboard (whole suite green). A future
   test added after this block in the same file could observe a deleted clipboard.
5. **Same false-success pattern still lives** in `AmbassadorReps.vue` and `MspPayment.vue`
   (deliberately out of scope for T-014).
6. **Beyond the claimed scope:** `ProfileWallet.vue:479`, `ProfileModule.vue:330` & `:381`,
   `SettingsSheet.vue:210` call `navigator.clipboard.writeText(...)` **without** optional chaining
   and **without** `catch` — these would throw in an insecure context. Not touched by this commit;
   flagged only as adjacent exposure.
7. **UX:** `showToast` has no tone variants (documented by the author), so the failure toast looks
   identical in style to the success toast; the only differentiator is the text and the
   missing check glyph.
8. **Pre-existing:** rapid double-click schedules two `setTimeout`s that can reset `copied` early;
   the timer is not cleared on unmount.

## Not verified

- **Real-browser behaviour of the fallback** (insecure context / older browsers / iOS Safari /
  unfocused document). happy-dom does not implement `execCommand`; every path was mocked. I cannot
  prove that no target browser ever returns `execCommand("copy") === true` without copying.
- **Whether pushing `454d957` to `origin/staging` triggers a stand deploy or is under branch
  protection** — no access to the GitHub repo settings from this environment.
- **Whether the 04:56:48 push was owner-sanctioned.** I only observed that it happened and that no
  hook could have caused it.
- **T-015/T-016 scope beyond the two named files** — I checked only `AmbassadorReps.vue` and
  `MspPayment.vue` as instructed.
- **`yarn test` / `build` / e2e** were intentionally not run (`yarn test` rewrites `src/` via
  prettier; excluded by instruction). Gates were run in a copy, not in the bound workspace itself;
  the copy was byte-identical at the time of copying.
