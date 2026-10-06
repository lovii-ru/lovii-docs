# T-015 — OTP delivery path map & mask-redirect feasibility

Repo: `lovii-core` @ HEAD `16e062b` (branch `staging`). Read-only analysis; no PHP/composer available, evidence gathered via `cat`/`grep`/`sed`.
Author: subagent_01 (independent map of the OTP delivery layer).

## Conclusion

1. **There is no `Infrastructure/Auth/Transports/*` layer that all channels share.** That folder contains **MAX transports only** (`LogMaxTransport`, `GreenApiMaxTransport`, `MaxBotApiTransport`). SMS, WhatsApp, Call, Telegram and VK senders deliver directly (logger stub / `TelegramBotApiClient` / `VKApiClient`), not through a transport abstraction.
2. **The single choke point every *primary* channel passes through at delivery time is `OtpSenderContract::send()`**, dispatched by `OtpSenderRegistry::forChannel()` from `SendOtpAction::execute()`. Exact call site: `app/Application/Auth/Actions/SendOtpAction.php:114`. The registry only *selects* a sender (`OtpSenderRegistry.php:20-29`); the `send()` invocation is the one universal delivery line. Each `*Sender` **is** the channel's transport.
3. **The plaintext code and the target phone are both computed in `SendOtpAction` and passed positionally** to `send(string $phone, string $code, ?string $bindingToken)`. `$phone` is the **raw request phone** (`SendOtpController.php:23` → `SendOtpData->phone`), never normalized, never re-read from the session. So a redirect placed on this boundary sees the mask phone as input and can substitute the owner phone.
4. **Caveat that changes the design:** there are **three additional delivery points that bypass `OtpSenderContract`** — MAX `bot_started` webhook, Telegram otp-bot webhook and VK `message_new` — which call `OtpService::reissueCode()` + the transport/client directly. And the mask phone will not have a bot link, so on a real (non-log) transport the primary path **parks the session before ever reaching the sender** (`SendOtpAction.php:65, 82-84, 100-102`). A redirect placed *only* at `OtpSenderContract::send()` therefore will not fire on production-like transports. See Gaps.
5. **Env-gating idiom already exists and is exactly the right shape:** `OTP_DEV_BYPASS` → `config('otp.dev_bypass')` (`config/otp.php:17`), read in `OtpService.php:114`, `OtpDevCodeStore.php:25`, `routes/api.php:178`. Prod vs staging is distinguished by `APP_ENV` (`config/app.php:31` default `production`; staging is `APP_ENV=staging` — `app/Http/Middleware/StagingNoIndex.php:21`, `config/horizon.php:228`), and code guards use `app()->environment('production')` / `app()->isProduction()` (`AppServiceProvider.php:74,133`; `FakePaymentNotifyController.php:29`).
6. **No mask/test-phone concept exists anywhere in `lovii-core`** — zero hits for `+7 000`, `mask`, `test phone` in `app/`, `config/`, `routes/`, `tests/`.
7. **The ASCII mask format `"+7 000ХХХ-ХХ-ХХ"` cannot pass validation as written** — every OTP/phone request validates `regex:/^\+[1-9]\d{7,14}$/` (spaces, dashes and Cyrillic `Х` are rejected). The redirect key must be an E.164 constant (e.g. `+70000000000`); the dashed form is display-only.

## Evidence (file:line)

### 1. HTTP → action
- `routes/api.php:122` `POST /auth/request-code` → `RequestOtpController` (throttle `otp-send`).
- `routes/api.php:123` `POST /auth/send-code` → `SendOtpController` (throttle `otp-send`).
- `routes/api.php:124` `POST /auth/confirm` → `ConfirmOtpController` (throttle `otp-confirm`).
- `routes/api.php:132` `POST /auth/confirm-by-binding` → `ConfirmByBindingController`.
- `routes/api.php:177-180` dev gate: `if (config('otp.dev_bypass')) { Route::get('/dev/otp/last-code', OtpLastCodeController::class); }`.
- `app/Http/Controllers/Api/V1/Auth/SendOtpController.php:19` `OtpChannel::from($request->string('channel')->value())`.
- `app/Http/Controllers/Api/V1/Auth/SendOtpController.php:22-26` builds `SendOtpData(phone: $request->string('phone')->value(), channel: $channel, guestToken: …)` — **raw phone in**.
- `app/Http/Controllers/Api/V1/Auth/RequestOtpController.php:15-28` returns the channel list (delegates to `RequestOtpAction`).

