# SPEC.md — Project Stash (Local Webapp)

## 1. Project overview

A single-user, **local-only** web application that helps anyone paid on a biweekly schedule build a 6-month budget plan with a target savings rate. The app collects user inputs through a questionnaire, then displays an interactive dashboard showing per-paycheck allocations, monthly budgets, savings projections, and recurring-charge tracking.

**Non-goals:**
- No authentication, no multi-user accounts, no cloud sync.
- No external deployment — runs on `localhost` only.
- No financial-institution integrations (no Plaid, no bank APIs).
- No real-money movement — this is a planning/tracking tool only.

**Out-of-scope for v1 (note for future):** monthly pay schedules, semi-monthly (1st/15th) pay schedules, weekly pay, hourly/variable income.

---

## 2. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Single dev server, file-based routing, great DX |
| Language | **TypeScript** (strict mode) | Catches budget-math bugs at compile time |
| Styling | **Tailwind CSS** | Fast iteration, no CSS file sprawl |
| Charts | **Recharts** | Clean React API, handles everything in spec |
| Date math | **date-fns** | Avoid timezone landmines with native `Date` |
| Persistence | **localStorage** (v1) — abstract behind a `StorageAdapter` interface | Trivial to swap for SQLite/IndexedDB later |
| Forms | **React Hook Form + Zod** | Validation matches the data model |
| Package manager | **pnpm** (or npm if user prefers) | — |
| Testing | **Vitest** for unit tests on the budget engine | Pure-function logic must be tested |

**No backend.** All logic runs in the browser. App should work fully offline once loaded.

---

## 3. User flow

```
[ Landing / Welcome ]
        │
        ▼
[ Questionnaire (multi-step wizard) ]
   ├─ Step 1: Income
   ├─ Step 2: Fixed expenses
   ├─ Step 3: Variable expenses
   ├─ Step 4: Subscriptions
   ├─ Step 5: Savings goal & allocation
   └─ Step 6: Review & confirm
        │
        ▼
[ Dashboard ] ◄─── (user can edit any input here too)
   ├─ Summary tab
   ├─ Per-Paycheck tab
   ├─ Monthly Budget tab
   ├─ Subscriptions tab
   └─ Settings tab (reset, export, import)
```

First-time visit: questionnaire is mandatory. Returning visit: skip straight to dashboard. A "Start over" button in Settings clears localStorage and re-runs the questionnaire.

---

## 4. Data model

All amounts are stored as **numbers in the user's currency unit** (no cents/integer math in v1 — `Number` is fine for typical household budgets; document this as a known tradeoff). Currency symbol is configurable but defaults to `$`.

```typescript
type Frequency = 'biweekly'; // v1 only supports biweekly; enum is here for future expansion

type Income = {
  netPerPaycheck: number;          // e.g. 2180
  frequency: Frequency;            // 'biweekly'
  firstPaycheckDate: string;       // ISO date, e.g. '2026-05-01'
  payDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // derived from firstPaycheckDate; cached
};

type FixedExpense = {
  id: string;                      // uuid
  name: string;                    // 'Rent + internet'
  amount: number;                  // monthly amount
  dueDayOfMonth: number;           // 1-31; the day this bill is typically due
  category: 'housing' | 'utilities' | 'transport' | 'insurance' | 'subscription' | 'other';
};

type VariableExpense = {
  id: string;
  name: string;                    // 'Groceries', 'Takeout', etc.
  monthlyBudget: number;           // user's monthly cap
  isCap: boolean;                  // true = hard cap (e.g. takeout); false = soft target
};

type Subscription = {
  id: string;
  name: string;
  monthlyAmount: number;
  usedRecently: boolean;           // user-set flag
  markedForCancel: boolean;
};

type SavingsBucket = {
  id: string;
  name: string;                    // user-defined: 'RRSP', 'TFSA', 'Roth IRA', 'House fund', etc.
  percentageOfSavings: number;     // 0–1; sum across all buckets must equal 1
  notes?: string;
};

type SavingsGoal = {
  targetRate: number;              // 0–1; e.g. 0.5 for 50%
  buckets: SavingsBucket[];
};

type BudgetState = {
  schemaVersion: number;           // start at 1; bump on breaking changes for migration
  currency: string;                // '$' default
  createdAt: string;               // ISO timestamp
  updatedAt: string;
  income: Income;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  subscriptions: Subscription[];
  savingsGoal: SavingsGoal;
};
```

