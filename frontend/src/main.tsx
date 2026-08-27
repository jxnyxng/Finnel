import React from 'react';
import { createPortal, flushSync } from 'react-dom';
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
import { GoogleAdSlot, SideRailAd } from './components/AdSlot';
import { AppFooter } from './components/AppFooter';
import { DataSourceGuide as DataSourceGuideView } from './components/DataSourceGuide';
import { MarketChartSection } from './components/MarketChartSection';
import { CurrencyStrengthPage as CurrencyStrengthPageView } from './pages/CurrencyStrengthPage';
import { ExchangeRateGuidePage as ExchangeRateGuidePageView } from './pages/ExchangeRateGuidePage';
import { GovernmentBriefingsPage as GovernmentBriefingsPageView } from './pages/GovernmentBriefingsPage';
import { ExchangeProfitCalculator, HomePage as HomePageView } from './pages/HomePage';
import { KoreaStatusPage as KoreaStatusPageView } from './pages/KoreaStatusPage';
import { NewsroomPage as NewsroomPageView } from './pages/NewsroomPage';
import { ServiceGuidePage as ServiceGuidePageView } from './pages/ServiceGuidePage';
import { DashboardPage as DashboardPageView } from './pages/DashboardPage';
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
    getMarketDailyStatus
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
    SyncStatus,
    DashboardFeedResponse
} from './types';
import { FadeIn } from './components/FadeIn';

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

type DashboardLoadState = 'idle' | 'loading' | 'ready' | 'error';
type UsdKrwChartDisplayMode = 'line' | 'candlestick';
type DashboardMainChartType = 'usdKrw' | 'dollarIndex';

type CalculatorCurrencySelectOption = {
    label: React.ReactNode;
    value: string;
};
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
    exchangeRate: import.meta.env.VITE_ADSENSE_SLOT_TAB_EXCHANGE_GUIDE,
    governmentBriefings: import.meta.env.VITE_ADSENSE_SLOT_TAB_POLICY_BRIEFINGS,
    koreaStatus: import.meta.env.VITE_ADSENSE_SLOT_TAB_KOREA_STATUS,
    newsroom: import.meta.env.VITE_ADSENSE_SLOT_TAB_NEWSROOM,
    ranking: import.meta.env.VITE_ADSENSE_SLOT_TAB_RANKING
} satisfies Record<MainTabKey, string | undefined>;
const bottomAdExcludedTabs = new Set<MainTabKey>(['dashboard', 'newsroom', 'governmentBriefings', 'ranking', 'calculator']);
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

