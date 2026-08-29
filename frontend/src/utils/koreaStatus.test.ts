import { describe, expect, it } from 'vitest';
import type { DomesticIndicator } from '../types';
import {
  collectionStatusLabel,
  formatCollectedAt,
  formatCollectedDate,
  formatCompactBaseDate,
  formatHistoryAxisValue,
  formatHistoryTick,
  formatHistoryValue,
  formatIndicatorSource,
  formatIndicatorValue,
  getHistoryValueDomain
} from './koreaStatus';

describe('korea status utils', () => {
  it('keeps history value precision by unit', () => {
    expect(formatHistoryValue(3.456, 'PERCENT')).toBe('3.46');
    expect(formatHistoryValue(1234.56, 'USD_MILLION')).toBe('1,235');
    expect(formatHistoryValue(-10.25, 'KRW_TRILLION')).toBe('-10.3');
    expect(formatHistoryValue(42.4, 'DOCUMENT')).toBe('42');
  });

  it('keeps history axis value precision by unit', () => {
    expect(formatHistoryAxisValue(1234.56, 'USD_1000')).toBe('1,235');
    expect(formatHistoryAxisValue(1234.56, 'INDEX')).toBe('1,234.6');
    expect(formatHistoryAxisValue(1234.56, 'DOCUMENT')).toBe('1,235');
  });

  it('formats source labels with existing fallbacks', () => {
    expect(formatIndicatorSource(null)).toBe('-');
    expect(formatIndicatorSource('Twelve Data:USD/KRW 1min')).toBe('Twelve Data 실시간 환율');
    expect(formatIndicatorSource('FRED:DTWEXBGS')).toBe('미국 연방준비은행 경제데이터');
    expect(formatIndicatorSource('ECOS:722Y001')).toBe('한국은행 경제통계시스템');
    expect(formatIndicatorSource('OPENFISCAL:BudgetBalance')).toBe('열린재정 재정정보');
    expect(formatIndicatorSource('Koreaexim/FRED')).toBe('한국수출입은행 환율정보');
    expect(formatIndicatorSource('CUSTOM_SOURCE:VALUE')).toBe('CUSTOM SOURCE VALUE');
  });

  it('keeps compact date and tick formatting', () => {
    expect(formatHistoryTick('2026-08-29')).toBe('26.08');
    expect(formatCompactBaseDate(null)).toBe('-');
    expect(formatCompactBaseDate('2026-08-29')).toBe('2026-08-29');
  });

  it('formats collection status and dates', () => {
    expect(formatCollectedDate(null)).toBe('-');
    expect(formatCollectedAt(indicator({ fetchedAt: null }))).toBe('-');
    expect(collectionStatusLabel(indicator({ status: '연동 필요' }))).toBe('대기');
    expect(collectionStatusLabel(indicator({ freshnessStatus: 'STALE' }))).toBe('지연');
    expect(collectionStatusLabel(indicator({ value: null }))).toBe('대기');
    expect(collectionStatusLabel(indicator({ status: '데이터 없음' }))).toBe('대기');
    expect(collectionStatusLabel(indicator())).toBe('정상');
  });

  it('formats indicator values and padded chart domains', () => {
    expect(formatIndicatorValue(indicator({ value: null }))).toBe('-');
    expect(formatIndicatorValue(indicator({ value: 3.456, unit: 'PERCENT_POINT' }))).toBe('3.46');
    expect(getHistoryValueDomain([
      { baseDate: '2026-08-28', value: 100 },
      { baseDate: '2026-08-29', value: 110 }
    ])).toEqual([97, 113]);
    expect(getHistoryValueDomain([{ baseDate: '2026-08-29', value: 0 }])).toEqual([-1, 1]);
  });
});

function indicator(overrides: Partial<DomesticIndicator> = {}): DomesticIndicator {
  return {
    code: 'KR_US_RATE_GAP',
    title: '한미 기준금리차',
    category: '금리',
    value: 2,
    unit: 'PERCENT_POINT',
    baseDate: '2026-08-29',
    observedAt: null,
    previousValue: null,
    previousBaseDate: null,
    source: 'FRED',
    sourceUrl: null,
    fetchedAt: '2026-08-29T00:00:00Z',
    krwImpact: '중립',
    note: '',
    status: '정상 수집',
    detailUrl: null,
    freshnessStatus: 'FRESH',
    staleReason: null,
    freshnessReason: null,
    expectedNextUpdateAt: null,
    lastSuccessfulFetchedAt: null,
    componentFreshnesses: [],
    ...overrides
  };
}
