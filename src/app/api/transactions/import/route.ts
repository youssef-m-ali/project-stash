import db from '@/lib/db';
import { hashTransaction } from '@/lib/import/hashTransaction';
import { computeActuals } from '@/lib/import/computeActuals';
import type { ParsedTransaction } from '@/lib/types';

interface ImportRequestBody {
  transactions: (ParsedTransaction & { id?: string })[];
}

export async function POST(request: Request) {
  const { transactions } = (await request.json()) as ImportRequestBody;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (id, account_id, date, month_key, description, amount, raw_amount, category_id, status, ignore_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;
  const months = new Set<string>();

  const doImport = db.transaction(() => {
    for (const tx of transactions) {
      const id = tx.id ?? hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId);
      const categoryId = tx.userOverrideCategory ?? tx.categoryId;

      const result = insert.run(
        id,
        tx.accountId,
        tx.date,
        tx.monthKey,
        tx.description,
        tx.amount,
        tx.rawAmount,
        categoryId ?? null,
        tx.status,
        tx.ignoreReason ?? null,
      );

      if (result.changes > 0) {
        inserted++;
        months.add(tx.monthKey);
      } else {
        skipped++;
      }
    }
  });

  doImport();
  if (inserted > 0) computeActuals();

  return Response.json({ inserted, skipped, months: [...months].sort() });
}
