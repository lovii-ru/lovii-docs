# LOVII Design System

<!-- fact-guard: allow — DESIGN содержит UI-токены, отступы, типографику; канон: PARAMS.md §1.1–§1.3 -->

> **Canonical, single source of truth** for the LOVII demo app design language.
> Merged from `DESIGN.md` (implementation tokens & drift corrections) and
> `UIUX_BEST_PRACTICES.md` (design principles, patterns, screen templates).
>
> This document MUST match `css/demo.css` exactly. Where the code diverges from a
> recommended convention, the divergence is called out explicitly under
> **"Use this, not that"** and listed in **Known Gaps To Fix** (§16).
>
> Downstream consumers: CSS, JS, UI/UX, and data agents all build from this file.
> It is self-contained — do not infer tokens that are not listed here.
>
> **Brand accents:** Pink `#f64a8a` · Tiffany `#0ABAB5` · Gold `#D4A854`
> **Reference apps:** Glovo, Grab, Rappi Partners, Яндекс Go, Gojek, Bolt Food

---

## Table of Contents

0. [Base Rules (non-negotiable)](#0-base-rules-non-negotiable)
1. [Design Tokens](#1-design-tokens-every-custom-property-in-democss)
2. [Design Principles](#2-design-principles)
3. [Brand Identity](#3-brand-identity)
4. [Color System](#4-color-system)
5. [Typography](#5-typography)
6. [Spacing & Grid](#6-spacing--grid)
7. [Elevation & Shadows](#7-elevation--shadows)
8. [Border Radius](#8-border-radius)
9. [Icon System](#9-icon-system)
10. [Components](#10-components)
11. [Patterns](#11-patterns)
12. [Screen Templates by Role](#12-screen-templates-by-role)
13. [Dark Theme](#13-dark-theme)
14. [Accessibility](#14-accessibility)
15. [Performance](#15-performance)
16. [Known Gaps To Fix](#16-known-gaps-to-fix-drift-backlog)

---

## 0. Base Rules (non-negotiable)

These are the project's stated base rules. They override any local convenience in the code.

1. **No gray page backgrounds.** The app page background is `--bg` (`#ffffff`). The only
   "gray" token, `--surface-secondary` (`#F8F8F8`), is a *card fill*, never a page/section
   background. Do not introduce gray page backgrounds.
2. **Spacing follows the home-screen rules.** Horizontal content padding is `16px` everywhere
   (see `--space-*` scale). Do not invent ad-hoc horizontal insets.
3. **Emoji icons are banned.** All icons are Tabler-style SVG `<symbol>` sprites using
   `currentColor`. Emoji currently appear in `.or-emoji`, `.role-icon`, `.store-badge`, and
   `.status-banner .rank-icon` — these are **legacy and must be replaced** (see §16 Known Gaps).
4. **One canonical card radius.** `12px` via `--radius-lg`. The ad-hoc `14px` literals in the
   code are drift and must be unified (see §16 Known Gaps).
5. **One elevation token.** Card shadow is `0 1px 3px var(--shadow)` (soft). The heavier
   `0 2px 12px` shadows on the home-screen cards are legacy and should converge (see §16 Known Gaps).

---

## 1. Design Tokens (every custom property in `demo.css`)

This is the complete, verbatim list of CSS custom properties currently defined in
`css/demo.css` `:root`. **Do not invent tokens that are not in this table.**

### 1.1 Brand / Accent

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--pink` | `#f64a8a` | yes | Primary brand accent |
| `--pink-light` | `rgba(246,74,138,0.12)` | yes | Pink tint (badges, soft fills) |
| `--pink-mid` | `rgba(246,74,138,0.06)` | yes | Faint pink (role-card.active bg) |
| `--pink-dark` | `#c92a6a` | yes | Pink gradient end (banners) |
| `--tiffany` | `#0ABAB5` | yes | Secondary accent (teal) |
| `--tiffany-light` | `rgba(10,186,181,0.10)` | yes | Tiffany tint |
| `--chiffon` | `#F5E6CC` | yes | Gold tint fill (menu-item icon-box) |
| `--sand` | `#E8D5B7` | yes | Gold-family text on chiffon |
| `--gold` | `#D4A854` | yes | Gold accent (grid-item .iw.chiffon, cat-tile.t-gold) |
| `--gold-light` | `rgba(212,168,84,0.12)` | yes | Gold tint |

### 1.2 Shadows (color-only rgba — paired with a blur/offset at use site)

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--shadow-sm` | `rgba(0,0,0,0.04)` | yes | Used as `0 2px 12px var(--shadow-sm)` (top-card) |
| `--shadow` | `rgba(0,0,0,0.06)` | yes | Canonical soft shadow: `0 1px 3px var(--shadow)` |
| `--pink-shadow` | `rgba(246,74,138,0.2)` | yes | Glow on pink icon boxes |
| `--tiffany-shadow` | `rgba(10,186,181,0.2)` | yes | Glow on tiffany icon boxes |
| `--gold-shadow` | `rgba(212,168,84,0.25)` | yes | Glow on gold icon boxes |

### 1.3 On-colored overlays

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--on-pink-text` | `rgba(255,255,255,0.9)` | yes | Text on pink gradient |
| `--on-pink-overlay` | `rgba(255,255,255,0.15)` | yes | Circle bg / timer bg on pink gradient |

### 1.4 Semantic extras

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--star` | `#FBBF24` | **NO** | Dead token — defined, never referenced. Remove. |

### 1.5 Surfaces

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--bg` | `#ffffff` | yes | Page + white card background |
| `--surface` | `#ffffff` | **NO** | Dead token — defined, never referenced as a value. Remove. |
| `--surface-secondary` | `#F8F8F8` | yes (9×) | Light-gray card fill. Allowed as card fill ONLY, never page bg. |
| `--border` | `#EEEEEE` | yes | Hairline border |
| `--border-strong` | `#DDDDDD` | yes | Hover/active border |

### 1.6 Text

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--text-primary` | `#1a1a1a` | yes | Headings, primary text |
| `--text-secondary` | `#888888` | yes | Secondary/meta text |
| `--text-dim` | `#bbbbbb` | yes | Dim labels, inactive nav |

### 1.7 Semantic status

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--success` | `#34D399` | yes | Success text/icon |
| `--success-light` | `rgba(52,211,153,0.12)` | yes | Success tint |
| `--warning` | `#FBBF24` | **NO** | Dead token — defined, never referenced. Remove. |
| `--danger` | `#EF4444` | **NO** | Dead token — defined, never referenced. Remove. |
| `--danger-light` | `rgba(239,68,68,0.12)` | **NO** | Dead token — defined, never referenced. Remove. |

### 1.8 Radii

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--radius-sm` | `6px` | yes | Small chips, price-tag, store-view-toggle |
| `--radius-md` | `10px` | yes | Icon boxes (menu-item, chip), order-row icon-box |
| `--radius-lg` | `12px` | yes | **CANONICAL card radius** |
| `--radius-xl` | `16px` | yes | Banner radius (status-banner, profile-banner) |

### 1.9 Layout

| Token | Value | Used? | Notes |
|---|---|---|---|
| `--header-h` | `44px` | yes | App header height |
| `--nav-h` | `50px` | yes | Bottom nav height |
| `--safe-bottom` | `env(safe-area-inset-bottom, 0px)` | yes | iOS safe area |

---

## 2. Design Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Local first** | Каждый элемент говорит: «этот сервис про мой город, мой район, мой магазин» |
| 2 | **Тепло и доверие** | Chiffon-фоны, скругления, мягкие тени — интерфейс не давит, а приглашает |
| 3 | **Три акцента — одна система** | Розовый (энергия), Тиффани (спокойствие), Шифон (тепло). Никаких случайных цветов |
| 4 | **Показать, не рассказать** | Визуальные сценарии вместо списков. Smart feed, контекстные виджеты |
| 5 | **Роль определяет экран** | Клиент, партнёр, представитель, амбасадор — каждый видит только свой инструментарий |
| 6 | **Mobile first** | 375px → 768px → 1440px. Touch-ориентированные интерфейсы |

---

## 3. Brand Identity

### 3.1. Logo

- **Full logo:** `assets/lovii-logo-light.svg` (light bg) / `assets/lovii-logo-black.svg` (dark bg)
- **Icon:** `assets/lovii-icon.svg`
- **Minimum clear space:** height of the letter "Л" around all sides
- **Do not:** stretch, rotate, apply filters, change colors

### 3.2. Brand Icon

The **О with heart** (`cls-6 fill: #f64a8a`) is the primary brand icon element. Used as:

| Usage | Where |
|-------|-------|
| Home tab icon | Bottom navigation — always |
| Loading splash | App launch (future) |
| Empty states | As visual anchor |
| Favicon | Browser tab |

### 3.3. Brand Voice

| Attribute | Expression |
|-----------|-----------|
| Tone | Warm, confident, local |
| Language | Russian (interface), English (code) |
| Pronouns | Ты (informal, friendly) |
| Character | "Свой сервис для своего района" |

---

## 4. Color System

### 4.1. Brand Palette

```
  Pink     #f64a8a   ████████  — основной акцент, энергия
  Tiffany  #0ABAB5   ████████  — вторичный, спокойствие, доверие
  Chiffon  #F5E6CC   ████████  — тёплый фон, бордеры, сэнд
  Sand     #E8D5B7   ████████  — более тёмный шифон для контраста
  Gold     #D4A854   ████████  — третичный, «Акции»/«Настройки»
```

### 4.2. Light Theme Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FFFFFF` | Основной фон страницы |
| `--surface` | `#FFFFFF` | Карточки, модалки |
| `--surface-secondary` | `#F8F8F8` | Вторичные поверхности (едва отличимый от white) |
| `--border` | `#EEEEEE` | Бордеры карточек, разделители (тонкий серый) |
| `--border-strong` | `#DDDDDD` | Более заметные бордеры |
| `--text-primary` | `#1A1A1A` | Основной текст |
| `--text-secondary` | `#888888` | Подписи, мета-информация |
| `--text-dim` | `#BBBBBB` | Самый бледный текст (плейсхолдеры) |
| `--accent-pink` | `#f64a8a` | Активные состояния, CTA, бейджи |
| `--accent-pink-light` | `rgba(246,74,138,0.12)` | Фон для pink-элементов |
| `--accent-pink-mid` | `rgba(246,74,138,0.06)` | Очень лёгкий розовый фон |
| `--accent-tiffany` | `#0ABAB5` | Вторичные кнопки, ссылки, info |
| `--accent-tiffany-light` | `rgba(10,186,181,0.1)` | Фон для tiffany-элементов |
| `--accent-chiffon` | `#F5E6CC` | **Тёплый акцент** — используется точечно (например, иконка chiffon-обёртки) |
| `--success` | `#34D399` | Зелёный — успех, готово |
| `--success-light` | `rgba(52,211,153,0.12)` | Фон success |
| `--warning` | `#FBBF24` | Жёлтый — внимание |
| `--warning-light` | `rgba(251,191,36,0.12)` | Фон warning |
| `--danger` | `#EF4444` | Красный — ошибка, отмена |
| `--danger-light` | `rgba(239,68,68,0.12)` | Фон danger |

### 4.3. Dark Theme Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#FFFFFF` | `#0A0A0C` |
| `--surface` | `#FFFFFF` | `#1C1C1E` |
| `--surface-secondary` | `#FAF9F7` | `#151517` |
| `--border` | `#F5E6CC` | `#2A2A2C` |
| `--border-strong` | `#E8D5B7` | `#3A3A3C` |
| `--text-primary` | `#1A1A1A` | `#FFFFFF` |
| `--text-secondary` | `#888888` | `#888888` |
| `--text-dim` | `#BBBBBB` | `#555555` |

Accent colours remain the same in both themes. Only backgrounds and text change.

### 4.4. Color Usage Rules

| Element | Rule |
|---------|------|
| **CTA / primary button** | Pink `--accent-pink` |
| **Secondary action** | Tiffany `--accent-tiffany` |
| **Decorative accent** | Chiffon `--accent-chiffon` (иконки, мелкие акценты) |
| **Active tab** | Pink text + pink stroke |
| **Inactive tab** | `--text-dim` |
| **Status: готовится** | Pink tag |
| **Status: в пути** | Tiffany tag |
| **Status: готово** | Success tag |
| **Status: отменён** | Danger tag |
| **Link** | Tiffany, no underline |
| **Error state** | Danger border + message |

### 4.5. 60-30-10 Distribution

| Proportion | Where | Color |
|------------|-------|-------|
| 60% — Background | Page bg, large areas | White / `#0A0A0C` |
| 30% — Surface | Cards, sheets, sections | White / `#1C1C1E` + `#EEEEEE` borders |
| 10% — Accent | CTAs, active states, badges, decorative touches | Pink + Tiffany + Chiffon (точечно) |

### 4.6. Color Summary (implementation)

- **Brand pink:** `--pink` `#f64a8a` (primary), with `--pink-light` / `--pink-mid` / `--pink-dark`.
- **Tiffany teal:** `--tiffany` `#0ABAB5` (secondary), with `--tiffany-light`.
- **Gold:** `--gold` `#D4A854` (tertiary, used for "Акции"/"Настройки" accents), with `--gold-light`, `--chiffon`, `--sand`.
- **Neutrals:** `--bg` `#ffffff`, `--surface-secondary` `#F8F8F8` (card fill only), `--border`
  `#EEEEEE`, `--border-strong` `#DDDDDD`, text `--text-primary` `#1a1a1a` / `--text-secondary`
  `#888888` / `--text-dim` `#bbbbbb`.
- **Status:** `--success` `#34D399` (used); `--warning`/`--danger` defined but dead.

Accent assignment (grid menu): Каталог/Бонусы/Города = pink; Заказы/Отчёты/Команда = tiffany;
Акции/Настройки = gold (`.iw.chiffon` maps to `--gold`).

---

## 5. Typography

### 5.1. Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

Base: `font-size: 14px; line-height: 1.4;` Weights loaded: 400, 500, 600, 700, 800.

### 5.2. Type Scale

| Name | Size | Weight | Line Height | Letter-spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| Hero | 28px | 700 | 1.2 | −0.5px | Screen title (rare) |
| H1 | 22px | 700 | 1.25 | −0.3px | Section headers |
| H2 | 18px | 600 | 1.3 | 0 | Card titles |
| H3 | 16px | 600 | 1.35 | 0 | Subheaders |
| Body | 15px | 400 | 1.5 | 0 | Main text |
| Body small | 13px | 500 | 1.4 | 0 | Card body, prices |
| Caption | 12px | 500 | 1.4 | 0 | Labels, tags |
| Caption uppercase | 11px | 600 | 1.3 | 0.5px | Section titles (all caps) |
| Micro | 10px | 500 | 1.3 | 0 | Tab labels, badges |
| Micro bold | 9px | 700 | 1.2 | 0 | Status tags, count badges |

### 5.3. Implementation-Specific Type Ramp

| Role | Size | Weight | Color | Example class |
|---|---|---|---|---|
| Display / hero name | `22px` | 700 | `--text-primary` / `--pink` | `.balance-amount`, `.detail-info .name` |
| Section title | `15px` | 700 | `--text-primary` | `.section-label`, `.top-card-title`, `.top-title` |
| Banner strong | `15px` | 700 | white / `--bg` | `.promo-banner .text strong`, `.status-banner .income .val` |
| Body / input | `13px` | 400–600 | `--text-primary` | `.or-name`, `.search-bar input`, `.oname` |
| Sub-body | `11px` | 500–600 | `--text-secondary` | `.table-row .name`, `.menu-item .text .sub`, `.cat-name` |
| Small / meta | `10px` | 500–600 | `--text-secondary` / `--text-dim` | `.top-card-sub`, `.balance-label`, `.or-meta` |
| Tiny / caption | `9px` | 600–700 | `--text-secondary` / accent | `.tag`, `.top-card-timer`, `.grid-item` label |
| Micro badge | `8px` | 700 | accent | `.top-card-badge` |

### 5.4. Font Weights

| Weight | Usage |
|--------|-------|
| 400 | Body text |
| 500 | Body text (emphasis), captions |
| 600 | H2, H3, active nav labels, buttons |
| 700 | H1, Hero, bold prices, amounts, emphasis/headline |

**Weight convention:** 700 = emphasis/headline, 600 = semibold label, 500 = normal-medium,
400 = body. Buttons: 600. Tags/badges: 600–700.

### 5.5. Type Rules

- No text smaller than 9px (accessibility)
- All caps only for section titles (caption uppercase)
- Prices always use ruble sign `₽`
- Numbers in amounts: Inter — tabular figures for alignment
- Line-height never below 1.2 for headings, 1.4 for body

---

## 6. Spacing & Grid

### 6.1. Baseline Grid

```
4px  — 1× (icon spacing, micro adjustments)
8px  — 2× (tight padding, chip gaps)
12px — 3× (card inner padding, button padding)
16px — 4× (page margins, card padding)
20px — 5× (section gaps)
24px — 6× (between sections, modal padding)
32px — 8× (screen top padding, large gaps)
48px — 12× (between major blocks)
```

### 6.2. Recommended `--space-*` Tokens

The code uses raw `px` values consistently. Map them to these recommended tokens so future
work shares one vocabulary:

| Token | Value | Where it appears in code |
|---|---|---|
| `--space-1` | `4px` | `.top-card-divider` margin-top, `.order-row + .order-row` gaps, `.tab-bar` margin, `.chip-row` padding |
| `--space-2` | `8px` | Grid gap, `.card + .card` margin, `.metric-row` gap, `.section-top`, horizontal card padding insets |
| `--space-3` | `12px` | `.card` padding, `.p-order` padding, `.menu-item` padding, `.progress-block` padding |
| `--space-4` | `16px` | **Canonical horizontal content padding** (every screen), `.top-card`/`.orders-card`/`.balance-card` margins |
| `--space-5` | `22px` | `.section-label` top/bottom margin (22px / 12px) |

**Rule:** Horizontal content padding is **always 16px** (`--space-4`). Vertical rhythm uses
`--space-2` (8px) and `--space-3` (12px). Do not introduce other horizontal insets.

### 6.3. Mobile Grid (375px–428px)

| Property | Value |
|----------|-------|
| Columns | 4 |
| Gutter | 8px |
| Margin | 16px |
| Max content width | 343px (4 cols × 77px + 3 × 8px) |

### 6.4. Tablet Grid (768px–1024px)

| Property | Value |
|----------|-------|
| Columns | 8 |
| Gutter | 12px |
| Margin | 32px |

### 6.5. Desktop Grid (1440px+)

| Property | Value |
|----------|-------|
| Columns | 12 |
| Gutter | 16px |
| Margin | auto (max 1200px) |
| Phone mockup | 393×852px in 40px border-radius frame |

### 6.6. Layout Rules

- **Bottom navigation:** always at bottom, 4 tabs max on phone
- **Header:** sticky, 48px height (including safe area)
- **Cards in grid:** equal height, use flexbox
- **Horizontal scroll:** hide scrollbar (iOS style), snap to item
- **Section spacing:** 24px between sections on main screen

---

## 7. Elevation & Shadows

### 7.1. Elevation Scale

| Level | Light Theme | Dark Theme |
|-------|-------------|------------|
| 0 — Flat | No shadow | No shadow |
| 1 — Card | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.3)` |
| 2 — Raised | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.4)` |
| 3 — Modal | `0 8px 32px rgba(0,0,0,0.1)` | `0 8px 32px rgba(0,0,0,0.5)` |
| 4 — Top | `0 12px 40px rgba(0,0,0,0.12)` | `0 12px 40px rgba(0,0,0,0.6)` |

Usage:
- **Level 1:** all cards in grids, order rows
- **Level 2:** promo banners, floating buttons, hover state
- **Level 3:** bottom sheets, modals, dropdowns
- **Level 4:** full-screen overlays, dialogs

### 7.2. Implementation Shadow Scale

| Level | Declaration | Use |
|---|---|---|
| Soft (canonical card) | `0 1px 3px var(--shadow)` | `.card`, `.metric-block`, `.stat-block`, `.menu-item`, `.p-order`, `.store-card`, `.search-bar`, `.progress-block` |
| Glow (accent icon box) | `0 4px 10px var(--pink-shadow \| --tiffany-shadow \| --gold-shadow)` | `.grid-item .iw`, `.chip .iw`, `.cat-tile.active` |
| Hover lift | `0 4px 12px var(--shadow)` + `translateY(-1px)` | `.grid-item:hover` |

**Use this, not that:** The home-screen cards (`.top-card`, `.orders-card`, `.balance-card`)
currently use the heavier `0 2px 12px var(--shadow)` (or `var(--shadow-sm)`). This is a
second, inconsistent elevation. Converge all cards to `0 1px 3px var(--shadow)` unless a
deliberate "raised" treatment is approved. See §16 Known Gaps §K3.

### 7.3. Hover/Active Effect

```css
.card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.card:active {
  transform: translateY(0);
  opacity: 0.95;
}
```

---

## 8. Border Radius

### 8.1. Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small tags, badge dots |
| `--radius-md` | 10px | Small cards, icon wraps |
| `--radius-lg` | 12px | Cards, order rows, chips container |
| `--radius-xl` | 16px | Promo banners, bottom sheets |
| `--radius-full` | 100px | Chips, pills, buttons |
| `--radius-phone` | 30px | Phone screen inner radius |

### 8.2. Radius Rules

- Cards: always `--radius-lg` (12px)
- Buttons: always `--radius-full` (pill shape)
- Chips: `--radius-full` (pill shape)
- Bottom sheet top: `--radius-xl` top corners only
- Modal: `--radius-xl`

### 8.3. Implementation Radius Scale

| Purpose | Use | Avoid |
|---|---|---|
| Card / tile / panel | `var(--radius-lg)` = **12px** | `border-radius: 14px` (ad-hoc literal) |
| Banner (gradient blocks) | `var(--radius-xl)` = 16px | — |
| Icon box (32px) | `var(--radius-md)` = 10px | — |
| Small chip / price-tag | `var(--radius-sm)` = 6px | — |
| Pill (buttons, tags, badges) | `border-radius: 100px` | — |

**Use this, not that:** Every card in the code should use `var(--radius-lg)` (12px).
Currently **5 rules hardcode `border-radius: 14px`** (`.top-card`, `.orders-card`,
`.promo-banner`, `.grid-item`, `.balance-card`). These are drift — replace with
`var(--radius-lg)`. See §16 Known Gaps §K2.

---

## 9. Icon System

### 9.1. Icon Style

- **Lucide-style** outline: 1.8px stroke, round caps, round joins
- **Stroke-based** — no filled icons (except brand heart)
- **20×20px** standard, **16×16px** small (inline with text)
- **SVG sprite** — all icons in one `<svg style="display:none">` block

### 9.2. Policy (MANDATORY)

- **All icons are SVG `<symbol>` sprites** rendered via `<svg class="icon"><use href="#i-{name}"/></svg>`.
- **Source:** Tabler Icons (outline, 24×24, `stroke="currentColor"`, `stroke-width="2"`,
  round caps). Repo: `tabler/tabler-icons`, raw: `https://raw.githubusercontent.com/tabler/tabler-icons/master/icons/outline/{name}.svg`.
- **Exception — Sushi:** No major set ships a sushi glyph. `i-sushi` is sourced from
  **Lucide Lab** (`lucide-icons/lucide-lab`, `icons/sushi-2.svg`) — same 24×24 stroke style.
- **Color:** always `currentColor`. Never hardcode `fill`/`stroke` hex in a symbol.
- **Banned:** emoji, hardcoded colors (`fill="#141B34"` etc.), non-24×24 viewBox without normalization.
- **Sprite location:** `#app-sprite` in `index.html`. JS helper: `Icon(name, cls)`.

### 9.3. Icon Sizes

| Size | Container | Usage |
|------|-----------|-------|
| 16px | — | Inline with text, chips |
| 20px | — | Standard list icons, tab bar |
| 28px | — | Store icons in order rows |
| 32px | — | Grid menu items (icon wrap) |
| 36px | — | Large store icons |
| 22px | — | Navigation icons |

### 9.4. Size-Pairing Table (icon size ↔ text size)

Icons are paired to the type size of their context. Use this table — do not free-size.

| Text size | Paired icon size | Class / context |
|---|---|---|
| `12px` | **16px** | `.icon-sm`, `.section-label a`, `.menu-item .arrow`, `.search-bar .icon`, `.chip .icon` |
| `14px` | **20px** | `.icon` (default), `.nav-item` base context |
| `16px` | **24px** | `.icon-lg`, `.profile-banner .avatar .icon` |
| `10–11px` | **14px** | `.top-card-loc .icon`, `.top-card-timer .icon`, `.promo-banner .timer .icon`, `.quick-btn .icon` |
| `22px` tile | **22px** | `.grid-item .iw .icon`, `.nav-item .icon` |
| `26px` tile | **26px** | `.cat-tile .icon` |

> Note: `.nav-item .icon` is 22px (paired to the 9px nav label by visual weight, not the
> 14px rule) — this is intentional and matches the bottom-nav spec.

### 9.5. Brand Icon (О with Heart)

| Property | Value |
|----------|-------|
| ViewBox | `160 195 90 100` |
| О fill | `#ffffff` (white, both themes) |
| Heart fill | `#f64a8a` (pink, both themes) |
| Usage | Home tab, favicon, splash |

### 9.6. Icon Inventory

| ID | Icon | Used In |
|----|------|---------|
| `#i-home` | О with heart | Tab bar, Главная |
| `#i-home-dark` | О with heart (white О) | Dark theme tab bar |
| `#i-search` | Search/magnifier | Search bar |
| `#i-cart` | Shopping cart | Cart tab, add to cart |
| `#i-user` | User/profile | Profile tab, chips |
| `#i-bell` | Bell/notification | Header |
| `#i-store` | Store/building | Business chip |
| `#i-package` | Package/order | Orders, Заказы grid |
| `#i-star` | Star | Bonuses, rating |
| `#i-bar-chart` | Bar chart | Analytics, reports |
| `#i-users` | Users/team | Team list |
| `#i-building` | Building/city | Cities grid |
| `#i-zap` | Zap/lightning | Promos, акции |
| `#i-settings` | Gear/settings | Settings |
| `#i-map-pin` | Map pin | Location |
| `#i-shopping-bag` | Shopping bag | Catalog, store orders |
| `#i-gift` | Gift | Promotions, flower orders |
| `#i-clock` | Clock | Time, countdown |
| `#i-wallet` | Wallet | Balance, income |
| `#i-trending-up` | Trending up | Growth charts |
| `#i-chevron-right` | Chevron | Navigation, "more" |

### 9.7. Available Symbols in `#app-sprite` (30 total, current)

Utility: `i-home`, `i-search`, `i-package`, `i-user`, `i-bell` (reserved, unused in nav),
`i-store` (reserved), `i-star`, `i-bar-chart`, `i-users`, `i-building`, `i-zap` (utility,
unused in UI), `i-settings`, `i-map-pin`, `i-shopping-bag`, `i-gift` (defined twice — see
§16 Known Gaps §K5), `i-clock`, `i-wallet`, `i-trending-up`, `i-chevron-right`, `i-chevron-left`,
`i-plus`, `i-check`, `i-arrow-left`, `i-log-out`, `i-bread`, `i-flower`, `i-sushi`,
`i-coffee`, `i-discount`.

### 9.8. SVG Sprite Convention (a11y)

Each `<symbol>` MUST carry a `<title>` child for accessibility. **Current state: ALL 30
symbols lack `<title>`** — this triggers the pre-existing LSP `noSvgWithoutTitle` warning.
Fix pattern:

```html
<symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <title>Home</title>
  <path .../>
</symbol>
```

See §16 Known Gaps §K4.

---

## 10. Components

Every component below is implemented in `demo.css` (+ `js/components.js` where noted).
Class names are the contract — use them as written.

### 10.1. Shell & Layout

#### App Shell `#app`
Flex column, `height: 100dvh`, `max-width: 480px`, centered. Contains header, `#app-content`, `#app-nav`.

#### Header `#app-header`
`height: var(--header-h)` (44px); `padding: 8px 16px`; flex space-between; `background: var(--bg)`.
- `#app-logo` — `height: 28px` (left).
- `.header-actions` — flex, `gap: 12px` (right). Contains `.cart-btn` and `.avatar-wrap`.
- `.avatar-wrap` — `position: relative`.
- `.avatar-icon` — `28×28px`, `border-radius: 8px`, `background: var(--bg)`, `1px solid var(--border)`; inline SVG (person + checkmark).
- `.notif-dot` — `10×10px`, `background: var(--pink)`, `2px solid var(--bg)`, `border-radius: 50%`, absolute `top:-2px; right:-2px`.
- `.cart-btn` — `height: 28px`, `background: var(--pink)`, `border-radius: 8px`, contains `.cart-icon` (22×28px) + `.cart-num` (13px/700, white).

**Rules:** No bell icon in header — logo (left) + cart + avatar (right) only. Logo and avatar equal 28px. 8px edge spacing.

#### Content Area `#app-content`
`flex: 1; overflow-y: auto; padding: 8px 0 0`. InnerHTML swapped on navigation.

#### Bottom Nav `#app-nav` + `.nav-item`
`height: calc(var(--nav-h) + var(--safe-bottom))`; `padding: 4px 0 calc(4px + var(--safe-bottom))`; `border-top: 1px solid var(--border)`; `background: var(--bg)`.
- `.nav-item` — flex column, `gap: 2px`, `font-size: 9px`, `font-weight: 500`, `color: var(--text-dim)`; `.icon` 22×22px.
- `.nav-item.active` — `color: var(--pink)`; icon `color: var(--pink)`.
- Tabs: `home` (`i-home`), `search` (`i-search`), `orders` (`i-package`), `profile` (`i-user`).

#### Splash `#splash`
`position: fixed; inset: 0; z-index: 9999; background: var(--bg)`. `.splash-cover` animates
`slide-cover 1.2s cubic-bezier(0.16,1,0.3,1)`. `.hidden` → opacity 0. JS: `showSplash()`.

### 10.2. Shared UI Components

#### Icons `.icon` / `.icon-sm` / `.icon-lg`
See §9. Base: `.icon` 20×20, `.icon-sm` 16×16, `.icon-lg` 24×24.

#### Card `.card`
`background: var(--surface-secondary)`; `border-radius: var(--radius-lg)`; `padding: 12px`;
`box-shadow: 0 1px 3px var(--shadow)`. `.card + .card { margin-top: 8px }`.
> **Drift note:** `.card` uses `--surface-secondary` (gray) as fill. Per base rule #1 this is
> allowed *only* as a card fill, not a page bg. If a white card is wanted, use `--bg`.

#### Section Label `.section-label`
Flex space-between; `font-size: 15px`, `font-weight: 700`, `color: var(--text-primary)`,
`letter-spacing: -0.2px`; `padding: 0 16px`; `margin: 22px 0 12px` (first-of-type `margin-top: 4px`).
Optional `a` link: `color: var(--pink)`, `font-weight: 600`, `font-size: 12px`.

#### Buttons `.btn` + variants
`display: inline-flex`; `padding: 8px 16px`; `border-radius: 100px`; `font-size: 12px`;
`font-weight: 600`. Variants: `.btn-primary` (`--pink` bg, `--bg` text), `.btn-ghost`
(transparent, `1px solid var(--border)`, `--text-secondary` text), `.btn-tiffany` (`--tiffany`
bg, `--bg` text), `.btn-sm` (`padding: 6px 12px; font-size: 10px; min-height: 36px`),
`.btn-block` (`display: flex; width: 100%`).

#### Tags `.tag` + `.tag-*`
`display: inline-flex`; `padding: 2px 8px`; `border-radius: 100px`; `font-size: 9px`;
`font-weight: 600`. Variants: `.tag-pink` (`--pink-light`/`--pink`), `.tag-tiffany`
(`--tiffany-light`/`--tiffany`), `.tag-success` (`--success-light`/`--success`), `.tag-gray`
(`--surface-secondary` + `1px solid var(--border)` / `--text-secondary`).

#### Badge `.badge` + `.b-*`
`display: inline-flex`; `gap: 4px`; `font-size: 9px`; `font-weight: 700`; `text-transform: uppercase`;
`letter-spacing: 0.4px`; `padding: 3px 8px`; `border-radius: 100px`; `color: #fff`;
`box-shadow: 0 3px 8px rgba(0,0,0,0.18)`. Variants: `.b-pink`, `.b-tiffany`, `.b-gold`, `.b-dark`
(`--text-primary`). Used in `.store-card .cat-badge` and `.product-card .badges`.

### 10.3. Data Display

#### Metric Block `.metric-row` / `.metric-block`
Grid 3 cols, `gap: 8px`, `padding: 0 16px`. `.metric-block`: `background: var(--surface-secondary)`,
`border-radius: var(--radius-lg)`, `padding: 10px`, `box-shadow: 0 1px 3px var(--shadow)`,
text-align center. `.val` 17px/700 (`.pink`/`.tiffany` color), `.lbl` 10px uppercase `--text-secondary`.

#### Stats Grid `.stats-grid-2` / `.stat-block`
Grid 2 cols, `gap: 8px`, `padding: 0 16px`. `.stat-block`: `background: var(--surface-secondary)`,
`border-radius: var(--radius-lg)`, `padding: 10px`, `box-shadow: 0 1px 3px var(--shadow)`.
`.val` 16px/700, `.lbl` 10px uppercase `--text-secondary`.

#### Status Banner `.status-banner`
`margin: 0 16px; padding: 12px`; pink→`--pink-dark` gradient; `border-radius: var(--radius-xl)`;
flex align-center `gap: 10px`. `.rank-icon` 36×36px circle, `background: var(--on-pink-overlay)`,
**currently emoji** (legacy — replace with SVG). `.info .title` 13px/700 white, `.info .sub`
10px opacity 0.8. `.income .val` 15px/700, `.income .lbl` 9px opacity 0.8.

#### Progress Block `.progress-block` / `.bar` / `.bar-fill`
`margin: 8px 16px; padding: 12px`; `background: var(--surface-secondary)`;
`border-radius: var(--radius-lg)`; `box-shadow: 0 1px 3px var(--shadow)`. `.bar` 4px,
`--border` bg, pill; `.bar-fill` `--pink`, transition width 0.3s.

#### Table Row `.table-row` (in `.table-list`)
Flex space-between; `padding: 8px 0`; `border-bottom: 1px solid var(--border)` (last child none).
`.name` 11px/500, `.meta` 10px `--text-secondary`, `.value` 11px/600.

#### Profile Banner `.profile-banner`
`margin: 0 16px; padding: 16px`; pink→`--pink-dark` gradient; `border-radius: var(--radius-xl)`;
text-align center; `color: var(--bg)`. `.avatar` 48×48px circle, `background: var(--on-pink-overlay)`,
`.icon` 24×24px white. `.name` 16px/700, `.sub` 11px opacity 0.8.

### 10.4. Interactive / Navigation

#### Menu Item `.menu-item` (in `.menu-list`)
Flex align-center `gap: 10px`; `padding: 12px`; `background: var(--bg)`; `1px solid var(--border)`;
`border-radius: var(--radius-lg)`; `margin-bottom: 8px`; `box-shadow: 0 1px 3px var(--shadow)`.
`.icon-box` 32×32px, `border-radius: var(--radius-md)`. Variants: `.pink` (`--pink-light` bg,
`--pink` icon), `.tiffany` (`--tiffany-light` bg, `--tiffany` icon), `.chiffon-bg` (`--chiffon`
bg, `--sand` icon), `.dim` (`--tiffany-light` bg, `--tiffany` icon). `.text .title` 13px/500,
`.text .sub` 11px `--text-secondary`. `.arrow` 16×16px `--text-dim`.

#### Quick Actions Bar `.quick-bar` / `.quick-btn`
`.quick-bar` flex `gap: 6px`, `padding: 0 16px`. `.quick-btn` flex:1, `padding: 8px 12px`,
`border-radius: 100px`, `min-height: 36px`, `background: var(--pink-light)`, `font-size: 10px`,
`font-weight: 600`, `color: var(--pink)`, `.icon` 14×14px `--pink`. `.quick-btn.ghost`
(transparent, `1px solid var(--border)`, `--text-secondary`).

#### Tab Bar `.tab-bar` / `.tab-item`
Flex; `padding: 0 16px`; `margin-bottom: 10px`; `border-bottom: 1px solid var(--border)`.
`.tab-item` `padding: 10px 0 8px`, `font-size: 12px`, `font-weight: 500`, `color: var(--text-dim)`,
`border-bottom: 2px solid transparent`. `.tab-item + .tab-item { margin-left: 16px }`.
`.tab-item.active` → `--pink` text + `--pink` bottom border.

#### Search Bar `.search-bar`
Flex align-center `gap: 8px`; `margin: 0 16px 8px`; `padding: 10px 14px`;
`background: var(--surface-secondary)`; `border-radius: var(--radius-lg)`;
`box-shadow: 0 1px 3px var(--shadow)`. `.icon` 16×16px `--text-dim`. `input` 13px, no border.

#### Category Chips `.cat-row` / `.cat-chip` / `.cat-tile`
`.cat-row` flex, `gap: 14px`, `overflow-x: auto`, `padding: 4px 16px 14px`. `.cat-chip` flex
column `gap: 7px`, `width: 64px`. `.cat-tile` 56×56px, `border-radius: var(--radius-lg)`,
`.icon` 26×26px. `.cat-name` 11px/600 `--text-secondary`. Active: `.cat-tile.t-pink/t-tiffany/
t-gold` fills solid accent + `0 4px 10px` glow, icon white, `.cat-name` → `--text-primary`/700.
Tile variants: `.t-pink` (`--pink-light`/`--pink`), `.t-tiffany` (`--tiffany-light`/`--tiffany`),
`.t-gold` (`--gold-light`/`--gold`).

#### Chip `.chip` / `.chip .iw`
`.chip` flex align-center `gap: 6px`; `padding: 8px 14px`; `border-radius: var(--radius-md)`;
`min-height: 32px`; `background: #fff` (hardcoded — see §16 Known Gaps §K1); `1px solid var(--border)`;
`font-size: 11px`, `font-weight: 600`, `--text-primary`. `.chip .iw` 22×22px,
`border-radius: var(--radius-sm)`, variants `.pink`/`.tiffany`/`.chiffon` (solid accent + glow,
white icon). `.chip.active` → `--pink-mid` bg, `--pink` border.

#### Role Card `.role-grid` / `.role-card`
`.role-grid` grid 2 cols, `gap: 8px`, `padding: 0 16px`. `.role-card` flex column `gap: 6px`,
`padding: 14px 8px`, `border-radius: var(--radius-lg)`, `border: 2px solid var(--border)`,
`background: var(--bg)`. `.role-icon` **24px emoji (legacy — replace with SVG)**. `.role-name`
11px/600 `--text-primary`, `.role-desc` 9px `--text-secondary`. `.role-card.active` → `--pink`
border + `--pink-mid` bg.

#### Top Card (location + promo) `.top-card`
`margin: 8px 16px`; `background: var(--bg)`; `1px solid var(--border)`; **`border-radius: 14px`
(drift — should be `--radius-lg`)**; `box-shadow: 0 2px 12px var(--shadow-sm)` (drift — should
be `0 1px 3px var(--shadow)`); `overflow: hidden`. Sub-parts: `.top-card-loc` (11px `--text-dim`,
`.icon` 14×14px, city `span` 600 `--text-primary`), `.top-card-change` (`--pink`, 500, margin-left
auto), `.top-card-divider` (1px `--border`), `.top-card-body` (flex space-between, `padding: 12px
14px 8px`), `.top-card-badge` (8px/700 `--pink` on `--pink-light`, pill, uppercase), `.top-card-title`
(15px/700), `.top-card-sub` (10px `--text-secondary`), `.top-card-timer` (`--pink-light` pill, 9px/600,
`.icon` 12×12px), `.top-card-action`, `.top-card-link` (`--tiffany`, 10px/600, `.icon` 12×12px).

#### Orders Card `.orders-card`
`margin: 0 16px`; `background: var(--bg)`; **`border-radius: 14px` (drift)**; `padding: 4px 14px`;
`box-shadow: 0 2px 12px var(--shadow)` (drift). Contains `.order-row` (flex space-between,
`padding: 13px 0`, divider `1px solid var(--border)` between rows). `.order-row .icon-box` 32×32px,
`border-radius: 10px`, `.pink`/`tiffany` bg + glow, **`.or-emoji` 15px emoji (legacy — replace)**.
`.or-name` 13px/600, `.or-meta` 9px `--text-secondary`, `.or-price` 13px/700, `.right` gap 6px.

#### Balance Card `.balance-card`
`margin: 10px 16px 0`; `padding: 14px 16px`; `background: var(--bg)`; **`border-radius: 14px`
(drift)**; `box-shadow: 0 2px 12px var(--shadow)` (drift); flex space-between. `.balance-label`
10px uppercase `--text-dim`, `.balance-amount` 22px/700 (`.pink` → `--pink`), `.unit` 13px/500
`--text-secondary`, `.balance-sub` 10px `--text-secondary`, `.balance-link` 10px/600 `--tiffany`.

#### Promo Banner `.promo-banner`
`margin: 0 16px`; pink→`--pink-dark` gradient; **`border-radius: 14px` (drift — should be
`--radius-xl` or `--radius-lg`)**; `padding: 12px 14px`; flex space-between. `.text` 11px/500
`--on-pink-text`, `.text strong` 15px/700 `--bg`. `.timer` `--on-pink-overlay` pill, 9px/600
`--bg`, `.icon` 14×14px.

#### Partner Order Card `.p-order`
Flex space-between `gap: 8px`; `padding: 10px`; `background: var(--bg)`; `1px solid var(--border)`;
`border-radius: var(--radius-lg)`; `margin-bottom: 8px`; `box-shadow: 0 1px 3px var(--shadow)`;
`:active` → `--pink` border + `0 2px 8px var(--pink-shadow)`. `.left` (`.store-badge` 40×40px,
`border-radius: 12px`, **`.store-badge` uses 20px emoji (legacy — replace)**; `.store-info`,
`.oname` 13px/600, `.or-meta` 9px `--text-secondary`). `.right` (`.store-eta` 11px/600, `.tag`).
Also `.thumb` 48×48px `border-radius: 12px`.

#### Store Card `.store-grid2 .store-card`
Grid 2 cols (`--store-grid2`), `gap: 10px`. `.store-card` `background: var(--bg)`, `1px solid
var(--border)`, `border-radius: var(--radius-lg)`, `overflow: hidden`, `box-shadow: 0 1px 3px
var(--shadow)`. `.cover` 1:1 `--surface-secondary` bg. `.cat-badge` absolute top/right 8px, pill,
9px/700 uppercase, `color: #fff` (hardcoded), `.b-pink`/`.b-tiffany` bg. `.body` `padding: 10px`,
`.oname` 13px/600, `.eta` 11px/600, `.meta` 9px `--text-secondary`. Toggle: `.store-view-toggle`
34×34px, `border-radius: 9px`, `--surface-secondary` bg, swaps `.ic-list`/`.ic-grid` by
`data-layout`.

#### Product Card `.product-card`
Grid 2 cols (`.product-grid`), `gap: 10px`. `.product-card` flex column, `background: #fff`
(hardcoded — see §16 §K1), `1px solid var(--border)`, `border-radius: var(--radius-lg)`,
`box-shadow: 0 1px 4px var(--shadow)`, `overflow: hidden`. `.media`/`.thumb` 1:1
`--surface-secondary` bg. `.badges` (top-right), `.price-tag` (top-left, `border-radius: 8px`,
`background: rgba(0,0,0,0.45)`, `color: #fff`, 14px/800, `.old` 9px strike), `.caption`
(bottom, `rgba(0,0,0,0.45)`, `.glass-edge` top hairline), `.store` 9px uppercase, `.pname` 13px/600,
`.add-btn` (`--pink` bg, `color: #fff`, pill), `.qty`/`.qty-btn`/`.count` (pink pill stepper).

#### Section Padding Helpers
`.section-pad` (`padding: 0 16px`), `.section-margin` (`margin: 0 16px`), `.section-top`
(`padding-top: 8px`).

#### Top Bar (detail screens) `.top-bar` / `.back-btn` / `.top-title`
`.top-bar` flex `gap: 12px`, `padding: 14px 16px`, sticky top, `background: var(--bg)`,
`border-bottom: 1px solid var(--border)`. `.back-btn` 36×36px circle, `1px solid var(--border)`,
`background: #fff` (hardcoded), 20px `--text-primary`. `.top-title` 15px/600.

#### Product Detail `.product-detail` / `.hero` / `.detail-info`
`.product-detail` `max-width: 520px; margin: 0 auto`. `.hero` 300px, `.hero-img` cover
`--surface-secondary` bg. `.detail-info` `padding: 14px 16px 24px`: `.store` 11px uppercase
`--text-secondary`, `.name` 22px/700, `.price` 20px/700 `--pink`, `.desc` 13px/1.6
`--text-secondary`. `.qty-detail` pink pill stepper. `.add-big` (`--pink` bg, `color: #fff`,
14px/700, `border-radius: var(--radius-lg)`). `.empty-state` centered 14px `--text-secondary`.

### 10.5. UI/UX Component Specs (visual reference)

#### Button — Primary
```
┌──────────────────────┐
│  Войти               │  ← pink bg, white text, 14px/600
└──────────────────────┘
```

| Property | Value |
|----------|-------|
| Height | 48px |
| Padding | 16px 24px |
| Radius | 100px (pill) |
| BG | `--accent-pink` |
| Text | White, 14px, 600 |
| Icon | Left, white stroke |
| Hover | `filter: brightness(1.1)` |
| Active | `filter: brightness(0.95)` |
| Disabled | `opacity: 0.4` |
| Full width | Whole container width |

#### Button — Secondary (Outline)
```
┌──────────────────────┐
│  Отменить             │  ← white bg, sand border, pink text
└──────────────────────┘
```

| Property | Value |
|----------|-------|
| Height | 48px |
| Padding | 16px 24px |
| Radius | 100px |
| BG | Transparent / white |
| Border | `1px solid var(--border-strong)` |
| Text | `--accent-pink`, 14px, 600 |
| Hover | `--accent-pink-light` bg |

#### Button — Small / Ghost
```
  ┌──────────┐
  │ + Товар  │  ← for inline actions, 36px height
  └──────────┘
```

| Property | Value |
|----------|-------|
| Height | 36px |
| Padding | 8px 16px |
| Radius | 100px |
| BG | `--accent-pink-light` / transparent |
| Text | `--accent-pink`, 12px, 600 |

#### Input
```
  ┌──────────────────────────────┐
  │  Название магазина            │  ← 16px text, placeholder dim
  └──────────────────────────────┘
  ┌──────────────────────────────┐
  │                              │  ← focused: pink border
  └──────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Height | 48px |
| Padding | 14px 16px |
| Radius | 12px |
| Border | `1px solid var(--border)` |
| Focus border | `1px solid var(--accent-pink)` |
| Error border | `1px solid var(--danger)` |
| BG | `--surface` |
| Text | 16px, `--text-primary` |
| Placeholder | `--text-dim` |

#### Chips (Category Pills)
```
  [ Все ]  [  Пекарни  ]  [  Цветы  ]  [  Химчистка  ]
```

| Property | Value |
|----------|-------|
| Height | 32px |
| Padding | 6px 14px |
| Radius | 100px |
| Default | `--surface-secondary` bg, `--text-secondary` text |
| Active | Pink bg (light) / pink text + underline (dark), bold |
| Gap | 6px |
| Container | Horizontal scroll, no scrollbar |

#### Bottom Navigation
```
  [ ♥ Главная ]  [ 🔍 Поиск ]  [ 🛒 Корзина ]  [ 👤 Профиль ]
```

| Property | Value |
|----------|-------|
| Height | 56px + safe area bottom |
| Items | 4 max |
| Layout | Flex, space-around |
| Active | Pink text, pink icon stroke |
| Inactive | `--text-dim` text, `--text-dim` stroke |
| Divider | `1px solid var(--border)` |
| Icon size | 20px |
| Label | 9px, 500, centered below icon |

#### Card (visual spec)
```
  ┌────────────────────────────────┐
  │  Пекарня #23           1 200₽ │
  │  15–25 мин · 1.2 км  [Готовится] │
  └────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Radius | 12px |
| BG | `--surface` |
| Border | `1px solid var(--border)` |
| Padding | 14px |
| Shadow | Level 1 |
| Hover | translateY(-2px) + Level 2 shadow |

#### Status Tag
```
   [Готовится]  [В пути]  [Готово]  [Отменён]
      pink       tiffany   success    danger
```

| Property | Value |
|----------|-------|
| Height | 20px |
| Padding | 2px 8px |
| Radius | 6px |
| Font | 9px, 700 |
| BG | `--accent-*-light` |
| Text | Matching accent color |

#### Promo Banner (visual spec)
```
  ┌──────────────────────────────────────┐
  │  −20% на выпечку               [4 ч] │
  │  В Пекарне #23 до конца дня          │
  └──────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Radius | 16px |
| BG | Pink gradient (`--accent-pink` → `#c92a6a`) |
| Text | White |
| Padding | 14px 16px |
| Layout | Two rows: title (16px/700) + subtitle (12px). Right: timer tag |

#### Segment Control
```
  ┌──────────────────────────────┐
  │ [Клиент] │ [Бизнес] │ [Партнёр] │
  └──────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Height | 36px |
| Radius | 12px (container) / 10px (item) |
| BG | `--accent-chiffon` (container) |
| Active item | White bg, `--text-primary` bold |
| Inactive | `--text-dim` |
| Gap | 4px |
| Inner padding | 3px |
| Icon | 16px, inline with text |

#### Header (visual spec)
```
  [♡]                             [🔔] [icon]
  Москва
```

| Property | Value |
|----------|-------|
| Height | 48px + top safe area |
| Layout | Left: logo; Right: actions (bell + avatar) |
| Location bar | Below header: map pin + city name + time |
| Font | Location: 11px secondary; City: 13px/600 |

#### Grid Menu
```
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ 🛍️  │ │ 📦  │ │ ⭐  │ │ 📊  │
  │Каталог│ │Заказы│ │Бонусы│ │Отчёты│
  └──────┘ └──────┘ └──────┘ └──────┘
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ 👥  │ │ 🏙️  │ │ ⚡  │ │ ⚙️  │
  │Команда│ │Города│ │Акции │ │Настр.│
  └──────┘ └──────┘ └──────┘ └──────┘
```

| Property | Value |
|----------|-------|
| Columns | 4 |
| Gap | 8px |
| Item height | auto (flex column) |
| Icon wrap | 28×28px (light) / 32×32px (dark), radius 8–10px |
| Icon | 20px |
| Label | 10px, 500, `--text-secondary` |
| Icon BG | `--accent-pink-light`, `--accent-tiffany-light`, or Chiffon |

#### Bottom Sheet
```
  ┌──────────────────────────────────┐  ← 16px top radius
  │  ───  (drag handle)              │
  │                                  │
  │  Content                         │
  │                                  │
  └──────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Radius | 16px top only |
| Shadow | Level 3 |
| BG | `--surface` |
| Drag handle | 32×4px, `--border-strong`, centered |
| Backdrop | `rgba(0,0,0,0.4)` |

#### Toast
```
  ┌──────────────────────────────────┐
  │ ✓ Товар добавлен в корзину       │  ← 2s, slide up
  └──────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Position | Bottom, above nav bar |
| Radius | 12px |
| BG | `--text-primary` (dark bg) |
| Text | White |
| Duration | 2s |
| Animation | slideUp 300ms, opacity fade |
| Icon | 16px left (tiffany for success, pink for info) |

#### Balance Block
```
  ┌──────────────────────────────────┐
  │  1 250 баллов        Как получить?│
  │  до статуса Digital Representative│
  └──────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Layout | Card with two columns |
| Amount | 18px, 700, pink |
| Subtext | 11px, `--text-secondary` |
| Link | 12px, Tiffany |

---

## 11. Patterns

### 11.1. Role-Based Chips

Three roles at the top of the home screen — user can switch between them:

```
  [👤 Клиент]  [🏪 Бизнес]  [🤝 Партнёр]
```

Each role shows a different home screen:
- **Клиент:** catalog, promos, bonus balance, active orders
- **Бизнес:** dashboard with today's metrics, recent orders
- **Партнёр:** network stats, income, team

### 11.2. Order Status Flow

```
  Новый → Подтверждён → Готовится → Готов → Передан → Завершён
  [pink]   [tiffany]     [pink]    [tiffany] [warning] [success]
```

Tags per status:
| Status | Tag | Color |
|--------|-----|-------|
| Новый | `[Новый]` | Pink |
| Подтверждён | `[Подтверждён]` | Tiffany |
| Готовится | `[Готовится]` | Pink |
| Готов | `[Готов]` | Tiffany |
| Передан в доставку | `[В пути]` | Warning |
| Завершён | `[Завершён]` | Success |

### 11.3. Smart Feed (Home Screen)

```
  ┌──────────────────────────────────┐
  │  [Header: Logo + Notifications]   │
  │  Москва                          │
  │  [Клиент | Бизнес | Партнёр]     │
  │                                  │
  │  ┌─── Promo Banner ──────────┐   │
  │  │ −20% на выпечку     [4 ч] │   │
  │  └───────────────────────────┘   │
  │                                  │
  │  ┌─── 4×2 Grid Menu ────────┐   │
  │  │ 🛍 📦 ⭐ 📊               │   │
  │  │ 👥 🏙 ⚡ ⚙               │   │
  │  └───────────────────────────┘   │
  │                                  │
  │  Активные заказы                 │
  │  ┌─ Card ───────────────────┐   │
  │  │ Пекарня #23     1 200₽   │   │
  │  │ 15 мин · 1.2 км [Готов.] │   │
  │  └──────────────────────────┘   │
  │  ┌─ Card ───────────────────┐   │
  │  │ Цветы Fresh     2 300₽   │   │
  │  │ 20 мин · 2.3 км [В пути] │   │
  │  └──────────────────────────┘   │
  │                                  │
  │  [Tab Bar: ♥ | 🔍 | 🛒 | 👤]    │
  └──────────────────────────────────┘
```

### 11.4. Empty States

| State | Visual | Text | Action |
|-------|--------|------|--------|
| No orders | Brand icon | «У вас пока нет заказов» | «Начать покупки» button |
| No stores | Brand icon | «В этом городе пока нет магазинов» | «Пригласить бизнес» link |
| No team | Brand icon | «В вашей команде пока никого нет» | «Добавить» button |
| No data | Brand icon | «Нет данных за этот период» | — |
| Search empty | Search icon | «Ничего не найдено» | «Попробуйте изменить запрос» |

### 11.5. Progressive Disclosure

- **Dashboard:** show metrics first, details on tap
- **Order list:** last 5 active orders visible, «Все заказы» link
- **Team list:** top 5 members, «Показать всех» expand
- **Balance:** show total, hide history behind tap

### 11.6. Transition / Animation

| Event | Animation | Duration | Easing |
|-------|-----------|----------|--------|
| Screen appear | fadeIn | 300ms | ease |
| Card appear | slideUp + fade | 400ms | ease-out |
| Bottom sheet | slideUp from bottom | 300ms | cubic-bezier |
| Tab switch | cross-fade | 200ms | ease |
| Hover | translateY + shadow | 150ms | ease |
| Active press | scale(0.97) | 100ms | ease |
| Toast | slideUp | 300ms | ease-out |
| `prefers-reduced-motion` | All disabled | — | — |

---

## 12. Screen Templates by Role

### 12.1. Клиент (5 screens)

| Screen | Layout | Key Components |
|--------|--------|----------------|
| **Главная** | Header + location + chips + promo banner + grid menu + active orders + tab bar | Smart feed, role chips, promo banner |
| **Каталог** | Search bar + category chips (horizontal) + 2-col store grid | Card grid, chips |
| **Магазин** | Store header + product list (each: name, price, +) | Product cards |
| **Корзина** | Item list (+/−) + total + checkout CTA | Cart rows, primary button |
| **Профиль** | Balance (large) + QR code + order history + favorites | Balance block, order history list |

### 12.2. Партнёр / Торговая точка (5 screens)

| Screen | Layout | Key Components |
|--------|--------|----------------|
| **Дашборд** | Today metrics (3 cards: orders, revenue, new clients) + recent orders + quick actions | Metric cards, order rows, small buttons |
| **Товары** | Search + category filter + product list (edit/active toggle) + FAB "+" | Filter, product rows, ghost button |
| **Заказы** | Tab: Active / History + order cards per status | Tabs, status tags, order cards |
| **Отчёты** | Period selector + bar chart (revenue by day) + export | Chart, period tabs |
| **Настройки** | Store info form + hours + profile edit | Inputs, toggles, save button |

### 12.3. Представитель (4 screens)

| Screen | Layout | Key Components |
|--------|--------|----------------|
| **Дашборд** | Status badge (Rep/Mayor/Gov) + coins counter + metric cards + progress bar | Status badge, balance, progress |
| **Мои точки** | Search + points list (each: name, address, revenue, status) | Card list with metrics |
| **Доход** | Period selector + income chart + transaction history | Chart, transaction list |
| **Профиль** | Status + badge + referral code + stats | Profile card, stats grid |

### 12.4. Амбасадор (4 screens)

| Screen | Layout | Key Components |
|--------|--------|----------------|
| **Дашборд** | Network stats (reps, points, revenue) + top performers | Metric cards, mini leaderboard |
| **Представители** | Search + rep list (name, points, revenue) + tap for detail | Card list with expand |
| **Доход** | Income breakdown by rep + history | Detail chart, list |
| **Обучение** | Materials list + video placeholders | Card list |

### 12.5. Цифровой Мэр / Губернатор

| Screen | Layout | Key Components |
|--------|--------|----------------|
| **Мэр дашборд** | Rep dashboard + badge + privilege badges | Status badge + extended metrics |
| **Губернатор дашборд** | Multi-city map + city cards (each: points, revenue) + total metrics | Map placeholder, city cards |

---

## 13. Dark Theme

### 13.1. Principles

1. **Same accent colors** — Pink, Tiffany, Chiffon stay unchanged
2. **Backgrounds invert** — white → near-black `#0A0A0C`
3. **Surfaces dark** — `#1C1C1E` for cards, `#151517` for secondary
4. **Borders subtle** — `#2A2A2C` instead of Chiffon
5. **Text flips** — black → white
6. **No pure black** — always `#0A0A0C` or `#1C1C1E`, never `#000`
7. **Reduced shadows** — darker bg provides depth
8. **Icons stay white** — O with heart icon uses white О in both themes

### 13.2. Dark Theme Token Mapping

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#FFFFFF` | `#0A0A0C` |
| `--surface` | `#FFFFFF` | `#1C1C1E` |
| `--surface-secondary` | `#F8F8F8` | `#151517` |
| `--border` | `#EEEEEE` | `#2A2A2C` |
| `--border-strong` | `#DDDDDD` | `#3A3A3C` |
| `--text-primary` | `#1A1A1A` | `#FFFFFF` |
| `--text-secondary` | `#888888` | `#888888` |
| `--text-dim` | `#BBBBBB` | `#555555` |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.3)` |
| `--shadow-raised` | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.4)` |

### 13.3. Dark Theme Component Adjustments

| Component | Light | Dark |
|-----------|-------|------|
| Card bg | White | `#1C1C1E` |
| Segment control bg | `#F8F8F8` | `#2A2A2C` |
| Segment active bg | White | `#1C1C1E` |
| Chips active | Pink bg | Pink stroke + pink text, no bg |
| Input bg | White | `#1C1C1E` |
| Card secondary bg | `#F8F8F8` | `#151517` |
| Promo banner | Pink gradient | Pink gradient (same) |

### 13.4. Theme Toggle

- Toggle in settings or long-press on home icon
- Transition: `background-color 0.3s ease`
- Stored in `localStorage('theme')` as `'light'` or `'dark'`
- Applied via `data-theme="dark"` on `<html>` element

---

## 14. Accessibility

### 14.1. Contrast Ratios

| Combination | Ratio | WCAG |
|-------------|-------|------|
| `--text-primary` on `--bg` (light) | 15:1 | AAA ✓ |
| `--text-primary` on `--bg` (dark) | 15:1 | AAA ✓ |
| `--text-secondary` on `--bg` (light) | 5.6:1 | AA ✓ |
| `--text-secondary` on `--bg` (dark) | 4.5:1 | AA ✓ |
| Pink `#f64a8a` on white | 4.8:1 | AA ✓ |
| Pink `#f64a8a` on dark `#0A0A0C` | 6.2:1 | AA ✓ |
| Tiffany `#0ABAB5` on white | 3.0:1 | AA ✗ (use on dark bg or as accent only) |

> **Note:** Tiffany is used as an accent only (not for body text). For text-on-tiffany, always use white.

### 14.2. Touch Targets

| Element | Min size |
|---------|----------|
| Buttons | 44×44px |
| Bottom nav items | 48×48px |
| Chips | 32×32px |
| Close buttons | 44×44px |
| Icon buttons | 44×44px |

### 14.3. Other Requirements

- `aria-label` on all icon-only buttons
- `prefers-reduced-motion` disables all animations
- Focus outlines: 2px solid pink with 2px offset
- Font size respects system settings (rem / user-agent styles)
- All touch targets separated by ≥ 8px gap

---

## 15. Performance

| Requirement | Target |
|-------------|--------|
| TTI | < 2s |
| Lighthouse | ≥ 90 all categories |
| Total page weight | < 100KB (excluding fonts) |
| Requests | < 10 |
| Fonts | Inter (400, 500, 600, 700) — self-hosted preferred |
| Images | None in demo. SVG only |
| Icons | Single SVG sprite |
| State | `localStorage` for theme, cart, auth |
| Build | None — vanilla HTML/CSS/JS, GitHub Pages |

### 15.1. SVG Sprite Strategy

```html
<svg style="display:none">
  <symbol id="i-home" viewBox="...">...</symbol>
  <symbol id="i-search" viewBox="0 0 24 24">...</symbol>
  <!-- All icons here -->
</svg>
```

Usage: `<svg class="icon"><use href="#i-home"/></svg>`

### 15.2. CSS Architecture

- **Custom properties** for all colors, spacing, radii
- **No preprocessor** — native CSS with logical grouping
- **Media queries** only for grid breakpoints
- **`data-theme`** attribute for dark/light switching
- **File size target:** < 15KB compressed

---

## 16. Known Gaps To Fix (drift backlog)

These are concrete divergences from the canonical scales above. They are the action items for
the CSS/JS agents before the build agent finishes.

### K1. Hardcoded `#fff` instead of `--bg` token
**16 hardcoded `#fff`/`#ffffff` usages** in component rules (2 more are the `--bg`/`--surface`
token definitions themselves). Replace with `var(--bg)`:
- `.store-grid2 .store-card .cat-badge` (color: #fff)
- `.cat-chip.active .cat-tile.t-pink/.t-tiffany/.t-gold .icon` (color: #fff)
- `.chip` (background: #fff)
- `.chip .iw.pink/.tiffany/.chiffon .icon` (color: #fff)
- `.product-card` (background: #fff)
- `.product-card .price-tag` / `.caption` (color: #fff)
- `.product-card .add-btn` / `.add-big` (color: #fff)
- `.badge` (color: #fff)
- `.cart-num` (color: #fff)
- `.back-btn` (background: #fff)

### K2. 14px radius must become 12px (`--radius-lg`)
5 rules hardcode `border-radius: 14px`: `.top-card`, `.orders-card`, `.promo-banner`,
`.grid-item`, `.balance-card`. Replace with `var(--radius-lg)`.

### K3. Dual elevation — converge to one card shadow
Home-screen cards (`.top-card`, `.orders-card`, `.balance-card`) use `0 2px 12px var(--shadow)`
/ `var(--shadow-sm)`. Canonical card shadow is `0 1px 3px var(--shadow)`. Unify unless a
deliberate raised treatment is approved.

### K4. SVG `<title>` missing on all 30 symbols
Every `<symbol>` in `#app-sprite` lacks a `<title>` child → LSP `noSvgWithoutTitle` warning.
Add `<title>{Name}</title>` inside each symbol (see §9.8).

### K5. Dead tokens to remove
`--surface`, `--warning`, `--danger`, `--danger-light`, `--star` are defined but never
referenced. Remove from `:root` (or wire them in if a future component needs them).

### K6. Emoji icons are banned — replace legacy emoji
Emoji still appear in: `.or-emoji` (order-row icon-box), `.role-icon` (role-card),
`.store-badge` (p-order), `.status-banner .rank-icon`. Replace each with a Tabler SVG symbol
(`Icon(name)`) per §9.2.

### K7. Duplicate `i-gift` symbol
`index.html` defines `i-gift` twice (lines 84 and 98) with different paths. De-duplicate to a
single canonical `i-gift`.

### K8. `--surface-secondary` as card fill
`--surface-secondary` (`#F8F8F8`) is used as the fill for `.card`, `.metric-block`,
`.stat-block`, `.progress-block`, `.search-bar`, `.p-order .store-badge` context, covers, and
`.tag-gray`. This is permitted *only* as a card fill (base rule #1), never a page background.
If white cards are desired for consistency, switch these to `var(--bg)`.
