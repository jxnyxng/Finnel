import { describe, expect, it } from 'vitest';
import type { ChartCandlestickPoint, ChartPoint } from '../types';
import {
  getDisplayOhlcPoint,
  getNearestPointFromPointerX,
  getPointXPosition,
  hoverStateKey,
  isCandlestickPoint
} from './marketChartPointer';

describe('market chart pointer utils', () => {
  const series: ChartPoint[] = [
    { label: 'A', dateValue: '2026-08-27', x: 0, value: 100, latestValue: null },
    { label: 'B', dateValue: '2026-08-28', x: 100, value: 110, latestValue: null },
    { label: 'C', dateValue: '2026-08-29', x: 200, value: 120, latestValue: 120 }
  ];

  it('returns null when pointer lookup has no drawable area or series', () => {
    expect(getNearestPointFromPointerX({ plotLeft: 0, plotRight: 100, series: [], x: 50, xDomain: [0, 200] })).toBeNull();
    expect(getNearestPointFromPointerX({ plotLeft: 100, plotRight: 100, series, x: 50, xDomain: [0, 200] })).toBeNull();
  });

  it('selects the nearest point within the x domain', () => {
    expect(getNearestPointFromPointerX({ plotLeft: 0, plotRight: 100, series, x: 26, xDomain: [0, 200] })).toBe(series[1]);
    expect(getNearestPointFromPointerX({ plotLeft: 0, plotRight: 100, series, x: 74, xDomain: [0, 200] })).toBe(series[1]);
    expect(getNearestPointFromPointerX({ plotLeft: 0, plotRight: 100, series, x: 76, xDomain: [0, 200] })).toBe(series[2]);
  });

  it('uses series bounds for dataMin dataMax domains', () => {
    expect(getNearestPointFromPointerX({ plotLeft: 0, plotRight: 100, series, x: 100, xDomain: ['dataMin', 'dataMax'] })).toBe(series[2]);
  });

  it('maps point x values into plot coordinates', () => {
    expect(getPointXPosition({ plotLeft: 10, plotRight: 110, point: series[1], xDomain: [0, 200] })).toBe(60);
    expect(getPointXPosition({ plotLeft: 10, plotRight: 110, point: series[1], xDomain: ['dataMin', 'dataMax'] })).toBeNull();
    expect(getPointXPosition({ plotLeft: 10, plotRight: 110, point: series[1], xDomain: [1, 1] })).toBeNull();
  });

  it('keeps hover keys stable', () => {
    expect(hoverStateKey(null)).toBeNull();
    expect(hoverStateKey({ point: series[1], value: 110, x: 60, y: 20 })).toBe('2026-08-28|110');
  });

  it('resolves matching ohlc points for line hover points', () => {
    const candle: ChartCandlestickPoint = {
      label: 'B',
      dateValue: '2026-08-28',
      x: 100,
      value: 110,
      latestValue: null,
      open: 109,
      high: 111,
      low: 108,
      close: 110,
      complete: true,
      sourcePointCount: 5
    };

    expect(isCandlestickPoint(candle)).toBe(true);
    expect(isCandlestickPoint(series[1])).toBe(false);
    expect(getDisplayOhlcPoint(candle, [])).toBe(candle);
    expect(getDisplayOhlcPoint(series[1], [candle])).toBe(candle);
    expect(getDisplayOhlcPoint(series[0], [candle])).toBeNull();
    expect(getDisplayOhlcPoint(null, [candle])).toBeNull();
  });
});
