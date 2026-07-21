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
import { RelatedNewsBanner, prefetchRelatedNews } from './components/RelatedNewsBanner';
import { CurrencyStrengthPage as CurrencyStrengthPageView } from './pages/CurrencyStrengthPage';
import { ExchangeRateGuidePage as ExchangeRateGuidePageView } from './pages/ExchangeRateGuidePage';
import { GovernmentBriefingsPage as GovernmentBriefingsPageView } from './pages/GovernmentBriefingsPage';
import { HomePage as HomePageView } from './pages/HomePage';
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
  getPanelPeriodLabel,
  getRangeLabel,
  getUsdKrwPanelReferenceLabel,
  getUsdKrwReferenceLabel,
  getUsdKrwXTicks,
  getValueDomain,
  getXDomain,
  isCurrentIntradaySession
} from './utils/chart';
import { formatValue } from './utils/format';
import { findMetric, sortMetrics } from './utils/metrics';
import {
  getIntradayStatusLabel,
  getLatestSyncLabel,
  getMarketDailyStatus,
  getServiceStatus,
  getServiceUpdateInterval
} from './utils/sync';
import {
  getRemainingCooldownSeconds,
  getSeoulDateString,
  getSeoulTimeString
} from './utils/time';
import type {
  ChartHoverState,
  DailyDashboardResponse,
  ForeignExchangeRate,
  GovernmentBriefingArticle,
  GovernmentBriefingCategory,
  GovernmentBriefingFilters,
  GovernmentBriefingResponse,
  MainTabKey,
  NewsArticle,
  NewsCategory,
  NewsFilters,
  NewsResponse,
  PageKey,
  RangeKey,
  SyncStatus
} from './types';

type DashboardLoadState = 'idle' | 'loading' | 'ready' | 'error';

