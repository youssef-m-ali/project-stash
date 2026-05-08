import { getDb } from '../client';
import type { CsvMapping } from '@/lib/types';

type MappingRow = { date_col: number; desc_col: number; amount_col: number; flip_sign: number };

export async function getLastImportDates(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ account_id: string; last_tx_date: string }[]>(
    'SELECT account_id, MAX(date) as last_tx_date FROM transactions GROUP BY account_id',
    [],
  );
  const result: Record<string, string> = {};
  for (const r of rows) result[r.account_id] = r.last_tx_date;
  return result;
}

export async function getCsvMapping(accountId: string): Promise<CsvMapping | null> {
  const db = await getDb();
  const rows = await db.select<MappingRow[]>(
    'SELECT date_col, desc_col, amount_col, flip_sign FROM account_csv_mappings WHERE account_id = ?',
    [accountId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { dateCol: r.date_col, descCol: r.desc_col, amountCol: r.amount_col, flipSign: Boolean(r.flip_sign) };
}

export async function saveCsvMapping(accountId: string, mapping: CsvMapping): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO account_csv_mappings (account_id, date_col, desc_col, amount_col, flip_sign)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       date_col   = excluded.date_col,
       desc_col   = excluded.desc_col,
       amount_col = excluded.amount_col,
       flip_sign  = excluded.flip_sign`,
    [accountId, mapping.dateCol, mapping.descCol, mapping.amountCol, mapping.flipSign ? 1 : 0],
  );
}
