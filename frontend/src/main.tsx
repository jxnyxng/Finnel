import React from 'react';
import { flushSync } from 'react-dom';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './styles.css';
import {
  dailyXAxisHeightPx,
  intradayXAxisHeightPx,
  longRangeOptions,
  mainTabs,
  pageRoutes,
  rangeOptions,
} from './constants';
import {
  DollarIndexTooltip,
  RangeSelector,
  UsdKrwCandlestickTooltip,
  UsdKrwTooltip
} from './components/ChartElements';
import { GoogleAdSlot } from './components/AdSlot';
import { AppFooter } from './components/AppFooter';
import { DataSourceGuide as DataSourceGuideView } from './components/DataSourceGuide';
import { MarketChartSection } from './components/MarketChartSection';
import { RelatedNewsBanner, prefetchRelatedNews } from './components/RelatedNewsBanner';
import { CurrencyStrengthPage as CurrencyStrengthPageView } from './pages/CurrencyStrengthPage';
import { ExchangeRateGuidePage as ExchangeRateGuidePageView } from './pages/ExchangeRateGuidePage';
import { GovernmentBriefingsPage as GovernmentBriefingsPageView } from './pages/GovernmentBriefingsPage';
import { ExchangeProfitCalculator, HomePage as HomePageView } from './pages/HomePage';
import { KoreaStatusPage as KoreaStatusPageView } from './pages/KoreaStatusPage';
import { NewsroomPage as NewsroomPageView } from './pages/NewsroomPage';
import { ServiceGuidePage as ServiceGuidePageView } from './pages/ServiceGuidePage';
import { TodayFlowPage as TodayFlowPageView } from './pages/TodayFlowPage';
import {
  buildVisibleDailySeries,
  buildVisibleUsdKrwCandles,
  buildVisibleUsdKrwSeries,
  formatDailyXTick,
  formatUsdKrwXTick,
  getCandlestickValueDomain,
  getDailyXTicks,
  getLatestIntradayDate,
  getPanelPeriodLabel,
  getRangeLabel,
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
  ContentSyncStatus,
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
  ServiceStatusTone,
  SyncStatus
} from './types';

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

type DashboardLoadState = 'idle' | 'loading' | 'ready' | 'error';
type UsdKrwChartDisplayMode = 'line' | 'candlestick';
const pageRouteEntries = Object.entries(pageRoutes) as Array<[PageKey, string]>;
const mainTabKeys = new Set<MainTabKey>(mainTabs.map((tab) => tab.key));
const chartAdSlots = {
  dollarIndexDesktop: import.meta.env.VITE_ADSENSE_SLOT_DOLLAR_INDEX_DESKTOP,
  dollarIndexMobile: import.meta.env.VITE_ADSENSE_SLOT_DOLLAR_INDEX_MOBILE,
  usdKrwDesktop: import.meta.env.VITE_ADSENSE_SLOT_USD_KRW_DESKTOP,
  usdKrwMobile: import.meta.env.VITE_ADSENSE_SLOT_USD_KRW_MOBILE
} satisfies Record<string, string | undefined>;
const tabAdSlots = {
  calculator: import.meta.env.VITE_ADSENSE_SLOT_TAB_CALCULATOR,
  dashboard: import.meta.env.VITE_ADSENSE_SLOT_TAB_DASHBOARD,
  dataSources: import.meta.env.VITE_ADSENSE_SLOT_TAB_DATA_SOURCES,
  exchangeGuide: import.meta.env.VITE_ADSENSE_SLOT_TAB_EXCHANGE_GUIDE,
  governmentBriefings: import.meta.env.VITE_ADSENSE_SLOT_TAB_POLICY_BRIEFINGS,
  koreaStatus: import.meta.env.VITE_ADSENSE_SLOT_TAB_KOREA_STATUS,
  newsroom: import.meta.env.VITE_ADSENSE_SLOT_TAB_NEWSROOM,
  ranking: import.meta.env.VITE_ADSENSE_SLOT_TAB_RANKING,
  todayFlow: import.meta.env.VITE_ADSENSE_SLOT_TAB_TODAY_FLOW
} satisfies Record<MainTabKey, string | undefined>;
const dollarIndexTabs = [
  { key: 'advanced', label: '7개국' },
  { key: 'broad', label: '26개국' }
] as const;
type DollarIndexTabKey = (typeof dollarIndexTabs)[number]['key'];

function getPageFromPath(pathname: string): PageKey {
  const normalizedPath = normalizePath(pathname);
  return pageRouteEntries.find(([, route]) => route === normalizedPath)?.[0] ?? 'home';
}

function normalizePath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '');
  return normalizedPath === '' ? '/' : normalizedPath;
}

function getMainTabKey(page: PageKey): MainTabKey | null {
  return mainTabKeys.has(page as MainTabKey) ? page as MainTabKey : null;
}