`Subscription` totals roll up into a synthetic `FixedExpense` row labeled "Subscriptions" in computed views — they are NOT stored as a separate FixedExpense to avoid double-counting. The engine sums `subscriptions[].monthlyAmount` where `markedForCancel === false`.

---

## 5. Budget engine (core logic — must be pure functions, fully unit-tested)

All functions live in `src/lib/budget/` and take `BudgetState` (or relevant slice) as input. No side effects, no I/O.

### 5.1 Paycheck schedule

```typescript
function generatePaychecks(
  firstPaycheckDate: Date,
  windowMonths: number  // e.g. 6
): Paycheck[]
```

Generates every paycheck date from `firstPaycheckDate` until `firstPaycheckDate + windowMonths`, stepping by 14 days. Returns:

```typescript
type Paycheck = {
  index: number;          // 0-based
  date: string;           // ISO
  monthKey: string;       // 'YYYY-MM'
  amount: number;         // = income.netPerPaycheck
};
```

**Edge case:** Months with 3 paychecks fall out naturally; do not special-case them in this function. Downstream logic detects them by grouping on `monthKey`.

### 5.2 Per-paycheck allocation

This is the core algorithm. For each paycheck, assign:

1. **Fixed bills due before the next paycheck.**
   For each `FixedExpense`, compute its due date in the paycheck's month (or next month, if the paycheck falls in the last 14 days and the bill is due on/after the 1st of next month). Assign the bill to the **most recent paycheck** whose date is `≤ dueDate` AND within 14 days of `dueDate`.

   **Special rule for housing (`category === 'housing'`):** when a month has 3 paychecks, the 3rd paycheck is the funding source for *next* month's housing payment. This is what "advance rent" means — the 3rd paycheck of May funds June's rent rather than going entirely to savings.

2. **Variable allowance.** Compute once: `variableAllowancePerPaycheck = sum(variableExpenses.monthlyBudget) / 2`. This represents a 2-week spending allowance, evenly split.

   *Rationale:* Months don't divide evenly into biweekly periods (avg 2.17 paychecks/month), but for user simplicity we use 2 as the divisor. The "extra" allowance from 3-paycheck months becomes additional buffer/savings, which is fine.

3. **Savings = paycheck amount − bills assigned − variable allowance.**

Output:

```typescript
type PaycheckAllocation = {
  paycheck: Paycheck;
  job: string;                     // human-readable: 'May rent', 'Utilities cycle', 'EXTRA SAVINGS', etc.
  billsPaid: { name: string; amount: number }[];
  totalBills: number;
  variableAllowance: number;
  savings: number;
  notes: string;                   // e.g. 'Funds June rent (3rd paycheck of month)'
};
```

### 5.3 Monthly rollup

```typescript
function monthlyRollup(allocations: PaycheckAllocation[]): MonthlySummary[]
```

Groups by `monthKey`. For each month, returns:

```typescript
type MonthlySummary = {
  monthKey: string;
  paycheckCount: number;
  netIncome: number;
  fixedSpending: number;           // budgeted, from FixedExpense rows
  variableSpending: number;        // budgeted, from VariableExpense rows
  totalSpending: number;
  budgetedSavings: number;         // netIncome - totalSpending
  savingsRate: number;             // budgetedSavings / netIncome
  hitsGoal: boolean;               // savingsRate >= savingsGoal.targetRate
};
```

### 5.4 Savings allocation across buckets

```typescript
function allocateSavings(
  totalSavings: number,
  buckets: SavingsBucket[]
): { bucketId: string; amount: number }[]
```

Trivial: multiply by percentage. Validate buckets sum to 1.0 (±0.001 for floating-point).

### 5.5 Validation

A `validateBudgetState(state: BudgetState): ValidationResult` function checks:
- Savings bucket percentages sum to 1.0
- All amounts ≥ 0
- `firstPaycheckDate` is a valid date
- Target savings rate is between 0 and 1
- No duplicate IDs

Surfaced as inline form errors in the UI.

---

## 6. UI / pages

### 6.1 Welcome page (`/`)

