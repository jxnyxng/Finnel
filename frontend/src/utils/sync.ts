import axios, { AxiosError } from 'axios';
import type {
  CurrencyStrengthRank,
  DailyDashboardResponse,
  DomesticIndicator,
  MainTabKey,
  ServiceStatusTone,
  SyncResult,
  SyncStatus
} from '../types';
import { formatIntradayObservedAt, getActiveIntradaySessionStartDate } from './chart';
import { formatCooldown, formatDateTime, isWeekdayString } from './time';

export function getIntradayStatusLabel(
  isSyncing: boolean,
  latestIntradayDate: string | null,
  sessionPointCount: number,
  latestSessionObservedAt: string | null,
  remainingCooldownSeconds: number
) {
  if (isSyncing) {
    return '1일 세션 데이터 확인 중';
  }

  if (sessionPointCount > 0) {
    return `최신 ${formatIntradayObservedAt(latestSessionObservedAt)} · ${sessionPointCount}개`;
  }

  if (!latestIntradayDate) {
    return '1일 세션 데이터 확인 중';
  }

  if (remainingCooldownSeconds > 0) {
    return `최근 저장 세션 ${latestIntradayDate} · 다음 1일 데이터 확인까지 ${formatCooldown(remainingCooldownSeconds)}`;
  }

  return `최근 저장 세션 ${latestIntradayDate} · 자동 확인 대기 중`;
}

export function getLatestSyncLabel(syncStatus: SyncStatus | null, remainingCooldownSeconds: number) {
  if (!syncStatus?.latestStartedAt) {
    return '전체 데이터 수집 이력 없음 · 화면은 저장된 DB 데이터를 자동으로 다시 확인합니다.';
  }

  const latestTime = formatDateTime(syncStatus.latestEndedAt ?? syncStatus.latestStartedAt);
  const status = syncStatus.latestStatus ?? 'UNKNOWN';
  if (remainingCooldownSeconds > 0) {
    return `전체 데이터 수집 ${latestTime} · ${status} · 다음 전체 수집까지 ${formatCooldown(remainingCooldownSeconds)}`;
  }

  return `전체 데이터 수집 ${latestTime} · ${status}`;
}

export function getServiceStatus({
  activeTab,
  dashboard,
  dashboardLoadState,
  domesticIndicators,
  isGovernmentBriefingsConfigured,
  intradayStatus,
  isNewsConfigured,
  latestGovernmentBriefingFetchedAt,
  latestIntradayDate,
  latestNewsFetchedAt,
  ranks,
  seoulDate,
  seoulTime,
  syncStatus
}: {
  activeTab: MainTabKey;
  dashboard: DailyDashboardResponse | null;
  dashboardLoadState?: 'idle' | 'loading' | 'ready' | 'error';
  domesticIndicators: DomesticIndicator[];
  isGovernmentBriefingsConfigured: boolean;
  intradayStatus: SyncStatus | null;
  isNewsConfigured: boolean;
  latestGovernmentBriefingFetchedAt?: string | null;
  latestIntradayDate: string | null;
  latestNewsFetchedAt?: string | null;
  ranks: CurrencyStrengthRank[];
  seoulDate: string;
  seoulTime: string;
  syncStatus: SyncStatus | null;
}): { label: string; tone: ServiceStatusTone } {
  if (activeTab === 'newsroom') {
    return getContentFreshnessStatus(isNewsConfigured, latestNewsFetchedAt, 60);
  }

  if (activeTab === 'governmentBriefings') {
    return getContentFreshnessStatus(isGovernmentBriefingsConfigured, latestGovernmentBriefingFetchedAt, 60);
  }

  if (!dashboard && dashboardLoadState === 'loading') {
    return { label: '조회 중', tone: 'idle' };
  }

  if (!dashboard && dashboardLoadState === 'error') {
    return { label: '조회 실패', tone: 'error' };
  }

  const marketSyncFailed = isFailedSyncStatus(syncStatus?.latestStatus);
  const marketSyncRunning = isRunningSyncStatus(syncStatus?.latestStatus);
  if (activeTab === 'koreaStatus') {
    const hasDomesticData = domesticIndicators.some((indicator) => indicator.value !== null);
    const hasStaleDomesticData = domesticIndicators.some((indicator) => indicator.freshnessStatus === 'STALE');
    if (marketSyncFailed) {
      return { label: '업데이트 점검', tone: 'error' };
    }
    if (marketSyncRunning) {
      return { label: '업데이트 중', tone: 'idle' };
    }
    if (hasStaleDomesticData) {
      return { label: '업데이트 지연', tone: 'error' };
    }
    if (!dashboard || !hasDomesticData) {
      return { label: '업데이트 대기', tone: 'idle' };
    }

    return { label: '업데이트 원활', tone: 'healthy' };
  }

  if (activeTab === 'ranking') {
    if (!isRankingUpdateWindow(seoulDate)) {
      return { label: '업데이트 대기', tone: 'idle' };
    }

    if (marketSyncFailed) {
      return { label: '업데이트 점검', tone: 'error' };
    }
    if (marketSyncRunning) {
      return { label: '업데이트 중', tone: 'idle' };
    }
    if (hasSuccessfulSync(syncStatus) && ranks.length === 0) {
      return { label: '업데이트 지연', tone: 'error' };
    }
    if (ranks.length === 0) {
      return { label: '업데이트 대기', tone: 'idle' };
    }

    return { label: '업데이트 원활', tone: 'healthy' };
  }

  const intradayFailed = isFailedSyncStatus(intradayStatus?.latestStatus);
  const intradayRunning = isRunningSyncStatus(intradayStatus?.latestStatus);
  const usdKrw = dashboard?.domesticIndicators.find((indicator) => indicator.code === 'USD_KRW') ?? null;
  if (!isIntradayExchangeUpdateWindow(seoulDate, seoulTime)) {
    return { label: '업데이트 대기', tone: 'idle' };
  }

  if (marketSyncFailed || intradayFailed) {
    return { label: '업데이트 점검', tone: 'error' };
  }
  if (marketSyncRunning || intradayRunning) {
    return { label: '업데이트 중', tone: 'idle' };
  }
  if (usdKrw?.freshnessStatus === 'STALE' || (hasSuccessfulSync(intradayStatus) && !latestIntradayDate)) {
    return { label: '업데이트 지연', tone: 'error' };
  }
  if (!dashboard || !latestIntradayDate) {
    return { label: '업데이트 대기', tone: 'idle' };
  }

  return { label: '업데이트 원활', tone: 'healthy' };
}

