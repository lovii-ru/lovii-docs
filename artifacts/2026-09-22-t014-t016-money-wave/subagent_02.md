# subagent_02 — T-016: как консольная команда должна сбрасывать подписку представителя через машину состояний и перевыдавать личный промокод

Role perspective: code risk / implementation feasibility (read-only analysis of `lovii-core`).
Repo: `/Users/best/LOVII/lovii-core` (branch `staging`, HEAD `16e062b` "fix(chargeback): статус платежа переводится в chargeback (T-014 приёмка)", working tree clean at time of reading). All paths below are relative to that repo root. No files were modified; PHP/composer/docker were not executed.

---

## Conclusion

1. **A single console command can legally bring any current status to the reset target, because the reset target must be `Active`, and `Active` is reachable by exactly one transition from every other status** (`GracePeriod→Active`, `Suspended→Active`, `Cancelled→Active`). There is **no status from which the target `Active` is unreachable** in the declared transition graph.
2. **The trap is `Active→Active`: it is NOT a declared transition**, so a command that unconditionally calls `transition($sub, Active, ...)` will throw `BusinessException('invalid_status_transition')` when the subscription is already `Active`. A reset command must branch: transition only when the current status is not `Active`.
3. **The state machine alone cannot produce a "clean/fresh" row.** `transition()` never clears `suspended_at` or `cancelled_at` on the way back to `Active` (it only clears `grace_ends_at`), and it **never touches `current_period_started_at` / `current_period_ends_at` at all**. A truly clean reset therefore requires the same residual attribute write that the existing billing code already uses (`forceFill([...])->save()`), i.e. "no direct UPDATE" can only be read as "do not write the **status** column directly / do not bypass the machine for status", not "never touch any column".
4. **Promo reissue should be done by injecting `RepresentativePromoService` and calling `issue($user, $prefix)`** (the exact pattern already used by `SubscriptionBillingService`), not by shelling out to `roles:issue-promo` (which needs a phone argument and adds a second process). `issue()` already deactivates the previous active code and creates the new one inside one transaction, so it satisfies "reuse `roles:issue-promo`" at the behaviour level.
5. **There is no existing env-gate convention in any console command** (none of the ~25 commands checks `APP_ENV`), but the codebase-wide non-prod gate idiom is `app()->environment('production')` / `config('payments.fake') === true && ! app()->environment('production')`. A non-prod gate for T-016 should mirror `FakePaymentNotifyController` / `AppServiceProvider` and refuse (FAILURE) on `production`, allowing `local`/`staging`/`testing`.
6. Main integrity risk: partial failure across a multi-step sequence, and the **absence of an audit row when the subscription is already `Active`** (no transition happens, so no `subscription_status_changes` row records the reset).

---

## Evidence (file:line)

### 1. State machine — allowed transitions
- `app/Domain/Subscription/Enums/SubscriptionStatus.php:38-50` — `allowedTransitions()`:
  - `Active => [GracePeriod, Cancelled]` (line 42)
  - `GracePeriod => [Active, Suspended]` (line 44)
  - `Suspended => [Active]` (line 46)
  - `Cancelled => [Active]` (line 48)
- `app/Domain/Subscription/Enums/SubscriptionStatus.php:52-55` — `canTransitionTo()` is exactly `in_array($next, $this->allowedTransitions(), true)`.
- Enum cases: `Active='active'` (17), `GracePeriod='grace_period'` (20), `Suspended='suspended'` (23), `Cancelled='cancelled'` (26).
- `grantsBenefits()` (62-68): true only for `Active` + `GracePeriod`.
- Confirmed by tests: `tests/Unit/Domain/Subscription/SubscriptionStatusTest.php:7-22` (Active→grace/cancelled only; `Active->canTransitionTo(Suspended)` is false; grace→{active,suspended}; suspended/cancelled→active only).

### 2. Machine service
- `app/Domain/Subscription/Services/SubscriptionStatusMachine.php:37-83` — `start(User, priceKopecks, priceSource='standard', promoCode=null, periodStart=null, periodEnd=null, actorType='system', actorId=null, meta=[])`:
  - throws `subscription_exists` (409) if `$user->subscription()->exists()` (48-54);
  - defaults period to `now()` … `+1 month` (56-58);
  - creates the subscription with `status=Active` (61-69) and a status-change row with `from=null, to='active', reason='payment_confirmed'` (71-79).
