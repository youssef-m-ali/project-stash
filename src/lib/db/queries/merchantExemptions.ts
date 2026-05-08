import { getDb } from '../client';

export async function getMerchantExemptions(): Promise<{ merchantKey: string }[]> {
  const db = await getDb();
  const rows = await db.select<{ merchant_key: string }[]>(
    'SELECT merchant_key FROM merchant_exemptions ORDER BY created_at DESC', [],
  );
  return rows.map(r => ({ merchantKey: r.merchant_key }));
}

export async function addMerchantExemption(merchantKey: string): Promise<void> {
  const db = await getDb();
  await db.execute('INSERT OR IGNORE INTO merchant_exemptions (merchant_key) VALUES (?)', [merchantKey]);
}

export async function deleteMerchantExemption(merchantKey: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM merchant_exemptions WHERE merchant_key = ?', [merchantKey]);
}
