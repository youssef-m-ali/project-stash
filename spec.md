# SPEC.md — Project Stash (Local Webapp)

## 1. Project overview

A single-user, **local-only** web application for people paid biweekly who want to track real
spending — not project it. Each paycheck period is a clean slate: you upload weekly CSVs from
your bank accounts, approve every transaction into a spending "bucket," and watch the buckets
fill up against your per-paycheck plan.

**Non-goals:**
- No authentication, no multi-user accounts, no cloud sync.
- No external deployment — runs on `localhost` only.
- No bank API integrations (no Plaid). CSV upload only.
- No real-money movement — planning/tracking tool only.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Styling | Tailwind CSS |
| Date math | date-fns |
| Persistence | SQLite via better-sqlite3 (server-side) |
| Forms | React Hook Form + Zod |
| Testing | Vitest |

No Recharts needed — bucket fills are pure CSS progress bars.

---

## 3. Core concepts

### Buckets
User-defined spending categories, each with a planned amount per paycheck (2-week period).
Examples: Groceries $300, Dining Out $150, Gas $100, Savings $800.
Buckets replace the old fixed/variable/subscriptions/savings-buckets split entirely.

### Paycheck periods
Biweekly windows derived from the user's first paycheck date. Period 0 starts on
`firstPaycheckDate`, ends on `firstPaycheckDate + 13 days`. Period 1 starts 14 days later, etc.
The dashboard always shows the current period. History shows past periods.

### Transaction approval
Every imported transaction starts as `pending`. The user reviews it, assigns a bucket, and
approves it. Approved transactions fill the bucket. Ignored transactions are hidden.

### Merchant memory
When a transaction is approved, the app normalizes the merchant name (e.g.
"SOBEYS #4321 TORONTO ON" → "sobeys") and saves `{merchantKey → bucketId}`. The next time
that merchant appears, the bucket is pre-filled in the review queue.

---

## 4. User flow

```
[ / ] ──→ if setup: /dashboard | if not: /setup
           │
[ /setup ] 3-step wizard:
   Step 1: Income (net per paycheck, first paycheck date)
   Step 2: Buckets (name + amount per paycheck for each category)
   Step 3: Accounts (chequing + credit card)
           │
[ /dashboard ] — current period bucket fills + pending count
[ /review ]    — approve / ignore each pending transaction
[ /import ]    — drag-and-drop weekly CSV files
[ /history ]   — past paycheck periods
[ /settings ]  — edit buckets, income, accounts; manage merchant memory
```

First-time visit: setup wizard is mandatory. Returning visit: skip straight to dashboard.
"Reset" in Settings wipes the database and re-runs the wizard.

---

## 5. Data model

All amounts stored as numbers in the user's currency unit. Currency symbol defaults to `$`.

```typescript
type Bucket = {
  id: string;
  name: string;
  amountPerPaycheck: number;   // planned spend per 2-week period
  color: string;               // hex color for progress bar
  sortOrder: number;
};

type PaycheckPeriod = {
  id: string;          // = startDate (YYYY-MM-DD), used as PK
  startDate: string;
  endDate: string;     // startDate + 13 days
  paycheckAmount: number;
};

type Transaction = {
  id: string;          // sha256(date|description|rawAmount|accountId) — dedup key
  accountId: string;
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // positive = outflow (spending); negative = credit/refund
  rawAmount: number;   // original CSV value before normalization
  bucketId: string | null;
  periodId: string | null;
  status: 'pending' | 'approved' | 'ignored';
  importedAt: string;
};

type MerchantMemory = {
  merchantKey: string;  // normalized description (see §8)
  bucketId: string;
  lastSeen: string;     // ISO date
  count: number;        // times approved to this bucket
};

// ParsedTransaction — ephemeral, used during preview before import
type ParsedTransaction = Omit<Transaction, 'id' | 'importedAt'> & {
  tempId: string;
  duplicate: boolean;
  suggestedBucketId: string | null;  // from merchant_memory at preview time
};

type AccountKind = 'chequing' | 'credit-card';
type Account = {
  id: string;
  label: string;
  kind: AccountKind;
  isPassThrough: boolean;  // true = credit card paid from chequing (skip double-count)
};

type BudgetState = {
  schemaVersion: 4;
  currency: string;
  income: {
    netPerPaycheck: number;
    firstPaycheckDate: string;  // ISO date; used to compute all period boundaries
    frequency: 'biweekly';
  };
  accounts: Account[];
  buckets: Bucket[];
};
```

---

## 6. DB schema (SQLite, schema version 4)