- App title, one-paragraph intro.
- Two buttons: "Start questionnaire" (first-time) and "Continue" (if `localStorage` has saved state).
- Footer: "100% local — your data never leaves your device."

### 6.2 Questionnaire (`/setup`)

Multi-step wizard. Each step has Back/Next, progress indicator, and inline validation. On the final step, "Save & continue" persists to localStorage and routes to `/dashboard`.

**Step 1 — Income**
- Net per paycheck (after tax, what hits the bank)
- First paycheck date (date picker; default = next Friday)
- Frequency = biweekly (locked in v1; show as disabled radio with note "more options coming soon")

**Step 2 — Fixed expenses**
- Pre-populated empty rows for: Rent/mortgage, Utilities, Phone, Internet, Car payment, Car insurance.
- Each row: name, monthly amount, due day of month, category dropdown.
- "+ Add another" button.
- "Skip this category" toggle for items that don't apply (e.g. no car).

**Step 3 — Variable expenses**
- Pre-populated rows for common categories: Groceries, Dining out, Coffee, Entertainment, Personal care, Gas, Buffer.
- Each row: name, monthly budget, "is this a hard cap?" checkbox.
- "+ Add another" button.

**Step 4 — Subscriptions**
- Helper text: "Pull your last 90 days of statements to find recurring charges. Most people miss 2–3."
- Pre-populated row suggestions (Netflix, Spotify, etc.) but all empty by default; user fills in only what applies.
- Each row: name, monthly amount, "used in last 30 days?" checkbox.

**Step 5 — Savings goal**
- Slider for target savings rate, 10%–80%, default 30%.
- "Add savings buckets" — user names them (e.g. "Retirement", "House fund", "Brokerage") and assigns percentage. Default: one bucket "General savings" at 100%.
- Live preview of monthly $ per bucket as user types.
- Validation: percentages must sum to 100%.

**Step 6 — Review**
- Read-only summary of everything entered.
- Computed preview: "Your monthly savings will be ~$X (Y% of income)."
- "Looks good — go to dashboard" button.

### 6.3 Dashboard (`/dashboard`)