- `SubscriptionStatusMachine.php:88-141` — `transition($subscription, $to, $reason, $actorType='system', $actorId=null, $meta=[])`:
  - reads `$from = $subscription->status` (96);
  - **throws `BusinessException('invalid_status_transition')`** if `! $from->canTransitionTo($to)` (98-103) — thrown **before** the transaction;
  - atomic `DB::transaction` (105): fills `status` (106), sets `suspended_at ?? now()` on →Suspended (108-110), `cancelled_at ?? now()` on →Cancelled (112-114), `grace_ends_at = now()+grace_period_hours` on →GracePeriod (118-120), clears `grace_ends_at` when leaving grace (123-125), saves (127), writes a `SubscriptionStatusChange` row (129-137).
  - **Never sets/clears `suspended_at`/`cancelled_at` when the target is `Active`**, and **never touches `current_period_*`**.
- Reasons documented at `SubscriptionStatusMachine.php:21-26`: `payment_confirmed`, `payment_failed`, `grace_expired`, `user_cancelled`, `admin_action` — `reason` is a free string (no enum validation in code).
- `BusinessException` signature: `app/Domain/Shared/Exceptions/BusinessException.php:19-31` — `(string $errorCode, string $message='', int $statusCode=422, array $context=[])`, extends `RuntimeException`.

### 3. Models / schema
- `app/Models/Core/Subscription.php:40-51` — fillable: `user_id, status, price_kopecks, price_source, promo_code, current_period_started_at, current_period_ends_at, grace_ends_at, suspended_at, cancelled_at`.
- `app/Models/Core/Subscription.php:64-76` — casts: `status => SubscriptionStatus::class`, `price_kopecks => integer`, `current_period_started_at/current_period_ends_at/grace_ends_at/suspended_at/cancelled_at => datetime`. No `promo_code` cast.
- `app/Models/Core/Subscription.php:59-62` — `statusChanges()` HasMany.
- `app/Models/Core/SubscriptionStatusChange.php:32-39` — `$timestamps = false` (append-only, created_at only), `$guarded = ['id']`, casts `meta => array`, `created_at => datetime`.
- Migration `database/migrations/2026_09_18_120000_create_subscriptions_tables.php`:
  - `subscriptions` columns (22-42), including `status` default `active` (25), `price_source` default `standard` (29), `promo_code` nullable (31), `current_period_*` NOT NULL (33-34), `grace_ends_at/suspended_at/cancelled_at` nullable (36-38), **`unique('user_id')`** (41).
  - `subscription_status_changes` (46-58): `from` nullable (null = creation), `to`, `reason` varchar(40) (51), `actor_type` default `system` (52), `actor_id` nullable (53), `meta` jsonb (54), `created_at` (55).

### 4. Promo reissue
- `app/Console/Commands/IssueRepresentativeCodeCommand.php:19` — signature `roles:issue-promo {phone} {--prefix=}`; `handle(RepresentativePromoService $service)` (23) resolves the user by phone (27-33), calls `$service->issue($user, $this->option('prefix'))` (36), catches `RuntimeException` (37-41), prints code/prefix (43) and QR link (44), returns `self::SUCCESS`/`self::FAILURE`.
- `app/Domain/Roles/Services/RepresentativePromoService.php:32-54` — `issue(User $representative, ?string $prefix = null)`:
  - uppercases prefix, default `AA` (`FOUNDER_PREFIX`, 23) (34);
  - `assertPrefixExists($prefix)` (36) — non-`AA` prefix must exist as an **active** `Ambassador` row (`prefix`, `is_active=true`), else `RuntimeException('Ветка с префиксом «%s» не найдена.')` (56-68);
  - inside `DB::transaction` (38): **deactivates the previous active code** `update(['is_active' => false])` for this user (39-42), generates a unique suffix (44, 70-89), creates the new active code (46-52). Returns the new `RepresentativePromoCode`.
  - Class is `final readonly` → injectable as a singleton; no state.
