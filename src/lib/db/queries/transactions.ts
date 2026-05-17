import { getDb } from '../client';
import { assignPeriodsToTransactions } from '../helpers';
import { parseCsv } from '@/lib/import/parseCsv';
import { hashTransaction } from '@/lib/import/hashTransaction';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';
import type { Transaction, Subtransaction, TransactionWithSubs, ParsedTransaction, CsvMapping, Account, Bucket } from '@/lib/types';

type TxRow = {
  id: string; account_id: string; date: string; description: string;
  amount: number; raw_amount: number; bucket_id: string | null;
  period_id: string | null; status: string; imported_at: string;
};
type SubRow = { id: string; tx_id: string; description: string; amount: number; date: string; created_at: string };

function rowToTx(r: TxRow): Transaction {
  return {
    id: r.id, accountId: r.account_id, date: r.date, description: r.description,
    amount: r.amount, rawAmount: r.raw_amount, bucketId: r.bucket_id,
    periodId: r.period_id, status: r.status as Transaction['status'], importedAt: r.imported_at,
  };
}

function rowToSub(r: SubRow): Subtransaction {
  return { id: r.id, txId: r.tx_id, description: r.description, amount: r.amount, date: r.date, createdAt: r.created_at };
}

export interface TxFilters {
  periodId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  bucketId?: string | null;
  accountId?: string | null;
}

export async function getTransactions(filters: TxFilters = {}): Promise<TransactionWithSubs[]> {
  const db = await getDb();
  const { periodId, startDate, endDate, status, bucketId, accountId } = filters;

  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params: unknown[] = [];

  if (periodId && startDate && endDate) {
    sql += ' AND (period_id = ? OR (period_id IS NULL AND date BETWEEN ? AND ?))';
    params.push(periodId, startDate, endDate);
  } else if (periodId) {
    sql += ' AND period_id = ?'; params.push(periodId);
  } else if (startDate && endDate) {
    sql += ' AND date BETWEEN ? AND ?'; params.push(startDate, endDate);
  }
  if (status)    { sql += ' AND status = ?';     params.push(status); }
  if (bucketId)  { sql += ' AND bucket_id = ?';  params.push(bucketId); }
  if (accountId) { sql += ' AND account_id = ?'; params.push(accountId); }
  sql += ' ORDER BY date DESC, imported_at DESC';

  const rows = await db.select<TxRow[]>(sql, params);
  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const ph = ids.map(() => '?').join(', ');
  const subRows = await db.select<SubRow[]>(
    `SELECT * FROM subtransactions WHERE tx_id IN (${ph}) ORDER BY date, created_at`,
    ids,
  );

  const subsByTx = new Map<string, Subtransaction[]>();
  for (const s of subRows) {
    const list = subsByTx.get(s.tx_id) ?? [];
    list.push(rowToSub(s));
    subsByTx.set(s.tx_id, list);
  }

  return rows.map(r => {
    const subtransactions = subsByTx.get(r.id) ?? [];
    return { ...rowToTx(r), subtransactions, netAmount: r.amount + subtransactions.reduce((s, sub) => s + sub.amount, 0) };
  });
}

interface PatchBody {
  status?: 'approved' | 'ignored' | 'pending';
  bucketId?: string | null;
  description?: string;
  amount?: number;
}

export async function patchTransaction(id: string, body: PatchBody): Promise<void> {
  const db = await getDb();

  const txRows = await db.select<{ description: string; status: string }[]>(
    'SELECT description, status FROM transactions WHERE id = ?', [id],
  );
  if (txRows.length === 0) throw new Error('Transaction not found');
  const tx = txRows[0];

  if (body.description !== undefined || body.amount !== undefined) {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(body.description); }
    if (body.amount !== undefined)       { fields.push('amount = ?');      vals.push(body.amount); }
    vals.push(id);
    await db.execute(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, vals);
    return;
  }

  await db.execute(
    'UPDATE transactions SET status = ?, bucket_id = ? WHERE id = ?',
    [body.status, body.bucketId ?? null, id],
  );

  if (body.status === 'approved' && body.bucketId) {
    const key = normalizeMerchant(tx.description);
    if (key) {
      await db.execute(
        `INSERT INTO merchant_memory (merchant_key, bucket_id, last_seen, count) VALUES (?, ?, date('now'), 1)
         ON CONFLICT(merchant_key) DO UPDATE SET bucket_id = excluded.bucket_id, last_seen = excluded.last_seen, count = count + 1`,
        [key, body.bucketId],
      );
    }
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM transactions WHERE id = ?', [id]);
}

interface FileInput { accountId: string; csvText: string; mapping?: CsvMapping | null }
export interface PreviewTx extends ParsedTransaction { id: string }

export async function previewTransactions(
  files: FileInput[],
): Promise<{ transactions: PreviewTx[]; buckets: Bucket[] }> {
  const db = await getDb();

  const accountRows = await db.select<{ id: string; label: string; kind: string }[]>(
    'SELECT id, label, kind FROM accounts', [],
  );
  const accounts: Account[] = accountRows.map(r => ({ id: r.id, label: r.label, kind: r.kind as Account['kind'] }));

  const bucketRows = await db.select<{ id: string; name: string; amount_per_paycheck: number; color: string; emoji: string | null; sort_order: number; is_special: number }[]>(
    'SELECT * FROM buckets ORDER BY sort_order', [],
  );
  const buckets: Bucket[] = bucketRows.map(r => ({
    id: r.id, name: r.name, amountPerPaycheck: r.amount_per_paycheck,
    color: r.color, emoji: r.emoji ?? null, sortOrder: r.sort_order, isSpecial: Boolean(r.is_special),
  }));

  const memRows = await db.select<{ merchant_key: string; bucket_id: string }[]>(
    'SELECT merchant_key, bucket_id FROM merchant_memory', [],
  );
  const merchantMemory = new Map(memRows.map(r => [r.merchant_key, r.bucket_id]));

  const existingIdRows = await db.select<{ id: string }[]>('SELECT id FROM transactions', []);
  const existingIds = new Set(existingIdRows.map(r => r.id));

  const allTransactions: PreviewTx[] = [];
  for (const file of files) {
    const account = accounts.find(a => a.id === file.accountId);
    if (!account) continue;
    const parsed = parseCsv(file.csvText, account, file.mapping);
    for (const tx of parsed) {
      const id = await hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId);
      const key = normalizeMerchant(tx.description);
      allTransactions.push({ ...tx, id, duplicate: existingIds.has(id), suggestedBucketId: merchantMemory.get(key) ?? null });
    }
  }

  return { transactions: allTransactions, buckets };
}

export async function importTransactions(
  transactions: (ParsedTransaction & { id?: string })[],
): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();

  const resolvedIds = await Promise.all(
    transactions.map(tx => tx.id
      ? Promise.resolve(tx.id)
      : hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId),
    ),
  );

  let inserted = 0;
  let skipped = 0;

  await db.execute('BEGIN', []);
  try {
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const id = resolvedIds[i];
      const result = await db.execute(
        `INSERT OR IGNORE INTO transactions
           (id, account_id, date, description, amount, raw_amount, bucket_id, status, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, tx.accountId, tx.date, tx.description, tx.amount, tx.rawAmount, tx.bucketId ?? null, tx.status],
      );
      if (result.rowsAffected > 0) inserted++;
      else skipped++;
    }
    await db.execute('COMMIT', []);
  } catch (e) {
    await db.execute('ROLLBACK', []);
    throw e;
  }

  if (inserted > 0) await assignPeriodsToTransactions();

  return { inserted, skipped };
}
