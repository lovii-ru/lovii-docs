# LOVII — Модель данных
## Data Model Specification

<!-- fact-guard: allow — DATA_MODEL содержит схему данных с числовыми типами (decimal, percent); канон: PARAMS.md §1.1–§7 -->

**Версия:** 1.1  
**Дата:** 2026-08-25

---

## 1. ER-диаграмма

```mermaid
erDiagram
    User ||--o| PromoCode : "имеет"
    User ||--o| Subscription : "имеет"
    User ||--|| UdidAccount : "имеет"
    User ||--o| UserStatus : "имеет"
    User ||--o{ MspAccount : "может быть"
    User ||--o{ Transaction : "инициирует"
    User ||--o{ Cashback : "получает"
    User ||--o{ EventParticipation : "участвует"
    PromoCode }o--|| User : "invited_by"
    MspAccount ||--o{ Transaction : "генерирует"
    Transaction ||--o| Cashback : "может иметь"
    Transaction ||--|| PoolDistribution : "распределяется в"
    User ||--o{ AccountTransfer : "отправляет"
    User ||--o{ AccountTransfer : "получает"
    
    User {
        string udid PK
        string phone
        string email
        string full_name
        string city
        string legal_status "ИП / ООО / Самозанятый"
        datetime created_at
        boolean is_active
    }
    
    PromoCode {
        string code PK
        string prefix FK
        string suffix
        string owner_udid FK
        datetime created_at
        datetime last_changed_at
        int change_count
    }
    
    Subscription {
        string id PK
        string udid FK
        decimal amount
        string period_months
        datetime started_at
        datetime expires_at
        string status
        string payment_method
    }
    
    UdidAccount {
        string udid PK,FK
        decimal balance
        decimal total_earned
        decimal total_withdrawn
        string payout_channel "push / pull, вычисляется из legal_status"
        datetime updated_at
    }
    
    UserStatus {
        string udid PK,FK
        string status
        int msp_count
        int cities_count
        decimal network_gmv_30d
        datetime assigned_at
    }
    
    MspAccount {
        string id PK
        string udid FK
        string legal_name
        string inn
        string address
        string city
        string category
        decimal balance
        datetime created_at
    }
    
    Transaction {
        string id PK
        string msp_id FK
        decimal amount
        string payment_method
        decimal bank_commission
        decimal pool_amount
        datetime created_at
        string promo_code FK
    }
    
    Cashback {
        string id PK
        string transaction_id FK
        string client_udid FK
        decimal amount
        decimal fee
        datetime created_at
    }
    
    PoolDistribution {
        string id PK
        string transaction_id FK
        decimal company_share
        decimal rep_share
        decimal ambassador_share
        string rep_udid
        string ambassador_prefix
    }
    
    AccountTransfer {
        string id PK
        string from_udid FK
        string to_udid FK
        decimal amount
        string type
        datetime created_at
    }
    
    EventParticipation {
        string id PK
        string udid FK
        string event_type
        string role
        datetime event_date
        string status
    }
```

---

## 2. Сущности (JSON-схемы)

### 2.1. User

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "User",
  "required": ["udid", "phone", "created_at"],
  "properties": {
    "udid": {
      "type": "string",
      "description": "Уникальный идентификатор пользователя"
    },
    "phone": {
      "type": "string",
      "pattern": "^\\+7\\d{10}$"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "full_name": {
      "type": "string"
    },
    "city": {
      "type": "string"
    },
    "legal_status": {
      "type": "string",
      "enum": ["ИП", "ООО", "Самозанятый"],
      "description": "Определяет канал выплаты (push/pull) и не связан со статусом Представитель/Мэр/Губернатор"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "is_active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

### 2.2. PromoCode

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "PromoCode",
  "required": ["code", "prefix", "suffix", "owner_udid"],
  "properties": {
    "code": {
      "type": "string",
      "pattern": "^[2-9A-HJ-NP-Z]{6}$",
      "description": "6-символьный промокод"
    },
    "prefix": {
      "type": "string",
      "pattern": "^[2-9A-HJ-NP-Z]{2}$"
    },
    "suffix": {
      "type": "string",
      "pattern": "^[2-9A-HJ-NP-Z]{4}$"
    },
    "owner_udid": {
      "type": "string"
    },
    "invited_by_code": {
      "type": "string",
      "description": "Промокод пригласившего"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "last_changed_at": {
      "type": "string",
      "format": "date-time",
      "nullable": true
    },
    "change_count": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    },
    "is_reserved": {
      "type": "boolean",
      "default": false,
      "description": "True для зарезервированных (AAAAAA)"
    }
  }
}
```

### 2.3. Subscription

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Subscription",
  "required": ["udid", "amount", "period_months", "expires_at", "status"],
  "properties": {
    "id": {"type": "string"},
    "udid": {"type": "string"},
    "amount": {"type": "number", "minimum": 0},
    "period_months": {"type": "integer", "minimum": 1, "maximum": 12},
    "started_at": {"type": "string", "format": "date-time"},
    "expires_at": {"type": "string", "format": "date-time"},
    "status": {
      "type": "string",
      "enum": ["active", "expired", "pending"]
    },
    "payment_method": {
      "type": "string",
      "enum": ["card", "sbp", "udid_balance", "mixed"]
    },
    "auto_renew": {
      "type": "boolean",
      "default": false
    }
  }
}
```

### 2.4. UdidAccount

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "UdidAccount",
  "required": ["udid", "balance"],
  "properties": {
    "udid": {"type": "string"},
    "balance": {"type": "number", "description": "Может уходить в отрицательное значение при клоубэке после вывода (см. edge case 37)"},
    "total_earned": {"type": "number", "minimum": 0, "default": 0},
    "total_withdrawn": {"type": "number", "minimum": 0, "default": 0},
    "payout_channel": {
      "type": "string",
      "enum": ["push", "pull"],
      "description": "push — только МСП с legal_status ИП/ООО, ежедневно, без минимума. pull — все остальные, минимум 10000 по запросу"
    },
    "updated_at": {"type": "string", "format": "date-time"}
  }
}
```

### 2.5. Transaction

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Transaction",
  "required": ["id", "msp_id", "amount", "payment_method", "pool_amount"],
  "properties": {
    "id": {"type": "string"},
    "msp_id": {"type": "string"},
    "amount": {"type": "number", "minimum": 0},
    "payment_method": {
      "type": "string",
      "enum": ["card", "sbp", "tpay"]
    },
    "bank_commission": {"type": "number", "minimum": 0},
    "pool_amount": {"type": "number", "minimum": 0},
    "promo_code": {"type": "string"},
    "client_udid": {"type": "string"},
    "created_at": {"type": "string", "format": "date-time"},
    "status": {
      "type": "string",
      "enum": ["pending", "completed", "refunded", "chargeback"]
    }
  }
}
```

### 2.6. Cashback

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Cashback",
  "required": ["transaction_id", "client_udid", "amount"],
  "properties": {
    "id": {"type": "string"},
    "transaction_id": {"type": "string"},
    "client_udid": {"type": "string"},
    "amount": {"type": "number", "minimum": 0},
    "fee": {"type": "number", "minimum": 0, "description": "25% от amount"},
    "created_at": {"type": "string", "format": "date-time"}
  }
}
```

### 2.7. PoolDistribution

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "PoolDistribution",
  "required": ["transaction_id", "company_share", "rep_share", "ambassador_share"],
  "properties": {
    "id": {"type": "string"},
    "transaction_id": {"type": "string"},
    "company_share": {"type": "number", "minimum": 0},
    "rep_share": {"type": "number", "minimum": 0},
    "ambassador_share": {"type": "number", "minimum": 0},
    "rep_udid": {"type": "string"},
    "ambassador_prefix": {"type": "string"}
  }
}
```

