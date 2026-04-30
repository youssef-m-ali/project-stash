const NOISE = new Set([
  'canada', 'inc', 'ltd', 'corp', 'co', 'the', 'online', 'ca',
  'store', 'market', 'marketplace', 'purchase', 'payment', 'pos',
]);

export function normalizeMerchant(description: string): string {
  let s = description.toLowerCase().trim();
  // Strip store/location numbers (#1234)
  s = s.replace(/\s*#\d+\b/g, '');
  // Strip trailing 2-letter province/state abbreviations
  s = s.replace(/\s+[a-z]{2}$/, '');
  // Strip non-alphanumeric except spaces
  s = s.replace(/[^a-z0-9 ]/g, ' ');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // Filter noise words
  const words = s.split(' ').filter(w => w.length > 0 && !NOISE.has(w));
  // Take first 2 meaningful words
  return words.slice(0, 2).join(' ');
}
