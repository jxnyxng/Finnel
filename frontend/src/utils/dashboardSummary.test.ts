// Tests for dashboard summary helper behavior.
import { describe, expect, it } from 'vitest';

import {
  formatCompactRateDate,
  formatIndicatorMarketValue,
  formatSignedNumber,
  getDirection,
  getDirectionBadgeClass,
  getDirectionLabel,
  getDirectionTextClass,
  getItemTime,
  getNumericChange,
  getPriorityScore,
  sortByRecent
} from './dashboardSummary';
import type { DomesticIndicator } from '../types';

describe('dashboard summary helpers', () => {
  it('formats indicator values and numeric changes in the existing display style', () => {
    const indicator = indicatorFixture({ unit: 'PERCENT', value: 3.5, previousValue: 3.25 });

    expect(formatIndicatorMarketValue(indicator)).toBe('3.50%');
    expect(getNumericChange(indicator)).toBe(0.25);
    expect(formatSignedNumber(0.25)).toBe('+0.25');
    expect(formatSignedNumber(0)).toBe('-');
  });

  it('maps direction thresholds and classes without changing labels', () => {
    expect(getDirection(0.031)).toBe('up');
    expect(getDirection(-0.031)).toBe('down');
    expect(getDirection(0.03)).toBe('flat');
    expect(getDirection(null)).toBe('unknown');
    expect(getDirectionLabel('up')).toBe('상승');
    expect(getDirectionBadgeClass('down')).toBe('bg-rose-50 text-rose-700');
    expect(getDirectionTextClass(-1)).toBe('change-rate-down');
  });

  it('scores priority content with keyword and recency weight', () => {
    const now = Date.parse('2026-08-27T12:00:00Z');
    const item = { fetchedAt: '2026-08-27T00:00:00Z', publishedAt: null };

    expect(getPriorityScore(item, now, '환율 금리', 1)).toBe(12);
  });

  it('sorts content by publishedAt before fetchedAt', () => {
    const sorted = sortByRecent([
      { id: 'old', fetchedAt: '2026-08-27T01:00:00Z', publishedAt: '2026-08-27T00:00:00Z' },
      { id: 'new', fetchedAt: '2026-08-27T00:00:00Z', publishedAt: '2026-08-27T02:00:00Z' }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['new', 'old']);
    expect(getItemTime({ fetchedAt: '2026-08-27T01:00:00Z', publishedAt: null })).toBe(Date.parse('2026-08-27T01:00:00Z'));
  });

  it('formats compact rate dates with fallback for invalid dates', () => {
    expect(formatCompactRateDate('not-a-date-value')).toBe('not-a-date');
  });
});

function indicatorFixture(overrides: Partial<DomesticIndicator> = {}): DomesticIndicator {
  return {
    baseDate: '2026-08-27',
    category: '금리',
    code: 'KR_POLICY_RATE',
    componentFreshnesses: [],
    detailUrl: null,
    expectedNextUpdateAt: null,
    fetchedAt: '2026-08-27T00:00:00Z',
    freshnessStatus: 'FRESH',
    freshnessReason: null,
    krwImpact: '원화 영향',
    lastSuccessfulFetchedAt: '2026-08-27T00:00:00Z',
    note: '설명',
    observedAt: null,
    previousBaseDate: '2026-08-26',
    previousValue: null,
    source: 'ECOS',
    sourceUrl: 'https://ecos.bok.or.kr/',
    staleReason: null,
    status: '정상 수집',
    title: '한국 기준금리',
    unit: 'PERCENT',
    value: null,
    ...overrides
  };
}
