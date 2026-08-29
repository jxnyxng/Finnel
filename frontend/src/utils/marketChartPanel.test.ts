import { describe, expect, it } from 'vitest';
import {
  getCompactMarketChartPanelDetails,
  getMarketChartCollectionStatusSummary,
  getMarketChartSectionLabel,
  getOhlcSummaryItems
} from './marketChartPanel';

describe('market chart panel utils', () => {
  it('keeps section label normalization', () => {
    expect(getMarketChartSectionLabel('실시간 원달러 환율')).toBe('원달러환율');
    expect(getMarketChartSectionLabel('실시간 달러인덱스')).toBe('달러인덱스');
  });

  it('keeps usd krw intraday collection summary', () => {
    expect(getMarketChartCollectionStatusSummary({
      panelDetails: [{ label: '출처', value: 'Twelve Data' }],
      range: '1D',
      sectionLabel: '원달러환율',
      showCandlesticks: true
    })).toEqual([
      { label: '수집', value: '1분봉' },
      { label: '표시', value: '5분봉 캔들' },
      { label: '점검', value: '5분마다 확인' },
      { label: '출처', value: 'Twelve Data' }
    ]);
  });

  it('keeps non intraday collection summary fallbacks', () => {
    expect(getMarketChartCollectionStatusSummary({
      panelDetails: [],
      range: '1Y',
      sectionLabel: '원달러환율',
      showCandlesticks: false
    })).toEqual([
      { label: '수집', value: '일별 기준' },
      { label: '표시', value: '일별 환율' },
      { label: '출처', value: '저장 데이터' }
    ]);

    expect(getMarketChartCollectionStatusSummary({
      panelDetails: [{ label: '기간', value: '2026.01~2026.08' }],
      range: '1Y',
      sectionLabel: '달러인덱스',
      showCandlesticks: false
    })).toEqual([
      { label: '수집', value: '일별 기준' },
      { label: '표시', value: '2026.01~2026.08' },
      { label: '출처', value: 'FRED' }
    ]);
  });

  it('filters duplicated compact panel labels', () => {
    expect(getCompactMarketChartPanelDetails([
      { label: '범위', value: '1년' },
      { label: '메모', value: '확인' }
    ])).toEqual([{ label: '메모', value: '확인' }]);
  });

  it('builds ohlc summary labels and values', () => {
    expect(getOhlcSummaryItems({
      label: '09:10',
      dateValue: '2026-08-29T09:10:00',
      x: 550,
      value: 1392,
      latestValue: 1392,
      open: 1390,
      high: 1393,
      low: 1389,
      close: 1392,
      complete: true,
      sourcePointCount: 5
    }, '1D')).toEqual([
      { key: 'time', label: '시간', value: '09:05 ~ 09:10' },
      { key: 'open', label: '시가', value: '1,390.00원' },
      { key: 'high', label: '고가', value: '1,393.00원' },
      { key: 'low', label: '저가', value: '1,389.00원' },
      { key: 'close', label: '종가', value: '1,392.00원' }
    ]);
  });
});