function App() {
  const [dashboard, setDashboard] = React.useState<DailyDashboardResponse | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [intradayStatus, setIntradayStatus] = React.useState<SyncStatus | null>(null);
  const [dashboardLoadState, setDashboardLoadState] = React.useState<DashboardLoadState>('idle');
  const dashboardLoadStateRef = React.useRef<DashboardLoadState>('idle');
  const [dashboardErrorMessage, setDashboardErrorMessage] = React.useState<string | null>(null);
  const [usdKrwRange, setUsdKrwRange] = React.useState<RangeKey>('1D');
  const [usdKrwChartDisplayMode, setUsdKrwChartDisplayMode] = React.useState<UsdKrwChartDisplayMode>('line');
  const [dxyRange, setDxyRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [dollarIndexRange, setDollarIndexRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [showBroadDollarIndex, setShowBroadDollarIndex] = React.useState(false);
  const initialPage = getPageFromPath(window.location.pathname);
  const initialMainTabKey = getMainTabKey(initialPage);
  const [activeTab, setActiveTab] = React.useState<MainTabKey>(initialMainTabKey ?? 'dashboard');
  const [activeMainTabKey, setActiveMainTabKey] = React.useState<MainTabKey | null>(initialMainTabKey);
  const [activePage, setActivePage] = React.useState<PageKey>(initialPage);
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
  const [newsSyncStatus, setNewsSyncStatus] = React.useState<ContentSyncStatus | null>(null);
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
  const [governmentBriefingsSyncStatus, setGovernmentBriefingsSyncStatus] = React.useState<ContentSyncStatus | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const isMainAppPage = activePage === 'home' || mainTabs.some((tab) => tab.key === activePage);
  const mainTabNavRef = React.useRef<HTMLElement | null>(null);
  const mainTabButtonRefs = React.useRef<Partial<Record<MainTabKey, HTMLButtonElement | null>>>({});
  const activeDollarIndexTabKey: DollarIndexTabKey = showBroadDollarIndex ? 'broad' : 'advanced';
  const navigatePage = React.useCallback((page: PageKey, options: { replace?: boolean; scroll?: boolean } = {}) => {
    const mainTabKey = getMainTabKey(page);
    flushSync(() => {
      if (mainTabKey) {
        setActiveTab(mainTabKey);
      }
      setActiveMainTabKey(mainTabKey);
    });
    React.startTransition(() => {
      setActivePage(page);
    });
    const nextPath = pageRoutes[page];
    if (window.location.pathname !== nextPath) {
      const historyState = { page };
      if (options.replace) {
        window.history.replaceState(historyState, '', nextPath);
      } else {
        window.history.pushState(historyState, '', nextPath);
      }
    }
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);
  const goDashboard = React.useCallback(() => navigatePage('dashboard'), [navigatePage]);
  const navigateMainTab = React.useCallback((tabKey: MainTabKey) => navigatePage(tabKey), [navigatePage]);
  React.useEffect(() => {
    window.history.replaceState({ page: activePage }, '', pageRoutes[activePage]);

    const handlePopState = () => {
      navigatePage(getPageFromPath(window.location.pathname), { replace: true, scroll: false });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  React.useEffect(() => {
    if (mainTabs.some((tab) => tab.key === activePage)) {
      setActiveMainTabKey(activePage as MainTabKey);
      return;
    }
    setActiveMainTabKey(null);
  }, [activePage]);
  React.useEffect(() => {
    if (!isMainAppPage) {
      return;
    }

    const activeKey = activePage as MainTabKey;
    const nav = mainTabNavRef.current;
    const button = mainTabButtonRefs.current[activeKey];
    if (!nav || !button || nav.scrollWidth <= nav.clientWidth) {
      return;
    }

    const nextScrollLeft = button.offsetLeft - ((nav.clientWidth - button.offsetWidth) / 2);
    nav.scrollTo({
      behavior: 'smooth',
      left: Math.max(0, nextScrollLeft)
    });
  }, [activePage, isMainAppPage]);

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
    filters = newsFilters,
    mode: 'replace' | 'append' = 'replace'
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
      setNewsArticles((current) => {
        if (mode === 'replace') {
          return response.data.articles;
        }

        const seen = new Set(current.map((article) => `${article.categoryCode}-${article.link || article.originLink || article.title}`));
        const nextArticles = response.data.articles.filter((article) => {
          const key = `${article.categoryCode}-${article.link || article.originLink || article.title}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        return [...current, ...nextArticles];
      });
      setNewsCategories(response.data.categories);
      setIsNewsConfigured(response.data.configured);
      setNewsPage(response.data.page);
      setNewsTotalCount(response.data.totalCount);
      setNewsTotalPages(response.data.totalPages);
      setLatestNewsFetchedAt(response.data.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.data.articles));
      setNewsSyncStatus({
        freshnessStatus: response.data.freshnessStatus ?? null,
        lastSuccessfulFetchedAt: response.data.lastSuccessfulFetchedAt ?? null,
        latestSyncEndedAt: response.data.latestSyncEndedAt ?? null,
        latestSyncStartedAt: response.data.latestSyncStartedAt ?? null,
        latestSyncStatus: response.data.latestSyncStatus ?? null
      });
    } catch {
      if (mode === 'replace') {
        setNewsArticles([]);
        setLatestNewsFetchedAt(null);
        setNewsSyncStatus(null);
      }
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
    filters = governmentBriefingFilters,
    mode: 'replace' | 'append' = 'replace'
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
      setGovernmentBriefings((current) => {
        if (mode === 'replace') {
          return response.data.articles;
        }

        const seen = new Set(current.map((article) => article.originalUrl || `${article.title}-${article.publishedAt ?? ''}`));
        const nextArticles = response.data.articles.filter((article) => {
          const key = article.originalUrl || `${article.title}-${article.publishedAt ?? ''}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
        return [...current, ...nextArticles];
      });
      setGovernmentBriefingCategories(response.data.categories);
      setIsGovernmentBriefingsConfigured(response.data.configured);
      setGovernmentBriefingsPage(response.data.page);
      setGovernmentBriefingsTotalCount(response.data.totalCount);
      setGovernmentBriefingsTotalPages(response.data.totalPages);
      setLatestGovernmentBriefingFetchedAt(response.data.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.data.articles));
      setGovernmentBriefingsSyncStatus({
        freshnessStatus: response.data.freshnessStatus ?? null,
        lastSuccessfulFetchedAt: response.data.lastSuccessfulFetchedAt ?? null,
        latestSyncEndedAt: response.data.latestSyncEndedAt ?? null,
        latestSyncStartedAt: response.data.latestSyncStartedAt ?? null,
        latestSyncStatus: response.data.latestSyncStatus ?? null
      });
    } catch {
      if (mode === 'replace') {
        setGovernmentBriefings([]);
        setLatestGovernmentBriefingFetchedAt(null);
        setGovernmentBriefingsSyncStatus(null);
      }
    } finally {
      setHasGovernmentBriefingsLoaded(true);
      if (showLoading) {
        setIsGovernmentBriefingsLoading(false);
      }
    }
  }, [governmentBriefingFilters, governmentBriefingsPage, selectedGovernmentBriefingCategory]);

  React.useEffect(() => {
    dashboardLoadStateRef.current = dashboardLoadState;
  }, [dashboardLoadState]);

  React.useEffect(() => {
    loadDashboard(true);
    loadSyncStatus();
    loadIntradayStatus();

    const dashboardTimer = window.setInterval(() => {
      loadDashboard(dashboardLoadStateRef.current === 'error');
    }, 15_000);
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

    if (newsArticles.length === 0) {
      loadNews(selectedNewsCategory, 1, true, newsFilters);
    }

    return undefined;
  }, [activePage, loadNews, newsArticles.length, newsFilters, selectedNewsCategory]);

  React.useEffect(() => {
    if (activePage !== 'todayFlow') {
      return undefined;
    }

    loadDashboard(false);
    loadNews('all', 1, false, { fromDate: '', toDate: '', keyword: '' });
    loadGovernmentBriefings('all', 1, false, { fromDate: '', toDate: '', keyword: '' });

    const contentTimer = window.setInterval(() => {
      loadNews('all', 1, false, { fromDate: '', toDate: '', keyword: '' });
      loadGovernmentBriefings('all', 1, false, { fromDate: '', toDate: '', keyword: '' });
    }, 600_000);

    return () => window.clearInterval(contentTimer);
  }, [activePage, loadDashboard, loadGovernmentBriefings, loadNews]);

  React.useEffect(() => {
    if (activePage !== 'governmentBriefings') {
      return undefined;
    }

    if (governmentBriefings.length === 0) {
      loadGovernmentBriefings(selectedGovernmentBriefingCategory, 1, true, governmentBriefingFilters);
    }

    return undefined;
  }, [activePage, governmentBriefingFilters, governmentBriefings.length, loadGovernmentBriefings, selectedGovernmentBriefingCategory]);

  const metrics = sortMetrics(dashboard?.metrics ?? []);
  const usdKrwMetric = findMetric(metrics, 'USD/KRW');
  const dxyMetric = findMetric(metrics, 'ADVANCED_DOLLAR_INDEX');
  const dollarIndexMetric = findMetric(metrics, 'BROAD_DOLLAR_INDEX');
  const usdKrwSeries = dashboard?.usdKrwSeries ?? [];
  const usdKrwIntradaySeries = dashboard?.usdKrwIntradaySeries ?? [];
  const usdKrwIntradayCandles = dashboard?.usdKrwIntradayCandles ?? [];
  const latestUsdKrwIntradayPoint = usdKrwIntradaySeries[usdKrwIntradaySeries.length - 1] ?? null;
  const dxyIndexSeries = dashboard?.dxyIndexSeries ?? [];
  const dollarIndexSeries = dashboard?.dollarIndexSeries ?? [];
  const advancedDollarIndexStatus = dashboard?.advancedDollarIndexStatus ?? null;
  const dollarIndexStatus = dashboard?.dollarIndexStatus ?? null;
  const currencyStrengthRanks = dashboard?.currencyStrengthRanks ?? [];
  const foreignExchangeRates = dashboard?.foreignExchangeRates ?? [];
  const domesticIndicators = dashboard?.domesticIndicators ?? [];
  const usdKrwIndicator = domesticIndicators.find((indicator) => indicator.code === 'USD_KRW') ?? null;
  const dataSources = dashboard?.dataSources ?? [];
  const isInitialDashboardLoading = dashboardLoadState === 'loading' && dashboard === null;
  const shouldCoverDashboardCharts = dashboardLoadState === 'loading' && dashboard !== null;
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
  const visibleUsdKrwCandles = usdKrwRange === '1D' ? buildVisibleUsdKrwCandles(usdKrwIntradayCandles) : [];
  const visibleUsdKrwSeries = buildVisibleUsdKrwSeries(usdKrwSeries, usdKrwIntradaySeries, usdKrwRange, usdKrwIntradayCandles);
  const showUsdKrwCandlesticks = usdKrwRange === '1D' && usdKrwChartDisplayMode === 'candlestick' && visibleUsdKrwCandles.length > 0;
  const latestUsdKrwPoint = visibleUsdKrwSeries[visibleUsdKrwSeries.length - 1] ?? null;
  const usdKrwDomain = showUsdKrwCandlesticks ? getCandlestickValueDomain(visibleUsdKrwCandles, 5) : getValueDomain(visibleUsdKrwSeries, 5);
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
  const remainingCooldownSeconds = getRemainingCooldownSeconds(syncStatus, nowMs);
  const remainingIntradayCooldownSeconds = getRemainingCooldownSeconds(intradayStatus, nowMs);
  const latestSyncLabel = getLatestSyncLabel(syncStatus, remainingCooldownSeconds);
  const activeServiceStatus = getServiceStatus({
    activeTab,
    dashboard,
    dashboardLoadState,
    domesticIndicators,
    governmentBriefingsSyncStatus,
    isGovernmentBriefingsConfigured,
    intradayStatus,
    latestGovernmentBriefingFetchedAt,
    isNewsConfigured,
    newsSyncStatus,
    latestNewsFetchedAt,
    latestIntradayDate,
    ranks: currencyStrengthRanks,
    seoulDate: seoulToday,
    seoulTime,
    syncStatus
  });
  const selectDollarIndexTab = React.useCallback((tabKey: DollarIndexTabKey) => {
    if (tabKey === 'broad') {
      setShowBroadDollarIndex(true);
      setActiveAdvancedDollarHover(null);
    } else {
      setShowBroadDollarIndex(false);
      setActiveBroadDollarHover(null);
    }
  }, []);
  const activeServiceUpdateInterval = getServiceUpdateInterval(activeTab);
  const marketDailyStatus = getMarketDailyStatus(dashboard, syncStatus);
  const dollarIndexSourceRun = syncStatus?.sourceRuns?.find((sourceRun) => sourceRun.sourceName === 'dollarIndex') ?? null;
  const activeDollarIndexFetchedAt = showBroadDollarIndex
    ? dollarIndexStatus?.fetchedAt ?? null
    : advancedDollarIndexStatus?.fetchedAt ?? null;
  const usdKrwLatestUpdatedAt = usdKrwIndicator?.lastSuccessfulFetchedAt ?? usdKrwIndicator?.fetchedAt ?? null;
  const usdKrwIntradayLatestUpdatedAt = latestUsdKrwIntradayPoint?.observedAt ?? usdKrwLatestUpdatedAt;
  const usdKrwIntradayStatusDetails = getStatusDetails({
    attemptedAt: intradayStatus?.latestEndedAt ?? intradayStatus?.latestStartedAt ?? null,
    latestUpdatedAt: usdKrwIntradayLatestUpdatedAt,
    syncStatus: intradayStatus?.latestStatus ?? null
  });
  const usdKrwDailyStatusDetails = getStatusDetails({
    attemptedAt: syncStatus?.latestEndedAt ?? syncStatus?.latestStartedAt ?? null,
    latestUpdatedAt: usdKrwLatestUpdatedAt,
    syncStatus: syncStatus?.latestStatus ?? null
  });
  const dollarIndexStatusDetails = getStatusDetails({
    attemptedAt: dollarIndexSourceRun?.endedAt ?? dollarIndexSourceRun?.startedAt ?? syncStatus?.latestEndedAt ?? syncStatus?.latestStartedAt ?? null,
    latestUpdatedAt: activeDollarIndexFetchedAt,
    syncStatus: dollarIndexSourceRun?.status ?? syncStatus?.latestStatus ?? null
  });
  const newsStatusDetails = getStatusDetails({
    attemptedAt: newsSyncStatus?.latestSyncEndedAt ?? newsSyncStatus?.latestSyncStartedAt ?? null,
    latestUpdatedAt: latestNewsFetchedAt,
    syncStatus: newsSyncStatus?.latestSyncStatus ?? null
  });
  const governmentBriefingsStatusDetails = getStatusDetails({
    attemptedAt: governmentBriefingsSyncStatus?.latestSyncEndedAt ?? governmentBriefingsSyncStatus?.latestSyncStartedAt ?? null,
    latestUpdatedAt: latestGovernmentBriefingFetchedAt,
    syncStatus: governmentBriefingsSyncStatus?.latestSyncStatus ?? null
  });
  const activeStatusDetails = activeTab === 'newsroom'
    ? newsStatusDetails
    : activeTab === 'governmentBriefings'
      ? governmentBriefingsStatusDetails
      : getStatusDetails({
          attemptedAt: syncStatus?.latestEndedAt ?? syncStatus?.latestStartedAt ?? null,
          latestUpdatedAt: syncStatus?.latestEndedAt ?? null,
          syncStatus: syncStatus?.latestStatus ?? null
        });
  const usdKrwIntradayCardStatus = getUsdKrwIntradayCardStatus({
    dashboard,
    dashboardLoadState,
    intradayStatus,
    isCurrentSession: isUsdKrwIntradayActive,
    latestIntradayDate
  });
  const showUsdKrwLatestValueDot = usdKrwRange === '1D' && usdKrwIntradayCardStatus.tone !== 'idle' && isUsdKrwIntradayActive;
  const usdKrwStatusNode = (
    <UpdateStatusBox
      details={usdKrwRange === '1D' ? usdKrwIntradayStatusDetails : usdKrwDailyStatusDetails}
      interval={`${getRangeLabel(usdKrwRange)} 수집상태`}
      statusLabel={usdKrwRange === '1D' ? usdKrwIntradayCardStatus.label : marketDailyStatus.label}
      tone={usdKrwRange === '1D' ? usdKrwIntradayCardStatus.tone : marketDailyStatus.tone}
    />
  );
  const dollarIndexStatusNode = (
    <UpdateStatusBox
      details={dollarIndexStatusDetails}
      interval={`${getRangeLabel(showBroadDollarIndex ? dollarIndexRange : dxyRange)} 수집상태`}
      statusLabel={marketDailyStatus.label}
      tone={marketDailyStatus.tone}
    />
  );
  const showPageStatus = activePage !== 'dashboard' && activePage !== 'exchangeGuide' && activePage !== 'serviceGuide' && activePage !== 'dataSources' && activePage !== 'calculator';
  const activeStatusNode = showPageStatus ? (
    <UpdateStatusBox
      details={activeStatusDetails}
      interval={activeServiceUpdateInterval}
      statusLabel={activeServiceStatus.label}
      tone={activeServiceStatus.tone}
    />
  ) : null;
  const intradayStatusLabel = getIntradayStatusLabel(
    false,
    latestIntradayDate,
    usdKrwIntradaySeries.length,
    latestUsdKrwIntradayPoint?.observedAt ?? null,
    remainingIntradayCooldownSeconds
  );
  const usdKrwChartStatusText = usdKrwRange === '1D'
    ? `${showUsdKrwCandlesticks ? '5분봉 캔들' : '5분봉 라인'} · ${intradayStatusLabel}`
    : `기준 환율 일별 · 최신 ${latestUsdKrwPoint?.dateValue.slice(0, 10) ?? '-'} · ${marketDailyStatus.label}`;
  const onePercentHigherUsdKrw = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 1.01;
  const onePercentLowerUsdKrw = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 0.99;
  const usdKrwPanelDetails = [
    { label: '+1%', value: `${formatValue(onePercentHigherUsdKrw)} KRW` },
    { label: '-1%', value: `${formatValue(onePercentLowerUsdKrw)} KRW` },
    { label: '범위', value: getRangeLabel(usdKrwRange) },
    { label: usdKrwRange === '1D' ? '세션' : '기간', value: usdKrwRange === '1D' ? '주중 24시간 실시간 수집 환율' : `${getRangeLabel(usdKrwRange)} 일별 기준 환율` },
    { label: '의미', value: '1달러 가격' },
    { label: '해석', value: '상승하면 원화 약세' },
    { label: '출처', value: usdKrwRange === '1D' ? 'Twelve Data 1분봉 집계' : 'Koreaexim/FRED 일별' }
  ];
  const usdKrwChartDisplayControl = usdKrwRange === '1D' ? (
    <div className="usd-krw-chart-mode-control shrink-0">
      <RangeSelector
        columns={2}
        compact
        onChange={setUsdKrwChartDisplayMode}
        options={[
          { key: 'line', label: '라인' },
          { key: 'candlestick', label: '캔들' }
        ]}
        value={usdKrwChartDisplayMode}
      />
    </div>
  ) : null;
  const dollarIndexPanelDetails = [
    { label: '범위', value: `${getRangeLabel(dollarIndexRange)} · 26개국 교역 상대` },
    { label: '기간', value: getPanelPeriodLabel(visibleDollarIndexSeries) },
    { label: '관측값', value: `${visibleDollarIndexSeries.length}개` },
    { label: '최신 기준일', value: dollarIndexStatus?.latestBaseDate ?? latestDollarIndexPoint?.dateValue.slice(0, 10) ?? '-' },
    { label: '구성', value: '26개' },
    { label: '의미', value: '넓은 교역 상대 기준 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXBGS' }
  ];
  const dxyPanelDetails = [
    { label: '범위', value: `${getRangeLabel(dxyRange)} · 7개국 통화권` },
    { label: '기간', value: getPanelPeriodLabel(visibleDxyIndexSeries) },
    { label: '관측값', value: `${visibleDxyIndexSeries.length}개` },
    { label: '최신 기준일', value: advancedDollarIndexStatus?.latestBaseDate ?? latestDxyIndexPoint?.dateValue.slice(0, 10) ?? '-' },
    { label: '구성', value: '7개' },
    { label: '의미', value: '주요 7개 통화권 대비 달러 강도' },
    { label: '해석', value: '상승하면 달러 강세' },
    { label: '출처', value: 'FRED DTWEXAFEGS' }
  ];
  const activeDollarIndexRange = showBroadDollarIndex ? dollarIndexRange : dxyRange;
  const activeDollarIndexSeries = showBroadDollarIndex ? visibleDollarIndexSeries : visibleDxyIndexSeries;
  const activeDollarIndexMetric = showBroadDollarIndex ? dollarIndexMetric : dxyMetric;
  const activeDollarIndexPanelDetails = showBroadDollarIndex ? dollarIndexPanelDetails : dxyPanelDetails;
  const activeDollarIndexLatestBaseDate = showBroadDollarIndex
    ? dollarIndexStatus?.latestBaseDate ?? latestDollarIndexPoint?.dateValue.slice(0, 10) ?? '-'
    : advancedDollarIndexStatus?.latestBaseDate ?? latestDxyIndexPoint?.dateValue.slice(0, 10) ?? '-';
  const activeDollarIndexChartStatusText = `일별 지수 · 최신 ${activeDollarIndexLatestBaseDate} · ${marketDailyStatus.label}`;
  const activeDollarIndexHeaderAction = (
    <div className="dollar-index-mode-control w-[6.75rem] shrink-0">
      <RangeSelector
        columns={2}
        compact
        onChange={selectDollarIndexTab}
        options={[...dollarIndexTabs]}
        value={activeDollarIndexTabKey}
      />
    </div>
  );

  const changeNewsCategory = React.useCallback((category: string) => {
    setSelectedNewsCategory(category);
    setNewsPage(1);
    loadNews(category, 1, true, newsFilters);
  }, [loadNews, newsFilters]);

  const changeNewsPage = React.useCallback((page: number) => {
    loadNews(selectedNewsCategory, page, true, newsFilters, page === 1 ? 'replace' : 'append');
  }, [loadNews, newsFilters, selectedNewsCategory]);

  const applyNewsFilters = React.useCallback((filters: NewsFilters) => {
    setNewsFilters(filters);
    setNewsPage(1);
    loadNews(selectedNewsCategory, 1, true, filters);
  }, [loadNews, selectedNewsCategory]);

  const changeGovernmentBriefingsPage = React.useCallback((page: number) => {
    loadGovernmentBriefings(selectedGovernmentBriefingCategory, page, true, governmentBriefingFilters, page === 1 ? 'replace' : 'append');
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
      <header className="py-1.5 sm:pb-0 sm:pt-2">
        <div className="mx-auto grid w-full max-w-[82rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-3 sm:px-4 xl:min-h-[48px] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-x-3">
          <button
            className="brand-lockup col-start-1 row-start-1 flex min-w-0 shrink-0 items-center justify-start gap-0.5 py-0.5 xl:gap-1"
            onClick={() => navigatePage('home')}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              className="brand-logo-mark h-[2.95rem] w-[2.95rem] shrink-0 lg:h-[3.5rem] lg:w-[3.5rem]"
              src="/assets/finnel_logo_rounded_final_deepnavy.svg"
            />
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="brand-name-ko truncate text-[1.18rem] leading-none lg:text-[1.32rem]">핀넬</span>
              <span className="brand-name-en text-[1.18rem] leading-none lg:text-[1.32rem]">
                <span className="brand-name-en-accent">fin</span>nel.kr
              </span>
            </span>
          </button>
          {isMainAppPage ? (
            <div className="col-start-2 row-start-1 flex justify-end xl:col-start-3">
              <ForeignExchangeTicker emptyMessage={dashboardEmptyText} rates={foreignExchangeRates} />
            </div>
          ) : null}
        </div>
      </header>
      <section className={`mx-auto flex w-full max-w-[82rem] flex-col px-3 pb-2 pt-0 sm:px-4 sm:pb-3 sm:pt-0 ${activePage === 'home' ? 'gap-0' : 'gap-1 sm:gap-2'}`}>
        {isMainAppPage ? (
          <nav
            className="scrollbar-none relative flex w-full max-w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 pb-1 pt-1.5 sm:pt-2"
            aria-label="주요 화면"
            ref={mainTabNavRef}
          >
            {mainTabs.map((tab) => (
              <React.Fragment key={tab.key}>
                {tab.key === 'dataSources' ? <span className="mx-1.5 block h-5 w-px shrink-0 self-center bg-zinc-200 md:mx-2 md:ml-auto" aria-hidden="true" /> : null}
                <button
                  className={`main-tab-button relative z-10 inline-flex h-[30px] shrink-0 items-center justify-center rounded-md px-[11px] text-center text-[12px] font-bold leading-none sm:h-[35px] sm:px-[13px] sm:text-[13px] ${
                    activeMainTabKey === tab.key ? 'main-tab-button-active' : 'border border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                  onClick={() => navigateMainTab(tab.key)}
                  ref={(node) => {
                    mainTabButtonRefs.current[tab.key] = node;
                  }}
                  type="button"
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              </React.Fragment>
            ))}
          </nav>
        ) : null}
        {activePage === 'home' ? (
          <HomePageView
            calculatorMeta={dashboard?.exchangeRateCalculator ?? null}
            currencyStrengthRanks={currencyStrengthRanks}
            rates={foreignExchangeRates}
            onGoDashboard={goDashboard}
          />
        ) : null}

        {activePage === 'dashboard' ? <RelatedNewsBanner topic="exchange" /> : null}
        {activePage === 'koreaStatus' ? <RelatedNewsBanner topic="indicators" /> : null}

        {activePage === 'todayFlow' ? (
          <div className="page-content-enter">
            <TodayFlowPageView
              dashboard={dashboard}
              dashboardEmptyText={dashboardEmptyText}
              dashboardLoadState={dashboardLoadState}
              governmentBriefings={governmentBriefings}
              governmentBriefingsConfigured={!hasGovernmentBriefingsLoaded || isGovernmentBriefingsConfigured}
              governmentBriefingsSyncStatus={governmentBriefingsSyncStatus}
              newsArticles={newsArticles}
              newsConfigured={!hasNewsLoaded || isNewsConfigured}
              newsSyncStatus={newsSyncStatus}
              statusNode={activeStatusNode}
            />
          </div>
        ) : null}

        {activePage === 'dashboard' ? (
          <header className="page-tab-header page-tab-header-after-news page-tab-header-no-divider page-content-enter">
            <div className="min-w-0">
              <p className="page-tab-eyebrow">FX DASHBOARD</p>
              <h2 className="page-tab-title">환율 현황</h2>
              <p className="page-tab-description">원/달러 환율과 달러 지수를 함께 보며 오늘 원화 흐름의 위치와 달러 강도를 확인합니다.</p>
            </div>
            {activeStatusNode ? (
              <div className="grid min-w-0 justify-items-start gap-1 md:justify-items-end">
                {activeStatusNode}
              </div>
            ) : null}
          </header>
        ) : null}

        {activePage === 'dashboard' ? (
          <section className="page-content-enter grid gap-4">
            <MarketChartSection
              emptyText={dashboardEmptyText}
              candlestickSeries={visibleUsdKrwCandles}
              chartVariant={showUsdKrwCandlesticks ? 'candlestick' : 'line'}
              desktopAdSlot={chartAdSlots.usdKrwDesktop}
              headerAction={usdKrwChartDisplayControl}
              headerActionPlacement="chartControls"
              headerStatus={usdKrwStatusNode}
              helpAriaLabel="USD/KRW 그래프 안내"
              helpContent={(
                <>
                  <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                  <p className="mt-1">1일은 1분봉을 5분 단위로 집계한 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                </>
              )}
              helpTitle="USD/KRW 그래프"
              hover={activeUsdKrwHover}
              lineStroke="#18a999"
              lineStrokeWidth={1.25}
              metric={usdKrwMetric}
              mobileAdSlot={chartAdSlots.usdKrwMobile}
              onHoverChange={setActiveUsdKrwHover}
              onRangeChange={setUsdKrwRange}
              panelDetails={usdKrwPanelDetails}
              plotLeft={28}
              plotRight={66}
              range={usdKrwRange}
              rangeColumns={4}
              rangeOptions={rangeOptions}
              referenceStroke="#18a999"
              series={visibleUsdKrwSeries}
              showExtremaLines
              showLatestValueDot={showUsdKrwLatestValueDot && !showUsdKrwCandlesticks}
              showLoadingOverlay={shouldCoverDashboardCharts}
              statusClassName="text-teal-700"
              statusText={usdKrwChartStatusText}
              subtitle={null}
              title="실시간 원달러 환율"
              tooltipContent={showUsdKrwCandlesticks ? <UsdKrwCandlestickTooltip /> : <UsdKrwTooltip range={usdKrwRange} />}
              usePointerHover
              xAxisHeight={usdKrwRange === '1D' ? intradayXAxisHeightPx : dailyXAxisHeightPx}
              xAxisPadding={{ left: 0, right: 0 }}
              xDomain={usdKrwXDomain}
              xTickFormatter={(value) => usdKrwRange === '1D' ? formatUsdKrwXTick(value) : formatDailyXTick(value, usdKrwRange)}
              xTicks={usdKrwXTicks}
              yDomain={usdKrwDomain}
            />

            <MarketChartSection
              emptyText={dashboardEmptyText}
              desktopAdSlot={chartAdSlots.dollarIndexDesktop}
              headerStatus={dollarIndexStatusNode}
              helpAriaLabel="달러인덱스 안내"
              helpContent={(
                <>
                  <p className="mt-1">7개 통화권 지수는 FRED DTWEXAFEGS 공식 시리즈입니다. 유로지역, 캐나다, 일본, 영국, 스위스, 호주, 스웨덴 통화권 대비 달러 강도를 봅니다.</p>
                  <p className="mt-1">26개 교역 상대 지수는 FRED DTWEXBGS 공식 시리즈입니다. 한국, 중국, 멕시코, 캐나다, 유로지역 등 주요 교역 상대 통화 대비 달러 강도를 봅니다.</p>
                  <p className="mt-1">흔히 말하는 ICE DXY 6개 바스켓과는 다르며, 값이 오르면 해당 바스켓 대비 달러 강세로 해석합니다.</p>
                </>
              )}
              helpTitle="달러인덱스"
              helpWidthClassName="w-80"
              hover={showBroadDollarIndex ? activeBroadDollarHover : activeAdvancedDollarHover}
              lineStroke="#18a999"
              lineStrokeWidth={1.25}
              keepHeaderSingleLineOnMobile
              metric={activeDollarIndexMetric}
              mobileAdSlot={chartAdSlots.dollarIndexMobile}
              headerAction={activeDollarIndexHeaderAction}
              headerActionPlacement="chartControls"
              onHoverChange={showBroadDollarIndex ? setActiveBroadDollarHover : setActiveAdvancedDollarHover}
              onRangeChange={(range) => {
                if (showBroadDollarIndex) {
                  setDollarIndexRange(range);
                } else {
                  setDxyRange(range);
                }
              }}
              panelDetails={activeDollarIndexPanelDetails}
              plotLeft={18}
              plotRight={66}
              range={activeDollarIndexRange}
              rangeColumns={3}
              rangeOptions={longRangeOptions}
              referenceStroke="#18a999"
              series={activeDollarIndexSeries}
              showExtremaLines
              showLatestValueDot={false}
              showLoadingOverlay={shouldCoverDashboardCharts}
              statusClassName="text-slate-600"
              statusText={activeDollarIndexChartStatusText}
              subtitle={null}
              title="달러인덱스"
              tooltipContent={<DollarIndexTooltip title={showBroadDollarIndex ? '26개 교역 상대 달러' : '7개 통화권 달러'} />}
              usePointerHover
              xAxisHeight={dailyXAxisHeightPx}
              xAxisPadding={{ left: 0, right: 0 }}
              xDomain={showBroadDollarIndex ? dollarIndexXDomain : dxyIndexXDomain}
              xTickFormatter={(value) => formatDailyXTick(value, activeDollarIndexRange)}
              xTicks={showBroadDollarIndex ? dollarIndexXTicks : dxyIndexXTicks}
              yDomain={showBroadDollarIndex ? dollarIndexDomain : dxyIndexDomain}
            />
          </section>
        ) : null}

        {activePage === 'exchangeGuide' ? (
          <div className="page-content-enter">
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
              onLoadMore={changeNewsPage}
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
              onLoadMore={changeGovernmentBriefingsPage}
              page={governmentBriefingsPage}
              selectedCategory={selectedGovernmentBriefingCategory}
              statusNode={activeStatusNode}
              totalCount={governmentBriefingsTotalCount}
              totalPages={governmentBriefingsTotalPages}
            />
          </div>
        ) : null}

        {activePage === 'serviceGuide' ? (
          <div className="page-content-enter">
            <ServiceGuidePageView />
          </div>
        ) : null}

        {activePage === 'dataSources' ? (
          <div className="page-content-enter">
            <DataSourceGuideView dataSources={dataSources} />
          </div>
        ) : null}

        {activePage === 'calculator' ? (
          <CalculatorPage
            calculatorMeta={dashboard?.exchangeRateCalculator ?? null}
            rates={foreignExchangeRates}
          />
        ) : null}

        {activeMainTabKey ? (
          <section className="page-content-enter">
            <GoogleAdSlot
              className="w-full"
              minHeightClassName="min-h-28 sm:min-h-32"
              slot={tabAdSlots[activeMainTabKey] ?? import.meta.env.VITE_ADSENSE_SLOT_TAB_DEFAULT}
            />
          </section>
        ) : null}

      </section>
      {activePage !== 'home' ? <AppFooter /> : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function CalculatorPage({
  calculatorMeta,
  rates
}: {
  calculatorMeta?: DailyDashboardResponse['exchangeRateCalculator'] | null;
  rates: ForeignExchangeRate[];
}) {
  return (
    <section className="page-content-enter grid gap-5">
      <header className="page-tab-header">
        <div className="min-w-0">
          <p className="page-tab-eyebrow">CALCULATORS</p>
          <h2 className="page-tab-title">환전 계산</h2>
          <p className="page-tab-description">
            수수료와 은행별 스프레드를 제외한 기준 환율로 환전 금액과 환차익을 계산합니다.
          </p>
        </div>
      </header>

      <div className="calculator-tab-layout grid min-w-0 gap-4 xl:grid-cols-[minmax(15rem,0.56fr)_minmax(34rem,1.44fr)] xl:items-start">
        <section className="calculator-tab-panel min-w-0">
          <div className="calculator-tab-panel-header">
            <div>
              <p className="calculator-tab-panel-kicker">현재 기준</p>
              <h3 className="calculator-tab-panel-title">지금 환전하면 얼마인가요?</h3>
            </div>
            <span className="calculator-tab-panel-badge">실시간 기준 환율</span>
          </div>
          <section className="calculator-tab-conversion-card glass-card min-w-0 overflow-hidden rounded-2xl shadow-sm">
            <ExchangeRateConversionCalculator rates={rates} />
          </section>
        </section>

        <section className="calculator-tab-panel min-w-0">
          <div className="calculator-tab-panel-header">
            <div>
              <p className="calculator-tab-panel-kicker">과거 비교</p>
              <h3 className="calculator-tab-panel-title">그때 환전한 돈은 지금 얼마인가요?</h3>
            </div>
            <span className="calculator-tab-panel-badge">휴일은 직전 기준일</span>
          </div>
          <ExchangeProfitCalculator
            calculatorMeta={calculatorMeta}
            className="calculator-tab-profit-card shadow-sm"
            rates={rates}
            variant="tab"
          />
        </section>
      </div>
    </section>
  );
}

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

function getDashboardErrorMessage(_error: unknown) {
  return '현재 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.';
}

function UpdateStatusBox({
  details = [],
  interval,
  statusLabel,
  tone
}: {
  details?: string[];
  interval: string;
  statusLabel: string;
  tone: string;
}) {
  const tooltipLines = details.length > 0 ? details : [interval];
  const ariaLabel = `${statusLabel}. ${tooltipLines.join('. ')}`;

  return (
    <div className="service-status-box relative flex max-w-full min-w-0 flex-nowrap items-center justify-between gap-3 text-[10px] font-medium text-zinc-500">
      <span className="inline-flex min-w-0 flex-1 items-center">
        <span className="truncate">{interval}</span>
      </span>
      <span
        aria-label={ariaLabel}
        className="service-status-trigger inline-flex min-w-0 shrink-0 items-center gap-1"
        tabIndex={0}
      >
        <span className="truncate">{statusLabel}</span>
        <span className={`service-status-dot service-status-dot-${tone} shrink-0`} aria-hidden="true" />
        <span className="service-status-tooltip" role="tooltip">
          {tooltipLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      </span>
    </div>
  );
}

function getUsdKrwIntradayCardStatus({
  dashboard,
  dashboardLoadState,
  intradayStatus,
  isCurrentSession,
  latestIntradayDate
}: {
  dashboard: DailyDashboardResponse | null;
  dashboardLoadState: DashboardLoadState;
  intradayStatus: SyncStatus | null;
  isCurrentSession: boolean;
  latestIntradayDate: string | null;
}): { label: string; tone: ServiceStatusTone } {
  if (!dashboard && dashboardLoadState === 'loading') {
    return { label: '조회 중', tone: 'idle' };
  }

  if (!dashboard && dashboardLoadState === 'error') {
    return { label: '조회 실패', tone: 'error' };
  }

  if (isCurrentSession) {
    return { label: '업데이트 원활', tone: 'healthy' };
  }

  if (intradayStatus?.latestStatus === 'RUNNING') {
    return { label: '업데이트 중', tone: 'idle' };
  }

  if (intradayStatus?.latestStatus && intradayStatus.latestStatus !== 'SUCCESS' && !intradayStatus.latestStatus.startsWith('SKIPPED')) {
    return { label: '업데이트 점검', tone: 'error' };
  }

  if (latestIntradayDate) {
    return { label: '업데이트 대기', tone: 'idle' };
  }

  return { label: '업데이트 대기', tone: 'idle' };
}

function ForeignExchangeTicker({ emptyMessage, rates }: { emptyMessage: string; rates: ForeignExchangeRate[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isPaused = isExpanded || isHovering;

  React.useEffect(() => {
    if (activeIndex >= rates.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, rates.length]);

  React.useEffect(() => {
    if (rates.length <= 1 || isPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % rates.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isPaused, rates.length]);

  React.useEffect(() => {
    if (!isExpanded) {
      return undefined;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isExpanded]);

  if (rates.length === 0) {
    return (
      <div className="w-[min(12.5rem,48vw)] rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px] text-zinc-500 shadow-sm sm:w-56 lg:w-60">
        {emptyMessage}
      </div>
    );
  }

  const activeRate = rates[activeIndex] ?? rates[0];

  return (
    <div
      className="relative z-30 w-[min(12.5rem,48vw)] sm:w-56 lg:w-60"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      ref={containerRef}
    >
      <button
        aria-expanded={isExpanded}
        className="group relative h-10 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-left transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-100"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        {isExpanded ? (
          <div className="flex h-full items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-950">주요 통화 환율</p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-teal-700">접기</span>
          </div>
        ) : (
          <>
            <div key={activeRate.currencyCode} className={`foreign-rate-ticker-item foreign-rate-primary-content flex h-full items-center gap-2 ${isPaused ? 'foreign-rate-ticker-paused' : ''}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-base leading-none" aria-hidden="true">
                {getCurrencyFlag(activeRate.displayCode)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-zinc-950">{getCurrencyShortLabel(activeRate.displayCode)}</span>
                <span className="block truncate text-[10px] text-zinc-500">{activeRate.displayCode} · {formatForeignExchangeUpdatedAt(new Date(activeRate.fetchedAt))}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-teal-700">{formatValue(activeRate.dealBasRate, 2)}원</span>
            </div>
            <span className="foreign-rate-hover-content pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-semibold text-teal-700 opacity-0 group-hover:opacity-100">
              <span className="foreign-rate-hover-label">펼쳐서 보기</span>
            </span>
          </>
        )}
      </button>
      <div
        className={`foreign-rate-dropdown absolute right-0 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-950/10 ${
          isExpanded ? 'foreign-rate-dropdown-open' : ''
        }`}
      >
        <div className="foreign-rate-list-scroll grid max-h-[min(60vh,26rem)] min-w-0 gap-1.5 overflow-y-auto bg-zinc-50 p-2">
          {rates.map((rate) => (
            <article className="foreign-rate-card grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2.5 shadow-sm" key={rate.currencyCode}>
              <div className="foreign-rate-card-flag grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-xl leading-none" aria-hidden="true">
                {getCurrencyFlag(rate.displayCode)}
              </div>
              <div className="foreign-rate-card-main min-w-0">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <p className="whitespace-nowrap text-sm font-semibold text-zinc-950">{getCurrencyShortLabel(rate.displayCode)}</p>
                  <span className="shrink-0 text-[10px] font-bold text-zinc-400">{rate.displayCode}</span>
                </div>
                <p className="mt-1 whitespace-nowrap text-[11px] font-medium leading-4 text-zinc-500">
                  {formatForeignExchangeUpdatedAt(new Date(rate.fetchedAt))}
                </p>
              </div>
              <div className="foreign-rate-card-value shrink-0 pt-0.5 text-right">
                <p className="whitespace-nowrap text-sm font-bold text-teal-700">{formatValue(rate.dealBasRate, 2)}원</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExchangeRateConversionCalculator({
  onClose,
  rates
}: {
  onClose?: () => void;
  rates: ForeignExchangeRate[];
}) {
  const [selectedCode, setSelectedCode] = React.useState('');
  const [foreignInput, setForeignInput] = React.useState('100');
  const [krwInput, setKrwInput] = React.useState('');
  const [lastEdited, setLastEdited] = React.useState<'foreign' | 'krw'>('foreign');
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

  return (
    <>
          <div className="calculator-card-header flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <div className="min-w-0">
              <h2 className="calculator-card-title">환전 계산기</h2>
              <p className="calculator-card-description">현재 기준 환율로 환전 금액을 계산합니다.</p>
            </div>
            {onClose ? <button
              aria-label="환전 계산기 닫기"
              className="grid h-7 w-7 shrink-0 place-items-center rounded border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
              onClick={onClose}
              type="button"
            >
              ×
            </button> : null}
          </div>

          {selectedRate ? (
            <div className="conversion-calculator-body grid gap-3 px-4 py-3">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-zinc-500">통화</span>
                <select
                  className="glass-field h-9 w-full rounded-md px-3 text-sm font-semibold outline-none"
                  onChange={(event) => handleCurrencyChange(event.target.value)}
                  value={selectedRate.currencyCode}
                >
                  {availableRates.map((rate) => (
                    <option key={rate.currencyCode} value={rate.currencyCode}>
                      {getCurrencyFlag(rate.displayCode)} {rate.displayCode} · {getCurrencyShortLabel(rate.displayCode)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="conversion-amount-grid grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <label className="grid gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
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
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
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

              <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] leading-5 text-zinc-500">
                <p className="font-medium text-zinc-700">
                  1 {selectedRate.displayCode} = {formatValue(selectedRate.dealBasRate / selectedRate.unitSize, 2)}원
                </p>
                <p>기준 시각 {formatForeignExchangeUpdatedAt(new Date(selectedRate.fetchedAt))}</p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-zinc-400">제공 중인 주요 통화 환율을 확인 중입니다.</div>
          )}
    </>
  );
}

function getCurrencyFlag(code: string) {
  const flags: Record<string, string> = {
    AUD: '🇦🇺',
    CAD: '🇨🇦',
    CHF: '🇨🇭',
    CNH: '🇨🇳',
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
    CNH: '역외 위안',
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

function formatDataFetchedAt(value: string | null) {
  if (!value) {
    return '-';
  }
  return formatForeignExchangeUpdatedAt(new Date(value));
}

function getContentSyncStatusLabel(status: string) {
  if (status === 'SUCCESS') {
    return '성공';
  }
  if (status === 'RUNNING') {
    return '진행중';
  }
  return '실패';
}

function getStatusDetails({
  attemptedAt,
  latestUpdatedAt,
  syncStatus
}: {
  attemptedAt?: string | null;
  latestUpdatedAt?: string | null;
  syncStatus?: string | null;
}) {
  const details: string[] = [];
  if (latestUpdatedAt) {
    details.push(`최근 업데이트 ${formatDataFetchedAt(latestUpdatedAt)}`);
  }
  if (syncStatus) {
    details.push(`마지막 시도 ${formatDataFetchedAt(attemptedAt ?? null)} · ${getContentSyncStatusLabel(syncStatus)}`);
  }
  return details;
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
