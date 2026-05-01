import { describe, it, expect } from 'vitest';
import { convert } from '@/lib/convert';

describe('convert', () => {
  const rate = { buy: 1400, sell: 1465 };

  it('returns the same amount when from and to currencies match (USD)', () => {
    expect(convert(100, 'USD', 'USD', rate)).toBe(100);
  });

  it('returns the same amount when from and to currencies match (ARS)', () => {
    expect(convert(50000, 'ARS', 'ARS', rate)).toBe(50000);
  });

  it('converts USD to ARS using the sell price', () => {
    expect(convert(100, 'USD', 'ARS', rate)).toBe(146500);
  });

  it('converts ARS to USD using the sell price', () => {
    expect(convert(146500, 'ARS', 'USD', rate)).toBe(100);
  });

  it('handles zero amount correctly', () => {
    expect(convert(0, 'USD', 'ARS', rate)).toBe(0);
    expect(convert(0, 'ARS', 'USD', rate)).toBe(0);
  });

  it('converts fractional USD amounts correctly', () => {
    expect(convert(0.5, 'USD', 'ARS', rate)).toBe(732.5);
  });

  it('round-trips: USD -> ARS -> USD returns the original amount', () => {
    const usd = 250;
    const ars = convert(usd, 'USD', 'ARS', rate);
    expect(convert(ars, 'ARS', 'USD', rate)).toBeCloseTo(usd, 10);
  });
});
