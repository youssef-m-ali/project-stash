export async function hashTransaction(
  date: string,
  description: string,
  rawAmount: number,
  accountId: string,
): Promise<string> {
  const canonical = `${date}|${description.trim().toLowerCase()}|${rawAmount}|${accountId}`;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 16);
}
