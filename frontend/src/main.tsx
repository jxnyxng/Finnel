import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './styles.css';
import {
  dailyXAxisHeightPx,
  intradayXAxisHeightPx,
  longRangeOptions,
  mainTabs,
  rangeOptions,
} from './constants';
import {
  DollarIndexTooltip,
  UsdKrwTooltip
} from './components/ChartElements';
import { AppFooter } from './components/AppFooter';
import { DataSourceGuide as DataSourceGuideView } from './components/DataSourceGuide';
import { MarketChartSection } from './components/MarketChartSection';
import { MetricSidePanel as MetricSidePanelView } from './components/MetricSidePanel';
import { CurrencyStrengthPage as CurrencyStrengthPageView } from './pages/CurrencyStrengthPage';
import { KoreaStatusPage as KoreaStatusPageView } from './pages/KoreaStatusPage';
import { NewsroomPage as NewsroomPageView } from './pages/NewsroomPage';
import { ServiceGuidePage as ServiceGuidePageView } from './pages/ServiceGuidePage';
import {
  buildVisibleDailySeries,
  buildVisibleUsdKrwSeries,
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
  getServiceUpdateInterval,
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
  NewsFilters,
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
  const [newsFilters, setNewsFilters] = React.useState<NewsFilters>({ fromDate: '', toDate: '', keyword: '' });
  const [newsPage, setNewsPage] = React.useState(1);
  const [newsTotalCount, setNewsTotalCount] = React.useState(0);
  const [newsTotalPages, setNewsTotalPages] = React.useState(0);
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

  const loadNews = React.useCallback(async (
    category = selectedNewsCategory,
    page = newsPage,
    showLoading = false,
    filters = newsFilters
  ) => {
    if (showLoading) {
      setIsNewsLoading(true);
    }

    try {
      const response = await axios.get<NewsResponse>('/api/v1/news', {
        params: {
          category,
          from: filters.fromDate || undefined,
          keyword: filters.keyword || undefined,
          page,
          pageSize: 10,
          to: filters.toDate || undefined
        }
      });
      setNewsArticles(response.data.articles);
      setNewsCategories(response.data.categories);
      setIsNewsConfigured(response.data.configured);
      setNewsPage(response.data.page);
      setNewsTotalCount(response.data.totalCount);
      setNewsTotalPages(response.data.totalPages);
    } catch {
      setNewsArticles([]);
    } finally {
      if (showLoading) {
        setIsNewsLoading(false);
      }
    }
  }, [newsFilters, newsPage, selectedNewsCategory]);

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

    loadNews(selectedNewsCategory, newsPage, true);
    const newsTimer = window.setInterval(() => loadNews(selectedNewsCategory, newsPage), 60_000);
    return () => window.clearInterval(newsTimer);
  }, [activePage, loadNews, newsPage, selectedNewsCategory]);

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
  const activeServiceUpdateInterval = getServiceUpdateInterval(activeTab);
  const activePageTitle = getMainPageTitle(activeTab);
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
    setNewsPage(1);
    loadNews(category, 1, true, newsFilters);
  }, [loadNews, newsFilters]);

  const changeNewsPage = React.useCallback((page: number) => {
    setNewsPage(page);
    loadNews(selectedNewsCategory, page, true, newsFilters);
  }, [loadNews, newsFilters, selectedNewsCategory]);

  const applyNewsFilters = React.useCallback((filters: NewsFilters) => {
    setNewsFilters(filters);
    setNewsPage(1);
    loadNews(selectedNewsCategory, 1, true, filters);
  }, [loadNews, selectedNewsCategory]);

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
            <span className="truncate text-sm font-semibold tracking-normal">코리아원 · 환율 모니터링 서비스</span>
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
          </div>
        </div>
      </div>
      {isMainAppPage ? (
        <div className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-5 py-2" aria-label="주요 화면">
            {mainTabs.map((tab) => (
              <button
                className={`h-7 shrink-0 rounded px-3 text-xs font-semibold ${
                  activePage === tab.key ? 'bg-teal-700 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
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
        </div>
      ) : null}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4">
        {isMainAppPage ? (
          <header className="flex flex-col gap-2 border-b border-zinc-200 pb-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">{activePageTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 md:justify-end">
              <span className="font-medium">오늘 {todayLabel}</span>
              <span className="hidden text-zinc-300 md:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-2 font-medium md:justify-end">
                <span className={`service-status-dot service-status-dot-${activeServiceStatus.tone}`} aria-hidden="true" />
                {activeServiceStatus.label}
                <span className="text-zinc-300" aria-hidden="true">·</span>
                <span className="font-normal">{activeServiceUpdateInterval}</span>
              </div>
            </div>
          </header>
        ) : null}

        {activePage === 'dashboard' ? (
          <section className="grid gap-4">
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <MarketChartSection
                emptyText={usdKrwRange === '1D'
                  ? '09:00~다음날 02:00 세션 환율 데이터를 확인 중입니다.'
                  : '표시할 환율 데이터가 없습니다.'}
                helpAriaLabel="USD/KRW 그래프 안내"
                helpContent={(
                  <>
                    <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                    <p className="mt-1">1일은 5분 단위 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                  </>
                )}
                helpTitle="USD/KRW 그래프"
                hover={activeUsdKrwHover}
                latestLabelTop={latestUsdKrwLabelTop}
                latestValue={latestUsdKrwPoint?.value ?? null}
                lineStroke="#0f766e"
                onHoverChange={setActiveUsdKrwHover}
                onRangeChange={setUsdKrwRange}
                plotLeft={28}
                plotRight={66}
                range={usdKrwRange}
                rangeColumns={4}
                rangeOptions={rangeOptions}
                referenceStroke="#0f766e"
                series={visibleUsdKrwSeries}
                statusClassName={usdKrwRange === '1D' ? 'text-teal-700' : 'text-transparent'}
                statusText={usdKrwRange === '1D' ? intradayStatusLabel : '상태 영역'}
                subtitle={usdKrwRange === '1D' ? '09:00~익일 02:00' : getRangeLabel(usdKrwRange)}
                title="USD/KRW 추이"
                tooltipContent={<UsdKrwTooltip range={usdKrwRange} />}
                xAxisHeight={usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx}
                xAxisPadding={{ left: 0, right: 0 }}
                xDomain={usdKrwXDomain}
                xTickFormatter={(value) => usdKrwRange === '1D' ? formatUsdKrwXTick(value) : formatDailyXTick(value, usdKrwRange)}
                xTicks={usdKrwXTicks}
                yDomain={usdKrwDomain}
              />
              <MetricSidePanelView
                details={usdKrwPanelDetails}
                footerText={`기준 ${dashboard?.baseDate ?? '-'}`}
                metric={usdKrwMetric}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <MarketChartSection
                emptyText="표시할 선진국 달러 지수 데이터가 없습니다."
                helpAriaLabel="선진국 달러 지수 안내"
                helpContent={(
                  <>
                    <p className="mt-1">FRED DTWEXAFEGS 공식 시리즈를 사용합니다. 주요 선진국 통화 대비 달러 강도를 보는 무역가중 지표입니다.</p>
                    <p className="mt-1">공식 ICE DXY와는 다른 지표이며, 값이 오르면 선진국 통화 대비 달러 강세로 해석합니다.</p>
                  </>
                )}
                helpTitle="선진국 달러 지수"
                helpWidthClassName="w-80"
                hover={activeAdvancedDollarHover}
                latestLabelTop={latestDxyIndexLabelTop}
                latestValue={latestDxyIndexPoint?.value ?? null}
                lineStroke="#0f766e"
                onHoverChange={setActiveAdvancedDollarHover}
                onRangeChange={setDxyRange}
                plotLeft={18}
                plotRight={66}
                range={dxyRange}
                rangeColumns={3}
                rangeOptions={longRangeOptions}
                referenceStroke="#0f766e"
                series={visibleDxyIndexSeries}
                statusClassName="text-transparent"
                statusText="상태 영역"
                subtitle={getRangeLabel(dxyRange)}
                title="선진국 달러 지수"
                tooltipContent={<DollarIndexTooltip title="선진국 달러" />}
                xAxisHeight={dailyXAxisHeightPx}
                xAxisPadding={{ left: 16, right: 16 }}
                xDomain={dxyIndexXDomain}
                xTickFormatter={(value) => formatDailyXTick(value, dxyRange)}
                xTicks={dxyIndexXTicks}
                yDomain={dxyIndexDomain}
              />
              <MetricSidePanelView
                details={dxyPanelDetails}
                footerText={`최신 계산 ${latestDxyIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
                metric={dxyMetric}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <MarketChartSection
                emptyText="표시할 달러 지수 데이터가 없습니다."
                helpAriaLabel="광의 달러 지수 안내"
                helpContent={(
                  <>
                    <p className="mt-1">여러 교역 상대 통화 대비 달러의 전반적 강도를 보여줍니다. 값이 오르면 글로벌 달러 강세로 해석합니다.</p>
                    <p className="mt-1">USD/KRW가 오를 때 이 지수도 오르면 달러 전체 강세 영향, 지수가 약한데 USD/KRW만 오르면 원화 고유 약세 가능성을 봅니다.</p>
                  </>
                )}
                helpTitle="광의 달러 지수"
                hover={activeBroadDollarHover}
                latestLabelTop={latestDollarIndexLabelTop}
                latestValue={latestDollarIndexPoint?.value ?? null}
                lineStroke="#52525b"
                onHoverChange={setActiveBroadDollarHover}
                onRangeChange={setDollarIndexRange}
                plotLeft={18}
                plotRight={66}
                range={dollarIndexRange}
                rangeColumns={3}
                rangeOptions={longRangeOptions}
                referenceStroke="#52525b"
                series={visibleDollarIndexSeries}
                statusClassName="text-transparent"
                statusText="상태 영역"
                subtitle={getRangeLabel(dollarIndexRange)}
                title="광의 달러 지수"
                tooltipContent={<DollarIndexTooltip title="광의 달러" />}
                xAxisHeight={dailyXAxisHeightPx}
                xAxisPadding={{ left: 16, right: 16 }}
                xDomain={dollarIndexXDomain}
                xTickFormatter={(value) => formatDailyXTick(value, dollarIndexRange)}
                xTicks={dollarIndexXTicks}
                yDomain={dollarIndexDomain}
              />
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
            filters={newsFilters}
            isLoading={isNewsLoading}
            onFiltersApply={applyNewsFilters}
            onCategoryChange={changeNewsCategory}
            onPageChange={changeNewsPage}
            page={newsPage}
            selectedCategory={selectedNewsCategory}
            totalCount={newsTotalCount}
            totalPages={newsTotalPages}
          />
        ) : null}

        {activePage === 'serviceGuide' ? <ServiceGuidePageView /> : null}

      </section>
      <AppFooter />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function getMainPageTitle(activeTab: MainTabKey) {
  switch (activeTab) {
    case 'dashboard':
      return '환율 흐름';
    case 'koreaStatus':
      return '국내 지표';
    case 'ranking':
      return '통화 순위';
    case 'newsroom':
      return '시장 뉴스';
    default:
      return '환율 흐름';
  }
}
