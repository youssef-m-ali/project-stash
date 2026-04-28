import db from '@/lib/db';
import type { Account, CategoryRule } from '@/lib/types';
import { parseCsv } from '@/lib/import/parseCsv';
import { hashTransaction } from '@/lib/import/hashTransaction';

interface FileInput {
  accountId: string;
  csvText: string;
}

interface PreviewRequestBody {
  files: FileInput[];
}

export async function POST(request: Request) {
  const { files } = (await request.json()) as PreviewRequestBody;

  type AccountRow = { id: string; label: string; kind: string; is_pass_through: number };
  const accounts: Account[] = (
    db.prepare('SELECT id, label, kind, is_pass_through FROM accounts').all() as AccountRow[]
  ).map((r) => ({ id: r.id, label: r.label, kind: r.kind as Account['kind'], isPassThrough: Boolean(r.is_pass_through) }));
  type RuleRow = { id: string; pattern: string; category_id: string; priority: number; created_at: string };
  const rules: CategoryRule[] = (db
    .prepare('SELECT id, pattern, category_id, priority, created_at FROM category_rules ORDER BY priority ASC')
    .all() as RuleRow[])
    .map((r) => ({
      id: r.id,
      pattern: r.pattern,
      categoryId: r.category_id,
      priority: r.priority,
      createdAt: r.created_at,
    }));

  const existingIds = new Set<string>(
    (db.prepare('SELECT id FROM transactions').all() as { id: string }[]).map((r) => r.id),
  );

  const allTransactions = [];
  for (const file of files) {
    const account = accounts.find((a) => a.id === file.accountId);
    if (!account) continue;

    const { transactions, format } = parseCsv(file.csvText, account, rules);

    for (const tx of transactions) {
      const id = hashTransaction(tx.date, tx.description, tx.rawAmount, tx.accountId);
      allTransactions.push({ ...tx, id, duplicate: existingIds.has(id), detectedFormat: format });
    }
  }

  return Response.json({ transactions: allTransactions });
}
