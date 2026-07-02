import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';
import {
  chartBottomMarginPx,
  chartTopMarginPx,
  dailyXAxisHeightPx,
  intradayXAxisHeightPx,
  longRangeOptions,
  mainTabs,
  rangeOptions,
} from './constants';
import {
  DollarIndexTooltip,
  LatestValueDot,
  UsdKrwTooltip,
  getActiveChartHover,
  getAxisTimeLabelLeft,
  getAxisValueLabelTop
} from './components/ChartElements';
import { DataSourceGuide as DataSourceGuideView } from './components/DataSourceGuide';
import { MetricSidePanel as MetricSidePanelView } from './components/MetricSidePanel';
import { CurrencyStrengthPage as CurrencyStrengthPageView } from './pages/CurrencyStrengthPage';
import { DeveloperInfoPage as DeveloperInfoPageView } from './pages/DeveloperInfoPage';
import { KoreaStatusPage as KoreaStatusPageView } from './pages/KoreaStatusPage';
import { NewsroomPage as NewsroomPageView } from './pages/NewsroomPage';
import { ServiceGuidePage as ServiceGuidePageView } from './pages/ServiceGuidePage';
import {
  buildVisibleDailySeries,
  buildVisibleUsdKrwSeries,
  formatCrosshairDate,
  formatDailyXTick,
  formatUsdKrwXTick,
  getDailyReferenceLabel,
  getDailyXTicks,
  getLatestIntradayDate,
  getLatestValueLabelTop,
  getPanelPeriodLabel,
  getRangeLabel,
  getUsdKrwPanelReferenceLabel,
  getUsdKrwReferenceLabel,
  getUsdKrwXTicks,
  getValueDomain,
  getXDomain
} from './utils/chart';
import { formatValue } from './utils/format';
import { findMetric, sortMetrics } from './utils/metrics';
import {
  getIntradayStatusLabel,
  getLatestSyncLabel,
  getRequestErrorMessage,
  getServiceStatus,
  getSyncSkippedMessage
} from './utils/sync';
import {
  getRemainingCooldownSeconds,
  getSeoulDateString,
  getSeoulTimeString,
  hasMissingRecentWeekday
} from './utils/time';
import type {
  ChartHoverState,
  DailyDashboardResponse,
  MainTabKey,
  NewsArticle,
  NewsCategory,
  NewsResponse,
  PageKey,
  RangeKey,
  SyncResult,
  SyncStatus
} from './types';

