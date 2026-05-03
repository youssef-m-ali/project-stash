import db from '@/lib/db';
import type { CsvMapping } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

type MappingRow = {
  date_col: number;
  desc_col: number;
  amount_col: number;
  flip_sign: number;
};

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const row = db
    .prepare('SELECT date_col, desc_col, amount_col, flip_sign FROM account_csv_mappings WHERE account_id = ?')
    .get(id) as MappingRow | undefined;

  if (!row) return Response.json({ mapping: null });

  const mapping: CsvMapping = {
    dateCol:   row.date_col,
    descCol:   row.desc_col,
    amountCol: row.amount_col,
    flipSign:  Boolean(row.flip_sign),
  };
  return Response.json({ mapping });
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const { mapping } = (await req.json()) as { mapping: CsvMapping };

  db.prepare(`
    INSERT INTO account_csv_mappings (account_id, date_col, desc_col, amount_col, flip_sign)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      date_col   = excluded.date_col,
      desc_col   = excluded.desc_col,
      amount_col = excluded.amount_col,
      flip_sign  = excluded.flip_sign
  `).run(id, mapping.dateCol, mapping.descCol, mapping.amountCol, mapping.flipSign ? 1 : 0);

  return Response.json({ ok: true });
}
