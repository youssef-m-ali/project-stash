# Tauri Migration Plan: Next.js → Tauri 2

**Total estimated effort: ~28–45 hours across 6 phases** (Phase 7 skipped — no prod data)

---

## Phase 1 — Tauri scaffold alongside Next.js (~4–6 h)

Install Tauri + Vite without breaking the existing dev server. Both run in parallel temporarily.

**Create:**
- `src-tauri/` directory with `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `capabilities/default.json`
- `vite.config.ts` — new Vite+React config (replaces Next.js build pipeline)
- `index.html` — Vite entrypoint (replaces `src/app/layout.tsx` as HTML shell)

**Modify:** `package.json` (add `@tauri-apps/api`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-dialog`, Vite deps, `"tauri"` script), `tsconfig.json` (remove `next` plugin, switch to ESNext/Bundler).

> **Gotcha:** First `cargo build` downloads ~600 MB of crates. `tauri.conf.json`'s `devUrl` must match Vite's port exactly or the webview shows blank.

---

## Phase 2 — Router swap: Next.js → React Router v7 (~3–5 h)

Establish the React Router route tree mirroring the current App Router structure. Every page component drops in with minimal changes.

**Create:** `src/main.tsx`, `src/router.tsx`

**Modify 8 files:**

| File | Change |
|---|---|
| `src/lib/context/AppContext.tsx` | `useRouter` → `useNavigate`, `router.push` → `navigate` |
| `src/components/dashboard/DashboardNav.tsx` | `usePathname` → `useLocation().pathname`, `next/link` → react-router `Link` |
| `src/components/dashboard/PeriodHeader.tsx` | `next/link` → react-router `Link` |
| `src/components/import/ImportSummaryBanner.tsx` | Same `Link` swap |
| `src/app/page.tsx` | `useRouter` → `useNavigate` |
| `src/app/setup/page.tsx` | `useRouter` → `useNavigate` |
| `src/app/(app)/settings/page.tsx` | `useRouter` → `useNavigate` |
| `src/app/layout.tsx` | Remove next/font, metadata export; move `<html>/<body>` shell to `index.html` |

> **Gotcha:** The `(app)` route group maps to a pathless parent layout route in React Router. `<Link href>` → `<Link to>`. `'use client'` directives are harmless no-ops — clean up in Phase 5.

---

## Phase 3 — DB layer: `better-sqlite3` → `tauri-plugin-sql` (~6–10 h)

All SQL becomes async. No direct equivalent of `db.transaction()` — emulate with explicit `BEGIN`/`COMMIT`/`ROLLBACK`.

**Create 4 new files replacing `src/lib/db/index.ts`:**

| New file | Content |
|---|---|
| `src/lib/db/client.ts` | Singleton `Database` instance + async `initDb()` called before React renders |
| `src/lib/db/migrations.ts` | Port of `migrateToV4()` + `addMissingColumns()` |
| `src/lib/db/schema.ts` | All `CREATE TABLE IF NOT EXISTS` / index DDL (each as a separate `await db.execute()`) |
| `src/lib/db/helpers.ts` | Async `regeneratePeriods()`, `assignPeriodsToTransactions()`, `FIXED_EXPENSES_BUCKET_ID` |

**Modify:** `src/lib/import/hashTransaction.ts` — `crypto.createHash` (Node) → `crypto.subtle.digest` (Web Crypto API). Changes function from sync to async — ripples into Phase 4.

> **Gotchas:** `tauri-plugin-sql` doesn't support multi-statement `exec()` — split every `CREATE TABLE` into its own call (~18 total). DB path `sqlite:budget.db` resolves to `~/Library/Application Support/com.stashup.app/budget.db` automatically.

**Transaction emulation pattern:**
```typescript
await db.execute('BEGIN', []);
try {
  await db.execute(sql1, params1);
  await db.execute(sql2, params2);
  await db.execute('COMMIT', []);
} catch (e) {
  await db.execute('ROLLBACK', []);
  throw e;
}
```

**`initDb()` call site in `src/main.tsx`:**
```typescript
import { initDb } from './lib/db/client';
initDb().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
```

---

## Phase 4 — Migrate 14 API routes to query modules (~10–16 h)

For each route group: extract SQL into `src/lib/db/queries/[feature].ts`, then replace all `fetch('/api/...')` calls in components with direct function calls. Do one route group at a time — each is independently shippable.

**Start with `queries/config.ts`** — it unblocks AppContext + Settings simultaneously.

| Module | Replaces route(s) | Consumers |
|---|---|---|
| `config.ts` | `/api/config`, `/api/periods/regenerate` | `AppContext.tsx`, `page.tsx`, `setup/page.tsx`, `settings/page.tsx` |
| `buckets.ts` | `/api/buckets`, `/api/buckets/[id]` | `review/page.tsx`, `history/page.tsx`, settings |
| `accounts.ts` | `/api/accounts/last-import`, `/api/accounts/[id]/csv-mapping` | `import/page.tsx` |
| `transactions.ts` | `/api/transactions/*`, `/api/transactions/import`, `/api/transactions/preview` | `import/page.tsx`, `history/page.tsx`, `review/page.tsx` |
| `subtransactions.ts` | `/api/subtransactions/[id]`, `/api/transactions/[id]/subtransactions` | `BucketTransactionsPanel.tsx` |
| `dashboard.ts` | `/api/dashboard` | `dashboard/page.tsx` (hardest — multi-CTE, synthesised periods) |
| `review.ts` | `/api/review` | `review/page.tsx` |
| `merchantMemory.ts` | `/api/merchant-memory/*` | settings |
| `merchantExemptions.ts` | `/api/merchant-exemptions/*` | settings, review |
| `periods.ts` | `/api/periods` | absorbed into config |

> **Gotchas:** `hashTransaction` is now async — `previewTransactions` and `importTransactions` must `await` it. No more `decodeURIComponent` on merchant keys. No more `NextResponse.json()` — functions return data directly.

---

## Phase 5 — Remove Next.js (~2–3 h)

**Delete:**
- `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`
- `src/app/api/` (entire directory)
- `src/lib/db/index.ts`

**Remove packages:** `next`, `better-sqlite3`, `eslint-config-next`, `@types/better-sqlite3`

**Update scripts in `package.json`:** `"dev": "vite"`, `"build": "vite build"`, remove `"start"`.

**Remove `'use client'` directives:**
```bash
grep -rl "'use client'" src/ --include="*.tsx" | xargs sed -i "" "s/'use client';//g"
```

---

## Phase 6 — Native file picker (optional, ~2–3 h)

Add a native macOS "Browse files" button to `src/components/import/FileDropZone.tsx` using `@tauri-apps/plugin-dialog`. The existing HTML `<input type="file">` keeps working — this is UX polish only.

```typescript
import { open } from '@tauri-apps/plugin-dialog';
const paths = await open({ multiple: true, filters: [{ name: 'CSV', extensions: ['csv'] }] });
```

---

## Summary

| Phase | What changes | Effort |
|---|---|---|
| 1 | Tauri scaffold + Vite | 4–6 h |
| 2 | Router swap (Next → React Router v7) | 3–5 h |
| 3 | DB layer (sync → async, better-sqlite3 → tauri-plugin-sql) | 6–10 h |
| 4 | 14 API routes → query modules | 10–16 h |
| 5 | Remove Next.js | 2–3 h |
| 6 | Native file picker (optional) | 2–3 h |
| **Total** | | **27–43 h** |

Phase 7 (data migration for existing users) skipped — no prod data.