### 2. Action → code generation / session / sender dispatch
- `app/Application/Auth/Actions/SendOtpAction.php:34` `execute(SendOtpData $data)`.
- `…SendOtpAction.php:38-43` resend cooldown gate (`AuthOtpSession::resendCooldownRemains`, `config('otp.resend_cooldown_seconds', 30)`).
- `…SendOtpAction.php:45-48` `User::firstOrCreate(['phone' => $data->phone])` — user keyed by **mask phone**.
- `…SendOtpAction.php:57` `$code = $this->otpService->generateCode($data->channel->codeLength())`.
- `…SendOtpAction.php:59` `$session = $this->otpService->createSession($data->phone, $code, $data->channel, $data->guestToken)` — session keyed by **mask phone**.
- `…SendOtpAction.php:65` MAX linkability gate: `if ($data->channel === OtpChannel::Max && ! $this->maxTransport->accountExists($data->phone))` → `linkRequired()` (returns early, **no delivery**).
- `…SendOtpAction.php:74-85` Telegram gate: token present + `MaxBotLink::forBot(TelegramOtpBotHandler::BOT_SCOPE, $data->phone)` must exist, else park.
- `…SendOtpAction.php:92-103` VK gate: `config('vk.community_token')` + `MaxBotLink::forBot(VKCallbackHandler::BOT_SCOPE, $data->phone)`, else park.
- `…SendOtpAction.php:110-112` stamps a single-use `binding_token`.
- **`…SendOtpAction.php:114` `→` THE CHOKE POINT:** `$this->senderRegistry->forChannel($data->channel)->send($data->phone, $code, (string) $session->binding_token);`
- `…SendOtpAction.php:121` `$session->update(['last_sent_at' => now()])`.
- `…SendOtpAction.php:123` `$this->devCodeStore->store($data->phone, $code)` (dev mirror).
- `…SendOtpAction.php:128-148` `linkRequired()` builds `https://max.ru/…?start=`, `https://t.me/…?start=`, `https://vk.me/…?ref=` deeplinks.

### 3. Domain services
- `app/Domain/Auth/Services/OtpService.php:19-24` `generateCode()` (random, zero-padded).
- `…OtpService.php:26-48` `createSession()` — stores `phone` verbatim, `code_hash = Hash::make($code)`, `channel`, `guest_token`; TTL 10 min; invalidates prior unconfirmed sessions.
- `…OtpService.php:66-78` `reissueCode()` — re-generates + re-hashes code, pushes cooldown (**used by the bot webhooks**).
- `…OtpService.php:107-129` `verifyCode()`; `…:113-118` **universal bypass** `config('otp.dev_bypass') && $code === '1234'` (const `DEV_UNIVERSAL_CODE = '1234'` at `:17`).
- `app/Domain/Auth/Services/OtpSenderRegistry.php:20-29` `forChannel()` — linear scan over injected senders, throws `RuntimeException('No OTP sender registered for channel […].')`.

### 4. Contract & senders
- `app/Domain/Auth/Contracts/OtpSenderContract.php:9-22` — `channel(): OtpChannel`; `send(string $phone, string $code, ?string $bindingToken = null): void` (docblock: `$phone` = "E.164 phone of the session owner"; `$code` = "plaintext OTP code (delivered here only)").
- `app/Infrastructure/Auth/Senders/MaxSender.php:31-43` → `MaxTransportContract::sendMessage($phone, sprintf(OTP_MESSAGE_TEMPLATE, $code))` (`:42`); guard `:33-35`.
- `app/Infrastructure/Auth/Senders/SmsSender.php:25-29` — **log stub only** (`logger()->info('SMS OTP for …')`; docblock `:10-17` forbids integrating an SMS provider).
- `app/Infrastructure/Auth/Senders/WhatsAppSender.php:17-21` — log stub.
- `app/Infrastructure/Auth/Senders/CallSender.php:17-23` — log stub (flash-call TODO).
- `app/Infrastructure/Auth/Senders/TelegramSender.php:43-68` → `MaxBotLink::forBot(telegram:otp, $phone)` guard (`:45-49`) then `(new TelegramBotApiClient('otp'))->sendOtpCodeMessage($link->chat_id, …, $code, $loginUrl)` (`:51-67`). **Direct client, no transport.**
- `app/Infrastructure/Auth/Senders/VKontakteSender.php:38-47` → `MaxBotLink::forBot(vk:otp, $phone)` guard then `(new VKApiClient)->sendMessage($link->chat_id, …)` (`:46`). **Direct client, no transport.**

