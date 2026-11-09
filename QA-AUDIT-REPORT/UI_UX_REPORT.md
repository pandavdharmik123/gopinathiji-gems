# Gopinathji Gems — UI / UX Report

**Audit date:** 2026-11-09
**Frontend:** React 19 · Ant Design 6 · Tailwind 4 · Vite 8
**Method:** Playwright Chromium desktop + 412 px mobile, axe-core scans, 22 Vitest unit/component tests, page-by-page source review, screenshots/traces from failures.
**Raw evidence:** `/tmp/qa-e2e-final.log`, `/tmp/qa-frontend.log`, `qa/test-results/` (screenshots, traces, error contexts)

---

## 1. Result overview

| Area | Result |
|---|---|
| Route rendering | ✅ Every declared route renders without a backend error (10 s sweep) |
| Sidebar role filtering | ✅ Employee sidebar hides admin entries |
| Mobile layout | ✅ No horizontal overflow at 412 px (login + dashboard); menu works |
| Currency/date formatting | ✅ INR Indian grouping, Gujarati locale dates |
| i18n | ✅ English/Gujarati strings and persistence |
| Payment-mode workflow | ❌ Only cash/bank in the UI |
| PDF export | ❌ Runtime crash with a date preset |
| Direct-URL authorization | ❌ Admin pages render for employees |
| Accessibility (login) | ⚠️ Moderate landmark/heading/region issues |
| Accessibility (dashboard) | ❌ Critical unlabeled control + 22 serious contrast failures |
| AntD deprecations | ⚠️ Warnings on every page |

---

## 2. Page-by-page review

| Page | Route | What works | Issues |
|---|---|---|---|
| **Login** | `/` (public) | Username/password, inline error on bad credentials, required-field validation, 2FA/OTP modals present | axe: missing `<main>` landmark (moderate), no H1 (moderate), 5 region violations (moderate); deprecated `Card`/`Space`/`Alert` props |
| **Dashboard** | `/dashboard` | Stat cards, cash/bank overview, recent transactions, charts, financial-year selector, masked amounts toggle | **axe critical:** year `<Select>` has no accessible name (`App.tsx:407`); **22 serious contrast** nodes; no H1; the year selector is the only global filter and is easy to miss |
| **Calendar / Panchang** | `/calendar` | Renders, tithi/lunar data, role-open | Deprecated `Card`/`Space`; dense layout on mobile not individually tested |
| **Income** | `/income` | Create income, category, party, amount, date | **Payment mode only cash/bank** (QA-009); `Transaction` type used as a callable (TS2349) |
| **Expense** | `/expense` | Create expense, categories | Same payment-mode gap; same TS callable bug |
| **Transactions** | `/transactions` | List/filter, edit (manager/admin), delete (admin) | `Transaction` callable bug (TS121); no client guard (employee by URL); list has no page-size control exposed |
| **Financial Years** | `/cashbook` | Year CRUD, opening balances, active year | Employee reachable by URL (UI); no DB single-active constraint |
| **Parties / Companies** | `/parties` | CRUD, balances, categories | Employee reachable by URL; unused imports; report balance scaling (see performance) |
| **Ledger** | `/ledger` | Party ledger, download affordance | Unused `Input`/`Card`/`Space`/`Download`; employee reachable by URL |
| **Reports** | `/reports` | Summary/monthly/yearly/category/party/P&L, filters, print PDF | **PDF crash** with date preset (`dateFrom` undefined); employee can read via API/URL; unfiltered outstanding |
| **Users** | `/users` | Admin-only list/create/edit/delete | **Employee can open by direct URL**; default `admin123`; deprecated `Space` |
| **Settings** | `/settings` | Company profile, backup, Drive | **Employee can open by direct URL**; backup buttons exposed to employees server-side |
| **Audit Logs** | `/audit` | Admin-only audit table | Employee reachable by URL; unused imports |
| **My Profile** | `/profile` | Name/email, password change, PIN, 2FA | Unused `Tabs`/`Space`/`Badge`/icons; mostly solid |

---

## 3. Accessibility (axe-core)

### Login page

| Rule | Impact | Nodes | Meaning |
|---|---|---|---|
| `landmark-one-main` | Moderate | 1 | No `<main>` landmark |
| `page-has-heading-one` | Moderate | 1 | No `<h1>` |
| `region` | Moderate | 5 | Content outside landmarks |

### Dashboard (authenticated, post-login)

| Rule | Impact | Nodes | Meaning |
|---|---|---|---|
| **`label`** | **Critical** | 1 | Form element has no label (`<input class="ant-select-input" role="combobox">` — the financial-year selector) |
| **`color-contrast`** | **Serious** | **22** | Text fails WCAG AA 4.5:1 |
| `page-has-heading-one` | Moderate | 1 | No `<h1>` |

**E2E consequence.** The dashboard scan fails on the critical `label` violation, so the “logs in, loads dashboard and survives reload” test fails despite the app working. This is a genuine accessibility defect, not a test artefact.