function App() {
  const [dashboard, setDashboard] = React.useState<DailyDashboardResponse | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [intradayStatus, setIntradayStatus] = React.useState<SyncStatus | null>(null);
  const [dailyBackfillStatus, setDailyBackfillStatus] = React.useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isIntradaySyncing, setIsIntradaySyncing] = React.useState(false);
  const [isDailyBackfilling, setIsDailyBackfilling] = React.useState(false);
  const [message, setMessage] = React.useState('DB에 저장된 최신 데이터를 조회합니다.');
  const [usdKrwRange, setUsdKrwRange] = React.useState<RangeKey>('1D');
  const [dxyRange, setDxyRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [dollarIndexRange, setDollarIndexRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [activeTab, setActiveTab] = React.useState<MainTabKey>('dashboard');
  const [activePage, setActivePage] = React.useState<PageKey>('dashboard');
  const [activeUsdKrwHover, setActiveUsdKrwHover] = React.useState<ChartHoverState | null>(null);
  const [activeAdvancedDollarHover, setActiveAdvancedDollarHover] = React.useState<ChartHoverState | null>(null);
  const [activeBroadDollarHover, setActiveBroadDollarHover] = React.useState<ChartHoverState | null>(null);
  const [newsArticles, setNewsArticles] = React.useState<NewsArticle[]>([]);
  const [newsCategories, setNewsCategories] = React.useState<NewsCategory[]>([]);
  const [isNewsConfigured, setIsNewsConfigured] = React.useState(false);
  const [isNewsLoading, setIsNewsLoading] = React.useState(false);
  const [selectedNewsCategory, setSelectedNewsCategory] = React.useState('all');
  const [newsSyncMessage, setNewsSyncMessage] = React.useState('');
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const lastIntradayRefreshAttemptAt = React.useRef(0);
  const attemptedDailyBackfillKey = React.useRef<string | null>(null);
  const isMainAppPage = activePage === 'dashboard' || activePage === 'koreaStatus' || activePage === 'ranking' || activePage === 'newsroom';

  const loadDashboard = React.useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const response = await axios.get<DailyDashboardResponse>('/api/v1/dashboard/daily');
      setDashboard(response.data);
      setMessage('대시보드 데이터를 불러왔습니다.');
    } catch {
      setMessage('백엔드 API를 불러오지 못했습니다.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadSyncStatus = React.useCallback(async () => {
    try {
      const response = await axios.get<SyncStatus>('/api/v1/sync/market-data/status');
      setSyncStatus(response.data);
    } catch {
      setSyncStatus(null);
    }
  }, []);

  const loadIntradayStatus = React.useCallback(async () => {
    try {
      const response = await axios.get<SyncStatus>('/api/v1/sync/intraday-exchange/status');
      setIntradayStatus(response.data);
    } catch {
      setIntradayStatus(null);
    }
  }, []);

  const loadDailyBackfillStatus = React.useCallback(async () => {
    try {
      const response = await axios.get<SyncStatus>('/api/v1/sync/daily-exchange/backfill/status');
      setDailyBackfillStatus(response.data);
    } catch {
      setDailyBackfillStatus(null);
    }
  }, []);

  const loadNews = React.useCallback(async (category = selectedNewsCategory, showLoading = false) => {
    if (showLoading) {
      setIsNewsLoading(true);
    }

    try {
      const response = await axios.get<NewsResponse>('/api/v1/news', {
        params: { category, limit: 30 }
      });
      setNewsArticles(response.data.articles);
      setNewsCategories(response.data.categories);
      setIsNewsConfigured(response.data.configured);
      if (!response.data.configured) {
        setNewsSyncMessage('네이버 뉴스 API 키 설정이 필요합니다.');
      } else if (!newsSyncMessage) {
        setNewsSyncMessage('저장된 최신 뉴스를 조회합니다.');
      }
    } catch {
      setNewsArticles([]);
      setNewsSyncMessage('뉴스 API를 불러오지 못했습니다.');
    } finally {
      if (showLoading) {
        setIsNewsLoading(false);
      }
    }
  }, [newsSyncMessage, selectedNewsCategory]);

  React.useEffect(() => {
    loadDashboard(true);
    loadSyncStatus();
    loadIntradayStatus();
    loadDailyBackfillStatus();

    const dashboardTimer = window.setInterval(loadDashboard, 15_000);
    const statusTimer = window.setInterval(loadSyncStatus, 15_000);
    const intradayStatusTimer = window.setInterval(loadIntradayStatus, 15_000);
    const dailyBackfillStatusTimer = window.setInterval(loadDailyBackfillStatus, 30_000);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1_000);

    return () => {
      window.clearInterval(dashboardTimer);
      window.clearInterval(statusTimer);
      window.clearInterval(intradayStatusTimer);
      window.clearInterval(dailyBackfillStatusTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadDashboard, loadSyncStatus, loadIntradayStatus, loadDailyBackfillStatus]);

  React.useEffect(() => {
    if (activePage !== 'newsroom') {
      return undefined;
    }

    loadNews(selectedNewsCategory, true);
    const newsTimer = window.setInterval(() => loadNews(selectedNewsCategory), 60_000);
    return () => window.clearInterval(newsTimer);
  }, [activePage, loadNews, selectedNewsCategory]);

  const metrics = sortMetrics(dashboard?.metrics ?? []);
  const usdKrwMetric = findMetric(metrics, 'USD/KRW');
  const dxyMetric = findMetric(metrics, 'ADVANCED_DOLLAR_INDEX');
  const dollarIndexMetric = findMetric(metrics, 'BROAD_DOLLAR_INDEX');
  const usdKrwSeries = dashboard?.usdKrwSeries ?? [];
  const usdKrwIntradaySeries = dashboard?.usdKrwIntradaySeries ?? [];
  const dxyIndexSeries = dashboard?.dxyIndexSeries ?? [];
  const dollarIndexSeries = dashboard?.dollarIndexSeries ?? [];
  const currencyStrengthRanks = dashboard?.currencyStrengthRanks ?? [];
  const domesticIndicators = dashboard?.domesticIndicators ?? [];
  const dataSources = dashboard?.dataSources ?? [];
  const seoulToday = getSeoulDateString(new Date(nowMs));
  const seoulTime = getSeoulTimeString(new Date(nowMs));
  const latestIntradayDate = getLatestIntradayDate(usdKrwIntradaySeries);
  const visibleUsdKrwSeries = buildVisibleUsdKrwSeries(usdKrwSeries, usdKrwIntradaySeries, usdKrwRange);
  const latestUsdKrwPoint = visibleUsdKrwSeries[visibleUsdKrwSeries.length - 1] ?? null;
  const usdKrwDomain = getValueDomain(visibleUsdKrwSeries, 5);
  const latestUsdKrwLabelTop = getLatestValueLabelTop(
    latestUsdKrwPoint?.value ?? null,
    usdKrwDomain,
    usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx
  );
  const usdKrwXDomain = getXDomain(visibleUsdKrwSeries, usdKrwRange);
  const usdKrwXTicks = usdKrwRange === '1D' ? getUsdKrwXTicks(usdKrwRange) : getDailyXTicks(visibleUsdKrwSeries);
  const visibleDxyIndexSeries = buildVisibleDailySeries(dxyIndexSeries, dxyRange);
  const latestDxyIndexPoint = visibleDxyIndexSeries[visibleDxyIndexSeries.length - 1] ?? null;
  const dxyIndexDomain = getValueDomain(visibleDxyIndexSeries, 1);
  const latestDxyIndexLabelTop = getLatestValueLabelTop(latestDxyIndexPoint?.value ?? null, dxyIndexDomain, dailyXAxisHeightPx);
  const dxyIndexXDomain = getXDomain(visibleDxyIndexSeries, dxyRange);
  const dxyIndexXTicks = getDailyXTicks(visibleDxyIndexSeries);
  const visibleDollarIndexSeries = buildVisibleDailySeries(dollarIndexSeries, dollarIndexRange);
  const latestDollarIndexPoint = visibleDollarIndexSeries[visibleDollarIndexSeries.length - 1] ?? null;
  const dollarIndexDomain = getValueDomain(visibleDollarIndexSeries, 1);
  const latestDollarIndexLabelTop = getLatestValueLabelTop(latestDollarIndexPoint?.value ?? null, dollarIndexDomain, dailyXAxisHeightPx);
  const dollarIndexXDomain = getXDomain(visibleDollarIndexSeries, dollarIndexRange);
  const dollarIndexXTicks = getDailyXTicks(visibleDollarIndexSeries);
  const dollarIndexReferenceLabel = getDailyReferenceLabel(visibleDollarIndexSeries);
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date());
  const usdKrwReferenceLabel = getUsdKrwReferenceLabel(usdKrwRange, visibleUsdKrwSeries, dashboard?.baseDate);
  const remainingCooldownSeconds = getRemainingCooldownSeconds(syncStatus, nowMs);
  const remainingIntradayCooldownSeconds = getRemainingCooldownSeconds(intradayStatus, nowMs);
  const remainingDailyBackfillCooldownSeconds = getRemainingCooldownSeconds(dailyBackfillStatus, nowMs);
  const hasRecentDailyGap = hasMissingRecentWeekday(usdKrwSeries, seoulToday);
  const latestSyncLabel = getLatestSyncLabel(syncStatus, remainingCooldownSeconds);
  const activeServiceStatus = getServiceStatus({
    activeTab,
    dashboard,
    domesticIndicators,
    intradayStatus,
    isNewsConfigured,
    latestIntradayDate,
    ranks: currencyStrengthRanks,
    seoulDate: seoulToday,
    seoulTime,
    syncStatus
  });
  const intradayStatusLabel = getIntradayStatusLabel(
    isIntradaySyncing,
    latestIntradayDate,
    usdKrwIntradaySeries.length,
    usdKrwIntradaySeries[usdKrwIntradaySeries.length - 1]?.observedAt ?? null,
    remainingIntradayCooldownSeconds
  );
  const onePercentHigherUsdKrw = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 1.01;
  const onePercentLowerUsdKrw = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 0.99;
  const usdKrwPanelDetails = [
    { label: '+1%', value: `${formatValue(onePercentHigherUsdKrw)} KRW` },
    { label: '-1%', value: `${formatValue(onePercentLowerUsdKrw)} KRW` },
    { label: '범위', value: getRangeLabel(usdKrwRange) },
    { label: usdKrwRange === '1D' ? '세션' : '기간', value: getUsdKrwPanelReferenceLabel(usdKrwRange, visibleUsdKrwSeries) },
    { label: '의미', value: '1달러 가격' },
    { label: '해석', value: '상승하면 원화 약세' },
    { label: '출처', value: usdKrwRange === '1D' ? 'Twelve Data 5분봉' : 'Koreaexim/FRED 일별' }
  ];
  const dollarIndexPanelDetails = [
    { label: '범위', value: getRangeLabel(dollarIndexRange) },
    { label: '기간', value: getPanelPeriodLabel(visibleDollarIndexSeries) },
    { label: '관측값', value: `${visibleDollarIndexSeries.length}개` },
    { label: '의미', value: '넓은 교역 상대 기준 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXBGS' }
  ];
  const dxyPanelDetails = [
    { label: '범위', value: getRangeLabel(dxyRange) },
    { label: '기간', value: getPanelPeriodLabel(visibleDxyIndexSeries) },
    { label: '관측값', value: `${visibleDxyIndexSeries.length}개` },
    { label: '의미', value: '선진국 통화 대비 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXAFEGS' }
  ];

  const refreshIntraday = React.useCallback(async () => {
    setIsIntradaySyncing(true);
    setMessage('1일 환율 데이터를 최신 상태로 확인 중입니다.');
    try {
      const response = await axios.post<SyncResult>('/api/v1/sync/intraday-exchange');
      await loadIntradayStatus();
      if (!response.data.status.startsWith('SKIPPED')) {
        await loadDashboard();
        setMessage('오늘 1일 환율 데이터를 다시 확인했습니다.');
      } else {
        setMessage(getSyncSkippedMessage(response.data));
      }
    } catch (error) {
      setMessage(getRequestErrorMessage(error, '1일 환율 데이터 확인에 실패했습니다.'));
    } finally {
      setIsIntradaySyncing(false);
    }
  }, [loadDashboard, loadIntradayStatus]);

  const backfillDailyExchange = React.useCallback(async () => {
    setIsDailyBackfilling(true);
    setMessage('누락된 영업일 환율 데이터를 확인 중입니다.');
    try {
      const response = await axios.post<SyncResult>('/api/v1/sync/daily-exchange/backfill');
      await loadDailyBackfillStatus();
      if (!response.data.status.startsWith('SKIPPED')) {
        await loadDashboard();
        setMessage('누락된 영업일 환율 데이터를 다시 확인했습니다.');
      } else {
        setMessage(getSyncSkippedMessage(response.data));
      }
    } catch (error) {
      setMessage(getRequestErrorMessage(error, '누락된 영업일 환율 데이터 확인에 실패했습니다.'));
    } finally {
      setIsDailyBackfilling(false);
    }
  }, [loadDashboard, loadDailyBackfillStatus]);

  const changeNewsCategory = React.useCallback((category: string) => {
    setSelectedNewsCategory(category);
    loadNews(category, true);
  }, [loadNews]);

  React.useEffect(() => {
    if (usdKrwRange !== '1D') {
      return;
    }

    if (usdKrwIntradaySeries.length > 0) {
      return;
    }

    if (isIntradaySyncing || remainingIntradayCooldownSeconds > 0) {
      return;
    }

    if (nowMs - lastIntradayRefreshAttemptAt.current < 60_000) {
      return;
    }

    lastIntradayRefreshAttemptAt.current = nowMs;
    refreshIntraday();
  }, [
    isIntradaySyncing,
    nowMs,
    refreshIntraday,
    remainingIntradayCooldownSeconds,
    seoulToday,
    usdKrwIntradaySeries.length,
    usdKrwRange
  ]);

  React.useEffect(() => {
    if (!hasRecentDailyGap) {
      return;
    }

    if (isDailyBackfilling || remainingDailyBackfillCooldownSeconds > 0) {
      return;
    }

    if (attemptedDailyBackfillKey.current === seoulToday) {
      return;
    }

    attemptedDailyBackfillKey.current = seoulToday;
    backfillDailyExchange();
  }, [
    backfillDailyExchange,
    hasRecentDailyGap,
    isDailyBackfilling,
    remainingDailyBackfillCooldownSeconds,
    seoulToday
  ]);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="w-full bg-teal-700 text-white">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between gap-3 px-5">
          <button
            className="flex min-w-0 items-center gap-2"
            onClick={() => {
              setActiveTab('dashboard');
              setActivePage('dashboard');
            }}
            type="button"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-xs font-bold text-teal-700">₩</span>
            <span className="truncate text-sm font-semibold tracking-normal">KRW Watcher</span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button
              className={`h-7 whitespace-nowrap rounded px-2.5 text-xs font-semibold ${
                activePage === 'serviceGuide' ? 'bg-white text-teal-700' : 'text-teal-50 hover:bg-teal-600'
              }`}
              onClick={() => setActivePage('serviceGuide')}
              type="button"
            >
              서비스 이용 안내
            </button>
            <button
              className={`h-7 whitespace-nowrap rounded px-2.5 text-xs font-semibold ${
                activePage === 'developerInfo' ? 'bg-white text-teal-700' : 'text-teal-50 hover:bg-teal-600'
              }`}
              onClick={() => setActivePage('developerInfo')}
              type="button"
            >
              개발자 정보
            </button>
          </div>
        </div>
      </div>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        {isMainAppPage ? (
          <>
            <header className="border-b border-zinc-200 pb-3">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-teal-700">환율·실효환율·금리 통합 모니터</p>
                <h1 className="text-2xl font-semibold tracking-normal">원화 가치 흐름 모니터</h1>
                <p className="max-w-2xl text-xs leading-5 text-zinc-600">
                  오늘 {todayLabel} · {message}
                </p>
              </div>
            </header>

            <div className="flex flex-col gap-2">
              <nav className="grid grid-cols-4 rounded-md border border-zinc-200 bg-zinc-100 p-1" aria-label="주요 화면">
                {mainTabs.map((tab) => (
                  <button
                    className={`h-9 rounded text-sm font-semibold ${
                      activePage === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setActivePage(tab.key);
                    }}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div className="flex min-w-0 text-xs text-zinc-500">
                <div className="flex items-center gap-2 font-medium">
                  <span className={`service-status-dot service-status-dot-${activeServiceStatus.tone}`} aria-hidden="true" />
                  {activeServiceStatus.label}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {activePage === 'dashboard' ? (
          <section className="grid gap-4">
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">USD/KRW 추이</h2>
                    <div className="group relative">
                      <button
                        aria-label="USD/KRW 그래프 안내"
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-teal-600 hover:text-teal-700"
                        type="button"
                      >
                        i
                      </button>
                      <div className="chart-help-tooltip pointer-events-none absolute top-7 z-20 hidden w-72 rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg group-hover:block">
                        <p className="font-semibold text-zinc-900">USD/KRW 그래프</p>
                        <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                        <p className="mt-1">1일은 5분 단위 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex h-8 flex-col justify-start gap-1">
                    <p className="text-xs text-zinc-500">{usdKrwRange === '1D' ? '09:00~익일 02:00' : getRangeLabel(usdKrwRange)}</p>
                    <p className={`text-xs ${usdKrwRange === '1D' ? 'text-teal-700' : 'text-transparent'}`}>
                      {usdKrwRange === '1D' ? intradayStatusLabel : '상태 영역'}
                    </p>
                  </div>
                </div>
                <div className="grid h-9 shrink-0 grid-cols-4 rounded-md border border-zinc-200 bg-zinc-100 p-1">
                  {rangeOptions.map((option) => (
                    <button
                      className={`h-7 min-w-14 px-3 text-xs font-semibold ${
                        usdKrwRange === option.key ? 'rounded bg-white text-teal-700 shadow-sm' : 'text-zinc-500'
                      }`}
                      key={option.key}
                      onClick={() => setUsdKrwRange(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-grid-surface relative h-80 overflow-hidden rounded-md">
              <div
                className="chart-plot-grid"
                style={{
                  bottom: chartBottomMarginPx + (usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx),
                  left: 28,
                  right: 66,
                  top: chartTopMarginPx
                }}
              />
              {visibleUsdKrwSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  {usdKrwRange === '1D'
                    ? '09:00~다음날 02:00 세션 환율 데이터를 확인 중입니다.'
                    : '표시할 환율 데이터가 없습니다.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={visibleUsdKrwSeries}
                    margin={{ top: 8, right: 8, bottom: 18, left: 28 }}
                    onMouseLeave={() => setActiveUsdKrwHover(null)}
                    onMouseMove={(state) => setActiveUsdKrwHover(getActiveChartHover(state, visibleUsdKrwSeries))}
                  >
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={usdKrwXDomain}
                      height={usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx}
                      padding={{ left: 0, right: 0 }}
                      ticks={usdKrwXTicks}
                      tickFormatter={(value) => usdKrwRange === '1D' ? formatUsdKrwXTick(value) : formatDailyXTick(value, usdKrwRange)}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      orientation="right"
                      domain={usdKrwDomain}
                      tickFormatter={(value) => formatValue(Number(value))}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      tickCount={8}
                      width={58}
                    />
                    <Tooltip
                      animationDuration={120}
                      content={<UsdKrwTooltip range={usdKrwRange} />}
                      cursor={false}
                      wrapperStyle={{ outline: 'none', transition: 'opacity 120ms ease-out' }}
                    />
                    {latestUsdKrwPoint ? (
                      <ReferenceLine
                        y={latestUsdKrwPoint.value}
                        stroke="#0f766e"
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="latestValue"
                      stroke="transparent"
                      dot={<LatestValueDot />}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {latestUsdKrwPoint && latestUsdKrwLabelTop !== null ? (
                <div className="latest-value-floating-label" style={{ top: `${latestUsdKrwLabelTop}%` }}>
                  <span>{formatValue(latestUsdKrwPoint.value)}</span>
                </div>
              ) : null}
              {activeUsdKrwHover ? (
                <div
                  className="chart-crosshair-x"
                  style={{
                    bottom: chartBottomMarginPx + (usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx),
                    left: activeUsdKrwHover.x,
                    top: chartTopMarginPx
                  }}
                />
              ) : null}
              {activeUsdKrwHover ? (
                <div
                  className="chart-crosshair-y"
                  style={{
                    left: 28,
                    right: 66,
                    top: activeUsdKrwHover.y
                  }}
                />
              ) : null}
              {activeUsdKrwHover ? (
                <div className="chart-axis-value-label" style={{ top: getAxisValueLabelTop(activeUsdKrwHover.y) }}>
                  <span>{formatValue(activeUsdKrwHover.point.value)}</span>
                </div>
              ) : null}
              {activeUsdKrwHover ? (
                <div className="chart-axis-time-label" style={{ left: getAxisTimeLabelLeft(activeUsdKrwHover.x) }}>
                  {formatCrosshairDate(activeUsdKrwHover.point.dateValue, usdKrwRange)}
                </div>
              ) : null}
            </div>
              </article>
              <MetricSidePanelView
                details={usdKrwPanelDetails}
                footerText={`기준 ${dashboard?.baseDate ?? '-'}`}
                metric={usdKrwMetric}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">선진국 달러 지수</h2>
                    <div className="group relative">
                      <button
                        aria-label="선진국 달러 지수 안내"
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-teal-600 hover:text-teal-700"
                        type="button"
                      >
                        i
                      </button>
                      <div className="chart-help-tooltip pointer-events-none absolute top-7 z-20 hidden w-80 rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg group-hover:block">
                        <p className="font-semibold text-zinc-900">선진국 달러 지수</p>
                        <p className="mt-1">FRED DTWEXAFEGS 공식 시리즈를 사용합니다. 주요 선진국 통화 대비 달러 강도를 보는 무역가중 지표입니다.</p>
                        <p className="mt-1">공식 ICE DXY와는 다른 지표이며, 값이 오르면 선진국 통화 대비 달러 강세로 해석합니다.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex h-8 flex-col justify-start gap-1">
                    <p className="text-xs text-zinc-500">{getRangeLabel(dxyRange)}</p>
                    <p className="text-xs text-transparent">상태 영역</p>
                  </div>
                </div>
                <div className="grid h-9 shrink-0 grid-cols-3 rounded-md border border-zinc-200 bg-zinc-100 p-1">
                  {longRangeOptions.map((option) => (
                    <button
                      className={`h-7 min-w-14 px-3 text-xs font-semibold ${
                        dxyRange === option.key ? 'rounded bg-white text-teal-700 shadow-sm' : 'text-zinc-500'
                      }`}
                      key={option.key}
                      onClick={() => setDxyRange(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-grid-surface relative h-80 overflow-hidden rounded-md">
              <div
                className="chart-plot-grid"
                style={{
                  bottom: chartBottomMarginPx + dailyXAxisHeightPx,
                  left: 18,
                  right: 66,
                  top: chartTopMarginPx
                }}
              />
              {visibleDxyIndexSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  표시할 선진국 달러 지수 데이터가 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={visibleDxyIndexSeries}
                    margin={{ top: 8, right: 8, bottom: 18, left: 18 }}
                    onMouseLeave={() => setActiveAdvancedDollarHover(null)}
                    onMouseMove={(state) => setActiveAdvancedDollarHover(getActiveChartHover(state, visibleDxyIndexSeries))}
                  >
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={dxyIndexXDomain}
                      height={dailyXAxisHeightPx}
                      padding={{ left: 16, right: 16 }}
                      ticks={dxyIndexXTicks}
                      tickFormatter={(value) => formatDailyXTick(value, dxyRange)}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      orientation="right"
                      domain={dxyIndexDomain}
                      tickFormatter={(value) => formatValue(Number(value))}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      tickCount={8}
                      width={58}
                    />
                    <Tooltip
                      animationDuration={120}
                      content={<DollarIndexTooltip title="선진국 달러" />}
                      cursor={false}
                      wrapperStyle={{ outline: 'none', transition: 'opacity 120ms ease-out' }}
                    />
                    {latestDxyIndexPoint ? (
                      <ReferenceLine
                        y={latestDxyIndexPoint.value}
                        stroke="#0f766e"
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="latestValue"
                      stroke="transparent"
                      dot={<LatestValueDot />}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {latestDxyIndexPoint && latestDxyIndexLabelTop !== null ? (
                <div className="latest-value-floating-label" style={{ top: `${latestDxyIndexLabelTop}%` }}>
                  <span>{formatValue(latestDxyIndexPoint.value)}</span>
                </div>
              ) : null}
              {activeAdvancedDollarHover ? (
                <div
                  className="chart-crosshair-x"
                  style={{
                    bottom: chartBottomMarginPx + dailyXAxisHeightPx,
                    left: activeAdvancedDollarHover.x,
                    top: chartTopMarginPx
                  }}
                />
              ) : null}
              {activeAdvancedDollarHover ? (
                <div
                  className="chart-crosshair-y"
                  style={{
                    left: 18,
                    right: 66,
                    top: activeAdvancedDollarHover.y
                  }}
                />
              ) : null}
              {activeAdvancedDollarHover ? (
                <div className="chart-axis-value-label" style={{ top: getAxisValueLabelTop(activeAdvancedDollarHover.y) }}>
                  <span>{formatValue(activeAdvancedDollarHover.point.value)}</span>
                </div>
              ) : null}
              {activeAdvancedDollarHover ? (
                <div className="chart-axis-time-label" style={{ left: getAxisTimeLabelLeft(activeAdvancedDollarHover.x) }}>
                  {formatCrosshairDate(activeAdvancedDollarHover.point.dateValue, dxyRange)}
                </div>
              ) : null}
            </div>
              </article>
              <MetricSidePanelView
                details={dxyPanelDetails}
                footerText={`최신 계산 ${latestDxyIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
                metric={dxyMetric}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">광의 달러 지수</h2>
                    <div className="group relative">
                      <button
                        aria-label="광의 달러 지수 안내"
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-teal-600 hover:text-teal-700"
                        type="button"
                      >
                        i
                      </button>
                      <div className="chart-help-tooltip pointer-events-none absolute top-7 z-20 hidden w-72 rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg group-hover:block">
                        <p className="font-semibold text-zinc-900">광의 달러 지수</p>
                        <p className="mt-1">여러 교역 상대 통화 대비 달러의 전반적 강도를 보여줍니다. 값이 오르면 글로벌 달러 강세로 해석합니다.</p>
                        <p className="mt-1">USD/KRW가 오를 때 이 지수도 오르면 달러 전체 강세 영향, 지수가 약한데 USD/KRW만 오르면 원화 고유 약세 가능성을 봅니다.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex h-8 flex-col justify-start gap-1">
                    <p className="text-xs text-zinc-500">{getRangeLabel(dollarIndexRange)}</p>
                    <p className="text-xs text-transparent">상태 영역</p>
                  </div>
                </div>
                <div className="grid h-9 shrink-0 grid-cols-3 rounded-md border border-zinc-200 bg-zinc-100 p-1">
                  {longRangeOptions.map((option) => (
                    <button
                      className={`h-7 min-w-14 px-3 text-xs font-semibold ${
                        dollarIndexRange === option.key ? 'rounded bg-white text-teal-700 shadow-sm' : 'text-zinc-500'
                      }`}
                      key={option.key}
                      onClick={() => setDollarIndexRange(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="chart-grid-surface relative h-80 overflow-hidden rounded-md">
              <div
                className="chart-plot-grid"
                style={{
                  bottom: chartBottomMarginPx + dailyXAxisHeightPx,
                  left: 18,
                  right: 66,
                  top: chartTopMarginPx
                }}
              />
              {visibleDollarIndexSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  표시할 달러 지수 데이터가 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={visibleDollarIndexSeries}
                    margin={{ top: 8, right: 8, bottom: 18, left: 18 }}
                    onMouseLeave={() => setActiveBroadDollarHover(null)}
                    onMouseMove={(state) => setActiveBroadDollarHover(getActiveChartHover(state, visibleDollarIndexSeries))}
                  >
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={dollarIndexXDomain}
                      height={dailyXAxisHeightPx}
                      padding={{ left: 16, right: 16 }}
                      ticks={dollarIndexXTicks}
                      tickFormatter={(value) => formatDailyXTick(value, dollarIndexRange)}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      orientation="right"
                      domain={dollarIndexDomain}
                      tickFormatter={(value) => formatValue(Number(value))}
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      tickCount={8}
                      width={58}
                    />
                    <Tooltip
                      animationDuration={120}
                      content={<DollarIndexTooltip title="광의 달러" />}
                      cursor={false}
                      wrapperStyle={{ outline: 'none', transition: 'opacity 120ms ease-out' }}
                    />
                    {latestDollarIndexPoint ? (
                      <ReferenceLine
                        y={latestDollarIndexPoint.value}
                        stroke="#52525b"
                        strokeDasharray="4 4"
                        strokeOpacity={0.45}
                      />
                    ) : null}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#52525b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="latestValue"
                      stroke="transparent"
                      dot={<LatestValueDot />}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {latestDollarIndexPoint && latestDollarIndexLabelTop !== null ? (
                <div className="latest-value-floating-label" style={{ top: `${latestDollarIndexLabelTop}%` }}>
                  <span>{formatValue(latestDollarIndexPoint.value)}</span>
                </div>
              ) : null}
              {activeBroadDollarHover ? (
                <div
                  className="chart-crosshair-x"
                  style={{
                    bottom: chartBottomMarginPx + dailyXAxisHeightPx,
                    left: activeBroadDollarHover.x,
                    top: chartTopMarginPx
                  }}
                />
              ) : null}
              {activeBroadDollarHover ? (
                <div
                  className="chart-crosshair-y"
                  style={{
                    left: 18,
                    right: 66,
                    top: activeBroadDollarHover.y
                  }}
                />
              ) : null}
              {activeBroadDollarHover ? (
                <div className="chart-axis-value-label" style={{ top: getAxisValueLabelTop(activeBroadDollarHover.y) }}>
                  <span>{formatValue(activeBroadDollarHover.point.value)}</span>
                </div>
              ) : null}
              {activeBroadDollarHover ? (
                <div className="chart-axis-time-label" style={{ left: getAxisTimeLabelLeft(activeBroadDollarHover.x) }}>
                  {formatCrosshairDate(activeBroadDollarHover.point.dateValue, dollarIndexRange)}
                </div>
              ) : null}
            </div>
              </article>
              <MetricSidePanelView
                details={dollarIndexPanelDetails}
                footerText={`최신 발표 ${latestDollarIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
                metric={dollarIndexMetric}
              />
            </section>
            <DataSourceGuideView dataSources={dataSources} />
          </section>
        ) : null}

        {activePage === 'koreaStatus' ? (
          <KoreaStatusPageView
            dataSources={dataSources}
            indicators={domesticIndicators}
            isLoading={isLoading}
            latestSyncLabel={latestSyncLabel}
          />
        ) : null}

        {activePage === 'ranking' ? <CurrencyStrengthPageView ranks={currencyStrengthRanks} /> : null}

        {activePage === 'newsroom' ? (
          <NewsroomPageView
            articles={newsArticles}
            categories={newsCategories}
            configured={isNewsConfigured}
            isLoading={isNewsLoading}
            onCategoryChange={changeNewsCategory}
            selectedCategory={selectedNewsCategory}
            syncMessage={newsSyncMessage}
          />
        ) : null}

        {activePage === 'serviceGuide' ? <ServiceGuidePageView /> : null}

        {activePage === 'developerInfo' ? <DeveloperInfoPageView /> : null}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
