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

  const state = db.prepare('SELECT data FROM budget_state WHERE id = 1').get() as { data: string } | undefined;
  if (!state) return Response.json({ error: 'No budget state found' }, { status: 400 });

  const budgetState = JSON.parse(state.data);
  const accounts: Account[] = budgetState.accounts ?? [];
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