Tabbed interface (use Next.js layout + tab routes, or a single page with tab state — implementer's choice).

**Tab 1: Summary**
- Big number: "6-month savings projection: $X,XXX"
- Big number: "Effective savings rate: XX%"
- Goal indicator (✓ or ✗ vs. target rate)
- Pie chart: spending breakdown (fixed vs. variable vs. savings)
- Bar chart: monthly savings across the 6 months (highlights 3-paycheck months)
- Sankey diagram (optional, nice-to-have): income → spending categories + savings buckets

**Tab 2: Per Paycheck**
- Table of all paychecks in the 6-month window.
- Columns: Date, Job, Bills paid (expandable), Variable allowance, Savings, Notes.
- 3-paycheck month rows are visually highlighted (subtle background tint).
- "Advance rent" rows have an icon + tooltip explaining the funding logic.
- Below the table: "Variable allowance breakdown — $X every 2 weeks" with a per-category list.

**Tab 3: Monthly Budget**
- 6-month table: rows = categories, columns = months + 6-mo total.
- Two views toggle: "Budgeted" (default) and "Actual" (user-input cells; saved per-month to localStorage under a separate `actuals` key — keeping `BudgetState` clean).
- Bottom rows: total spending, savings, savings rate, "Hit goal?" indicator per month.

**Tab 4: Subscriptions**
- Table of all subscriptions, sortable by amount.
- Total monthly + total annual.
- Highlight rows where `usedRecently === false` — these are cancellation candidates.
- "Mark for cancel" toggles update the row visually; UI shows projected savings if user cancels everything marked.

**Tab 5: Settings**
- Currency selector
- Edit any input (jumps back to relevant questionnaire step)
- Export budget as JSON (download)
- Import budget from JSON (file picker)
- "Start over" — wipes localStorage after confirmation

---

## 7. Persistence

- All state under one localStorage key: `budget-planner:v1`
- Store the full `BudgetState` as JSON.
- Store monthly `actuals` (user-tracked spending) under `budget-planner:v1:actuals`, keyed by `monthKey`.
- On app load: read `schemaVersion`. If lower than current, run migration. If unreadable, treat as no state and route to `/`.
- Auto-save on every change (debounced 500ms).
- All persistence goes through a `StorageAdapter` interface so it can be swapped (e.g. for IndexedDB) without touching components.

---

## 8. Privacy & security

- **No telemetry, no analytics, no third-party scripts.** Verify by checking that the network tab is empty after page load (other than initial bundle).
- Add a `<meta name="referrer" content="no-referrer">` and CSP headers (even though local) to make the security posture explicit.
- README must state: "All data lives in your browser's localStorage. Clearing browser data deletes the budget. Use Export to back up."

---

## 9. Project structure

```
project-stash/
├── README.md
├── SPEC.md                       # this file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # welcome
│   │   ├── setup/
│   │   │   └── page.tsx          # questionnaire wizard
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       ├── page.tsx          # default tab = summary
│   │       ├── per-paycheck/page.tsx
│   │       ├── monthly/page.tsx
│   │       ├── subscriptions/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                   # buttons, inputs, modals (small kit, no shadcn dependency required)
│   │   ├── charts/
│   │   ├── questionnaire/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── budget/
│   │   │   ├── paychecks.ts      # generatePaychecks
│   │   │   ├── allocate.ts       # per-paycheck allocation
│   │   │   ├── rollup.ts         # monthly rollup
│   │   │   ├── savings.ts        # bucket allocation
│   │   │   ├── validate.ts
│   │   │   └── index.ts
│   │   ├── storage/
│   │   │   ├── adapter.ts        # StorageAdapter interface
│   │   │   ├── localStorage.ts   # default implementation
│   │   │   └── migrations.ts
│   │   └── types.ts              # all type definitions from §4
│   └── tests/
│       └── budget/               # Vitest tests for every function in lib/budget/
└── .gitignore
```

---

## 10. Build phases (suggested — Claude Code, prioritize in order)

**Phase 1: Engine first.** Implement everything in `src/lib/budget/` with full unit tests. No UI yet. Tests must cover:
- 6-month windows starting on different days of the week
- Months with 2 vs 3 paychecks
- Fixed bill due dates that fall on/before/after paycheck dates
- The "advance rent in 3-paycheck month" rule
- Edge case: paycheck that falls on the same day as a bill due date (paycheck pays it)
- Bucket percentages that don't sum to 1.0 (validation error)

**Phase 2: Questionnaire.** All 6 steps, with validation, persisting to localStorage on completion.

**Phase 3: Dashboard — Summary + Per Paycheck tabs.** These are the highest-value views.

**Phase 4: Dashboard — Monthly Budget tab with actuals tracking.**

**Phase 5: Dashboard — Subscriptions + Settings.**

**Phase 6: Polish.** Empty states, loading states, error boundaries, mobile responsiveness, accessibility pass (keyboard nav, ARIA labels, color contrast).

---

## 11. Acceptance criteria for v1

- A new user can complete the questionnaire in under 5 minutes.
- The dashboard correctly identifies and labels 3-paycheck months.
- Closing and reopening the browser preserves all data.
- Export → wipe → import round-trips without data loss.
- All budget engine functions have ≥90% test coverage.
- No console errors on a clean run-through.
- Lighthouse accessibility score ≥ 90.

---

## 12. Open questions (decide before/during implementation)

1. Should the questionnaire allow the user to skip directly to "I just want to play with numbers" with sample data pre-loaded? (Suggest: yes, add a "Try with sample data" link on the welcome page.)
2. How to handle bills that don't fit cleanly into a calendar month (annual insurance, quarterly tax)? (Suggest: out of scope for v1; document as future work.)
3. Should the app warn if savings rate target is unrealistically high given fixed expenses? (Suggest: yes, validation in Step 5 — if `(income - fixedExpenses - 0.5*variableExpenses) / income < targetRate`, show a warning.)

---

## 13. Notes for the implementer

- **Be conservative with dependencies.** The whole app should run on ~10 npm packages.
- **The budget engine is the contract.** UI changes are easy; engine bugs corrupt user planning. Treat `src/lib/budget/` as the load-bearing wall — write tests first.
- **Don't over-design v1.** No drag-and-drop, no animations beyond standard transitions, no dark mode toggle (just respect `prefers-color-scheme`).
- **Ask before adding scope.** If a feature isn't in this spec, surface it as a question rather than building it speculatively.

