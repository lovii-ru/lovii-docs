# Т-Банк «Мультирасчеты» — публичная база знаний по API

> Неофициальная база знаний по API эквайринга и выплат **Т-Банк «Мультирасчеты»**
> (маркетплейс-продукт: площадка принимает оплату, держит средства на Сделке
> и выплачивает продавцам). Собрана в ходе интеграции платформы lovii.ru,
> поддерживается и обогащается по ходу разработки.
>
> ⚠️ **Дисклеймер:** это НЕ официальная документация. Источник истины —
> [developer.tbank.ru](https://developer.tbank.ru/) и PDF-документы, выдаваемые
> банком при подключении продукта. Условия, лимиты и состав методов зависят от
> договора площадки. Версии документов см. в каждом файле.

## Что внутри

| Путь | Что это |
|---|---|
| `docs/oplata_multisplit.pdf` | «Протокол EACQ Мультирасчеты» — приём платежей (21.03.2025): Init, Confirm, Cancel, GetState, CheckOrder, 3DS, нотификации, тестовые карты |
| `docs/vyplaty-multisplit.pdf` | «Протокол A2C_V2 Мультирасчеты» — выплаты (e2c): Init, Payment, GetState, CancelPayment, GetSbpMembers, подпись сертификатом |
| `docs/multisplit.pdf` | «Описание продукта Мультирасчеты» (06.04.2026): схема сделки, N списаний : N выплат, createSpDeal/closeSpDeal |
| `docs/api_reg_upd_multisplit.pdf` | «Регистрация и обновление партнёров» (16.06.2026): acqapi — oauth, /sm-register/register (GET/PATCH) |
| `openapi/tbank-payouts-openapi.json` | Машиночитаемая OpenAPI «Массовые выплаты 1.46» (e2c/a2c-sbp + привязка карт + сертификаты). Источник: [m4tveevm/paygen](https://github.com/m4tveevm/paygen) (MIT) |
| `notes/01-payment-api.md` | Конспект: приём платежей — методы, параметры, статусы |
| `notes/02-notifications-signature.md` | Конспект: http-нотификации и алгоритм подписи Token |
| `notes/03-payouts-and-deals.md` | Конспект: сделка, N:N, выплаты (e2c), регистрация точек (acqapi) |
| `notes/04-test-cards.md` | Тестовые карты оплаты и выплат |
| `notes/05-mock-stand.md` | Дизайн мок-стенда банка (тестовый контур своими руками) |
| `notes/06-ecosystem.md` | Обзор экосистемы GitHub: SDK, реализации Мультисплита, моки |

## Коротко о продукте

- **Роли:** Площадка (терминал маркетплейса) — Продавец (получатель выплаты) — Покупатель.
- **Оплата:** `POST /v2/Init` (создаёт платёж и, с `CreateDealWithType=NN`, Сделку) →
  платёжная форма банка → холд (`AUTHORIZED`) → `POST /v2/Confirm` → `CONFIRMED`.
- **Сделка (Deal / SpAccumulation):** баланс = Σ списаний − Σ выплат; закрытие финальной
  выплатой (`FinalPayout=true`) или `closeSpDeal`; возврат после закрытия запрещён.
- **Выплата Продавцу:** `POST /e2c/v2/Init` + `POST /e2c/v2/Payment`; каналы — на карту
  (`CardId`/`CardData`), по СБП (`Phone`+`SbpMemberId`), партнёру-ЮЛ (`PartnerId`).
- **Идентификатор сделки в схеме с формой банка приходит только в нотификации**
  `AUTHORIZED` (параметр `SpAccumulationId`) — в ответе `Init` его нет.

## Оригиналы и обновление

- PDF ниже — публичные ссылки CDN банка:
  [оплата](https://cdn.tbank.ru/static/documents/oplata_multisplit.pdf),
  [выплаты](https://cdn.tbank.ru/static/documents/vyplaty-multisplit.pdf),
  [регистрация](https://cdn.tbank.ru/static/documents/api_reg_upd_multisplit.pdf),
  [продукт](https://cdn.tbank.ru/static/documents/multisplit.pdf).
- Конспекты в `notes/` — наши; при обновлении документов банка заменяем PDF
  (сохраняя оригинальные имена) и правим конспекты, версия документа указывается
  в заголовке каждого конспекта.
- Текстовые версии части документов — в репо
  [RomarioDeveloper/TbankLib](https://github.com/RomarioDeveloper/TbankLib) (NB:
  его `multisplit.txt`/`vyplaty-multisplit.txt` — это дубль описания продукта, а не выплатная дока).

Секреты (ключи терминалов, пароли, реквизиты договора) в этом каталоге не публикуются.
