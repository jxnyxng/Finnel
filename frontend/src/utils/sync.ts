import axios, { AxiosError } from 'axios';
import { intradaySessionEndMinutes, intradaySessionStartMinutes } from '../constants';
import type {
  CurrencyStrengthRank,
  DailyDashboardResponse,
  DomesticIndicator,
  MainTabKey,
  ServiceStatusTone,
  SyncResult,
  SyncStatus
} from '../types';
import { formatIntradayObservedAt } from './chart';
import { formatCooldown, formatDateTime, getPreviousDateString, isWeekdayString } from './time';

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
  domesticIndicators,
  intradayStatus,
  isNewsConfigured,
  latestIntradayDate,
  ranks,
  seoulDate,
  seoulTime,
  syncStatus
}: {
  activeTab: MainTabKey;
  dashboard: DailyDashboardResponse | null;
  domesticIndicators: DomesticIndicator[];
  intradayStatus: SyncStatus | null;
  isNewsConfigured: boolean;
  latestIntradayDate: string | null;
  ranks: CurrencyStrengthRank[];
  seoulDate: string;
  seoulTime: string;
  syncStatus: SyncStatus | null;
}): { label: string; tone: ServiceStatusTone } {
  if (activeTab === 'newsroom') {
    return isNewsConfigured ? { label: '업데이트 원활', tone: 'healthy' } : { label: '업데이트 대기', tone: 'idle' };
  }

  const marketSyncFailed = isFailedSyncStatus(syncStatus?.latestStatus);
  if (activeTab === 'koreaStatus') {
    const hasDomesticData = domesticIndicators.some((indicator) => indicator.value !== null);
    if (marketSyncFailed || !dashboard || !hasDomesticData) {
      return { label: '업데이트 점검', tone: 'error' };
    }

    return { label: '업데이트 원활', tone: 'healthy' };
  }

  if (activeTab === 'ranking') {
    if (!isRankingUpdateWindow(seoulDate)) {
      return { label: '업데이트 대기', tone: 'idle' };
    }

    if (marketSyncFailed || ranks.length === 0) {
      return { label: '업데이트 점검', tone: 'error' };
    }

    return { label: '업데이트 원활', tone: 'healthy' };
  }

  const intradayFailed = isFailedSyncStatus(intradayStatus?.latestStatus);
  if (!isIntradayExchangeUpdateWindow(seoulDate, seoulTime)) {
    return { label: '업데이트 대기', tone: 'idle' };
  }

  if (marketSyncFailed || intradayFailed || !dashboard || !latestIntradayDate) {
    return { label: '업데이트 점검', tone: 'error' };
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

function isFailedSyncStatus(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return status !== 'SUCCESS' && status !== 'PARTIAL_SUCCESS' && !status.startsWith('SKIPPED');
}

function isIntradayExchangeUpdateWindow(seoulDate: string, seoulTime: string) {
  const [hour, minute] = seoulTime.split(':').map(Number);
  const minutes = hour * 60 + minute;

  if (minutes < intradaySessionStartMinutes) {
    return isWeekdayString(getPreviousDateString(seoulDate)) && minutes <= intradaySessionEndMinutes;
  }

  return isWeekdayString(seoulDate);
}

function isRankingUpdateWindow(seoulDate: string) {
  return isWeekdayString(seoulDate);
}