```sql
budget_config    (id INTEGER PK, currency TEXT, schema_version INTEGER)
income           (id INTEGER PK, net_per_paycheck REAL, first_paycheck_date TEXT, frequency TEXT)
accounts         (id TEXT PK, label TEXT, kind TEXT, is_pass_through INTEGER)
buckets          (id TEXT PK, name TEXT, amount_per_paycheck REAL, color TEXT, sort_order INTEGER)
paycheck_periods (id TEXT PK, start_date TEXT, end_date TEXT, paycheck_amount REAL)
transactions     (id TEXT PK, account_id TEXT FK→accounts, date TEXT, description TEXT,
                  amount REAL, raw_amount REAL, bucket_id TEXT FK→buckets,
                  period_id TEXT FK→paycheck_periods, status TEXT, imported_at TEXT)
merchant_memory  (merchant_key TEXT PK, bucket_id TEXT FK→buckets, last_seen TEXT, count INTEGER)
```

Indexes: `idx_tx_date`, `idx_tx_period`, `idx_tx_status`, `idx_tx_account`, `idx_periods_start`.

---

## 7. UI design

### Dashboard (`/dashboard`)

```
┌─ Apr 28 – May 11, 2026 ──────────── Net: $2,400 · 12 pending →/review ─┐
│                                                                           │
│  Groceries         $420 / $600   [████████░░░░░] 70%                    │
│  Dining Out         $85 / $150   [████████░░░░░] 57%                    │
│  Gas                $60 / $100   [██████░░░░░░░] 60%                    │
│  Entertainment      $20 / $80    [███░░░░░░░░░░] 25%                    │
│  Utilities           $0 / $200   [░░░░░░░░░░░░░]  0%                    │
│  Savings           $800 / $800   [█████████████] ✓ FULL                 │
│                                                                           │
│  Total: $1,385 of $1,930 planned · $1,015 remaining                     │
└───────────────────────────────────────────────────────────────────────────┘
```

Progress bars are pure CSS (no Recharts). Color from `bucket.color`.
Over-budget buckets highlight red with an "OVER" badge.

### Review queue (`/review`)

```
12 transactions need approval          [ Approve all suggested ]

Apr 29  Sobeys              -$87.43   [ Groceries ▼ ]  [✓ Approve] [✗ Ignore]
Apr 29  Tim Hortons          -$6.50   [ Dining Out ▼ ] [✓ Approve] [✗ Ignore]
Apr 28  Netflix             -$16.99   [ — select — ▼ ] [✓ Approve] [✗ Ignore]
```

- Bucket selector pre-filled from merchant memory (yellow tint when auto-suggested)
- "Approve" button disabled until a bucket is selected
- "Approve all suggested" approves every row that already has a bucket pre-filled
- Row removal after approve/ignore is optimistic (no re-fetch)

### History (`/history`)

List of past paycheck periods (most recent first), each expandable to show:
- Bucket summary: planned vs. actual for each bucket
- Total spent vs. total planned

### Settings (`/settings`)

- **Income section**: edit netPerPaycheck + firstPaycheckDate; triggers period regeneration
- **Buckets section**: add / edit / reorder / delete buckets with live total-per-paycheck footer
- **Accounts section**: add / edit / delete bank accounts
- **Merchant memory section**: table of all saved merchant→bucket mappings; delete individual entries
- **Danger zone**: "Reset everything" — wipes DB, redirects to /setup

---

## 8. Merchant normalization

`normalizeMerchant(description: string): string`

Steps (in order):
1. Lowercase + trim
2. Strip store numbers: `\s*#\d+\b` → `''`
3. Strip trailing 2-letter codes (province abbreviations): `\s+[a-z]{2}$` → `''`
4. Strip non-alphanumeric characters (except spaces)
5. Collapse whitespace
6. Filter noise words: `canada inc ltd corp co the online ca store market purchase`
7. Take first 2 meaningful words