### 5. Transports (MAX-only)
- `app/Domain/Auth/Contracts/MaxTransportContract.php:7-14` — `accountExists(phone): bool`, `sendMessage(phone, message): void`.
- `app/Infrastructure/Auth/Transports/LogMaxTransport.php:11-21` — `accountExists` always `true`; `sendMessage` logs.
- `app/Infrastructure/Auth/Transports/MaxBotApiTransport.php:35-53` — `accountExists` = `MaxBotLink` lookup; `sendMessage` → `MaxBotApiClient::sendMessageToUser`; also `sendMessageWithContactButton*` (`:60-89`).
- `app/Infrastructure/Auth/Transports/GreenApiMaxTransport.php` — Green-API implementation (see `SendersTest` cases).
- Binding: `app/Providers/AppServiceProvider.php:92-101` `MaxTransportContract` → `match(config('otp.channels.max.transport'))` `green_api` | `bot_api` | default `LogMaxTransport`.
- Registry wiring: `app/Providers/AppServiceProvider.php:103-110` `OtpSenderRegistry([MaxSender, SmsSender, WhatsAppSender, TelegramSender, VKontakteSender, CallSender])`.

### 6. Second/third delivery points that bypass `OtpSenderContract`
- `app/Http/Controllers/Api/V1/Auth/MaxWebhookController.php:110` `reissueCode(...)`; `:113` `maxTransport->sendMessageWithContactButton($session->phone, …)`; `:114-116` success log; `:117-120` failure `logger()->warning`.
- `app/Application/TelegramBot/Handlers/TelegramOtpBotHandler.php:144` `reissueCode(...)`; `:151-156` `client->sendOtpCodeMessage($chatId, …, $code, MagicLoginLink::…)`.
- `app/Application/VK/Handlers/VKCallbackHandler.php:172` `reissueCode(...)`; `:174` `reply($vkUserId, sprintf(CODE_MESSAGE_TEMPLATE, $code))` → `:199` `client->sendMessage`.

### 7. Env / prod-gating conventions
- `config/app.php:31` `'env' => env('APP_ENV', 'production')` (default is **production**).
- `.env.example:2` `APP_ENV=local`; `.env:2` `APP_ENV=local`; staging uses `APP_ENV=staging` (`app/Http/Middleware/StagingNoIndex.php:13,21`; `config/horizon.php:228`).
- `config/otp.php:17` `'dev_bypass' => env('OTP_DEV_BYPASS', true)` — note **default true**; `.env.example:94` and `.env:85` set `OTP_DEV_BYPASS=true`.
- `config/otp.php:84-102` sibling flags: `OTP_CODE_LENGTH`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`.
- `config/otp.php:63-69` `coming_soon.*` = `env('OTP_*_COMING_SOON', …)`; `config/otp.php:115-149` `channels.*` = `env('OTP_*_PROVIDER'/'OTP_MAX_TRANSPORT', …)`.
- Prod guards: `app/Providers/AppServiceProvider.php:74` `config('payments.fake') === true && ! $this->app->environment('production')`; `:133` `! $this->app->isProduction()`; `app/Http/Controllers/Api/V1/Payment/FakePaymentNotifyController.php:29` `throw_if(config('payments.fake') !== true || app()->environment('production'), …)`.
- Rate-limit config read the same way: `AppServiceProvider.php:166-181` (`otp.rate_limit.*`).

### 8. Logging conventions (Auth)
- Helper `logger()` dominant in infra: `SmsSender.php:28`, `WhatsAppSender.php:20`, `CallSender.php:22`, `LogMaxTransport.php:13,20`.
- Facade `Log::` used where imported: `VKCallbackHandler.php:189` (`Log::info`), `:203` (`Log::warning`).
- MAX webhook uses `logger()->info`/`logger()->warning` (`MaxWebhookController.php:96,114,119`).
- No dedicated channel is defined or used: `config/logging.php:23` default `stack` → `single`; **zero** `Log::channel(...)` / `Log::stack(...)` usages repo-wide.
- `OtpDevCodeStore` (`app/Infrastructure/Auth/OtpDevCodeStore.php:19-40`): mirrors last code to cache `otp:dev-last-code:<phone>` **only when `config('otp.dev_bypass')`** (`:25-27`); `<`ttl = `otp.ttl_minutes`>`. Read by `OtpLastCodeController.php:20` (`recall`).

