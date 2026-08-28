// Tests for exchange calculator input handling and amount conversion.
import { describe, expect, it } from 'vitest';

import {
  calculateForeignAmount,
  calculateKrwAmount,
  formatCalculatorNumber,
  parseCalculatorNumber,
  sanitizeNumericInput
} from './exchangeCalculator';
import type { ForeignExchangeRate } from '../types';

describe('exchange calculator helpers', () => {
  it('converts foreign currency input to KRW using the display unit', () => {
    expect(calculateKrwAmount('100', rateFixture({ dealBasRate: 950, unitSize: 100 }))).toBe(950);
  });

  it('converts KRW input to foreign currency using the display unit', () => {
    expect(calculateForeignAmount('1,900', rateFixture({ dealBasRate: 950, unitSize: 100 }))).toBe(200);
  });

  it('returns null for empty, dot, invalid, or unusable rates', () => {
    expect(parseCalculatorNumber('')).toBeNull();
    expect(parseCalculatorNumber('.')).toBeNull();
    expect(parseCalculatorNumber('abc')).toBeNull();
    expect(calculateKrwAmount('100', rateFixture({ unitSize: 0 }))).toBeNull();
    expect(calculateForeignAmount('100', rateFixture({ dealBasRate: 0 }))).toBeNull();
  });

  it('keeps existing sanitize and formatting behavior', () => {
    expect(sanitizeNumericInput('1,2a3.4.5')).toBe('123.45');
    expect(formatCalculatorNumber(1234567.891, 2)).toBe('1,234,567.89');
    expect(formatCalculatorNumber(null, 2)).toBe('');
  });
});

function rateFixture(overrides: Partial<ForeignExchangeRate> = {}): ForeignExchangeRate {
  return {
    baseDate: '2026-08-27',
    currencyCode: 'JPY(100)',
    currencyName: 'Japanese Yen',
    dealBasRate: 950,
    displayCode: 'JPY',
    fetchedAt: '2026-08-27T03:30:00.000Z',
    historyEndDate: '2026-08-27',
    historyStartDate: '1999-01-01',
    source: 'TEST',
    unitSize: 100,
    ...overrides
  };
}
