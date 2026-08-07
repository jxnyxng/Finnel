import { describe, expect, it } from 'vitest';

import {
  buildVisibleUsdKrwSeries,
  formatIntradayObservedAt,
  getIntradaySessionStartDate,
  getLatestIntradayDate,
  isCurrentIntradaySession
} from './chart';

describe('intraday chart time zone handling', () => {
  it('displays instant observedAt values in Asia/Seoul time', () => {
    const series = buildVisibleUsdKrwSeries([], [
      { observedAt: '2026-07-21T00:05:00Z', value: 1391.2 },
      { observedAt: '2026-07-21T00:10:00Z', value: 1391.4 }
    ], '1D');

    expect(series).toMatchObject([
      { label: '09:05', dateValue: '2026-07-21T09:05:00', x: 545 },
      { label: '09:10', dateValue: '2026-07-21T09:10:00', x: 550, latestValue: 1391.4 }
    ]);
  });

  it('keeps legacy offset-free observedAt values as Seoul local time', () => {
    const series = buildVisibleUsdKrwSeries([], [
      { observedAt: '2026-07-21T09:05:00', value: 1391.2 }
    ], '1D');

    expect(series[0]).toMatchObject({
      label: '09:05',
      dateValue: '2026-07-21T09:05:00',
      x: 545
    });
  });

  it('uses Asia/Seoul dates for session labels and latest intraday status', () => {
    const observedAt = '2026-07-20T21:30:00Z';

    expect(formatIntradayObservedAt(observedAt)).toBe('2026-07-21 06:30');
    expect(getLatestIntradayDate([{ observedAt, value: 1391.2 }])).toBe('2026-07-21');
    expect(getIntradaySessionStartDate(observedAt)).toBe('2026-07-21');
    expect(isCurrentIntradaySession([{ observedAt, value: 1391.2 }], '2026-07-21', '10:30')).toBe(true);
  });
});
