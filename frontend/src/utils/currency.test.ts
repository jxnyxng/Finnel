// Tests for shared currency display labels and fallback icons.
import { describe, expect, it } from 'vitest';
import { getCurrencyFlag, getCurrencyKoreanName, getCurrencyShortLabel } from './currency';

describe('currency helpers', () => {
  it('returns known currency flags and caller-specific fallback icons', () => {
    expect(getCurrencyFlag('USD')).toBe('🇺🇸');
    expect(getCurrencyFlag('EUR')).toBe('🇪🇺');
    expect(getCurrencyFlag('UNKNOWN')).toBe('💱');
    expect(getCurrencyFlag('UNKNOWN', '¤')).toBe('¤');
  });

  it('keeps short labels and fuller Korean names separate', () => {
    expect(getCurrencyShortLabel('JPY')).toBe('엔화');
    expect(getCurrencyKoreanName('JPY')).toBe('일본 엔');
    expect(getCurrencyShortLabel('ABC')).toBe('ABC');
    expect(getCurrencyKoreanName('ABC')).toBe('ABC');
  });
});