### 2.8. UserStatus

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "UserStatus",
  "required": ["udid", "status"],
  "properties": {
    "udid": {"type": "string"},
    "status": {
      "type": "string",
      "enum": ["Представитель", "Мэр", "Губернатор"]
    },
    "msp_count": {"type": "integer", "minimum": 0},
    "cities_count": {"type": "integer", "minimum": 0},
    "network_gmv_30d": {"type": "number", "minimum": 0},
    "assigned_at": {"type": "string", "format": "date-time"}
  }
}
```

### 2.9. FiscalDocument

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "FiscalDocument",
  "description": "Фискальный документ 54-ФЗ (T-038). Один платёж = чек «Предоплата 100%»; момент передачи заказа = чек «Полный расчёт»; отмена/возврат платежа = чек возврата. Правообладатель — агент, Лицензиат — поставщик (money_flow_public.md §2.1, Оферта присоединения §12.2.3). Провайдер по умолчанию: OFD Ferma (касса-партнёр терминала Т-Банка, Фаза 1).",
  "required": ["order_id", "kind", "status"],
  "properties": {
    "order_id": {"type": "integer", "description": "Заказ"},
    "payment_id": {"type": ["integer", "null"], "description": "Платёж (для prepayment/refund)"},
    "kind": {
      "type": "string",
      "enum": ["prepayment", "full_payment", "refund"],
      "description": "Вид фискального документа"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "sent", "confirmed", "failed"],
      "description": "pending → sent (принят кассой) → confirmed (ФН/ОФД подтвердили); failed с retry_count"
    },
    "provider": {"type": "string", "description": "Ключ провайдера (ferma / mock / …)"},
    "amount": {"type": "integer", "description": "Сумма чека в копейках"},
    "items": {"type": "array", "description": "Позиции (name, price, quantity, vat, payment_object, agent_info, supplier_info)"},
    "agent_sign": {"type": "string", "description": "Признак агента — конфиг, вердикт юриста (Фаза 1)"},
    "supplier": {
      "type": "object",
      "description": "Поставщик = Лицензиат (partner)",
      "properties": {
        "name": {"type": "string"},
        "inn": {"type": "string"},
        "phones": {"type": "array", "items": {"type": "string"}}
      }
    },
    "taxation": {"type": "string", "description": "СНО Правообладателя — конфиг, вердикт юриста"},
    "payments_split": {
      "type": "object",
      "description": "Формы оплаты: electronic / provision (баллы) — развилка владельца"
    },
    "fd_number": {"type": ["string", "null"], "description": "ФД"},
    "fiscal_sign": {"type": ["string", "null"], "description": "ФП"},
    "fiscal_at": {"type": ["string", "null"], "format": "date-time"},
    "ofd_receipt_url": {"type": ["string", "null"]},
    "error_text": {"type": ["string", "null"]},
    "retry_count": {"type": "integer", "minimum": 0},
    "external_id": {"type": ["string", "null"], "description": "ID документа у провайдера"},
    "created_at": {"type": "string", "format": "date-time"},
    "updated_at": {"type": "string", "format": "date-time"}
  }
}
```

Идемпотентность: unique `(payment_id, kind)` для prepayment/refund и
`(order_id, kind)` для full_payment. Связь с леджером: узел «внешний чек»
по образцу `external:bank` — отчётная obligation, движения денег не создаёт,
Σ-инвариант не меняет.

---
