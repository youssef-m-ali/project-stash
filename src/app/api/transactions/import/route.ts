import db, { assignPeriodsToTransactions } from '@/lib/db';
import { hashTransaction } from '@/lib/import/hashTransaction';
import type { ParsedTransaction } from '@/lib/types';

interface ImportRequestBody {
  transactions: (ParsedTransaction & { id?: string })[];
}

export async function POST(request: Request) {
  const { transactions } = (await request.json()) as ImportRequestBody;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (id, account_id, date, description, amount, raw_amount, bucket_id, status, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  let inserted = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const tx of transactions) {
      const id = tx.id ?? hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId);

      const result = insert.run(
        id,
        tx.accountId,
        tx.date,
        tx.description,
        tx.amount,
        tx.rawAmount,
        tx.bucketId ?? null,
        tx.status, // 'pending' or 'ignored'
      );

      if (result.changes > 0) inserted++;
      else skipped++;
    }
  })();

  // Assign paycheck period to newly imported transactions
  if (inserted > 0) assignPeriodsToTransactions();

  return Response.json({ inserted, skipped });
}
