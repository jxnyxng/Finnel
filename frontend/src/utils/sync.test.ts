import { describe, expect, it } from 'vitest';

import { getMarketDailyStatus, getServiceStatus, getServiceUpdateInterval, isFailedSyncStatus } from './sync';
import type { DailyDashboardResponse, SyncStatus } from '../types';

describe('sync freshness status', () => {
  it('shows the weekly ranking update window after the Friday USD/KRW session closes', () => {
    expect(getServiceUpdateInterval('ranking')).toBe('랭킹 토요일 장종료 후');
  });

  it('does not treat partial success as healthy', () => {
    const syncStatus = syncStatusFixture('PARTIAL_SUCCESS');

    expect(isFailedSyncStatus(syncStatus.latestStatus)).toBe(true);
    expect(getMarketDailyStatus(dashboardFixture('FRESH'), syncStatus)).toEqual({
      label: '업데이트 점검',
      tone: 'error'
    });
  });

  it('shows running sync as updating, not failed', () => {
    const syncStatus = syncStatusFixture('RUNNING');

    expect(isFailedSyncStatus(syncStatus.latestStatus)).toBe(false);
    expect(getMarketDailyStatus(dashboardFixture('FRESH'), syncStatus)).toEqual({
      label: '업데이트 중',
      tone: 'idle'
    });
  });

  it('shows a delayed state for stale USD/KRW freshness', () => {
    expect(getMarketDailyStatus(dashboardFixture('STALE'), syncStatusFixture('SUCCESS'))).toEqual({
      label: '업데이트 지연',
      tone: 'error'
    });
  });

  it('does not let stale macro freshness mark fresh USD/KRW daily as delayed', () => {
    expect(getMarketDailyStatus(dashboardFixture('STALE', 'FRESH'), syncStatusFixture('SUCCESS'))).toEqual({
      label: '업데이트 원활',
      tone: 'healthy'
    });
  });

  it('does not let stale macro freshness mark fresh USD/KRW intraday as delayed', () => {
    expect(getServiceStatus({
      activeTab: 'dashboard',
      dashboard: dashboardFixture('STALE', 'FRESH'),
      domesticIndicators: dashboardFixture('STALE', 'FRESH').domesticIndicators,
      isGovernmentBriefingsConfigured: true,
      intradayStatus: syncStatusFixture('SUCCESS'),
      isNewsConfigured: true,
      latestIntradayDate: '2026-07-21',
      ranks: [],
      seoulDate: '2026-07-21',
      seoulTime: '10:30',
      syncStatus: syncStatusFixture('SUCCESS')
    })).toEqual({
      label: '업데이트 원활',
      tone: 'healthy'
    });
  });

  it('does not let stale macro freshness mark existing rankings as delayed', () => {
    expect(getServiceStatus({
      activeTab: 'ranking',
      dashboard: dashboardFixture('STALE', 'FRESH'),
      domesticIndicators: dashboardFixture('STALE', 'FRESH').domesticIndicators,
      isGovernmentBriefingsConfigured: true,
      intradayStatus: syncStatusFixture('SUCCESS'),
      isNewsConfigured: true,
      latestIntradayDate: '2026-07-21',
      ranks: [{
        baseDate: '2026-07-21',
        areaCode: 'KR',
        areaName: 'Korea',
        neerValue: 100,
        neerRank: 1,
        totalCount: 10,
        reerBaseDate: null,
        reerValue: null,
        previousNeerRank: null,
        previousNeerValue: null,
        neerValueChange: null
      }],
      seoulDate: '2026-07-21',
      seoulTime: '10:30',
      syncStatus: syncStatusFixture('SUCCESS')
    })).toEqual({
      label: '업데이트 원활',
      tone: 'healthy'
    });
  });

  it('waits for daily market status while dashboard data is not loaded', () => {
    expect(getMarketDailyStatus(null, syncStatusFixture('SUCCESS'))).toEqual({
      label: '업데이트 대기',
      tone: 'idle'
    });
  });

  it('waits when a configured content source has no collected item yet', () => {
    expect(getServiceStatus({
      activeTab: 'newsroom',
      dashboard: null,
      domesticIndicators: [],
      isGovernmentBriefingsConfigured: true,
      intradayStatus: null,
      isNewsConfigured: true,
      latestIntradayDate: null,
      latestNewsFetchedAt: null,
      ranks: [],
      seoulDate: '2026-07-21',
      seoulTime: '10:30',
      syncStatus: null
    })).toEqual({
      label: '업데이트 대기',
      tone: 'idle'
    });
  });
});

function syncStatusFixture(latestStatus: string): SyncStatus {
  return {
    latestStatus,
    latestStartedAt: '2026-07-21T00:00:00Z',
    latestEndedAt: '2026-07-21T00:01:00Z',
    latestMessage: null,
    nextAllowedAt: null,
    remainingCooldownSeconds: 0,
    canSync: true
  };
}

function dashboardFixture(
  freshnessStatus: 'FRESH' | 'STALE',
  usdKrwFreshnessStatus: 'FRESH' | 'STALE' = freshnessStatus
): DailyDashboardResponse {
  return {
    baseDate: '2026-07-21',
    metrics: [],
    usdKrwSeries: [],
    usdKrwIntradaySeries: [],
    dxyIndexSeries: [],
    dollarIndexSeries: [],
    advancedDollarIndexStatus: { latestBaseDate: null, fetchedAt: null },
    dollarIndexStatus: { latestBaseDate: null, fetchedAt: null },
    currencyStrengthRanks: [],
    foreignExchangeRates: [],
    exchangeRateCalculator: {
      earliestAllowedDate: '2021-07-21',
      latestAllowedDate: '2026-07-21'
    },
    domesticIndicators: [
      {
        code: 'USD_KRW',
        title: '원/달러 환율',
        category: '환율 현재 압력',
        value: 1390,
        unit: 'KRW',
        baseDate: '2026-07-21',
        observedAt: '2026-07-21T00:00:00Z',
        previousValue: 1385,
        previousBaseDate: '2026-07-20',
        source: 'Twelve Data',
        sourceUrl: 'https://twelvedata.com/currencies/usd-krw',
        fetchedAt: '2026-07-21T00:00:00Z',
        krwImpact: '',
        note: '',
        status: usdKrwFreshnessStatus === 'STALE' ? '업데이트 지연' : '정상 수집',
        detailUrl: null,
        freshnessStatus: usdKrwFreshnessStatus,
        staleReason: usdKrwFreshnessStatus === 'STALE' ? '지연' : null,
        freshnessReason: usdKrwFreshnessStatus === 'STALE' ? '지연' : null,
        expectedNextUpdateAt: '2026-07-21T00:10:00Z',
        lastSuccessfulFetchedAt: '2026-07-21T00:00:00Z',
        componentFreshnesses: []
      }
    ],
    dataSources: [],
    freshnessStatus,
    staleReason: freshnessStatus === 'STALE' ? '지연' : null,
    expectedNextUpdateAt: '2026-07-21T00:10:00Z',
    lastSuccessfulFetchedAt: '2026-07-21T00:00:00Z'
  };
}
