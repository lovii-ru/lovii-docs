# APP-P-030 — Кабинет представителя — Профиль
<!-- fact-guard: allow — карточка T-032 описывает as-is UI: числа = что рендерит код lovii-app; канон чисел — canon/PARAMS.md -->
- Статус: живая
- Маршрут: `/cabinet/representative/profile` · name `RepresentativeProfile` (src/router/index.ts:610)
- Тип: вложенная (родитель: `/cabinet/representative` → CabinetLayout, вкладка «Профиль»)
- Доступ: роль representative (rolesGuard)
- Назначение: Личные данные представителя, промокод приглашения с QR и реф-ссылкой, счётчики, статус ранга и подписки, привилегии роли (по канону BRD).
- Функциональные блоки:
  - #identity — Имя (`profile.name ?? «Представитель»`) и телефон (RepresentativeProfile.vue:131-137).
  - #promo — Карточка «Промокод для подключения точек»: код крупно; если кода нет — честная фраза «Своего кода пока нет» (не «—», которое читалось как ошибка) + объяснение, когда появится; QR/копирование в этом состоянии не рисуются (RepresentativeProfile.vue:139-167).
  - #invite — «Приглашение клиентов»: QR (`AppQrCode`) на реф-ссылку `origin/?ref=КОД` (buildReferralUrl; домен текущего origin), ссылка текстом (читаема/копируема — a11y), кнопка «Скопировать ссылку» с проверкой результата clipboard (неудача — toast, без ложной галочки); состояние `inviteUnavailable` — код не в формате платформы (RepresentativeProfile.vue:59-95, 172-200).
  - #kpi — 2 KPI: «Заявки» (applications_count) и «Активные точки» (active_points_count) (RepresentativeProfile.vue:202-215).
  - #rank — «Цифровой Представитель»: ранг из API `null` — прогресс до следующего статуса НЕ рисуется (выдуманный прогресс убран) (RepresentativeProfile.vue:217-223, 75).
  - #subscription — «Подписка представителя»: подключена/не подключена (`subscription ? …`), подписка — условие доли (RepresentativeProfile.vue:70-73, 225-233).
  - #privileges — «Что даёт роль»: 40% пула (статус долю не меняет), промокод без ограничений, подписка 599/199 ₽ вне сплита (RepresentativeProfile.vue:98-114, 236-…).
- Состояния: loading — скелетон (identity/карточка/KPI); пусто — покрыто внутри блоков (нет кода, нет ранга, подписка off); ошибка — `roleLoadErrorText` + «Повторить»; offline — сетевой вариант.
- Зависимости: API `GET api/v1/representative/profile` (api/roles-api.ts:576); хелперы `buildReferralUrl` (src/package/global-helpers/referral.ts), `copyTextToClipboard`, `showToast`; `AppQrCode`, `LvIcon`, `AppSkeleton`; cabinet-ui (tiffany).
- Переходы: → нет исходящих в другие карточки (копирование — действие, не навигация); ← APP-P-026 (плитка «Профиль», CTA пустых состояний очереди и точек), ← APP-P-027 (CTA «Взять промокод»), ← таб-бар «Профиль».
- Дизайн/канон — проверить визуально: 3 состояния, честность (ранг/подписка/код — без выдуманного прогресса), токены ДС, a11y (QR с текстовой ссылкой-дублёром, focus-visible на кнопке копирования), tiffany-акцент.
- Сверка: роутер ✓ / код ✓ / UI ✗ (скрины — параллельный агент)