function App() {
  const [dashboard, setDashboard] = React.useState<DailyDashboardResponse | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [intradayStatus, setIntradayStatus] = React.useState<SyncStatus | null>(null);
  const [dashboardLoadState, setDashboardLoadState] = React.useState<DashboardLoadState>('idle');
  const [dashboardErrorMessage, setDashboardErrorMessage] = React.useState<string | null>(null);
  const [usdKrwRange, setUsdKrwRange] = React.useState<RangeKey>('1D');
  const [dxyRange, setDxyRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [dollarIndexRange, setDollarIndexRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [showBroadDollarIndex, setShowBroadDollarIndex] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<MainTabKey>('dashboard');
  const [activePage, setActivePage] = React.useState<PageKey>('home');
  const [activeUsdKrwHover, setActiveUsdKrwHover] = React.useState<ChartHoverState | null>(null);
  const [activeAdvancedDollarHover, setActiveAdvancedDollarHover] = React.useState<ChartHoverState | null>(null);
  const [activeBroadDollarHover, setActiveBroadDollarHover] = React.useState<ChartHoverState | null>(null);
  const [newsArticles, setNewsArticles] = React.useState<NewsArticle[]>([]);
  const [newsCategories, setNewsCategories] = React.useState<NewsCategory[]>([]);
  const [isNewsConfigured, setIsNewsConfigured] = React.useState(false);
  const [isNewsLoading, setIsNewsLoading] = React.useState(false);
  const delayedNewsLoading = useDelayedFlag(isNewsLoading, 240);
  const [hasNewsLoaded, setHasNewsLoaded] = React.useState(false);
  const [selectedNewsCategory, setSelectedNewsCategory] = React.useState('all');
  const [newsFilters, setNewsFilters] = React.useState<NewsFilters>({ fromDate: '', toDate: '', keyword: '' });
  const [newsPage, setNewsPage] = React.useState(1);
  const [newsTotalCount, setNewsTotalCount] = React.useState(0);
  const [newsTotalPages, setNewsTotalPages] = React.useState(0);
  const [latestNewsFetchedAt, setLatestNewsFetchedAt] = React.useState<string | null>(null);
  const [governmentBriefings, setGovernmentBriefings] = React.useState<GovernmentBriefingArticle[]>([]);
  const [governmentBriefingCategories, setGovernmentBriefingCategories] = React.useState<GovernmentBriefingCategory[]>([]);
  const [isGovernmentBriefingsConfigured, setIsGovernmentBriefingsConfigured] = React.useState(false);
  const [isGovernmentBriefingsLoading, setIsGovernmentBriefingsLoading] = React.useState(false);
  const delayedGovernmentBriefingsLoading = useDelayedFlag(isGovernmentBriefingsLoading, 240);
  const [hasGovernmentBriefingsLoaded, setHasGovernmentBriefingsLoaded] = React.useState(false);
  const [selectedGovernmentBriefingCategory, setSelectedGovernmentBriefingCategory] = React.useState('all');
  const [governmentBriefingFilters, setGovernmentBriefingFilters] = React.useState<GovernmentBriefingFilters>({ fromDate: '', toDate: '', keyword: '' });
  const [governmentBriefingsPage, setGovernmentBriefingsPage] = React.useState(1);
  const [governmentBriefingsTotalCount, setGovernmentBriefingsTotalCount] = React.useState(0);
  const [governmentBriefingsTotalPages, setGovernmentBriefingsTotalPages] = React.useState(0);
  const [latestGovernmentBriefingFetchedAt, setLatestGovernmentBriefingFetchedAt] = React.useState<string | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const isMainAppPage = activePage === 'home' || activePage === 'dashboard' || activePage === 'exchangeGuide' || activePage === 'koreaStatus' || activePage === 'ranking' || activePage === 'newsroom' || activePage === 'governmentBriefings';
  const mainTabNavRef = React.useRef<HTMLElement | null>(null);
  const mainTabButtonRefs = React.useRef<Partial<Record<MainTabKey, HTMLButtonElement | null>>>({});
  const [mainTabIndicator, setMainTabIndicator] = React.useState({ height: 0, left: 0, top: 0, width: 0 });
  const [mainTabButtonWidth, setMainTabButtonWidth] = React.useState(0);
  const mainTabHighlightTimeoutRef = React.useRef<number | null>(null);
  const [isMainTabHighlightActive, setIsMainTabHighlightActive] = React.useState(false);
  const [mainTabHighlightKey, setMainTabHighlightKey] = React.useState(0);
  const goDashboard = React.useCallback(() => {
    setActiveTab('dashboard');
    setActivePage('dashboard');
  }, []);
  const highlightMainTabs = React.useCallback(() => {
    if (mainTabHighlightTimeoutRef.current !== null) {
      window.clearTimeout(mainTabHighlightTimeoutRef.current);
    }
    setIsMainTabHighlightActive(true);
    setMainTabHighlightKey((current) => current + 1);
    mainTabHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsMainTabHighlightActive(false);
      mainTabHighlightTimeoutRef.current = null;
    }, 1300);
  }, []);

  React.useEffect(() => () => {
    if (mainTabHighlightTimeoutRef.current !== null) {
      window.clearTimeout(mainTabHighlightTimeoutRef.current);
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!isMainAppPage) {
      return;
    }

    const activeKey = activePage as MainTabKey;
    const updateIndicator = () => {
      const nav = mainTabNavRef.current;
      const button = mainTabButtonRefs.current[activeKey];
      const maxButtonWidth = Math.ceil(Math.max(
        0,
        ...mainTabs.map((tab) => mainTabButtonRefs.current[tab.key]?.scrollWidth ?? 0)
      ));
      setMainTabButtonWidth((current) => current === maxButtonWidth ? current : maxButtonWidth);

      if (!nav || !button) {
        setMainTabIndicator({ height: 0, left: 0, top: 0, width: 0 });
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const nextIndicator = {
        height: buttonRect.height,
        left: buttonRect.left - navRect.left,
        top: buttonRect.top - navRect.top,
        width: buttonRect.width
      };
      setMainTabIndicator((current) => {
        if (
          current.height === nextIndicator.height &&
          current.left === nextIndicator.left &&
          current.top === nextIndicator.top &&
          current.width === nextIndicator.width
        ) {
          return current;
        }
        return nextIndicator;
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activePage, isMainAppPage, mainTabButtonWidth]);

  const loadDashboard = React.useCallback(async (showLoading = false) => {
    if (showLoading) {
      setDashboardLoadState('loading');
    }

    try {
      const response = await axios.get<DailyDashboardResponse>('/api/v1/dashboard/daily');
      setDashboard(response.data);
      setDashboardLoadState('ready');
      setDashboardErrorMessage(null);
    } catch (error) {
      setDashboardLoadState('error');
      setDashboardErrorMessage(getDashboardErrorMessage(error));
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
      setLatestNewsFetchedAt(response.data.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.data.articles));
    } catch {
      setNewsArticles([]);
      setLatestNewsFetchedAt(null);
    } finally {
      setHasNewsLoaded(true);
      if (showLoading) {
        setIsNewsLoading(false);
      }
    }
  }, [newsFilters, newsPage, selectedNewsCategory]);

  const loadGovernmentBriefings = React.useCallback(async (
    category = selectedGovernmentBriefingCategory,
    page = governmentBriefingsPage,
    showLoading = false,
    filters = governmentBriefingFilters
  ) => {
    if (showLoading) {
      setIsGovernmentBriefingsLoading(true);
    }

    try {
      const response = await axios.get<GovernmentBriefingResponse>('/api/v1/government-briefings', {
        params: {
          category,
          from: filters.fromDate || undefined,
          keyword: filters.keyword || undefined,
          page,
          pageSize: 12,
          to: filters.toDate || undefined
        }
      });
      setGovernmentBriefings(response.data.articles);
      setGovernmentBriefingCategories(response.data.categories);
      setIsGovernmentBriefingsConfigured(response.data.configured);
      setGovernmentBriefingsPage(response.data.page);
      setGovernmentBriefingsTotalCount(response.data.totalCount);
      setGovernmentBriefingsTotalPages(response.data.totalPages);
      setLatestGovernmentBriefingFetchedAt(response.data.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.data.articles));
    } catch {
      setGovernmentBriefings([]);
      setLatestGovernmentBriefingFetchedAt(null);
    } finally {
      setHasGovernmentBriefingsLoaded(true);
      if (showLoading) {
        setIsGovernmentBriefingsLoading(false);
      }
    }
  }, [governmentBriefingFilters, governmentBriefingsPage, selectedGovernmentBriefingCategory]);

  React.useEffect(() => {
    loadDashboard(true);
    loadSyncStatus();
    loadIntradayStatus();

    const dashboardTimer = window.setInterval(loadDashboard, 15_000);
    const statusTimer = window.setInterval(loadSyncStatus, 15_000);
    const intradayStatusTimer = window.setInterval(loadIntradayStatus, 15_000);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1_000);

    return () => {
      window.clearInterval(dashboardTimer);
      window.clearInterval(statusTimer);
      window.clearInterval(intradayStatusTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadDashboard, loadSyncStatus, loadIntradayStatus]);

  React.useEffect(() => {
    loadNews('all', 1, false);
    loadGovernmentBriefings('all', 1, false);
    prefetchRelatedNews('exchange').catch(() => undefined);
    prefetchRelatedNews('indicators').catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (activePage !== 'newsroom') {
      return undefined;
    }

    loadNews(selectedNewsCategory, newsPage, newsArticles.length === 0);
    const newsTimer = window.setInterval(() => loadNews(selectedNewsCategory, newsPage), 60_000);
    return () => window.clearInterval(newsTimer);
  }, [activePage, loadNews, newsPage, selectedNewsCategory]);

  React.useEffect(() => {
    if (activePage !== 'governmentBriefings') {
      return undefined;
    }

    loadGovernmentBriefings(selectedGovernmentBriefingCategory, governmentBriefingsPage, governmentBriefings.length === 0);
    const briefingTimer = window.setInterval(() => loadGovernmentBriefings(selectedGovernmentBriefingCategory, governmentBriefingsPage), 60_000);
    return () => window.clearInterval(briefingTimer);
  }, [activePage, governmentBriefingsPage, loadGovernmentBriefings, selectedGovernmentBriefingCategory]);

  const metrics = sortMetrics(dashboard?.metrics ?? []);
  const usdKrwMetric = findMetric(metrics, 'USD/KRW');
  const dxyMetric = findMetric(metrics, 'ADVANCED_DOLLAR_INDEX');
  const dollarIndexMetric = findMetric(metrics, 'BROAD_DOLLAR_INDEX');
  const usdKrwSeries = dashboard?.usdKrwSeries ?? [];
  const usdKrwIntradaySeries = dashboard?.usdKrwIntradaySeries ?? [];
  const dxyIndexSeries = dashboard?.dxyIndexSeries ?? [];
  const dollarIndexSeries = dashboard?.dollarIndexSeries ?? [];
  const currencyStrengthRanks = dashboard?.currencyStrengthRanks ?? [];
  const foreignExchangeRates = dashboard?.foreignExchangeRates ?? [];
  const domesticIndicators = dashboard?.domesticIndicators ?? [];
  const dataSources = dashboard?.dataSources ?? [];
  const isInitialDashboardLoading = dashboardLoadState === 'loading' && dashboard === null;
  const hasDashboardError = dashboardLoadState === 'error';
  const dashboardEmptyText = isInitialDashboardLoading
    ? '저장된 대시보드 데이터를 불러오는 중입니다.'
    : hasDashboardError
      ? (dashboardErrorMessage ?? '대시보드 API를 불러오지 못했습니다.')
      : '표시할 데이터가 없습니다.';
  const seoulToday = getSeoulDateString(new Date(nowMs));
  const seoulTime = getSeoulTimeString(new Date(nowMs));
  const latestIntradayDate = getLatestIntradayDate(usdKrwIntradaySeries);
  const isUsdKrwIntradayActive = isCurrentIntradaySession(usdKrwIntradaySeries, seoulToday, seoulTime);
  const visibleUsdKrwSeries = buildVisibleUsdKrwSeries(usdKrwSeries, usdKrwIntradaySeries, usdKrwRange);
  const latestUsdKrwPoint = visibleUsdKrwSeries[visibleUsdKrwSeries.length - 1] ?? null;
  const usdKrwDomain = getValueDomain(visibleUsdKrwSeries, 5);
  const usdKrwXDomain = getXDomain(visibleUsdKrwSeries, usdKrwRange);
  const usdKrwXTicks = usdKrwRange === '1D' ? getUsdKrwXTicks(usdKrwRange, visibleUsdKrwSeries) : getDailyXTicks(visibleUsdKrwSeries);
  const visibleDxyIndexSeries = buildVisibleDailySeries(dxyIndexSeries, dxyRange);
  const latestDxyIndexPoint = visibleDxyIndexSeries[visibleDxyIndexSeries.length - 1] ?? null;
  const dxyIndexDomain = getValueDomain(visibleDxyIndexSeries, 1);
  const dxyIndexXDomain = getXDomain(visibleDxyIndexSeries, dxyRange);
  const dxyIndexXTicks = getDailyXTicks(visibleDxyIndexSeries);
  const visibleDollarIndexSeries = buildVisibleDailySeries(dollarIndexSeries, dollarIndexRange);
  const latestDollarIndexPoint = visibleDollarIndexSeries[visibleDollarIndexSeries.length - 1] ?? null;
  const dollarIndexDomain = getValueDomain(visibleDollarIndexSeries, 1);
  const dollarIndexXDomain = getXDomain(visibleDollarIndexSeries, dollarIndexRange);
  const dollarIndexXTicks = getDailyXTicks(visibleDollarIndexSeries);
  const dollarIndexReferenceLabel = getDailyReferenceLabel(visibleDollarIndexSeries);
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date());
  const usdKrwReferenceLabel = getUsdKrwReferenceLabel(usdKrwRange, visibleUsdKrwSeries, dashboard?.baseDate);
  const remainingCooldownSeconds = getRemainingCooldownSeconds(syncStatus, nowMs);
  const remainingIntradayCooldownSeconds = getRemainingCooldownSeconds(intradayStatus, nowMs);
  const latestSyncLabel = getLatestSyncLabel(syncStatus, remainingCooldownSeconds);
  const activeServiceStatus = getServiceStatus({
    activeTab,
    dashboard,
    dashboardLoadState,
    domesticIndicators,
    isGovernmentBriefingsConfigured,
    intradayStatus,
    latestGovernmentBriefingFetchedAt,
    isNewsConfigured,
    latestNewsFetchedAt,
    latestIntradayDate,
    ranks: currencyStrengthRanks,
    seoulDate: seoulToday,
    seoulTime,
    syncStatus
  });
  const activeServiceUpdateInterval = getServiceUpdateInterval(activeTab);
  const marketDailyStatus = getMarketDailyStatus(dashboard, syncStatus);
  const showUsdKrwLatestValueDot = usdKrwRange === '1D' && activeServiceStatus.tone !== 'idle' && isUsdKrwIntradayActive;
  const usdKrwStatusNode = (
    <UpdateStatusBox
      interval={usdKrwRange === '1D' ? '환율 1분봉 · 5분마다 확인' : '기준 환율 일별 · 09:10/15:10'}
      statusLabel={usdKrwRange === '1D' ? activeServiceStatus.label : marketDailyStatus.label}
      todayLabel={todayLabel}
      tone={usdKrwRange === '1D' ? activeServiceStatus.tone : marketDailyStatus.tone}
    />
  );
  const showPageStatus = activePage !== 'exchangeGuide' && activePage !== 'serviceGuide' && activePage !== 'dataSources';
  const activeStatusNode = showPageStatus ? (
    <UpdateStatusBox
      interval={activeServiceUpdateInterval}
      statusLabel={activeServiceStatus.label}
      todayLabel={todayLabel}
      tone={activeServiceStatus.tone}
    />
  ) : null;
  const intradayStatusLabel = getIntradayStatusLabel(
    false,
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
    { label: '출처', value: usdKrwRange === '1D' ? 'Twelve Data 1분봉' : 'Koreaexim/FRED 일별' }
  ];
  const dollarIndexPanelDetails = [
    { label: '범위', value: getRangeLabel(dollarIndexRange) },
    { label: '기간', value: getPanelPeriodLabel(visibleDollarIndexSeries) },
    { label: '관측값', value: `${visibleDollarIndexSeries.length}개` },
    { label: '구성', value: '26개 교역 상대' },
    { label: '의미', value: '넓은 교역 상대 기준 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXBGS' }
  ];
  const dxyPanelDetails = [
    { label: '범위', value: getRangeLabel(dxyRange) },
    { label: '기간', value: getPanelPeriodLabel(visibleDxyIndexSeries) },
    { label: '관측값', value: `${visibleDxyIndexSeries.length}개` },
    { label: '구성', value: '유로지역·캐나다·일본·영국·스위스·호주·스웨덴' },
    { label: '의미', value: '주요 7개 통화권 대비 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXAFEGS' }
  ];

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

  const changeGovernmentBriefingsPage = React.useCallback((page: number) => {
    setGovernmentBriefingsPage(page);
    loadGovernmentBriefings(selectedGovernmentBriefingCategory, page, true, governmentBriefingFilters);
  }, [governmentBriefingFilters, loadGovernmentBriefings, selectedGovernmentBriefingCategory]);

  const changeGovernmentBriefingCategory = React.useCallback((category: string) => {
    setSelectedGovernmentBriefingCategory(category);
    setGovernmentBriefingsPage(1);
    loadGovernmentBriefings(category, 1, true, governmentBriefingFilters);
  }, [governmentBriefingFilters, loadGovernmentBriefings]);

  const applyGovernmentBriefingFilters = React.useCallback((filters: GovernmentBriefingFilters) => {
    setGovernmentBriefingFilters(filters);
    setGovernmentBriefingsPage(1);
    loadGovernmentBriefings(selectedGovernmentBriefingCategory, 1, true, filters);
  }, [loadGovernmentBriefings, selectedGovernmentBriefingCategory]);

  return (
    <main className="app-shell min-h-screen bg-transparent text-zinc-950">
      <header className="py-3 sm:pb-0 sm:pt-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-3 sm:min-h-[58px] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:pr-5">
          <button
            className="flex min-w-0 items-center justify-center gap-3 text-white sm:justify-start sm:py-1"
            onClick={() => {
              setActivePage('home');
            }}
            type="button"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-xl font-black text-white shadow-lg shadow-teal-950/25">₩</span>
            <span className="truncate text-lg font-extrabold tracking-normal drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">코리아원</span>
          </button>
          {isMainAppPage ? (
            <nav
              className={`scrollbar-none relative mx-auto flex w-fit max-w-full flex-nowrap justify-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/10 p-1 shadow-lg shadow-zinc-950/20 backdrop-blur-md sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible ${
                activePage === 'home' && isMainTabHighlightActive && mainTabHighlightKey > 0
                  ? mainTabHighlightKey % 2 === 0 ? 'main-tab-color-pulse-even' : 'main-tab-color-pulse-odd'
                  : ''
              }`}
              aria-label="주요 화면"
              ref={mainTabNavRef}
            >
              {mainTabIndicator.width > 0 ? (
                <span
                  className="moving-tab-indicator pointer-events-none absolute left-0 top-0 rounded-full bg-teal-600 transition-[transform,width,height] duration-200 ease-out"
                  style={{
                    height: mainTabIndicator.height,
                    transform: `translate(${mainTabIndicator.left + 1}px, ${mainTabIndicator.top - 1}px)`,
                    width: Math.max(0, mainTabIndicator.width - 2)
                  }}
                />
              ) : null}
              {mainTabs.map((tab) => (
                <button
                  className={`relative z-10 inline-flex h-10 shrink-0 items-center justify-center rounded-full px-4 text-center text-xs font-semibold leading-none transition-colors duration-150 ${
                    activePage === tab.key ? 'text-white' : 'text-white/70 hover:text-white'
                  }`}
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActivePage(tab.key);
                  }}
                  ref={(node) => {
                    mainTabButtonRefs.current[tab.key] = node;
                  }}
                  style={mainTabButtonWidth > 0 ? { width: mainTabButtonWidth } : undefined}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
        {activePage === 'home' ? (
          <HomePageView
            calculatorMeta={dashboard?.exchangeRateCalculator ?? null}
            rates={foreignExchangeRates}
            onGoDashboard={goDashboard}
            onReachLastSection={highlightMainTabs}
          />
        ) : null}

        {activePage === 'dashboard' ? (
          <RelatedNewsBanner
            actionSlot={(
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-zinc-950/35 px-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md hover:bg-white/15"
                  onClick={() => {
                    setActiveTab('exchangeGuide');
                    setActivePage('exchangeGuide');
                  }}
                  type="button"
                >
                  <span aria-hidden="true">❓</span>
                  <span>환율이 무엇인가요?</span>
                  <span aria-hidden="true">&gt;</span>
                </button>
                <button
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-zinc-950/35 px-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-md hover:bg-white/15"
                  onClick={() => {
                    setActivePage('dataSources');
                  }}
                  type="button"
                >
                  <span aria-hidden="true">📚</span>
                  <span>데이터 출처</span>
                  <span aria-hidden="true">&gt;</span>
                </button>
              </div>
            )}
            topic="exchange"
          />
        ) : null}
        {activePage === 'koreaStatus' ? <RelatedNewsBanner topic="indicators" /> : null}

        {activePage === 'dashboard' ? (
          <section className="page-content-enter grid gap-4">
            <MarketChartSection
              emptyText={dashboardEmptyText}
              helpAriaLabel="USD/KRW 그래프 안내"
              helpContent={(
                <>
                  <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                  <p className="mt-1">1일은 1분 단위 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                </>
              )}
              helpTitle="USD/KRW 그래프"
              hover={activeUsdKrwHover}
              lineStroke="#5eead4"
              metric={usdKrwMetric}
              onHoverChange={setActiveUsdKrwHover}
              onRangeChange={setUsdKrwRange}
              panelDetails={usdKrwPanelDetails}
              panelFooterText={`기준 ${dashboard?.baseDate ?? '-'}`}
              plotLeft={28}
              plotRight={66}
              range={usdKrwRange}
              rangeColumns={4}
              rangeOptions={rangeOptions}
              referenceStroke="#5eead4"
              series={visibleUsdKrwSeries}
              showLatestValueDot={showUsdKrwLatestValueDot}
              statusClassName="text-teal-100"
              statusNode={usdKrwStatusNode}
              statusText={usdKrwRange === '1D' ? intradayStatusLabel : null}
              subtitle={usdKrwRange === '1D' ? '주중 24시간 실시간 수집 환율' : `${getRangeLabel(usdKrwRange)} 일별 기준 환율`}
              title="실시간 원달러 환율"
              tooltipContent={<UsdKrwTooltip range={usdKrwRange} />}
              xAxisHeight={usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx}
              xAxisPadding={{ left: 0, right: 0 }}
              xDomain={usdKrwXDomain}
              xTickFormatter={(value) => usdKrwRange === '1D' ? formatUsdKrwXTick(value) : formatDailyXTick(value, usdKrwRange)}
              xTicks={usdKrwXTicks}
              yDomain={usdKrwDomain}
            />
            <ForeignExchangeSummary emptyMessage={dashboardEmptyText} rates={foreignExchangeRates} />

              <MarketChartSection
                emptyText={dashboardEmptyText}
                headerAction={(
                  <button
                    className="inline-flex h-7 items-center rounded border border-white/15 bg-white/10 px-2.5 text-[11px] font-semibold text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() => setShowBroadDollarIndex((value) => !value)}
                    type="button"
                  >
                    {showBroadDollarIndex ? '26개 지수 접기' : '26개 지수 보기'}
                  </button>
                )}
                helpAriaLabel="달러인덱스 안내"
                helpContent={(
                  <>
                    <p className="mt-1">FRED DTWEXAFEGS 공식 시리즈를 사용합니다. 유로지역, 캐나다, 일본, 영국, 스위스, 호주, 스웨덴 통화권 대비 달러 강도를 보는 무역가중 지표입니다.</p>
                    <p className="mt-1">흔히 말하는 ICE DXY 6개 바스켓과는 다르며, 값이 오르면 주요 통화권 대비 달러 강세로 해석합니다.</p>
                  </>
                )}
                helpTitle="달러인덱스"
                helpWidthClassName="w-80"
                hover={activeAdvancedDollarHover}
                lineStroke="#cbd5e1"
                metric={dxyMetric}
                onHoverChange={setActiveAdvancedDollarHover}
                onRangeChange={setDxyRange}
                panelDetails={dxyPanelDetails}
                panelFooterText={`최신 계산 ${latestDxyIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
                plotLeft={18}
                plotRight={66}
                range={dxyRange}
                rangeColumns={3}
                rangeOptions={longRangeOptions}
                referenceStroke="#cbd5e1"
                series={visibleDxyIndexSeries}
                showLatestValueDot={false}
                statusClassName="text-transparent"
                statusText={null}
                subtitle={`${getRangeLabel(dxyRange)} · 주요 7개 통화권`}
                title="달러인덱스"
                tooltipContent={<DollarIndexTooltip title="주요 7개 통화권 달러" />}
                xAxisHeight={dailyXAxisHeightPx}
                xAxisPadding={{ left: 0, right: 0 }}
                xDomain={dxyIndexXDomain}
                xTickFormatter={(value) => formatDailyXTick(value, dxyRange)}
                xTicks={dxyIndexXTicks}
                yDomain={dxyIndexDomain}
              />

              {showBroadDollarIndex ? <MarketChartSection
                emptyText={dashboardEmptyText}
                helpAriaLabel="26개 교역 상대 달러인덱스 안내"
                helpContent={(
                  <>
                    <p className="mt-1">FRED DTWEXBGS 공식 시리즈를 사용합니다. 한국, 중국, 멕시코, 캐나다, 유로지역 등 26개 교역 상대 통화 대비 달러 강도를 보는 무역가중 지표입니다.</p>
                    <p className="mt-1">USD/KRW가 오를 때 이 지수도 오르면 달러 전체 강세 영향, 지수가 약한데 USD/KRW만 오르면 원화 고유 약세 가능성을 봅니다.</p>
                  </>
                )}
                helpTitle="26개 교역 상대 달러인덱스"
                hover={activeBroadDollarHover}
                lineStroke="#cbd5e1"
                metric={dollarIndexMetric}
                onHoverChange={setActiveBroadDollarHover}
                onRangeChange={setDollarIndexRange}
                panelDetails={dollarIndexPanelDetails}
                panelFooterText={`최신 발표 ${latestDollarIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
                plotLeft={18}
                plotRight={66}
                range={dollarIndexRange}
                rangeColumns={3}
                rangeOptions={longRangeOptions}
                referenceStroke="#cbd5e1"
                series={visibleDollarIndexSeries}
                showLatestValueDot={false}
                statusClassName="text-transparent"
                statusText={null}
                subtitle={`${getRangeLabel(dollarIndexRange)} · 26개 교역 상대`}
                title="달러인덱스"
                tooltipContent={<DollarIndexTooltip title="26개 교역 상대 달러" />}
                xAxisHeight={dailyXAxisHeightPx}
                xAxisPadding={{ left: 0, right: 0 }}
                xDomain={dollarIndexXDomain}
                xTickFormatter={(value) => formatDailyXTick(value, dollarIndexRange)}
                xTicks={dollarIndexXTicks}
                yDomain={dollarIndexDomain}
              /> : null}
          </section>
        ) : null}

        {activePage === 'exchangeGuide' ? (
          <div className="page-content-enter grid gap-3">
            <button
              className="inline-flex w-fit items-center gap-1 rounded-full border border-white/15 bg-zinc-950/35 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md hover:bg-white/15"
              onClick={() => {
                setActiveTab('dashboard');
                setActivePage('dashboard');
              }}
              type="button"
            >
              <span aria-hidden="true">&lt;</span>
              <span>환율 현황으로 돌아가기</span>
            </button>
            <ExchangeRateGuidePageView />
          </div>
        ) : null}

        {activePage === 'koreaStatus' ? (
          <div className="page-content-enter">
            <KoreaStatusPageView
              indicators={domesticIndicators}
              errorMessage={hasDashboardError && domesticIndicators.length === 0 ? dashboardErrorMessage : null}
              isLoading={isInitialDashboardLoading}
              latestSyncLabel={latestSyncLabel}
              statusNode={activeStatusNode}
            />
          </div>
        ) : null}

        {activePage === 'ranking' ? (
          <div className="page-content-enter">
            <CurrencyStrengthPageView
              emptyMessage={dashboardEmptyText}
              isLoading={isInitialDashboardLoading}
              ranks={currencyStrengthRanks}
              statusNode={activeStatusNode}
            />
          </div>
        ) : null}

        {activePage === 'newsroom' ? (
          <div className="page-content-enter">
            <NewsroomPageView
              articles={newsArticles}
              categories={newsCategories}
              configured={!hasNewsLoaded || isNewsConfigured}
              filters={newsFilters}
              isLoading={delayedNewsLoading}
              isPendingInitialLoad={isNewsLoading && !delayedNewsLoading && newsArticles.length === 0}
              onFiltersApply={applyNewsFilters}
              onCategoryChange={changeNewsCategory}
              onPageChange={changeNewsPage}
              page={newsPage}
              selectedCategory={selectedNewsCategory}
              statusNode={activeStatusNode}
              totalCount={newsTotalCount}
              totalPages={newsTotalPages}
            />
          </div>
        ) : null}

        {activePage === 'governmentBriefings' ? (
          <div className="page-content-enter">
            <GovernmentBriefingsPageView
              articles={governmentBriefings}
              categories={governmentBriefingCategories}
              configured={!hasGovernmentBriefingsLoaded || isGovernmentBriefingsConfigured}
              filters={governmentBriefingFilters}
              isLoading={delayedGovernmentBriefingsLoading}
              isPendingInitialLoad={isGovernmentBriefingsLoading && !delayedGovernmentBriefingsLoading && governmentBriefings.length === 0}
              onCategoryChange={changeGovernmentBriefingCategory}
              onFiltersApply={applyGovernmentBriefingFilters}
              onPageChange={changeGovernmentBriefingsPage}
              page={governmentBriefingsPage}
              selectedCategory={selectedGovernmentBriefingCategory}
              statusNode={activeStatusNode}
              totalCount={governmentBriefingsTotalCount}
              totalPages={governmentBriefingsTotalPages}
            />
          </div>
        ) : null}

        {activePage === 'serviceGuide' ? <div className="page-content-enter"><ServiceGuidePageView /></div> : null}

        {activePage === 'dataSources' ? (
          <div className="page-content-enter grid gap-3">
            <button
              className="inline-flex w-fit items-center gap-1 rounded-full border border-white/15 bg-zinc-950/35 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md hover:bg-white/15"
              onClick={() => {
                setActiveTab('dashboard');
                setActivePage('dashboard');
              }}
              type="button"
            >
              <span aria-hidden="true">&lt;</span>
              <span>환율 현황으로 돌아가기</span>
            </button>
            <DataSourceGuideView dataSources={dataSources} />
          </div>
        ) : null}

      </section>
      {activePage !== 'home' ? <ExchangeRateCalculator rates={foreignExchangeRates} /> : null}
      {activePage !== 'home' && activePage !== 'serviceGuide' && activePage !== 'dataSources' ? <AppFooter /> : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function useDelayedFlag(value: boolean, delayMs: number) {
  const [delayedValue, setDelayedValue] = React.useState(false);

  React.useEffect(() => {
    if (!value) {
      setDelayedValue(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setDelayedValue(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return delayedValue;
}

function getDashboardErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status
      ? `대시보드 API 호출 실패 HTTP ${status}: 저장된 DB 데이터를 다시 확인하세요.`
      : `대시보드 API 호출 실패: ${error.message}`;
  }

  return '대시보드 API 호출 실패: 백엔드 상태를 확인하세요.';
}

function UpdateStatusBox({
  interval,
  statusLabel,
  todayLabel,
  tone
}: {
  interval: string;
  statusLabel: string;
  todayLabel: string;
  tone: string;
}) {
  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] font-medium text-white/60">
      <span className="inline-flex max-w-full min-w-0 items-center">
        <span className="truncate">{interval}</span>
      </span>
      <span className="inline-flex max-w-full min-w-0 items-center">
        <span className="truncate">오늘 {todayLabel}</span>
      </span>
      <span className="inline-flex max-w-full min-w-0 items-center gap-1">
        <span className={`service-status-dot service-status-dot-${tone} shrink-0`} aria-hidden="true" />
        <span className="truncate">{statusLabel}</span>
      </span>
    </div>
  );
}

function ForeignExchangeSummary({ emptyMessage, rates }: { emptyMessage: string; rates: ForeignExchangeRate[] }) {
  if (rates.length === 0) {
    return (
      <section className="glass-card rounded-2xl px-4 py-3 text-sm text-white/50 shadow-sm">
        {emptyMessage}
      </section>
    );
  }

  const latestFetchedAt = rates
    .map((rate) => new Date(rate.fetchedAt).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0] ?? null;

  return (
    <section className="glass-card min-w-0 overflow-hidden rounded-2xl shadow-sm">
      <div className="flex min-w-0 flex-col gap-1 border-b border-white/10 px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">주요 통화 환율</h2>
          <p className="mt-0.5 text-[11px] text-white/60">실시간 스트리밍이 아닌 최근 수집값입니다. 주요 통화는 약 1시간 주기로 갱신됩니다.</p>
        </div>
        <p className="text-[11px] font-medium text-white/60">
          최근 업데이트 {latestFetchedAt === null ? '-' : formatForeignExchangeUpdatedAt(new Date(latestFetchedAt))}
        </p>
      </div>
      <div className="grid min-w-0 gap-2 p-2.5 sm:p-3 md:grid-cols-2 md:gap-y-2 md:[&>article:nth-child(even)]:border-l md:[&>article:nth-child(even)]:border-white/10">
        {rates.map((rate) => (
          <article className="glass-subcard grid min-w-0 grid-cols-[40px_minmax(0,1fr)_minmax(82px,auto)] items-center gap-2 rounded-2xl px-2.5 py-2.5 sm:grid-cols-[48px_minmax(0,1fr)_minmax(104px,auto)] sm:gap-3 sm:px-3" key={rate.currencyCode}>
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-xl leading-none sm:h-12 sm:w-12 sm:rounded-2xl sm:text-2xl" aria-hidden="true">
              {getCurrencyFlag(rate.displayCode)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{getCurrencyShortLabel(rate.displayCode)}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-white/60">{getCurrencyDetailText(rate)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-teal-100 sm:text-base">{formatValue(rate.dealBasRate, 2)}원</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExchangeRateCalculator({ rates }: { rates: ForeignExchangeRate[] }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedCode, setSelectedCode] = React.useState('');
  const [foreignInput, setForeignInput] = React.useState('100');
  const [krwInput, setKrwInput] = React.useState('');
  const [lastEdited, setLastEdited] = React.useState<'foreign' | 'krw'>('foreign');
  const [isHoverExpansionPaused, setIsHoverExpansionPaused] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [isOpening, setIsOpening] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);
  const openTimerRef = React.useRef<number | null>(null);
  const availableRates = React.useMemo(
    () => [...rates].sort((a, b) => a.displayCode.localeCompare(b.displayCode)),
    [rates]
  );

  React.useEffect(() => {
    if (availableRates.length === 0) {
      setSelectedCode('');
      return;
    }

    if (!availableRates.some((rate) => rate.currencyCode === selectedCode)) {
      setSelectedCode(availableRates.find((rate) => rate.displayCode === 'USD')?.currencyCode ?? availableRates[0].currencyCode);
    }
  }, [availableRates, selectedCode]);

  const selectedRate = availableRates.find((rate) => rate.currencyCode === selectedCode) ?? availableRates[0] ?? null;

  React.useEffect(() => {
    if (!selectedRate) {
      setKrwInput('');
      return;
    }

    if (lastEdited === 'foreign') {
      setKrwInput(formatCalculatorNumber(calculateKrwAmount(foreignInput, selectedRate), 0));
      return;
    }

    setForeignInput(formatCalculatorNumber(calculateForeignAmount(krwInput, selectedRate), 2));
  }, [foreignInput, krwInput, lastEdited, selectedRate]);

  const handleForeignInputChange = (value: string) => {
    const sanitizedValue = sanitizeNumericInput(value);
    setLastEdited('foreign');
    setForeignInput(sanitizedValue);
    setKrwInput(formatCalculatorNumber(calculateKrwAmount(sanitizedValue, selectedRate), 0));
  };

  const handleKrwInputChange = (value: string) => {
    const sanitizedValue = sanitizeNumericInput(value);
    setLastEdited('krw');
    setKrwInput(sanitizedValue);
    setForeignInput(formatCalculatorNumber(calculateForeignAmount(sanitizedValue, selectedRate), 2));
  };

  const handleCurrencyChange = (value: string) => {
    const nextRate = availableRates.find((rate) => rate.currencyCode === value) ?? null;
    setSelectedCode(value);

    if (lastEdited === 'foreign') {
      setKrwInput(formatCalculatorNumber(calculateKrwAmount(foreignInput, nextRate), 0));
      return;
    }

    setForeignInput(formatCalculatorNumber(calculateForeignAmount(krwInput, nextRate), 2));
  };

  const openCalculator = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    setIsClosing(false);
    setIsOpening(true);
    setIsOpen(true);

    openTimerRef.current = window.setTimeout(() => {
      setIsOpening(false);
      openTimerRef.current = null;
    }, 220);
  };

  const closeCalculator = () => {
    setIsHoverExpansionPaused(true);
    setIsOpening(false);
    setIsClosing(true);
    setIsOpen(false);

    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      setIsHoverExpansionPaused(false);
      closeTimerRef.current = null;
    }, 420);
  };

  React.useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
    }
  }, []);

  const containerClassName = getCalculatorContainerClassName(isOpen, isClosing, isHoverExpansionPaused);
  const shouldShowPanel = isOpen || isClosing;
  const containerHeight = isOpen ? 306 : 56;

  return (
    <div className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-1.5rem)] justify-end sm:bottom-4 sm:right-4 sm:max-w-[calc(100vw-2rem)]">
      <div
        className={containerClassName}
        style={{ height: `${containerHeight}px` }}
        onMouseLeave={() => {
          if (!isClosing) {
            setIsHoverExpansionPaused(false);
          }
        }}
      >
      {isClosing ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <CalculatorIcon className="h-7 w-7 text-white" />
        </div>
      ) : null}
      {shouldShowPanel ? (
        <section
          aria-label="환율 계산기"
          className={`transition-opacity duration-200 ease-out ${isClosing || isOpening ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">환율 계산기</h2>
              <p className="mt-1 text-[11px] leading-4 text-white/55">수수료와 은행별 스프레드는 제외한 기준 환율 계산입니다.</p>
            </div>
            <button
              aria-label="환율 계산기 닫기"
              className="grid h-7 w-7 shrink-0 place-items-center rounded border border-white/15 bg-white/10 text-sm font-semibold text-white/60 hover:bg-white/15 hover:text-white"
              onClick={closeCalculator}
              type="button"
            >
              ×
            </button>
          </div>

          {selectedRate ? (
            <div className="grid gap-3 px-4 py-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-white/55">통화</span>
                <select
                  className="glass-field h-9 w-full rounded-md px-3 text-sm font-semibold outline-none"
                  onChange={(event) => handleCurrencyChange(event.target.value)}
                  value={selectedRate.currencyCode}
                >
                  {availableRates.map((rate) => (
                    <option key={rate.currencyCode} value={rate.currencyCode}>
                      {getCurrencyShortLabel(rate.displayCode)} ({rate.displayCode})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                    <span className="text-sm leading-none" aria-hidden="true">{getCurrencyFlag(selectedRate.displayCode)}</span>
                    {selectedRate.displayCode}
                  </span>
                  <input
                    className="glass-field h-10 min-w-0 rounded-md px-3 text-right text-sm font-semibold outline-none"
                    inputMode="decimal"
                    onChange={(event) => handleForeignInputChange(event.target.value)}
                    placeholder="0"
                    value={foreignInput}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                    <span className="text-sm leading-none" aria-hidden="true">🇰🇷</span>
                    KRW
                  </span>
                  <input
                    className="glass-field h-10 min-w-0 rounded-md px-3 text-right text-sm font-semibold outline-none"
                    inputMode="decimal"
                    onChange={(event) => handleKrwInputChange(event.target.value)}
                    placeholder="0"
                    value={krwInput}
                  />
                </label>
              </div>

              <div className="rounded border border-white/10 bg-white/8 px-3 py-2 text-[11px] leading-5 text-white/55">
                <p className="font-medium text-white/75">
                  1 {selectedRate.displayCode} = {formatValue(selectedRate.dealBasRate / selectedRate.unitSize, 2)}원
                </p>
                <p>기준 시각 {formatForeignExchangeUpdatedAt(new Date(selectedRate.fetchedAt))}</p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-white/45">제공 중인 주요 통화 환율을 확인 중입니다.</div>
          )}
        </section>
      ) : (
        <button
          aria-label="환율 계산기 열기"
          aria-pressed={isOpen}
          className="flex h-14 w-full cursor-pointer items-center gap-2.5 bg-white/10 px-[13px] text-left text-teal-100 transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal-200/40"
          onClick={openCalculator}
          type="button"
        >
          <CalculatorIcon className="h-7 w-7 shrink-0 text-white" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-[max-width,opacity] duration-300 ease-out group-hover:max-w-24 group-hover:opacity-100">
            환율계산기
          </span>
        </button>
      )}
      </div>
    </div>
  );
}

function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="18" rx="2.5" width="14" x="5" y="3" />
      <path d="M8 7h8" />
      <path d="M8 11h1" />
      <path d="M12 11h1" />
      <path d="M16 11h.01" />
      <path d="M8 15h1" />
      <path d="M12 15h1" />
      <path d="M16 15h.01" />
      <path d="M8 19h1" />
      <path d="M12 19h4" />
    </svg>
  );
}

function getCalculatorContainerClassName(isOpen: boolean, isClosing: boolean, isHoverExpansionPaused: boolean) {
  const baseClassName = 'glass-modal relative overflow-hidden border-2 border-teal-300/40 shadow-lg transition-[width,height,border-radius,box-shadow] ease-out';

  if (isOpen) {
    return `${baseClassName} duration-[600ms] w-[min(22rem,calc(100vw-2rem))] rounded-md shadow-xl`;
  }

  if (isClosing) {
    return `${baseClassName} duration-[420ms] w-14 rounded-[28px]`;
  }

  return `${baseClassName} group duration-500 w-14 rounded-[28px] ${
    isHoverExpansionPaused ? '' : 'hover:w-40 hover:rounded-[18px] hover:shadow-xl'
  }`;
}

function getCurrencyFlag(code: string) {
  const flags: Record<string, string> = {
    AUD: '🇦🇺',
    CAD: '🇨🇦',
    CHF: '🇨🇭',
    CNY: '🇨🇳',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    HKD: '🇭🇰',
    JPY: '🇯🇵',
    SGD: '🇸🇬',
    USD: '🇺🇸'
  };

  return flags[code] ?? '🏳️';
}

function getCurrencyShortLabel(code: string) {
  const labels: Record<string, string> = {
    AUD: '호주 달러',
    CAD: '캐나다 달러',
    CHF: '스위스 프랑',
    CNY: '위안화',
    EUR: '유로',
    GBP: '파운드',
    HKD: '홍콩 달러',
    JPY: '엔화',
    SGD: '싱가포르 달러',
    USD: '미국 달러'
  };

  return labels[code] ?? code;
}

function getCurrencyDetailText(rate: ForeignExchangeRate) {
  return `${rate.displayCode} · ${formatForeignExchangeUpdatedAt(new Date(rate.fetchedAt))} 업데이트`;
}

function getLatestFetchedAt(items: Array<NewsArticle | GovernmentBriefingArticle>) {
  const latestMs = items
    .map((item) => new Date(item.fetchedAt).getTime())
    .filter(Number.isFinite)
    .reduce<number | null>((latest, fetchedAt) => latest === null ? fetchedAt : Math.max(latest, fetchedAt), null);

  return latestMs === null ? null : new Date(latestMs).toISOString();
}

function formatForeignExchangeUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date);
}

function calculateKrwAmount(value: string, rate: ForeignExchangeRate | null) {
  const numericValue = parseCalculatorNumber(value);
  if (numericValue === null || !rate || rate.unitSize === 0) {
    return null;
  }

  return (numericValue * rate.dealBasRate) / rate.unitSize;
}

function calculateForeignAmount(value: string, rate: ForeignExchangeRate | null) {
  const numericValue = parseCalculatorNumber(value);
  if (numericValue === null || !rate || rate.dealBasRate === 0) {
    return null;
  }

  return (numericValue * rate.unitSize) / rate.dealBasRate;
}

function parseCalculatorNumber(value: string) {
  if (value.trim() === '' || value === '.') {
    return null;
  }

  const numericValue = Number(value.replace(/,/g, ''));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function sanitizeNumericInput(value: string) {
  const normalizedValue = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [integerPart, ...decimalParts] = normalizedValue.split('.');
  return decimalParts.length === 0 ? integerPart : `${integerPart}.${decimalParts.join('')}`;
}

function formatCalculatorNumber(value: number | null, fractionDigits: number) {
  if (value === null) {
    return '';
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: fractionDigits
  }).format(value);
}