Examples:
- `"SOBEYS #4321 TORONTO ON"` → `"sobeys toronto"` (province stripped, store# stripped)
- `"TIM HORTONS #187"` → `"tim hortons"`
- `"NETFLIX.COM"` → `"netflixcom"`
- `"METRO INC"` → `"metro"`

---

## 9. Period logic

### Generating periods

```typescript
function generatePeriods(
  firstPaycheckDate: string,   // YYYY-MM-DD
  netPerPaycheck: number,
  windowMonths?: number        // default 24
): PaycheckPeriod[]
```

Steps by 14 days from `firstPaycheckDate` for `windowMonths` months. Each period:
- `id` = `startDate`
- `endDate` = `startDate + 13 days`

Stored in `paycheck_periods` table. Regenerated whenever income changes.

### Assigning transactions to periods

`assignPeriodsToTransactions()` — SQL UPDATE:
```sql
UPDATE transactions
SET period_id = (
  SELECT id FROM paycheck_periods
  WHERE start_date <= transactions.date AND transactions.date <= end_date
  LIMIT 1
)
WHERE period_id IS NULL
```

Run after every import and after period regeneration.

---

## 10. API routes

| Method | Route | Purpose |
|---|---|---|
| GET/POST/DELETE | `/api/config` | Full BudgetState CRUD |
| GET | `/api/dashboard` | Current period + bucket fill totals (SQL aggregate) |
| GET | `/api/periods` | All paycheck periods |
| POST | `/api/periods/regenerate` | Rebuild periods after income change |
| GET | `/api/review` | Pending transactions + suggestedBucketId from merchant_memory |
| PATCH | `/api/transactions/[id]` | Approve (upserts merchant_memory) or ignore |
| GET | `/api/transactions` | Filtered by `?periodId` / `?status` / `?bucketId` |
| POST | `/api/transactions/preview` | Parse CSVs, attach suggestedBucketId |
| POST | `/api/transactions/import` | Persist rows, call assignPeriodsToTransactions() |
| GET/POST | `/api/buckets` | List / create buckets |
| PATCH/DELETE | `/api/buckets/[id]` | Update / delete a bucket |
| GET | `/api/merchant-memory` | List all merchant→bucket mappings |
| DELETE | `/api/merchant-memory/[key]` | Forget a merchant mapping |

---

## 11. Project structure

```
project-stash/
├── SPEC.md
├── src/
│   ├── app/
│   │   ├── layout.tsx           # root layout (fonts, body)
│   │   ├── page.tsx             # redirect: /dashboard if setup, else /setup
│   │   ├── setup/page.tsx       # 3-step wizard (no nav)
│   │   ├── (app)/               # route group — shares AppProvider + DashboardNav
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── review/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── config/route.ts
│   │       ├── dashboard/route.ts
│   │       ├── periods/route.ts
│   │       ├── periods/regenerate/route.ts
│   │       ├── review/route.ts
│   │       ├── buckets/route.ts
│   │       ├── buckets/[id]/route.ts
│   │       ├── merchant-memory/route.ts
│   │       ├── merchant-memory/[merchantKey]/route.ts
│   │       └── transactions/
│   │           ├── route.ts
│   │           ├── preview/route.ts
│   │           ├── import/route.ts
│   │           └── [id]/route.ts
│   ├── components/
│   │   ├── ui/                  # Button, Input, Label, Select, FieldError
│   │   ├── dashboard/
│   │   │   ├── DashboardNav.tsx
│   │   │   ├── PeriodHeader.tsx
│   │   │   ├── BucketFillRow.tsx
│   │   │   └── StatCard.tsx
│   │   ├── questionnaire/
│   │   │   ├── StepIncome.tsx
│   │   │   ├── StepBuckets.tsx  # NEW
│   │   │   └── StepAccounts.tsx
│   │   └── import/
│   │       ├── FileDropZone.tsx
│   │       ├── AccountSelector.tsx
│   │       ├── PreviewTable.tsx
│   │       └── ImportSummaryBanner.tsx
│   ├── lib/
│   │   ├── types.ts
│   │   ├── context/AppContext.tsx
│   │   ├── db/index.ts          # SQLite init + migrateToV4 + helpers
│   │   ├── periods/
│   │   │   └── generatePeriods.ts
│   │   └── import/
│   │       ├── detectFormat.ts
│   │       ├── parseCsv.ts
│   │       ├── parseCibcChequing.ts
│   │       ├── parseCibcCc.ts
│   │       ├── parseScotiabankChequing.ts
│   │       ├── parseScotiabankCc.ts
│   │       ├── parseGeneric.ts
│   │       ├── parseUtils.ts
│   │       ├── hashTransaction.ts
│   │       ├── applyIgnoreRules.ts
│   │       └── normalizeMerchant.ts  # NEW
│   └── tests/
│       ├── import/
│       │   ├── parsers.test.ts       # updated (drop CategoryRule tests)
│       │   └── normalizeMerchant.test.ts  # NEW
│       └── periods/
│           └── generatePeriods.test.ts    # NEW
└── data/budget.db
```

---

## 12. Acceptance criteria

- New user completes the 3-step setup in under 2 minutes
- Import a CSV → transactions appear in review queue with suggested buckets pre-filled
- Approve a transaction → bucket fill updates on dashboard immediately on next load
- Re-import same CSV → transactions are marked as duplicates (not re-inserted)
- Same merchant approved again → bucket pre-filled automatically in future imports
- Period boundary changes on paycheck date → `/dashboard` shows new (empty) period
- `/history` shows correct actuals for past periods
- "Reset everything" wipes DB and redirects to `/setup`
- No console errors on a clean setup-to-dashboard flow
- `pnpm test` passes all unit tests

---

## 13. Notes for the implementer

- **No Recharts.** Bucket fills are CSS `<div>` progress bars — simpler, faster, no dependency.
- **Server-side aggregation.** `/api/dashboard` computes `SUM(amount) GROUP BY bucket_id` in SQL. Do not ship all transactions to the client.
- **Merchant normalization is best-effort.** False matches (two different "metro" stores) are less harmful than false non-matches. Users can always override in the review queue.
- **Optimistic UI in review.** Removing a row after approve/ignore does not require a re-fetch — just splice it from local state.
- **Period assignment is lazy + backfill.** `assignPeriodsToTransactions()` only touches rows where `period_id IS NULL`. Run it after every import and after income changes.
- **`(app)` route group** in Next.js App Router adds shared layout without changing URLs.