- `app/Models/Core/RepresentativePromoCode.php:36` — `ALPHABET`, `:38` `$guarded=['id']`, `:40` table `representative_promo_codes`, `:49-54` `is_active => boolean`.
- Precedent of "inject the service" (not call the command): `app/Domain/Subscription/Services/SubscriptionBillingService.php:41` injects `RepresentativePromoService`; used at `:243-263` `issuePersonalCode()` which (a) returns early if `$user->activePromoCode()` already exists (245-247), (b) derives prefix from `users.promo_code` first 2 chars else `FOUNDER_PREFIX` (249-251), (c) on `RuntimeException` **falls back** to `FOUNDER_PREFIX` (253-262). `IssueRepresentativeCodeCommand` is the only other caller.
- `app/Models/Core/User.php:97` `activePromoCode()`, `:114` `subscription()`, `:142` `isRepresentative()`.

### 5. Console command conventions
- All commands are `final class X extends Command` with `protected $signature`, `protected $description`, `public function handle(...): int` and return `self::SUCCESS` / `self::FAILURE`. Examples: `app/Console/Commands/IssueRepresentativeCodeCommand.php:17-47`; `app/Console/Commands/BackfillKuperPartnersCommand.php:25-87` (returns `FAILURE` if any item failed); `app/Console/Commands/RepairBranchWorkingDataCommand.php:65-154`.
- DI into `handle()` is standard: `handle(CardNumberIssuer $issuer)` (`BackfillCardsCommand.php:28`), `handle(SubscriptionBillingService $billing)` (`ChargeSubscriptionsCommand.php:21`), `handle(PartnerProvisioner $provisioner)` (`BackfillKuperPartnersCommand.php:25`).
- Output helpers: `$this->info(...)`, `$this->line(...)`, `$this->warn(...)`, `$this->error(...)`, `$this->table(...)`, `$this->newLine()` (e.g. `BackfillKuperPartnersCommand.php:28,46,75,84,86`).
- Destructive/risky commands default to **dry-run/`--apply`** with an explicit flag and a JSON backup: `RepairBranchWorkingDataCommand.php:58-61` (signature), `:125-129` (preview default), `:131` + `:310-345` (backup before writes). `--dry-run` also in `BackfillKuperPartnersCommand.php:19,33,62`.
- Commands are auto-discovered from `app/Console/Commands` (Laravel `^13.2` per `composer.json:16`; `bootstrap/app.php:25-36` only wires routing, no `withCommands` override). Scheduling lives in `routes/console.php`. `SubscriptionStatusMachine` uses `$this->argument()/`$this->option()` style (`IssueRepresentativeCodeCommand.php:25,36`).

### 6. Env-gating conventions
- **No console command currently gates on environment** — grep over `app/Console/Commands/*.php` for `environment|APP_ENV|--force|confirm(` returns only `ImportIntegrationMappingsCommand.php:23` (`--with-internal-ids`, unrelated).
- The codebase non-prod idiom is `app()->environment('production')`:
  - `app/Providers/AppServiceProvider.php:74` — `if (config('payments.fake') === true && ! $this->app->environment('production'))`;
  - `app/Http/Controllers/Api/V1/Payment/FakePaymentNotifyController.php:29` — `throw_if(config('payments.fake') !== true || app()->environment('production'), BusinessException::class, 'not_found', ...)`;
  - `app/Http/Controllers/Api/V1/Payment/ChannelConsoleController.php:53,65,73` — `app()->environment('local')` and `(string) app()->environment()`;
  - `app/Domain/Payment/Services/PaymentChannelManager.php:46,54,71,115,120` — environment-driven channel selection.
- `config/app.php:31` — `'env' => env('APP_ENV', 'production')`. Staging runs with `APP_ENV=staging` (per `config/horizon.php:228` comment and `app/Http/Middleware/StagingNoIndex.php:13`); tests run `APP_ENV=testing` (`phpunit.xml:24`).
- Feature-flag guard precedent for "capability off": `app/Support/IntegrationsGuard.php:11-14` (`config('integrations.enabled', false)`), used as a command early-exit in `BackfillKuperPartnersCommand.php:27-31` (warn + `SUCCESS`) and as a scheduler `->when()` in `routes/console.php:13`.

### 7. Tests
- Pest (no PHPUnit classes), `tests/Pest.php:21-42` binds `Tests\TestCase` + `RefreshDatabase` for `Feature`/`Unit` and freezes time in `beforeEach`; helper functions live there.
- `phpunit.xml:7-17` suites: `Unit`, `Feature`, `E2e`; `:24` `APP_ENV=testing`; DB `pgsql_core`/`testing` (32-37).
- Subscription unit tests: `tests/Unit/Domain/Subscription/SubscriptionStatusTest.php`, `tests/Unit/Domain/Subscription/SubscriptionStatusMachineTest.php` (start duplicate 34-43; grace 45-59; grace-expiry suspend + `suspended_at` + cleared window 61-70; grace→active clears window + audit row 72-85; cancel stamps `cancelled_at` 87-95; invalid transition atomic 97-110).
- Subscription feature tests: `tests/Feature/Subscription/SubscriptionActivationTest.php` (resume suspended 188, cancelled 222), `SubscriptionBillingTest.php` (grace/suspend/promo-price reset 155-176), `SubscriptionApiTest.php`.
- Console tests: `tests/Feature/Console/` (flat) and `tests/Feature/Console/Commands/` (e.g. `SyncSearchIndexCommandTest.php`). Convention: `$this->artisan('cmd', [...])->assertSuccessful()` / `->assertExitCode(0)` / `->expectsOutputToContain(...)` — see `RepairBranchWorkingDataCommandTest.php:49-59`, `BackfillKuperPartnersCommandTest.php:55,69,80,92`, `MediaCheckOrphanedTest.php:27,49`. Disabled-feature commands are asserted in `tests/Feature/Console/IntegrationsDisabledTest.php:26`.
- Factory: `database/factories/.../SubscriptionFactory.php` with states `promo()` (19900/promo/AM1234), `inGrace()`, `suspended()`, `cancelled()` (36-71).
- Arch rules: `tests/Unit/ArchTest.php:7-13` (`arch()->preset()->php()/strict()->ignoring([ApiResource::class,'App\Models'])/security()`; controllers `not->toBeUsed()`), so new code must satisfy strict/phpstan-level typing.

### 8. Billing precedent for direct attribute writes (the "no direct UPDATE" question)
- `SubscriptionBillingService.php:78-83` — after `transition(..., Suspended, 'grace_expired')`, **directly** `forceFill(['price_kopecks'=>standard, 'price_source'=>'standard', 'promo_code'=>null])->save()`.
- `SubscriptionBillingService.php:215-226` — resume path: `transition(..., Active, 'payment_confirmed')` then `forceFill([price_kopecks, price_source, promo_code, current_period_started_at, current_period_ends_at])->save()`.
- `SubscriptionBillingService.php:481-494` — `renew()`: optional `transition(..., Active, 'payment_confirmed')` (486-488) then `forceFill(['current_period_started_at'=>…, 'current_period_ends_at'=>…])->save()` (490-493).
- So the established pattern is: **status only via the machine; period/price/promo snapshots via `forceFill()->save()`**. No caller uses raw `Subscription::query()->update(['status'=>...])`.

---

## Analysis

### A. What "reset to a clean/fresh state" must be
Fresh = the state `start()` produces (`SubscriptionStatusMachine.php:61-69`): `status=Active`, `current_period_started_at=now`, `current_period_ends_at=now+1 month`, `grace_ends_at=null`, and (for cleanliness) `suspended_at=null`, `cancelled_at=null`, plus price/promo snapshot re-resolved.

Sequence per current status (all legal, single command):
| current | steps | note |
|---|---|---|
| `Active` | **no transition** (`Active→Active` is illegal) + period/flag reset | must branch around the machine |
| `GracePeriod` | `transition(GracePeriod→Active)` (clears `grace_ends_at`) + period reset | 1 legal step |
| `Suspended` | `transition(Suspended→Active)` + clear `suspended_at` + period reset | 1 legal step; `suspended_at` NOT cleared by machine |
| `Cancelled` | `transition(Cancelled→Active)` + clear `cancelled_at` + period reset | 1 legal step; `cancelled_at` NOT cleared by machine |

So: the machine can legally reach the target from **any** status; **no status is unreachable**. The reachability subtlety is the *self-transition* (`Active→Active`) and the *residual timestamps*, not graph connectivity.

If the owner instead meant "reset all the way to a fresh **non-subscribed** state", that is impossible via transitions (`Suspended`/`Cancelled` cannot go to nothing; there is no delete/`null` status) and would require deleting the row — explicitly out of scope for a state-machine reset and contrary to §A2 (resume only by new payment).

### B. `suspended_at` / `cancelled_at` are sticky
`transition()` sets these only on the *inbound* edge (`:108-114`) and never on the outbound edge. Consequence: a subscript that was suspended and resumed keeps `suspended_at` set (it is only cleared if the command writes it). This is visible today: `activate()` resume path (`SubscriptionBillingService.php:219-225`) also does not clear `suspended_at`/`cancelled_at`. A "clean" reset command must clear them explicitly (residual write), otherwise the column state contradicts `status=active`.

### C. `grace_ends_at` is the only field the machine cleans on resume
`SubscriptionStatusMachine.php:118-125`: entering grace sets the window; leaving grace (`from=GracePeriod`, `to≠GracePeriod`) nulls it. `Active→Cancelled` and `Suspended→Active` do not involve grace, so `grace_ends_at` stays `null` there (fine), but a `Cancelled→Active` from a previously-suspended row leaves `suspended_at` and a possibly-`null` `grace_ends_at`.

### D. Invoking the promo reissue
- Preferred: constructor/`handle()` DI of `RepresentativePromoService` and call `issue($user, $prefix)` — same as `SubscriptionBillingService.php:41,254,261`. This keeps one process, one transaction boundary (nested), and lets the command print the returned code.
- Alternative: `$this->call('roles:issue-promo', ['phone' => $user->phone, '--prefix' => $prefix])` — works, but (i) it re-resolves the user by phone, (ii) it does not return the code to the caller, and (iii) its `--prefix` handling means the command must reconstruct the prefix anyway. DI is the convention.
- Prefix choice must mirror billing: take the first 2 chars (uppercased) of the user's bound `users.promo_code`, else `FOUNDER_PREFIX='AA'`; wrap in try/catch and fall back to `AA` on `RuntimeException` (`SubscriptionBillingService.php:249-262`), otherwise a stale branch prefix aborts the whole reset.
- `issue()` already performs "previous code deactivated + new code created" atomically (`RepresentativePromoService.php:38-53`), so the requirement "reissue the personal promo" is met by a single `issue()` call.

### E. Non-prod gate
No precedent inside `app/Console/Commands`, so the command establishes the pattern. Recommended shape consistent with the codebase: read `app()->environment()` (values in use: `local`, `staging`, `production`, `testing`) and refuse with `$this->error(...)` + `return self::FAILURE` when `production`. `IntegrationsGuard` shows the alternative "config flag" style; `FakePaymentNotifyController.php:29` shows the `environment('production')`-guard style. Do **not** silently no-op with `SUCCESS` unless matching `BackfillKuperPartnersCommand.php:27-31` (which returns `SUCCESS` when a feature is disabled) — for a *guard against prod* `FAILURE` is the honest exit code.

---

## Gaps and risks

1. **`Active→Active` is not a declared transition** (`SubscriptionStatus.php:42`). An unconditional `transition($sub, Active, ...)` throws `invalid_status_transition` (`SubscriptionStatusMachine.php:98-103`). The command MUST check `$sub->status === SubscriptionStatus::Active` first.
2. **"Reset" of an already-`Active` subscription produces no audit row.** If the command skips the transition (correct, because it is illegal), nothing is written to `subscription_status_changes` (`SubscriptionStatusMachine.php:129-137` runs only inside `transition()`), so the audit trail cannot prove the reset happened. Mitigations to flag to the owner: (a) walk `Active→Cancelled('user_cancelled')→Active('payment_confirmed')` — legal but semantically false and adds 2 misleading rows; or (b) accept the missing row and rely on command logs; or (c) extend the machine (out of scope for "no code changes to the machine"). The migration comment for `reason` (`…120000…:51`) already lists a free-form `resume` value, and the machine docblock lists `admin_action` (`SubscriptionStatusMachine.php:26`), so a machine-side `resume`/`admin_action` single row would be the clean fix — but that is a machine change, not a command-only change.
3. **"No direct UPDATE" vs period/flag fields.** The machine owns only `status` (+ derived timestamps). Period/price/promo snapshot are *designed* to be set by callers via `forceFill()->save()` (`SubscriptionBillingService.php:79-83,219-225,490-493`). If the owner's rule is literal ("no direct UPDATE on the subscriptions row at all"), then **a full reset is impossible through the existing API** — the machine has no `reset()/resume()` that writes periods. This must be clarified; my reading is that "no direct UPDATE" forbids `->update(['status' => …])` bypassing the machine, which is fully respected by the pattern above.
4. **Residual sticky timestamps**: `suspended_at`/`cancelled_at` are not cleared on →Active (`:108-114`). A "clean" reset requires clearing them explicitly, otherwise state is internally inconsistent (`status=active` while `suspended_at` set).
5. **Partial failure / atomicity.** Each `transition()` is atomic on its own (`:105`), but a command doing `transition()` **then** `forceFill()->save()` **then** `issue()` performs three separate commits. If the promo `issue()` throws (bad prefix and no fallback), the status/period are already committed → inconsistent state, and the old code was already deactivated inside `issue()`'s own transaction only after the prefix check (so a prefix failure aborts before deactivation — good), but the subscription reset would have applied. Recommendation: wrap the whole sequence in a single outer `DB::transaction` (nested transactions become savepoints, so `transition()`'s inner transaction is safe) — matching `activate()` (`SubscriptionBillingService.php:176-233`).
6. **Prefix fallback**: if the reset reissues the promo with the inviter's branch prefix and that branch is no longer an active `Ambassador` (`RepresentativePromoService.php:56-68`), `issue()` throws `RuntimeException`; without a fallback to `AA` the command fails after money-state writes. Mirror `SubscriptionBillingService.php:253-262`.
7. **Uniqueness/absence**: one row per user (`…120000…:41`). The command should `first()` the subscription by user and decide: if none → either refuse or `start()` (start throws `subscription_exists` if one exists). A "reset" command should probably require an existing row and refuse otherwise.
8. **Reason value length**: `reason` is varchar(40) (`…120000…:51`); keep any new reason token short.
9. **Audit append-only discipline**: `SubscriptionStatusChange` is `$timestamps=false`, `$guarded=['id']` (`SubscriptionStatusChange.php:32-34`), documented append-only ("строк не редактируют и не удаляют"). The command must not delete/rewrite history; a reset therefore *adds* rows (or none, see risk 2), never removes.
10. **Env gate**: no existing command precedent; also note `Model::preventLazyLoading` is enabled outside production (`AppServiceProvider.php:133`) — the command should eager-load/refresh carefully (or use `$subscription->user` after `loadMissing`), otherwise tests may trip lazy-loading guards.
11. **Testing gap**: no test asserts a "reset" flow, and no `reason` of `admin_action` is exercised anywhere (grep found only the docblock mention). New behaviour needs new Pest tests under `tests/Feature/Console/` (guarded success, prod refusal, already-active branch, each source status, promo reissue deactivation of the previous code, no partial state on failure).

---

## Suggested placement

Report/brief perspective (this is a read-only feasibility & risk analysis feeding the mainline delivery doc):
- **Conclusion** → top-of-doc "Как команда должна сбрасывать подписку" summary box, right after the T-016 one-liner; state plainly: target = `Active`, one legal transition from any status, self-transition `Active→Active` illegal, machine does not clean period/flag fields.
- **Evidence** → engineering appendix "Факты (file:line)" under the T-016 section; keep the transition table and the machine/model/config line references intact.
- **Analysis** → "Механика сброса" subsection: the per-status sequence table (A), sticky timestamps (B), promo reissue via DI (D), non-prod gate (E).
- **Gaps and risks** → "Риски и открытые вопросы" block of the T-016 section (highest priority: items 2 and 3 — audit row for an already-active reset, and the exact meaning of "no direct UPDATE"); carry them as explicit owner questions in the final delivery.
- Suggested final-DOCX placement: section «T-016 — команда сброса подписки представителя» → subsections «Что должна делать команда» (Conclusion), «Факты кода» (Evidence), «Механика и последовательность переходов» (Analysis), «Риски и решения владельца» (Gaps and risks). If the wave deliverable is a task card (like `lovii_docs/canon/TASKS/T-01x-*.md`), put Conclusion+Analysis into «Что сделать», Evidence into «Опорные факты», and Gaps into «Открытые вопросы» with the two owner decisions (audit row policy, "no direct UPDATE" scope).
