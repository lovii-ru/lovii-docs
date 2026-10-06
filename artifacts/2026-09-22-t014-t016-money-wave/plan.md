# plan.md — LOVII money-wave tasks T-014 (п.1), T-015, T-016

taskId: lovii-money-wave-t014-t016-20260922
Bound coding workspace: /Users/best/LOVII (repos: lovii-core, lovii-app, lovii_docs)
Request language: Russian. Delivery form: HTML report under control-workspace DELIVERY/.

## Ground truth (observed, this session)
- lovii-core @ staging = 16e062b, working tree clean, in sync with origin/staging.
- lovii-app  @ staging = fe8af79, working tree clean, in sync with origin/staging.
- lovii_docs @ main    = 1ae6fc1 (mirror/main, 2026-09-21 15:37), in sync.
- Cards T-014/T-015/T-016 and FINDINGS F-058/F-059 are ABSENT from every accessible clone/object.
- Code targets exist: see below.
- Tooling: node v26.5.1, bun 1.3.14 present; php/composer ABSENT; docker 29.4.0 present.

## Workstreams (one subtask = one subagent)
1. T-014 п.1 (app): clipboard-фолбэк в кабинете представителя.
   - Targets: src/modules/roles-module/representative/RepresentativeProfile.vue (line ~79 copyInvite),
     src/package/global-helpers/referral.ts (формат-гейт).
2. T-015 (core): OTP-маска +7 000ХХХ-ХХ-ХХ → код владельцу выбранным каналом.
   - Targets: app/Domain/Auth/Services/OtpService.php, OtpSenderRegistry.php, app/Infrastructure/Auth/{Senders,Transports,Strategies},
     config/otp.php. Redirect ONLY in transport layer; env-gate non-prod; log each redirect; prod forbids mask.
3. T-016 (core): console command — сброс подписки штатными переходами машины состояний + перевыпуск промокода (roles:issue-promo reused).
   - Targets: app/Domain/Subscription/Services/SubscriptionStatusMachine.php, Enums/SubscriptionStatus.php,
     app/Console/Commands/IssueRepresentativeCodeCommand.php, app/Domain/Roles/Services/RepresentativePromoService.php.
     No direct UPDATE; env-gate non-prod.

## Dependency graph
- Round 1 (read-only grounding): subagent_01 (OTP), subagent_02 (subscription+promo), subagent_03 (app clipboard/referral), subagent_04 (canon/fact-check).
- Round 2 (mutation): zcode_run implements workstreams 1–3 on local branches, local commits, NO push.
- Round 3 (verification): review subagents per dimension (code risk, env-gating/security, regression).
- Round 4: assembly + HTML report into DELIVERY/.

## Review items
- Env-gating is real non-prod gating and defaults to safe (prod) behaviour.
- No direct DB UPDATE; subscription changes only through SubscriptionStatusMachine valid transitions.
- OTP redirect only in transport layer; every redirect logged; mask rejected on prod.
- Clipboard path never reports false success.
- Local gates green; diffs minimal and scoped.

## Delivery items
- HTML report (control-workspace DELIVERY/) with diffs, gate evidence, gaps: missing cards, staging runs, push decision.

## cluster_bypass_reason
- (none) — sessions_spawn used.