**Remediation.**
1. Add `aria-label={t('nav.accountingYears')}` to the `<Select>` at `src/App.tsx:407`.
2. Raise contrast tokens (`--secondary`, `--muted-foreground`, coloured card subtext) to ≥ 4.5:1; the 22 nodes are concentrated in low-opacity helper text and coloured labels.
3. Wrap page content in `<main>` and add exactly one `<h1>` per page.
4. Add axe-core (critical/serious = 0) to CI for login, dashboard, and each list page.

---

## 4. Responsive / mobile

- Mobile viewport **412 × 915** (Pixel-class).
- `scrollWidth = innerWidth = 412` on login and dashboard → **no horizontal overflow**.
- Mobile menu opens via the hamburger and navigation works.
- Stat cards, tables and charts reflow; AntD Drawer used for the menu (deprecated `width` prop).
- Not individually tested at 360 px or in landscape; recommend adding those breakpoints.
- Tables on small screens rely on horizontal scroll inside cards (acceptable) but should be re-checked with long Gujarati party names.

---

## 5. Localisation & formatting

| Check | Result |
|---|---|
| English strings | ✅ |
| Gujarati strings | ✅ |
| Unknown key fallback | ✅ returns key |
| Language persistence | ✅ |
| INR Indian digit grouping, no decimals | ✅ |
| Sub-rupee rounding (documented display rule) | ✅ |
| Negative amounts (expense/debit) | ✅ |
| Gujarati-locale date | ✅ |
| Sortable `YYYY-MM-DD` input value | ✅ |

**Gaps.** Payment-mode labels are Gujarati-only when the UI is English (dropdown shows `રોકડા | બેંક ટ્રાન્સફર`). Mixed-language labels appear in an English session. Add locale-aware labels and include UPI/Cheque.

---

## 6. UX / workflow findings

1. **Incomplete payment capture** — users cannot record UPI or cheque, forcing workarounds (QA-009). This is the highest-impact UX gap for a modern Indian trading business.
2. **PDF export dead-end** — the primary “Print PDF” action crashes when any date preset is chosen (QA-008). Users see nothing happen.
3. **False sense of security** — hiding sidebar links without guarding routes means an employee can still land on admin pages via URL/history/bookmark (QA-010).
4. **Silent route fallback** — unknown paths render Dashboard instead of a 404, masking broken links (QA-027).
5. **No visible pagination/size control** on long transaction lists; the API returns 50 by default and the UI offers no obvious “load more”.
6. **Year selector discoverability** — the global financial-year filter is an unlabeled select in the header; users may not realise reports are scoped.
7. **Console noise** — AntD deprecation warnings on every page make debugging harder (QA-022).
8. **Destructive backup actions** are adjacent to normal settings with no confirmation/role gating in the UI.

---

## 7. Visual/state evidence

Playwright produced, for each failure:
- `qa/test-results/login-login-session-logs-i-d3b98--and-survives-a-page-reload-chromium/test-failed-1.png`
- `qa/test-results/rbac-role-based-route-enfo-006e4-nly-pages-by-typing-the-URL-chromium/test-failed-1.png`
- `qa/test-results/rbac-role-based-route-enfo-c89bc-s-not-expose-admin-settings-chromium/test-failed-1.png`
- `qa/test-results/reports-reports-module-PDF-36f9a-n-a-date-preset-is-selected-chromium/test-failed-1.png`
- `qa/test-results/reports-reports-module-inc-58a1d-kend-supported-payment-mode-chromium/test-failed-1.png`

Each also has `error-context.md` and a `trace.zip` (open with `npx playwright show-trace <zip>`).

---

## 8. Design-system health

| Signal | Assessment |
|---|---|
| Component consistency | Good — AntD cards/tables/forms used throughout |
| Deprecated APIs | `Card bordered`, `Space direction`, `Drawer width`, `Modal destroyOnClose`, `Alert message` (AntD 6) |
| Dead code/imports | ~20 TS6133 warnings across components |
| Type safety | 46 TS errors; build still succeeds (Vite esbuild ignores types) |
| Icon usage | Consistent lucide-react, but several unused icons |
| Bundle weight | 500 KB gzip initial (see performance) |

---

## 9. Prioritized UX fixes

| Priority | Fix |
|---|---|
| P0 | Add UPI/Cheque to `PAYMENT_MODES` and localise labels |
| P0 | Fix the PDF export scope bug |
| P1 | Guard admin/manager routes in `renderPage()` and show a 403 page |
| P1 | Add `aria-label` to the year selector; fix contrast; add `<main>`/`<h1>` |
| P2 | Add a 404 page; expose pagination on long lists |
| P2 | Replace deprecated AntD props |
| P3 | Remove unused imports; add type-check + axe CI gates |

---

## 10. Verdict

The UI is **visually coherent and functional on the happy path** — every route renders, mobile layout does not overflow, localisation and currency formatting are correct, and core data entry works. It is **not release-ready** because a primary workflow (payment modes) is incomplete, the main export crashes, admin pages are reachable by direct URL, and the dashboard fails a critical accessibility rule.

Fixing the P0/P1 items above would bring the UI to a credible launch state; the accessibility and type-safety debt should be scheduled immediately after.