export function getSyncSkippedMessage(result: SyncResult) {
  if (result.status === 'SKIPPED_RUNNING') {
    return '이미 수집이 진행 중입니다. 저장된 데이터는 자동으로 다시 확인합니다.';
  }

  return `API 호출 제한 보호 중입니다. ${formatCooldown(result.remainingCooldownSeconds)} 후 다시 수집할 수 있습니다.`;
}

export function getServiceUpdateInterval(activeTab: MainTabKey) {
  if (activeTab === 'dashboard') {
    return '환율 1분봉 · 5분마다 확인';
  }

  if (activeTab === 'koreaStatus') {
    return '정책·거시 09:10/15:10';
  }

  if (activeTab === 'ranking') {
    return '랭킹 09:10/15:10';
  }

  if (activeTab === 'governmentBriefings') {
    return '정부 정책 10분';
  }

  return '뉴스 10분';
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return `${fallback} 백엔드 로그를 확인하세요.`;
  }

  const axiosError = error as AxiosError<{ message?: string; error?: string; status?: number }>;
  const status = axiosError.response?.status;
  const responseMessage = axiosError.response?.data?.message ?? axiosError.response?.data?.error;
  if (status && responseMessage) {
    return `${fallback} HTTP ${status}: ${responseMessage}`;
  }

  if (status) {
    return `${fallback} HTTP ${status}`;
  }

  return `${fallback} ${axiosError.message}`;
}

export function isFailedSyncStatus(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return status !== 'SUCCESS' && status !== 'RUNNING' && !status.startsWith('SKIPPED');
}

export function getMarketDailyStatus(
  dashboard: DailyDashboardResponse | null,
  syncStatus: SyncStatus | null
): { label: string; tone: ServiceStatusTone } {
  if (syncStatus?.latestStatus && isFailedSyncStatus(syncStatus.latestStatus)) {
    return { label: '업데이트 점검', tone: 'error' };
  }
  if (isRunningSyncStatus(syncStatus?.latestStatus)) {
    return { label: '업데이트 중', tone: 'idle' };
  }
  if (!dashboard) {
    return { label: '업데이트 대기', tone: 'idle' };
  }

  const usdKrw = dashboard?.domesticIndicators.find((indicator) => indicator.code === 'USD_KRW') ?? null;
  if (usdKrw?.freshnessStatus === 'STALE') {
    return { label: '업데이트 지연', tone: 'error' };
  }

  if (hasSuccessfulSync(syncStatus) && (!usdKrw || usdKrw.freshnessStatus === 'MISSING')) {
    return { label: '업데이트 지연', tone: 'error' };
  }

  if (usdKrw?.freshnessStatus === 'FRESH' || hasSuccessfulSync(syncStatus)) {
    return { label: '업데이트 원활', tone: 'healthy' };
  }

  return { label: '업데이트 대기', tone: 'idle' };
}

function getContentFreshnessStatus(isConfigured: boolean, latestFetchedAt: string | null | undefined, maxAgeMinutes: number) {
  if (!isConfigured) {
    return { label: '업데이트 대기', tone: 'idle' as const };
  }

  if (!latestFetchedAt) {
    return { label: '업데이트 대기', tone: 'idle' as const };
  }

  const latestMs = new Date(latestFetchedAt).getTime();
  if (!Number.isFinite(latestMs)) {
    return { label: '업데이트 점검', tone: 'error' as const };
  }

  return Date.now() - latestMs > maxAgeMinutes * 60_000
    ? { label: '업데이트 지연', tone: 'error' as const }
    : { label: '업데이트 원활', tone: 'healthy' as const };
}

function hasSuccessfulSync(syncStatus: SyncStatus | null) {
  return syncStatus?.latestStatus === 'SUCCESS';
}

function isRunningSyncStatus(status: string | null | undefined) {
  return status === 'RUNNING';
}

function isIntradayExchangeUpdateWindow(seoulDate: string, seoulTime: string) {
  return getActiveIntradaySessionStartDate(seoulDate, seoulTime) !== null;
}

function isRankingUpdateWindow(seoulDate: string) {
  return isWeekdayString(seoulDate);
}