### 9. Tests / conventions (Pest)
- `tests/Pest.php:21-42` — global `RefreshDatabase`, `Http::preventStrayRequests()`, `Sleep::fake()`, frozen time, and `config()->set('otp.resend_cooldown_seconds', 0)` + relaxed `otp.rate_limit.*` per test.
- `tests/Feature/Auth/OtpDevCodeTest.php` — **model for a dev-gated feature**: end-to-end send-code → dev last-code → confirm; `:44-47` phone-format 422; `:49-58` `config(['otp.dev_bypass' => false])` → 404.
- `tests/Feature/Auth/OtpAuthTest.php:21-30` asserts the offered channel list is exactly `['max','telegram']`; `:38-96` per-channel delivery (Telegram via `Http::fake` on `api.telegram.org`, VK via `Http::fake` on `api.vk.com`); `:81-95` call/sms/whatsapp accepted but log-stub.
- `tests/Unit/Infrastructure/Auth/Senders/SendersTest.php` — `mock(MaxTransportContract::class)`, `Log::shouldReceive('info')`, direct `new MaxSender($transport)`; `:114-118` unknown-channel `RuntimeException`.
- `tests/Unit/MiscTest.php:78-81` registry happy-path; `tests/Unit/Domain/Auth/Enums/OtpChannelCodeLengthTest.php` config-driven length.

### 10. Phone validation (single convention, duplicated)
`regex:/^\+[1-9]\d{7,14}$/` in: `app/Http/Requests/Api/V1/SendOtpRequest.php:17`, `RequestOtpRequest.php:15`, `ConfirmOtpRequest.php:15`, `CreatePartnerApplicationRequest.php:31`, `app/Http/Controllers/Api/V1/Dev/OtpLastCodeController.php:17`. **No normalization** anywhere (no `preg_replace`/`str_replace` on phone) — raw E.164 only.

## Analysis

**Chain (primary path):**
`routes/api.php:123` → `SendOtpController:22` (`SendOtpData`, raw phone) → `SendOtpAction:34` → cooldown (`:38`) → `User::firstOrCreate(phone=mask)` (`:45`) → `generateCode()` (`:57`) → `createSession(phone=mask)` (`:59`) → **[MAX/TG/VK linkability gates `:65/:82/:100`]** → `binding_token` (`:110`) → **`OtpSenderRegistry:20` → `OtpSenderContract::send(maskPhone, code, token)` `SendOtpAction:114`** → concrete sender → (MAX) `MaxTransportContract`, (SMS/WA/Call) log, (TG) `TelegramBotApiClient`, (VK) `VKApiClient`.

**Where the code/phone actually meet a channel:** only inside `send()` of the concrete sender. The `OtpSenderContract::send()` boundary (`:114`) is therefore the honest, minimal "transport layer" for a cross-channel redirect — *not* `Infrastructure/Auth/Transports/` (MAX-only).

**What the mask redirect needs to do (faithful to the brief):**
- Detect the mask phone at the delivery boundary (E.164 constant, because the request validator strips/rejects the dashed form).
- Substitute the **destination phone** = owner phone, while the **code** and the **session** stay bound to the mask phone (so the tester confirms with the mask phone; `ConfirmOtpAction:24` looks up the session by raw phone, and `verifyCode` hashes against the same session — no change needed there).
- Gate with a non-prod env flag (idiom: `OTP_*`, `env(..., false)`), and **reject the mask on production** (`app()->environment('production')` or `config('app.env') === 'production'`).
- Log every redirect (idiom: `logger()->info('OTP mask redirect: <mask> -> <owner> via <channel>')`).

**Why it cannot be literally only at `:114`:** see Gaps — the gates at `:65/:82/:100` short-circuit before `:114` for MAX/TG/VK whenever the transport is real (`bot_api`/`green_api`): the mask phone has no `MaxBotLink`, so the session parks and no redirect fires.

## Gaps and risks

