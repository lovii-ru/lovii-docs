# SZ-082 механические находки — app-ext

- HEAD: `9cc3a6e9f45496249c80cb2da99fdac1cd0b99c2 (2026-09-28 22:14:51 +0300)`
- exclusions: `—`
- rules: находка = ≥2 независимые стратегии согласны «нет ссылок»; одиночные short-name попадания = AMBIGUOUS; миграции не сканируются.

| kind | где | почему выглядит мёртвым | стратегии (свидетельства) | вердикт |
|---|---|---|---|---|
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 3 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 9 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 4 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 6 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/entries.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 8 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/feed-period.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 5 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/feed-period.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 10 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/feed-period.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 2 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-card.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 12 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-card.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 8 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-card.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 8 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-card.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 8 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-card.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 3 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-privileges-match.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 12 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-privileges-match.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 6 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-tier.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 2 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-tier.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-tier.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 4 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-tier.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 6 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/pay-tier.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 4 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 2 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 12 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 12 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 8 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 6 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 7 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 10 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 12 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/transfer-form.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 11 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/wallet-history.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 2 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/wallet-history.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 6 hit(s) | **AMBIGUOUS(мансревью)** |
| helper-store-export | `src/modules/profile-balance/helpers/wallet-history.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 0 hit(s) | **CANDIDATE** |
| helper-store-export | `src/modules/profile-balance/helpers/wallet-history.ts` | exported helper/store-экспорт: нет импортов и упоминаний имени в src | S1_import: 0 hit(s); S2_raw_word: 7 hit(s) | **AMBIGUOUS(мансревью)** |