function shouldRenderBottomAd(tabKey: MainTabKey) {
    return !bottomAdExcludedTabs.has(tabKey);
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
    const [dashboardMainChartType, setDashboardMainChartType] = React.useState<DashboardMainChartType>('usdKrw');
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
    const [isExchangeGuideOpen, setIsExchangeGuideOpen] = React.useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [homeResetKey, setHomeResetKey] = React.useState(0);
    const isMainAppPage = activePage === 'home' || activePage === 'dataSources' || mainTabs.some((tab) => tab.key === activePage);
    const isFullBleedPage = activePage === 'home' || activePage === 'serviceGuide';
    const mainTabNavRef = React.useRef<HTMLElement | null>(null);
    const mainTabButtonRefs = React.useRef<Partial<Record<MainTabKey, HTMLButtonElement | null>>>({});
    const tabSwipeStartRef = React.useRef<{ x: number; y: number } | null>(null);
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

    const handleBrandClick = React.useCallback(() => {
        navigatePage('home', { replace: window.location.pathname === pageRoutes.home, scroll: false });
        setHomeResetKey((current) => current + 1);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [navigatePage]);

    const goDashboard = React.useCallback(() => navigatePage('dashboard'), [navigatePage]);
    const navigateMainTab = React.useCallback((tabKey: MainTabKey) => {
        setIsMobileMenuOpen(false);
        navigatePage(tabKey);
    }, [navigatePage]);
    const navigateAdjacentMainTab = React.useCallback((direction: -1 | 1) => {
        const activeKey = getMainTabKey(activePage);
        if (!activeKey) {
            return;
        }
        const currentIndex = mainTabs.findIndex((tab) => tab.key === activeKey);
        const nextTab = mainTabs[currentIndex + direction];
        if (nextTab) {
            navigateMainTab(nextTab.key);
        }
    }, [activePage, navigateMainTab]);

    const handleTabSwipeStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
        if (!isMainAppPage || shouldIgnoreTabSwipe(event.target)) {
            tabSwipeStartRef.current = null;
            return;
        }
        const touch = event.touches[0];
        tabSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    }, [isMainAppPage]);

    const handleTabSwipeEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
        const start = tabSwipeStartRef.current;
        tabSwipeStartRef.current = null;
        if (!start || !isMainAppPage || shouldIgnoreTabSwipe(event.target)) {
            return;
        }
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
            return;
        }
        navigateAdjacentMainTab(deltaX < 0 ? 1 : -1);
    }, [isMainAppPage, navigateAdjacentMainTab]);
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

    React.useEffect(() => {
        if (!isMobileMenuOpen) {
            document.body.classList.remove('mobile-main-menu-open');
            return;
        }

        document.body.classList.add('mobile-main-menu-open');
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.classList.remove('mobile-main-menu-open');
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [isMobileMenuOpen]);

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

    const applyNewsResponse = React.useCallback((response: NewsResponse) => {
        setNewsArticles(response.articles);
        setNewsCategories(response.categories);
        setIsNewsConfigured(response.configured);
        setNewsPage(response.page);
        setNewsTotalCount(response.totalCount);
        setNewsTotalPages(response.totalPages);
        setLatestNewsFetchedAt(response.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.articles));
        setNewsSyncStatus({
            freshnessStatus: response.freshnessStatus ?? null,
            lastSuccessfulFetchedAt: response.lastSuccessfulFetchedAt ?? null,
            latestSyncEndedAt: response.latestSyncEndedAt ?? null,
            latestSyncStartedAt: response.latestSyncStartedAt ?? null,
            latestSyncStatus: response.latestSyncStatus ?? null
        });
        setHasNewsLoaded(true);
    }, []);

    const applyGovernmentBriefingResponse = React.useCallback((response: GovernmentBriefingResponse) => {
        setGovernmentBriefings(response.articles);
        setGovernmentBriefingCategories(response.categories);
        setIsGovernmentBriefingsConfigured(response.configured);
        setGovernmentBriefingsPage(response.page);
        setGovernmentBriefingsTotalCount(response.totalCount);
        setGovernmentBriefingsTotalPages(response.totalPages);
        setLatestGovernmentBriefingFetchedAt(response.lastSuccessfulFetchedAt ?? getLatestFetchedAt(response.articles));
        setGovernmentBriefingsSyncStatus({
            freshnessStatus: response.freshnessStatus ?? null,
            lastSuccessfulFetchedAt: response.lastSuccessfulFetchedAt ?? null,
            latestSyncEndedAt: response.latestSyncEndedAt ?? null,
            latestSyncStartedAt: response.latestSyncStartedAt ?? null,
            latestSyncStatus: response.latestSyncStatus ?? null
        });
        setHasGovernmentBriefingsLoaded(true);
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
            if (mode === 'replace') {
                applyNewsResponse(response.data);
                return;
            }

            setNewsArticles((current) => {
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
    }, [applyNewsResponse, newsFilters, newsPage, selectedNewsCategory]);

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
            if (mode === 'replace') {
                applyGovernmentBriefingResponse(response.data);
                return;
            }

            setGovernmentBriefings((current) => {
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
    }, [applyGovernmentBriefingResponse, governmentBriefingFilters, governmentBriefingsPage, selectedGovernmentBriefingCategory]);

    const loadDashboardFeed = React.useCallback(async () => {
        try {
            const response = await axios.get<DashboardFeedResponse>('/api/v1/today-flow');
            setDashboard(response.data.dashboard);
            setDashboardLoadState('ready');
            setDashboardErrorMessage(null);
            applyNewsResponse(response.data.news);
            applyGovernmentBriefingResponse(response.data.governmentBriefings);
        } catch {
            loadDashboard(false);
            loadNews('all', 1, false, { fromDate: '', toDate: '', keyword: '' });
            loadGovernmentBriefings('all', 1, false, { fromDate: '', toDate: '', keyword: '' });
        }
    }, [applyGovernmentBriefingResponse, applyNewsResponse, loadDashboard, loadGovernmentBriefings, loadNews]);

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
        if (activePage !== 'dashboard') {
            return undefined;
        }

        loadDashboardFeed();

        const contentTimer = window.setInterval(() => {
            loadDashboardFeed();
        }, 600_000);

        return () => window.clearInterval(contentTimer);
    }, [activePage, loadDashboardFeed]);

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
    const activeDollarIndexSourceSeries = showBroadDollarIndex ? dollarIndexSeries : dxyIndexSeries;
    const usdKrwSelectedRangeChangeRate = getSeriesChangeRate(visibleUsdKrwSeries);
    const dollarIndexSelectedRangeChangeRate = getSeriesChangeRate(showBroadDollarIndex ? visibleDollarIndexSeries : visibleDxyIndexSeries);
    const changeComparisonRows = longRangeOptions.map((option) => ({
        dollarIndexChangeRate: getSeriesChangeRate(buildVisibleDailySeries(activeDollarIndexSourceSeries, option.key)),
        label: option.label,
        usdKrwChangeRate: getSeriesChangeRate(buildVisibleDailySeries(usdKrwSeries, option.key))
    }));
    const remainingCooldownSeconds = getRemainingCooldownSeconds(syncStatus, nowMs);
    const remainingIntradayCooldownSeconds = getRemainingCooldownSeconds(intradayStatus, nowMs);
    const latestSyncLabel = getLatestSyncLabel(syncStatus, remainingCooldownSeconds);
    const selectDollarIndexTab = React.useCallback((tabKey: DollarIndexTabKey) => {
        if (tabKey === 'broad') {
            setShowBroadDollarIndex(true);
            setActiveAdvancedDollarHover(null);
        } else {
            setShowBroadDollarIndex(false);
            setActiveBroadDollarHover(null);
        }
    }, []);
    const marketDailyStatus = getMarketDailyStatus(dashboard, syncStatus);
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
            interval="시스템 상태"
            statusLabel={usdKrwRange === '1D' ? usdKrwIntradayCardStatus.label : marketDailyStatus.label}
            tone={usdKrwRange === '1D' ? usdKrwIntradayCardStatus.tone : marketDailyStatus.tone}
        />
    );
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
    const activeDollarIndexNextReleaseDate = showBroadDollarIndex
        ? dollarIndexStatus?.nextReleaseDate ?? null
        : advancedDollarIndexStatus?.nextReleaseDate ?? null;
    const activeDollarIndexChartStatusText = activeDollarIndexNextReleaseDate
        ? `일별 지수 · 최신 기준일 ${activeDollarIndexLatestBaseDate} · FRED 다음 공개 예정 ${activeDollarIndexNextReleaseDate}`
        : `일별 지수 · 최신 기준일 ${activeDollarIndexLatestBaseDate}`;
    const activeDollarIndexHelpDetails = [
        { label: '최신 기준일', value: activeDollarIndexLatestBaseDate },
        ...(activeDollarIndexNextReleaseDate ? [{ label: '다음 공개 예정', value: `${activeDollarIndexNextReleaseDate} · FRED` }] : [])
    ];
    const activeDollarIndexHeaderAction = (
        <div className="dollar-index-mode-control shrink-0">
            <RangeSelector
                columns={2}
                compact
                onChange={selectDollarIndexTab}
                options={[...dollarIndexTabs]}
                value={activeDollarIndexTabKey}
            />
        </div>
    );
    const dashboardMainChartSelector = (
        <DashboardMainChartSelect
            onChange={setDashboardMainChartType}
            value={dashboardMainChartType}
        />
    );

    const changeNewsCategory = React.useCallback((category: string) => {
        setSelectedNewsCategory(category);
        setNewsPage(1);
        loadNews(category, 1, true, newsFilters);
    }, [loadNews, newsFilters]);

    const changeNewsPage = React.useCallback((page: number) => {
        setNewsPage(page);
        loadNews(selectedNewsCategory, page, true, newsFilters, 'replace');
    }, [loadNews, newsFilters, selectedNewsCategory]);

    const applyNewsFilters = React.useCallback((filters: NewsFilters) => {
        setNewsFilters(filters);
        setNewsPage(1);
        loadNews(selectedNewsCategory, 1, true, filters);
    }, [loadNews, selectedNewsCategory]);

    const changeGovernmentBriefingsPage = React.useCallback((page: number) => {
        setGovernmentBriefingsPage(page);
        loadGovernmentBriefings(selectedGovernmentBriefingCategory, page, true, governmentBriefingFilters, 'replace');
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
            {/* 🚀 전역 애니메이션 키프레임 주입 */}
            <style>{`
        @keyframes fadeInUpGlobal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            <header className="app-header border-b border-zinc-800 bg-black/95">
                <div className="grid w-full grid-cols-[auto_auto] items-center gap-2 pb-1 pl-9 pr-4 pt-1.5 sm:pl-10 sm:pr-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-[3.25rem]">
                    <button
                        className="brand-lockup flex min-w-0 shrink-0 items-center justify-start gap-2 py-0.5 xl:gap-2.5"
                        onClick={handleBrandClick}
                        type="button"
                    >
                        <img
                            alt=""
                            aria-hidden="true"
                            className="brand-logo-mark h-[1.8rem] w-[1.8rem] shrink-0 lg:h-[2rem] lg:w-[2rem]"
                            src="/assets/finnel_logo_rounded_final_white.svg"
                        />
                        <span className="flex min-w-0 items-center">
              <span className="brand-name-en text-[1.16rem] leading-none lg:text-[1.31rem]">
                <span className="brand-name-en-accent">fin</span>nel.kr
              </span>
                        </span>
                    </button>
                    {isMainAppPage ? (
                        <button
                            aria-expanded={isMobileMenuOpen}
                            aria-label={isMobileMenuOpen ? '주요 화면 메뉴 닫기' : '주요 화면 메뉴 열기'}
                            className={`mobile-main-menu-button justify-self-end lg:hidden ${isMobileMenuOpen ? 'mobile-main-menu-button-open' : ''}`}
                            onClick={() => setIsMobileMenuOpen((current) => !current)}
                            type="button"
                        >
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                        </button>
                    ) : null}
                {isMainAppPage ? (
                    <nav
                        className="scrollbar-none relative hidden w-full max-w-full flex-nowrap justify-start gap-1.5 overflow-x-auto overflow-y-hidden lg:flex xl:gap-2"
                        aria-label="주요 화면"
                        ref={mainTabNavRef}
                    >
                        {mainTabs.map((tab) => (
                            <button
                                className={`main-tab-button relative z-10 inline-flex h-[23px] shrink-0 items-center justify-center px-[10px] text-center text-[11.4px] leading-none sm:h-[24px] sm:px-[12px] sm:text-[12.4px] ${
                                    activeMainTabKey === tab.key ? 'main-tab-button-active' : 'text-zinc-400 hover:text-teal-200'
                                }`}
                                key={tab.key}
                                onClick={() => navigateMainTab(tab.key)}
                                ref={(node) => {
                                    mainTabButtonRefs.current[tab.key] = node;
                                }}
                                type="button"
                            >
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                ) : null}
                </div>
            </header>
                {isMainAppPage ? (
                    <div className={`mobile-main-menu-overlay lg:hidden ${isMobileMenuOpen ? 'mobile-main-menu-overlay-open' : ''}`} aria-hidden={!isMobileMenuOpen}>
                        <nav aria-label="모바일 주요 화면" className="mobile-main-menu-panel">
                            {mainTabs.map((tab) => (
                                <button
                                    className={`mobile-main-menu-item ${activeMainTabKey === tab.key ? 'mobile-main-menu-item-active' : ''}`}
                                    key={tab.key}
                                    onClick={() => navigateMainTab(tab.key)}
                                    tabIndex={isMobileMenuOpen ? 0 : -1}
                                    type="button"
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                ) : null}
            <section
                className={`app-content-shell flex w-full flex-col px-0 ${isFullBleedPage ? 'gap-0 pb-0 pt-0 sm:pb-0 sm:pt-0' : 'gap-2 pb-2 pt-1 sm:gap-3 sm:pb-3 sm:pt-2'}`}
                onTouchEnd={handleTabSwipeEnd}
                onTouchStart={handleTabSwipeStart}
            >

                {activePage === 'home' ? (
                    <FadeIn>
                        <HomePageView
                            key={homeResetKey}
                            calculatorMeta={dashboard?.exchangeRateCalculator ?? null}
                            currencyStrengthRanks={currencyStrengthRanks}
                            rates={foreignExchangeRates}
                            onGoDashboard={goDashboard}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'dashboard' ? (
                    <FadeIn className="page-content-enter">
                        <DashboardPageView
                            dashboard={dashboard}
                            dashboardEmptyText={dashboardEmptyText}
                            dashboardLoadState={dashboardLoadState}
                            changeComparisonRows={changeComparisonRows}
                            foreignExchangeRates={foreignExchangeRates}
                            governmentBriefings={governmentBriefings}
                            governmentBriefingsConfigured={!hasGovernmentBriefingsLoaded || isGovernmentBriefingsConfigured}
                            governmentBriefingsSyncStatus={governmentBriefingsSyncStatus}
                            newsArticles={newsArticles}
                            newsConfigured={!hasNewsLoaded || isNewsConfigured}
                            newsSyncStatus={newsSyncStatus}
                            chartSupplement={<DashboardTrumpSnsCard />}
                            usdKrwChart={(
                                dashboardMainChartType === 'usdKrw' ? (
                                  <MarketChartSection
                                    compactLayout
                                    emptyText={dashboardEmptyText}
                                    candlestickSeries={visibleUsdKrwCandles}
                                    chartAction={usdKrwChartDisplayControl}
                                    chartVariant={showUsdKrwCandlesticks ? 'candlestick' : 'line'}
                                    desktopAdSlot={chartAdSlots.usdKrwDesktop}
                                    headerStatus={usdKrwRange === '1D' ? usdKrwStatusNode : null}
                                    helpAriaLabel="USD/KRW 그래프 안내"
                                    helpContent={(
                                        <>
                                            <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                                            <p className="mt-1">1일은 1분봉을 5분 단위로 집계한 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                                        </>
                                    )}
                                    helpTitle="USD/KRW 그래프"
                                    hover={activeUsdKrwHover}
                                    lineStroke="#00C9A7"
                                    lineStrokeWidth={1.75}
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
                                    rangeSummary={<RangeChangeSummary changeRate={usdKrwSelectedRangeChangeRate} rangeLabel={getRangeLabel(usdKrwRange)} />}
                                    referenceStroke="#00C9A7"
                                    sectionLabelAction={dashboardMainChartSelector}
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
                                    xAxisHeight={usdKrwRange === '1D' ? 22 : 24}
                                    xAxisPadding={{ left: 0, right: 0 }}
                                    xDomain={usdKrwXDomain}
                                    xTickFormatter={(value) => usdKrwRange === '1D' ? formatUsdKrwXTick(value) : formatDailyXTick(value, usdKrwRange)}
                                    xTicks={usdKrwXTicks}
                                    yDomain={usdKrwDomain}
                                  />
                                ) : (
                                  <MarketChartSection
                                      compactLayout
                                      emptyText={dashboardEmptyText}
                                      desktopAdSlot={chartAdSlots.dollarIndexDesktop}
                                      helpAriaLabel="달러인덱스 안내"
                                      helpContent={(
                                          <>
                                              <p className="mt-1">7개 통화권 지수와 26개 교역 상대 지수로 달러 강도를 봅니다.</p>
                                          </>
                                      )}
                                      helpTitle="달러인덱스"
                                      helpWidthClassName="w-[min(24rem,calc(100vw-1.5rem))]"
                                      hover={showBroadDollarIndex ? activeBroadDollarHover : activeAdvancedDollarHover}
                                      lineStroke="#00C9A7"
                                      lineStrokeWidth={1.75}
                                      keepHeaderSingleLineOnMobile
                                      helpDetails={activeDollarIndexHelpDetails}
                                      metric={activeDollarIndexMetric}
                                      mobileAdSlot={chartAdSlots.dollarIndexMobile}
                                      chartAction={activeDollarIndexHeaderAction}
                                      onHoverChange={showBroadDollarIndex ? setActiveBroadDollarHover : setActiveAdvancedDollarHover}
                                      onRangeChange={(range) => {
                                          if (showBroadDollarIndex) {
                                              setDollarIndexRange(range);
                                          } else {
                                              setDxyRange(range);
                                          }
                                      }}
                                      panelDetails={activeDollarIndexPanelDetails}
                                      plotLeft={28}
                                      plotRight={66}
                                      range={activeDollarIndexRange}
                                      rangeColumns={3}
                                      rangeOptions={longRangeOptions}
                                      rangeSummary={<RangeChangeSummary changeRate={dollarIndexSelectedRangeChangeRate} rangeLabel={getRangeLabel(activeDollarIndexRange)} />}
                                      referenceStroke="#00C9A7"
                                      sectionLabelAction={dashboardMainChartSelector}
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
                                      xAxisHeight={24}
                                      xAxisPadding={{ left: 0, right: 0 }}
                                      xDomain={showBroadDollarIndex ? dollarIndexXDomain : dxyIndexXDomain}
                                      xTickFormatter={(value) => formatDailyXTick(value, activeDollarIndexRange)}
                                      xTicks={showBroadDollarIndex ? dollarIndexXTicks : dxyIndexXTicks}
                                      yDomain={showBroadDollarIndex ? dollarIndexDomain : dxyIndexDomain}
                                  />
                                )
                            )}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'exchangeRate' ? (
                    <FadeIn as="header" className="page-tab-header page-tab-header-no-divider page-content-enter">
                        <div className="relative min-w-0 md:col-span-2">
                            <p className="page-tab-eyebrow">FX DASHBOARD</p>
                            <h2 className="page-tab-title">환율현황</h2>
                            <p className="page-tab-description m-0 mt-1 max-w-none">원/달러 환율과 달러지수의 차트, 기준값, 기간별 변동 정보를 제공합니다.</p>
                        </div>
                    </FadeIn>
                ) : null}

                {activePage === 'exchangeRate' ? (
                    <FadeIn as="section" className="page-content-enter grid gap-4" delay={0.1}>
                        <MarketChartSection
                            emptyText={dashboardEmptyText}
                            candlestickSeries={visibleUsdKrwCandles}
                            chartAction={usdKrwChartDisplayControl}
                            chartVariant={showUsdKrwCandlesticks ? 'candlestick' : 'line'}
                            desktopAdSlot={chartAdSlots.usdKrwDesktop}
                            headerStatus={usdKrwRange === '1D' ? usdKrwStatusNode : null}
                            helpAriaLabel="USD/KRW 그래프 안내"
                            helpContent={(
                                <>
                                    <p className="mt-1">값이 높아질수록 1달러를 사는 데 더 많은 원화가 필요하므로 원화 약세로 해석합니다.</p>
                                    <p className="mt-1">1일은 1분봉을 5분 단위로 집계한 흐름, 긴 기간은 일별 흐름을 봅니다. 최신값 점선은 현재 기준 환율 위치를 빠르게 비교하기 위한 표시입니다.</p>
                                </>
                            )}
                            helpTitle="USD/KRW 그래프"
                            hover={activeUsdKrwHover}
                            lineStroke="#00C9A7"
                            lineStrokeWidth={1.75}
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
                            referenceStroke="#00C9A7"
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
                            helpAriaLabel="달러인덱스 안내"
                            helpContent={(
                                <>
                                    <p className="mt-1">7개 통화권 지수는 FRED DTWEXAFEGS 공식 시리즈입니다. 유로지역, 캐나다, 일본, 영국, 스위스, 호주, 스웨덴 통화권 대비 달러 강도를 봅니다.</p>
                                    <p className="mt-1">26개 교역 상대 지수는 FRED DTWEXBGS 공식 시리즈입니다. 한국, 중국, 멕시코, 캐나다, 유로지역 등 주요 교역 상대 통화 대비 달러 강도를 봅니다.</p>
                                    <p className="mt-1">흔히 말하는 ICE DXY 6개 바스켓과는 다르며, 값이 오르면 해당 바스켓 대비 달러 강세로 해석합니다.</p>
                                </>
                            )}
                            helpTitle="달러인덱스"
                            helpWidthClassName="w-[min(24rem,calc(100vw-1.5rem))]"
                            hover={showBroadDollarIndex ? activeBroadDollarHover : activeAdvancedDollarHover}
                            lineStroke="#00C9A7"
                            lineStrokeWidth={1.75}
                            keepHeaderSingleLineOnMobile
                            helpDetails={activeDollarIndexHelpDetails}
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
                            referenceStroke="#00C9A7"
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
                    </FadeIn>
                ) : null}

                {activePage === 'koreaStatus' ? (
                    <FadeIn className="page-content-enter">
                        <KoreaStatusPageView
                            indicators={domesticIndicators}
                            errorMessage={hasDashboardError && domesticIndicators.length === 0 ? dashboardErrorMessage : null}
                            isLoading={isInitialDashboardLoading}
                            latestSyncLabel={latestSyncLabel}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'ranking' ? (
                    <FadeIn className="page-content-enter">
                        <CurrencyStrengthPageView
                            emptyMessage={dashboardEmptyText}
                            isLoading={isInitialDashboardLoading}
                            ranks={currencyStrengthRanks}
                            sideAdSlot={tabAdSlots.ranking}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'newsroom' ? (
                    <FadeIn className="page-content-enter">
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
                            sideAdSlot={import.meta.env.VITE_ADSENSE_SLOT_NEWSROOM_IN_FEED}
                            totalCount={newsTotalCount}
                            totalPages={newsTotalPages}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'governmentBriefings' ? (
                    <FadeIn className="page-content-enter">
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
                            sideAdSlot={import.meta.env.VITE_ADSENSE_SLOT_POLICY_BRIEFINGS_IN_FEED}
                            totalCount={governmentBriefingsTotalCount}
                            totalPages={governmentBriefingsTotalPages}
                        />
                    </FadeIn>
                ) : null}

                {activePage === 'serviceGuide' ? (
                    <FadeIn className="page-content-enter">
                        <ServiceGuidePageView />
                    </FadeIn>
                ) : null}

                {activePage === 'dataSources' ? (
                    <FadeIn className="page-content-enter">
                        <DataSourceGuideView dataSources={dataSources} />
                    </FadeIn>
                ) : null}

                {activePage === 'calculator' ? (
                    <CalculatorPage
                        calculatorMeta={dashboard?.exchangeRateCalculator ?? null}
                        rates={foreignExchangeRates}
                        sideAdSlot={tabAdSlots.calculator}
                    />
                ) : null}

                {activeMainTabKey && shouldRenderBottomAd(activeMainTabKey) ? (
                    <FadeIn as="section" className="page-content-enter" delay={0.2}>
                        <GoogleAdSlot
                            className="w-full"
                            minHeightClassName="min-h-28 sm:min-h-32"
                            slot={tabAdSlots[activeMainTabKey] ?? import.meta.env.VITE_ADSENSE_SLOT_TAB_DEFAULT}
                        />
                    </FadeIn>
                ) : null}

            </section>
            {activePage !== 'home' && activePage !== 'serviceGuide' ? <AppFooter onDataSourcesClick={() => navigatePage('dataSources')} /> : null}
            {isExchangeGuideOpen ? <ExchangeRateGuideModal onClose={() => setIsExchangeGuideOpen(false)} /> : null}
        </main>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

function RangeChangeSummary({ changeRate, rangeLabel }: { changeRate: number | null; rangeLabel: string }) {
    return (
        <span className="range-change-summary">
            <span>{rangeLabel}동안</span>
            <span className={getRangeChangeClass(changeRate)}>{formatRangeChangeRate(changeRate)}</span>
        </span>
    );
}

function getSeriesChangeRate(series: Array<{ value: number | null | undefined }>) {
    const validSeries = series.filter((point): point is { value: number } => typeof point.value === 'number' && Number.isFinite(point.value));
    const first = validSeries[0]?.value;
    const latest = validSeries[validSeries.length - 1]?.value;
    if (first === undefined || latest === undefined || first === 0) {
        return null;
    }
    return ((latest - first) / first) * 100;
}

function formatRangeChangeRate(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return '-';
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getRangeChangeClass(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return 'range-option-change-flat';
    }
    return value > 0 ? 'range-option-change-up' : 'range-option-change-down';
}

function DashboardMainChartSelect({
                                      onChange,
                                      value
                                  }: {
    onChange: (value: DashboardMainChartType) => void;
    value: DashboardMainChartType;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const options: Array<{ label: string; value: DashboardMainChartType }> = [
        { label: '원달러환율', value: 'usdKrw' },
        { label: '달러인덱스', value: 'dollarIndex' }
    ];
    const selected = options.find((option) => option.value === value) ?? options[0];

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeOnOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('pointerdown', closeOnOutside);
        return () => window.removeEventListener('pointerdown', closeOnOutside);
    }, [isOpen]);

    return (
        <div className="dashboard-chart-title-filter" ref={rootRef}>
            <button
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="dashboard-chart-title-trigger"
                onClick={() => setIsOpen((current) => !current)}
                type="button"
            >
                <span>{selected.label}</span>
                <span aria-hidden="true">⌄</span>
            </button>
            {isOpen ? (
                <div className="dashboard-chart-title-menu" role="listbox">
                    {options.map((option) => (
                        <button
                            aria-selected={option.value === value}
                            className="dashboard-chart-title-option"
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            role="option"
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CalculatorCurrencySelect({
                                      ariaLabel,
                                      onChange,
                                      options,
                                      value
                                  }: {
    ariaLabel: string;
    onChange: (value: string) => void;
    options: CalculatorCurrencySelectOption[];
    value: string;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const selected = options.find((option) => option.value === value) ?? options[0];

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeOnOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('pointerdown', closeOnOutside);
        return () => window.removeEventListener('pointerdown', closeOnOutside);
    }, [isOpen]);

    return (
        <div className="calculator-select relative min-w-0" ref={rootRef}>
            <button
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
                className="calculator-select-trigger glass-field h-9 w-full min-w-0 px-3 text-left text-sm font-semibold outline-none"
                onClick={() => setIsOpen((current) => !current)}
                type="button"
            >
                <span className="min-w-0 truncate">{selected?.label ?? '통화 선택'}</span>
                <span className="shrink-0 text-[0.72rem] text-teal-100" aria-hidden="true">⌄</span>
            </button>
            {isOpen ? (
                <div className="calculator-select-menu calculator-select-menu-wide" role="listbox">
                    {options.map((option) => (
                        <button
                            aria-selected={option.value === value}
                            className="calculator-select-option"
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            role="option"
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function DashboardTrumpSnsCard() {
    return (
        <article className="dashboard-coming-soon-card dashboard-trump-sns-card">
            <div className="dashboard-coming-soon-scanline" />
            <div className="dashboard-coming-soon-content">
                <div className="dashboard-coming-soon-header">
                    <span>COMING SOON</span>
                    <i aria-hidden="true" />
                </div>
                <div className="dashboard-coming-soon-body">
                    <h3>트럼프 SNS 소식</h3>
                    <p>발언, 정책 키워드, 환율 반응 연결 예정</p>
                </div>
            </div>
        </article>
    );
}

function shouldIgnoreTabSwipe(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(target.closest(
        'a, button, input, select, textarea, [role="button"], .chart-grid-surface, .related-news-banner, .calculator-tab-layout'
    ));
}

function CalculatorPage({
                            calculatorMeta,
                            rates,
                            sideAdSlot
                        }: {
    calculatorMeta?: DailyDashboardResponse['exchangeRateCalculator'] | null;
    rates: ForeignExchangeRate[];
    sideAdSlot?: string;
}) {
    const layoutRef = React.useRef<HTMLDivElement | null>(null);
    const [layoutHeight, setLayoutHeight] = React.useState<number | null>(null);

    React.useLayoutEffect(() => {
        const updateLayoutHeight = () => {
            const layout = layoutRef.current;

            if (!layout) {
                return;
            }

            const layoutTop = layout.getBoundingClientRect().top;
            const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
            setLayoutHeight(Math.max(460, Math.floor(viewportHeight - layoutTop - 12)));
        };

        updateLayoutHeight();
        const animationFrame = window.requestAnimationFrame(updateLayoutHeight);
        window.addEventListener('resize', updateLayoutHeight);
        window.visualViewport?.addEventListener('resize', updateLayoutHeight);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', updateLayoutHeight);
            window.visualViewport?.removeEventListener('resize', updateLayoutHeight);
        };
    }, []);

    return (
        <section className="grid gap-5">
            <FadeIn as="header" className="page-tab-header" delay={0}>
                <div className="min-w-0">
                    <p className="page-tab-eyebrow">CALCULATORS</p>
                    <h2 className="page-tab-title">환전계산</h2>
                    <p className="page-tab-description">
                        수수료와 은행별 스프레드를 제외한 기준 환율로 환전 금액과 환차익을 계산합니다.
                    </p>
                </div>
            </FadeIn>

            <div className="side-ad-layout side-ad-layout-calculator">
                <SideRailAd slot={sideAdSlot} />
                <div
                    className="calculator-tab-layout calculator-split-layout mx-auto grid w-full max-w-[76rem] min-w-0 gap-4 xl:grid-cols-[minmax(16rem,0.6fr)_minmax(34rem,1.4fr)] xl:items-stretch"
                    ref={layoutRef}
                    style={layoutHeight ? { height: `${layoutHeight}px` } : undefined}
                >
                    <section className="calculator-tab-panel calculator-left-panel calculator-panel-enter-left glass-modal min-w-0 overflow-hidden text-sm shadow-xl">
                        <div className="calculator-tab-panel-header">
                            <div>
                                <p className="calculator-tab-panel-kicker">현재 기준</p>
                                <h3 className="calculator-tab-panel-title">지금 환전하면 얼마인가요?</h3>
                            </div>
                            <span className="calculator-tab-panel-badge">실시간 기준 환율</span>
                        </div>
                        <section className="calculator-tab-conversion-card min-w-0 overflow-y-auto">
                            <ExchangeRateConversionCalculator rates={rates} />
                        </section>
                    </section>

                    <aside className="calculator-side-panel calculator-panel-enter-right glass-modal min-w-0 overflow-hidden text-sm shadow-xl">
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
                    </aside>
                </div>
                <SideRailAd slot={sideAdSlot} />
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
                            <span className="current-market-value shrink-0 text-xs font-bold">{formatValue(activeRate.dealBasRate, 2)}원</span>
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
                                <p className="current-market-value whitespace-nowrap text-sm font-bold">{formatValue(rate.dealBasRate, 2)}원</p>
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
    const availableRates = React.useMemo(() => [...rates], [rates]);

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
    const currencyOptions = React.useMemo<CalculatorCurrencySelectOption[]>(
        () => availableRates.map((rate) => ({
            label: `${getCurrencyFlag(rate.displayCode)} ${rate.displayCode} · ${getCurrencyShortLabel(rate.displayCode)}`,
            value: rate.currencyCode
        })),
        [availableRates]
    );

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
                    <h2 className="calculator-card-title">환전계산</h2>
                    <p className="calculator-card-description">현재 기준 환율로 환전 금액을 계산합니다.</p>
                </div>
                {onClose ? <button
                    aria-label="환전계산 닫기"
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
                        <CalculatorCurrencySelect
                            ariaLabel="현재 기준 통화 선택"
                            onChange={handleCurrencyChange}
                            options={currencyOptions}
                            value={selectedRate.currencyCode}
                        />
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
                            1 {selectedRate.displayCode} = <span className="current-market-value">{formatValue(selectedRate.dealBasRate / selectedRate.unitSize, 2)}원</span>
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

function ExchangeRateGuideModal({ onClose }: { onClose: () => void }) {
    return createPortal(
        <div className="modal-overlay responsive-modal-overlay fixed inset-0 z-[100] flex bg-zinc-950/35" onClick={onClose}>
            <div
                aria-modal="true"
                className="modal-panel glass-modal responsive-modal-panel overflow-hidden rounded-2xl text-sm shadow-xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <div className="modal-scroll-area responsive-modal-scroll p-4 sm:p-5 md:p-6">
                    <div className="mb-4 flex min-w-0 items-start justify-between gap-3 border-b border-zinc-200 pb-4">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-teal-700">EXCHANGE BASICS</p>
                            <h2 className="mt-1 text-xl font-semibold text-zinc-950">환율이란?</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-600">
                                환율은 외국 돈의 가격입니다. 숫자 하나가 여행 경비, 수입물가, 기업 실적, 투자 심리까지 연결됩니다.
                            </p>
                        </div>
                        <button
                            aria-label="환율 안내 닫기"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-lg font-semibold leading-none text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-950"
                            onClick={onClose}
                            type="button"
                        >
                            ×
                        </button>
                    </div>
                    <ExchangeRateGuidePageView showHeader={false} />
                </div>
            </div>
        </div>,
        document.body
    );
}
