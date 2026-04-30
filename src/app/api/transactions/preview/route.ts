import db from '@/lib/db';
import type { Account, Bucket } from '@/lib/types';
import { parseCsv } from '@/lib/import/parseCsv';
import { hashTransaction } from '@/lib/import/hashTransaction';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';

interface FileInput {
  accountId: string;
  csvText: string;
}

interface PreviewRequestBody {
  files: FileInput[];
}

type AccountRow = { id: string; label: string; kind: string; is_pass_through: number };
type BucketRow = { id: string; name: string; amount_per_paycheck: number; color: string; sort_order: number };
type MemoryRow = { merchant_key: string; bucket_id: string };

export async function POST(request: Request) {
  const { files } = (await request.json()) as PreviewRequestBody;

  const accounts: Account[] = (
    db.prepare('SELECT id, label, kind, is_pass_through FROM accounts').all() as AccountRow[]
  ).map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind as Account['kind'],
    isPassThrough: Boolean(r.is_pass_through),
  }));

  const buckets: Bucket[] = (
    db.prepare('SELECT * FROM buckets ORDER BY sort_order').all() as BucketRow[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    amountPerPaycheck: r.amount_per_paycheck,
    color: r.color,
    sortOrder: r.sort_order,
  }));

  const merchantMemory = new Map<string, string>(
    (db.prepare('SELECT merchant_key, bucket_id FROM merchant_memory').all() as MemoryRow[]).map(
      (r) => [r.merchant_key, r.bucket_id],
    ),
  );

  const existingIds = new Set<string>(
    (db.prepare('SELECT id FROM transactions').all() as { id: string }[]).map((r) => r.id),
  );

  const allTransactions = [];
  for (const file of files) {
    const account = accounts.find((a) => a.id === file.accountId);
    if (!account) continue;

    const { transactions, format } = parseCsv(file.csvText, account);

    for (const tx of transactions) {
      const id = hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId);
      const key = normalizeMerchant(tx.description);
      const suggestedBucketId = merchantMemory.get(key) ?? null;
      allTransactions.push({
        ...tx,
        id,
        duplicate: existingIds.has(id),
        suggestedBucketId,
        detectedFormat: format,
      });
    }
  }

  return Response.json({ transactions: allTransactions, buckets });
}
