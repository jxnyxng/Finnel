import { describe, expect, it } from 'vitest';

import {
  buildVisibleUsdKrwCandles,
  buildVisibleUsdKrwSeries,
  formatIntradayObservedAt,
  getXDomain,
  getIntradaySessionStartDate,
  getLatestIntradayDate,
  isCurrentIntradaySession
} from './chart';

describe('intraday chart time zone handling', () => {
  it('displays instant observedAt values in Asia/Seoul time', () => {
    const series = buildVisibleUsdKrwSeries([], [
      { observedAt: '2026-07-21T00:05:00Z', open: 1391.2, high: 1391.2, low: 1391.2, value: 1391.2 },
      { observedAt: '2026-07-21T00:10:00Z', open: 1391.4, high: 1391.4, low: 1391.4, value: 1391.4 }
    ], '1D');

    expect(series).toMatchObject([
      { label: '09:05', dateValue: '2026-07-21T09:05:00', x: 545 },
      { label: '09:10', dateValue: '2026-07-21T09:10:00', x: 550, latestValue: 1391.4 }
    ]);
  });

  it('keeps legacy offset-free observedAt values as Seoul local time', () => {
    const series = buildVisibleUsdKrwSeries([], [
      { observedAt: '2026-07-21T09:05:00', open: 1391.2, high: 1391.2, low: 1391.2, value: 1391.2 }
    ], '1D');

    expect(series[0]).toMatchObject({
      label: '09:05',
      dateValue: '2026-07-21T09:05:00',
      x: 545
    });
  });

  it('labels five minute candles by the right edge of each bucket', () => {
    const candles = buildVisibleUsdKrwCandles([
      {
        observedAt: '2026-07-21T00:10:00Z',
        open: 1391.2,
        high: 1392.4,
        low: 1390.8,
        close: 1391.8,
        sourcePointCount: 5,
        complete: true,
        fetchedAt: '2026-07-21T00:10:30Z'
      }
    ]);

    expect(candles[0]).toMatchObject({
      label: '09:10',
      x: 550,
      open: 1391.2,
      high: 1392.4,
      low: 1390.8,
      close: 1391.8
    });
  });

  it('uses five minute candle closes for the 1D line series when candles are available', () => {
    const series = buildVisibleUsdKrwSeries([], [
      { observedAt: '2026-07-21T00:04:00Z', open: 1390, high: 1390, low: 1390, value: 1390 }
    ], '1D', [
      {
        observedAt: '2026-07-21T00:05:00Z',
        open: 1390,
        high: 1392,
        low: 1389,
        close: 1391,
        sourcePointCount: 5,
        complete: true,
        fetchedAt: '2026-07-21T00:05:30Z'
      },
      {
        observedAt: '2026-07-21T00:10:00Z',
        open: 1391,
        high: 1393,
        low: 1390,
        close: 1392,
        sourcePointCount: 5,
        complete: true,
        fetchedAt: '2026-07-21T00:10:30Z'
      }
    ]);

    expect(series).toMatchObject([
      { label: '09:05', value: 1391, latestValue: null },
      { label: '09:10', value: 1392, latestValue: 1392 }
    ]);
  });

  it('keeps the 1D x domain on the full intraday session', () => {
    const domain = getXDomain([
      { label: '09:00', dateValue: '2026-07-21T09:00:00', x: 540, value: 1390, latestValue: null },
      { label: '15:00', dateValue: '2026-07-21T15:00:00', x: 900, value: 1392, latestValue: 1392 }
    ], '1D');

    expect(domain).toEqual([360, 1800]);
  });

  it('uses Asia/Seoul dates for session labels and latest intraday status', () => {
    const observedAt = '2026-07-20T21:30:00Z';

    expect(formatIntradayObservedAt(observedAt)).toBe('2026-07-21 06:30');
    expect(getLatestIntradayDate([{ observedAt, open: 1391.2, high: 1391.2, low: 1391.2, value: 1391.2 }])).toBe('2026-07-21');
    expect(getIntradaySessionStartDate(observedAt)).toBe('2026-07-21');
    expect(isCurrentIntradaySession([{ observedAt, open: 1391.2, high: 1391.2, low: 1391.2, value: 1391.2 }], '2026-07-21', '10:30')).toBe(true);
  });
});