1. **Bypass paths (production-relevant).** `MaxWebhookController:113`, `TelegramOtpBotHandler:151`, `VKCallbackHandler:174` deliver codes without touching `OtpSenderContract`. A redirect at `:114` alone does not cover them. Mitigation: also handle the mask at the *re-delivery* entry points, or (cleaner) place the redirect in a shared delivery component both paths call. Note these paths are only reachable if a `MaxBotLink` exists for the mask phone — which it will not — so in practice the concrete exposure is the **early-park** problem below, not duplicate-delivery.
2. **Early-park / never-deliver (highest risk).** With a real transport, `SendOtpAction:65` (`accountExists(mask)` = false on `bot_api`), `:82-84` (no `telegram:otp` link), `:100-102` (no `vk:otp` link) return `linkRequired()` **before** `:114`. On staging today `OTP_MAX_TRANSPORT=log` (`LogMaxTransport::accountExists` → always `true`) so MAX reaches the sender, but Telegram/VK still park (link missing) and on production MAX would park too. **Consequence:** the redirect must resolve the *effective delivery phone* **before** the gates (i.e. mask→owner substitution applied to the value passed to `accountExists`/`forBot`, or the gates must skip the mask), otherwise "deliver to the owner via the selected channel" fails for telegram/vk/prod-max.
3. **Selected channel semantics.** SMS/WhatsApp/Call are log stubs (`AllChannelsStrategy:31-34` hides them), so testing the mask on "any selected channel" really means MAX, and (with token) Telegram/VK. On log transports the "delivery" only reaches `laravel.log`, so the owner observes via logs or the dev endpoint — consistent with the existing dev-tooling convention, but worth stating.
4. **Prod leak of a real code.** If the flag were left on in production, the mask→owner redirect turns the login screen into an unauthenticated "send my code to me" primitive (rate-limited by `otp-send`, but still). The mask must be **forbidden** on production at the delivery boundary (hard `throw`/`abort`, not a silent pass-through), and the mask redirect must be OFF by default (`env(..., false)`), unlike `otp.dev_bypass` whose default is **true** (`config/otp.php:17`) — do not copy that default.
5. **Mask format vs validator.** `"+7 000ХХХ-ХХ-ХХ"` (spaces, dashes, Cyrillic `Х`) → 422 at `SendOtpRequest:17` before any code path. Define the mask as E.164 (e.g. `+70000000000`) and, if a "range" is meant (`+7000…`), prefer an explicit allow-list constant over a loose prefix regex to avoid masking real numbers.
6. **Multi-point drift.** The phone regex is duplicated in 5 places; a mask check naively copied would drift. Keep any mask logic in one place (a small domain service/value object read by the delivery boundary), not in each request class.
7. **Logging hygiene.** Existing infra logs the plaintext code (`SmsSender:28`, `LogMaxTransport:20`, etc.), so the repo already treats staging logs as non-secret. The redirect log line should record **mask, owner destination and channel** — and the destination is a PII phone; keep it to staging logs only (the same gate as the redirect).
8. **No `Log::channel` convention** — a dedicated audit channel would be new; to match the repo, use the default `logger()->info(...)` with a stable, greppable prefix.

## Suggested placement

Concrete, evidence-anchored recommendation (design only — no code written):

- **Config (idiom).** Add to `config/otp.php` near `dev_bypass` (`:17`): a non-prod flag (e.g. `'mask_redirect_enabled' => env('OTP_MASK_REDIRECT_ENABLED', false)`, default **false**) plus the mask constant and the owner destination (`'mask_phone' => env('OTP_MASK_PHONE')`, `'mask_redirect_to' => env('OTP_MASK_REDIRECT_TO')`). Document them in `.env.example` next to `OTP_DEV_BYPASS` (`:94`) and `OTP_MAX_TRANSPORT` (`:98`).
- **Single decision point.** Introduce a tiny domain component (e.g. `App\Domain\Auth\Services\OtpDeliveryTargetResolver`) that maps `(requestedPhone, channel) → ['sendTo' => effectivePhone, 'redirected' => bool]`, returns `effectivePhone` = owner when `config('otp.mask_redirect_enabled')` and `requestedPhone === config('otp.mask_phone')`, **throws** when `app()->environment('production')` and the mask is seen, and emits the `logger()->info('OTP mask redirect: …')` line. Keep the *session* phone = mask (do **not** rewrite `SendOtpData->phone`).
- **Wire the choke point.** Apply the resolver in `SendOtpAction` immediately after building the session and **before** the linkability gates (`:65`, `:82`, `:100`) so `accountExists`/`forBot` are evaluated against the **owner** phone, and pass the owner phone to `:114` (`->send($effectivePhone, $code, $bindingToken)`). This satisfies "only in the OTP delivery layer" while closing Gaps 1–2. (If a literal-only-`:114` change is mandated, it must be paired with a mask-aware bypass of the three gates, otherwise telegram/vk/prod-max never deliver.)
- **Tests (Pest conventions).** `tests/Unit/Domain/Auth/...` for the resolver (flag off → passthrough; flag on + mask → owner; production + mask → throws); `tests/Feature/Auth/MaskRedirectTest.php` modelled on `OtpDevCodeTest.php` — `config(['otp.mask_redirect_enabled' => true, 'otp.mask_phone' => '+70000000000', 'otp.mask_redirect_to' => '+79001234567'])`, `Http::fake` the channel, assert the destination chat/number, assert `Log::shouldReceive('info')` for the redirect line, and assert the session is still keyed by the mask phone so `/auth/confirm` with the mask phone works.
