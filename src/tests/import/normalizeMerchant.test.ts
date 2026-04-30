import { describe, it, expect } from 'vitest';
import { normalizeMerchant } from '@/lib/import/normalizeMerchant';

describe('normalizeMerchant', () => {
  it('lowercases and strips store numbers', () => {
    expect(normalizeMerchant('SOBEYS #4321')).toBe('sobeys');
  });

  it('keeps first two meaningful words', () => {
    expect(normalizeMerchant('TIM HORTONS #187')).toBe('tim hortons');
  });

  it('strips trailing province code', () => {
    expect(normalizeMerchant('SOBEYS #4321 TORONTO ON')).toBe('sobeys toronto');
  });

  it('filters noise words', () => {
    expect(normalizeMerchant('METRO INC')).toBe('metro');
  });

  it('strips dots in domain names', () => {
    // dots become spaces, collapse, then take 2 words
    expect(normalizeMerchant('NETFLIX.COM')).toBe('netflix com');
  });

  it('handles amazon example', () => {
    expect(normalizeMerchant('AMAZON.CA MARKETPLACE')).toBe('amazon');
  });

  it('is idempotent', () => {
    const first = normalizeMerchant('SOBEYS #4321 TORONTO ON');
    expect(normalizeMerchant(first)).toBe(first);
  });

  it('handles empty string', () => {
    expect(normalizeMerchant('')).toBe('');
  });

  it('handles single word', () => {
    expect(normalizeMerchant('WALMART')).toBe('walmart');
  });

  it('strips noise-only descriptions', () => {
    // If only noise words remain, returns empty string
    expect(normalizeMerchant('INC LTD CO')).toBe('');
  });

  it('handles CIBC e-Transfer style descriptions', () => {
    // e-Transfer descriptions often have name + memo
    expect(normalizeMerchant('CIBC ETRANSFER FROM JOHN')).toBe('cibc etransfer');
  });
});
