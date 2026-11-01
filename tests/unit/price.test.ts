import { describe, expect, it } from 'vitest';
import { formatPrice, formatPricePlain, parsePrice } from '../../src/lib/price';

describe('parsePrice', () => {
  it.each([
    ['8600', 8600],
    ['$8.600', 8600],
    ['$ 8.600', 8600],
    ['8.600,00', 8600],
    ['$8.600,50', 8600.5],
    ['8600,5', 8600.5],
    ['8600.50', 8600.5],
    ['8,600', 8600],
    ['12.500', 12500],
    ['1.250.000', 1250000],
    ['$1,234.56', 1234.56],
    ['  9200  ', 9200],
    ['ARS 7.100', 7100],
    ['$ 8.600', 8600],
  ])('lee %j como %d', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  it.each(['', '   ', 'consultar', '-500', '8.60.0', 'abc123', '$', '8600,00,00', '1e5'])('rechaza %j', (raw) => {
    expect(parsePrice(raw)).toBeNull();
  });

  it('acepta números ya parseados', () => {
    expect(parsePrice(8600)).toBe(8600);
    expect(parsePrice(Number.NaN)).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
});

describe('formatPrice', () => {
  it('formatea en pesos argentinos', () => {
    expect(formatPricePlain(8600)).toBe('$ 8.600');
    expect(formatPricePlain(25800)).toBe('$ 25.800');
    expect(formatPricePlain(8600.5)).toBe('$ 8.600,5');
    expect(formatPrice(1000)).toContain('1.000');
  });
});
