import React from 'react';
import { RelatedNewsBanner, type RelatedBannerArticle } from '../components/RelatedNewsBanner';
import type {
    ContentSyncStatus,
    DailyDashboardResponse,
    DomesticIndicator,
    ForeignExchangeRate,
    GovernmentBriefingArticle,
    NewsArticle
} from '../types';
import { formatValue } from '../utils/format';

type TodayFlowPageProps = {
    dashboard: DailyDashboardResponse | null;
    dashboardEmptyText: string;
    dashboardLoadState: 'idle' | 'loading' | 'ready' | 'error';
    changeComparisonRows: ChangeComparisonRow[];
    foreignExchangeRates: ForeignExchangeRate[];
    governmentBriefings: GovernmentBriefingArticle[];
    governmentBriefingsConfigured: boolean;
    governmentBriefingsSyncStatus: ContentSyncStatus | null;
    newsArticles: NewsArticle[];
    newsConfigured: boolean;
    newsSyncStatus: ContentSyncStatus | null;
    chartSupplement?: React.ReactNode;
    usdKrwChart: React.ReactNode;
};

type Direction = 'up' | 'down' | 'flat' | 'unknown';
type ChangeComparisonRow = {
    dollarIndexChangeRate: number | null;
    label: string;
    usdKrwChangeRate: number | null;
};

function useDashboardScrollShadow<T extends HTMLElement>(dependencyKey: unknown) {
    const ref = React.useRef<T | null>(null);
    const [shadowClassName, setShadowClassName] = React.useState('');

    React.useLayoutEffect(() => {
        const element = ref.current;

        if (!element) {
            setShadowClassName('');
            return undefined;
        }

        const updateShadow = () => {
            const maxScrollTop = element.scrollHeight - element.clientHeight;

            if (maxScrollTop <= 1) {
                setShadowClassName('');
                return;
            }

            const showTop = element.scrollTop > 1;
            const showBottom = element.scrollTop < maxScrollTop - 1;
            setShadowClassName([
                showTop ? 'dashboard-scroll-shadow-top' : '',
                showBottom ? 'dashboard-scroll-shadow-bottom' : ''
            ].filter(Boolean).join(' '));
        };

        updateShadow();
        const resizeObserver = new ResizeObserver(updateShadow);
        resizeObserver.observe(element);
        window.addEventListener('resize', updateShadow);
        element.addEventListener('scroll', updateShadow, { passive: true });

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateShadow);
            element.removeEventListener('scroll', updateShadow);
        };
    }, [dependencyKey]);

    return { ref, shadowClassName };
}

export function TodayFlowPage({
                                  dashboard,
                                  dashboardEmptyText,
                                  dashboardLoadState,
                                  changeComparisonRows,
                                  foreignExchangeRates,
                                  governmentBriefings,
                                  newsArticles,
                                  newsConfigured,
                                  chartSupplement,
                                  usdKrwChart
                              }: TodayFlowPageProps) {
    const majorIndicatorChanges = getMajorIndicatorChanges(dashboard?.domesticIndicators ?? []);
    const latestNews = React.useMemo(() => sortByRecent(newsArticles).slice(0, 9), [newsArticles]);
    const importantNews = React.useMemo(() => getImportantRecentNews(newsArticles, 8), [newsArticles]);
    const importantBriefings = React.useMemo(() => getImportantRecentBriefings(governmentBriefings, 8), [governmentBriefings]);
    const fallbackNewsBannerArticles: RelatedBannerArticle[] = React.useMemo(() => latestNews.map((article) => ({
        ...article,
        categoryName: article.categoryName || '뉴스'
    })), [latestNews]);
    // 애니메이션용 인라인 스타일 헬퍼
    const fadeUpStyle = (delay: string) => ({
        opacity: 0,
        animation: `todayFlowFadeInUp 0.32s ease-out ${delay}s forwards`
    });

    return (
        <section className="grid min-w-0 gap-3">
            {/* CSS Keyframes (의존성 없이 작동하도록 내부 주입) */}
            <style>{`
        @keyframes todayFlowFadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            <section className="dashboard-top-strip grid min-w-0 gap-3 px-3 sm:px-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1fr)]" style={fadeUpStyle('0')}>
                <div className="min-w-0 xl:max-w-[calc(50vw-1.25rem)]">
                    {newsConfigured ? (
                        <RelatedNewsBanner
                            configured={newsConfigured}
                            desktopGroupSize={3}
                            fallbackArticles={fallbackNewsBannerArticles}
                            label="뉴스룸 배너"
                            topic="exchange"
                        />
                    ) : (
                        <EmptyState text={newsConfigured ? '최근 뉴스 수집 대기' : '뉴스 수집 설정 확인 중'} />
                    )}
                </div>
                <div className="min-w-0">
                    <ComingSoonCard
                        body="환율·금리·뉴스 기반 리포트"
                        className="dashboard-gemini-card"
                        compact
                        fill
                        title="Gemini 시장 리포트"
                        variant="gemini"
                    />
                </div>
            </section>

            <section className="dashboard-main-grid grid min-w-0 gap-3 px-3 sm:px-4 xl:grid-cols-[minmax(11rem,0.42fr)_minmax(0,1.2fr)_minmax(12rem,0.48fr)_minmax(12rem,0.48fr)]">
                <section className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-2" style={fadeUpStyle('0.08')}>
                    <NewsListCard
                        emptyText={newsConfigured ? '최근 7일 경제뉴스 대기' : '뉴스 수집 설정 확인 중'}
                        items={importantNews.map((article) => ({
                            href: article.originLink ?? article.link,
                            meta: article.publisher ?? article.categoryName,
                            title: article.title
                        }))}
                        kicker="ECONOMY"
                        title="경제뉴스"
                    />
                    <NewsListCard
                        emptyText="최근 7일 정책뉴스 대기"
                        items={importantBriefings.map((article) => ({
                            href: article.originalUrl ?? undefined,
                            meta: article.ministry ?? article.category ?? '정책브리핑',
                            title: article.title
                        }))}
                        kicker="POLICY"
                        title="정책뉴스"
                    />
                </section>

                <section className="dashboard-chart-stack grid min-w-0 gap-3" style={fadeUpStyle('0.1')}>
                    {usdKrwChart}
                    {chartSupplement ? <div className="dashboard-chart-supplement min-w-0">{chartSupplement}</div> : null}
                </section>

                <aside className="dashboard-fx-column grid min-h-0 min-w-0 gap-3" style={fadeUpStyle('0.16')}>
                    <ChangeComparisonCard rows={changeComparisonRows} />
                    <ForeignExchangeRateCard className="dashboard-fx-full-card" rates={foreignExchangeRates} />
                </aside>

                <aside className="dashboard-market-indicator-column grid min-h-0 min-w-0 gap-3" style={fadeUpStyle('0.18')}>
                    <ComingSoonCard
                        body="주식 지수, 섹터 흐름, 주요 종목 이슈를 연결할 예정입니다."
                        className="dashboard-side-full-card"
                        fill
                        title="주식시장 정보"
                    />
                    <MajorIndicatorChangesCard indicators={majorIndicatorChanges} />
                </aside>
            </section>

            {dashboardLoadState === 'error' && !dashboard ? (
                <section className="glass-card rounded-2xl p-5 text-sm font-medium text-zinc-700" style={fadeUpStyle('0.4')}>
                    {dashboardEmptyText}
                </section>
            ) : null}

        </section>
    );
}

// ==========================================
// Sub Components
// ==========================================

function NewsListCard({
                          emptyText,
                          items,
                          kicker,
                          title
                      }: {
    emptyText: string;
    items: Array<{ href?: string; meta?: string | null; title: string }>;
    kicker: string;
    title: string;
}) {
    const scrollShadow = useDashboardScrollShadow<HTMLOListElement>(items.length);

    return (
        <section className="glass-card grid h-[15rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] border border-zinc-100 p-3 shadow-sm xl:h-full">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{kicker}</p>
                    <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">{title}</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-500">{items.length}개</span>
            </div>
            {items.length === 0 ? (
                <EmptyState text={emptyText} />
            ) : (
                <ol className={`news-card-list dashboard-scroll-shadow ${scrollShadow.shadowClassName} grid min-h-0 min-w-0 content-start gap-1 overflow-y-auto`} ref={scrollShadow.ref}>
                    {items.map((item, index) => {
                        const content = (
                            <>
                                <span className="shrink-0 text-[10px] font-bold text-teal-600">{String(index + 1).padStart(2, '0')}</span>
                                <span className="min-w-0">
                                    <NewsFlowTitle title={item.title} />
                                    <span className="block truncate text-[9px] font-semibold leading-4 text-zinc-500">{item.meta ?? '-'}</span>
                                </span>
                            </>
                        );
                        return (
                            <li key={`${title}-${item.title}-${index}`}>
                                {item.href ? (
                                    <a className="grid min-w-0 grid-cols-[1.7rem_minmax(0,1fr)] items-start gap-2 border border-zinc-100 bg-zinc-50/70 px-2.5 py-1.5 hover:border-teal-400 hover:bg-teal-500/10" href={item.href} rel="noreferrer" target="_blank">
                                        {content}
                                    </a>
                                ) : (
                                    <div className="grid min-w-0 grid-cols-[1.7rem_minmax(0,1fr)] items-start gap-2 border border-zinc-100 bg-zinc-50/70 px-2.5 py-1.5">
                                        {content}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function NewsFlowTitle({ title }: { title: string }) {
    const containerRef = React.useRef<HTMLSpanElement | null>(null);
    const textRef = React.useRef<HTMLSpanElement | null>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);

    React.useLayoutEffect(() => {
        const measure = () => {
            const container = containerRef.current;
            const text = textRef.current;
            if (!container || !text) {
                return;
            }
            setIsOverflowing(text.scrollWidth > container.clientWidth + 2);
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [title]);

    return (
        <span className={`news-flow-title block text-[11px] font-extrabold leading-5 text-zinc-950 ${isOverflowing ? 'news-flow-title-overflow' : ''}`} ref={containerRef}>
            <span className="news-flow-track">
                <span ref={textRef}>{title}</span>
                {isOverflowing ? <span aria-hidden="true">{title}</span> : null}
            </span>
        </span>
    );
}

function MajorIndicatorChangesCard({ indicators }: { indicators: DomesticIndicator[] }) {
    const scrollShadow = useDashboardScrollShadow<HTMLDivElement>(indicators.length);

    return (
        <section className="glass-card grid h-full min-h-32 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-zinc-100 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">DAILY INDICATORS</p>
                    <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">주요지표 변동</h3>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">{indicators.length}개</span>
            </div>
            {indicators.length === 0 ? (
                <EmptyState text="시장 지표 데이터 대기" />
            ) : (
                <div className={`dashboard-scroll-shadow ${scrollShadow.shadowClassName} grid min-h-0 min-w-0 content-start gap-1.5 overflow-y-auto pr-1`} ref={scrollShadow.ref}>
                    {indicators.map((indicator) => {
                        const change = getNumericChange(indicator);
                        return (
                            <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 px-2.5 py-2" key={indicator.code}>
                                <span className="grid min-w-0 content-center">
                                    <span className="block truncate text-[11px] font-bold leading-none text-zinc-950">{indicator.title}</span>
                                    <span className="mt-1 block truncate text-[9px] font-medium leading-none text-zinc-400">기준 {indicator.baseDate ?? '-'}</span>
                                </span>
                                <span className="grid justify-items-end gap-0.5">
                                    <span className="whitespace-nowrap text-xs font-extrabold text-white">{formatIndicatorMarketValue(indicator)}</span>
                                    <span className={`text-[10px] font-extrabold ${getDirectionTextClass(change)}`}>
                                        {formatSignedNumber(change)}
                                    </span>
                                </span>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function ComingSoonCard({
                            body,
                            className = '',
                            compact = false,
                            fill = false,
                            tall = false,
                            title,
                            variant = 'default'
                        }: {
    body: string;
    className?: string;
    compact?: boolean;
    fill?: boolean;
    tall?: boolean;
    title: string;
    variant?: 'default' | 'gemini';
}) {
    const isGemini = variant === 'gemini';

    return (
        <section className={`dashboard-coming-soon-card ${isGemini ? 'dashboard-coming-soon-card-gemini' : ''} ${fill ? 'dashboard-coming-soon-fill' : tall ? 'dashboard-coming-soon-tall' : compact ? 'dashboard-coming-soon-compact' : ''} ${className}`}>
            <div className="dashboard-coming-soon-scanline" />
            <div className="dashboard-coming-soon-content">
                <div className="dashboard-coming-soon-header">
                    <span>COMING SOON</span>
                    <i aria-hidden="true" />
                </div>
                <div className="dashboard-coming-soon-body">
                    <h3>{title}</h3>
                    <p className={compact ? 'line-clamp-1' : ''}>{body}</p>
                </div>
            </div>
        </section>
    );
}

function ChangeComparisonCard({ rows }: { rows: ChangeComparisonRow[] }) {
    return (
        <section className="glass-card dashboard-change-comparison-card grid min-w-0 border border-zinc-100 p-3 shadow-sm">
            <div className="mb-2 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">CHANGE MAP</p>
                <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">환율 · 달러인덱스</h3>
            </div>
            <div className="grid min-w-0 gap-1.5">
                {rows.map((row) => (
                    <article className="grid min-w-0 grid-cols-[2.2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 border border-zinc-100 bg-zinc-50/70 px-2 py-1.5" key={row.label}>
                        <span className="text-[10px] font-extrabold text-white">{row.label}</span>
                        <ChangeComparisonValue label="환율" value={row.usdKrwChangeRate} />
                        <ChangeComparisonValue label="DXY" value={row.dollarIndexChangeRate} />
                    </article>
                ))}
            </div>
        </section>
    );
}

function ChangeComparisonValue({ label, value }: { label: string; value: number | null }) {
    return (
        <span className="grid min-w-0 gap-0.5 text-right">
            <span className="text-[9px] font-medium leading-none text-zinc-500">{label}</span>
            <span className={`text-[10px] font-extrabold leading-none ${getPercentTextClass(value)}`}>{formatChangePercent(value)}</span>
        </span>
    );
}

function ForeignExchangeRateCard({ className = '', rates }: { className?: string; rates: ForeignExchangeRate[] }) {
    const scrollShadow = useDashboardScrollShadow<HTMLDivElement>(rates.length);

    return (
        <section className={`glass-card grid max-h-[17rem] min-h-56 grid-rows-[auto_minmax(0,1fr)] border border-zinc-100 p-3 shadow-sm ${className}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">FX RATES</p>
                    <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">각국 통화환율</h3>
                </div>
                <span className="bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">{rates.length}개</span>
            </div>
            {rates.length === 0 ? (
                <EmptyState text="환율 데이터 대기" />
            ) : (
                <div className={`dashboard-fx-rate-list dashboard-scroll-shadow ${scrollShadow.shadowClassName} grid min-h-0 min-w-0 content-start gap-1 overflow-y-auto`} ref={scrollShadow.ref}>
                    {rates.map((rate) => (
                        <article className="dashboard-fx-rate-row grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-1.5 border border-zinc-100 bg-zinc-50/70 px-2 py-1.5" key={rate.currencyCode}>
                            <span className="text-sm leading-none" aria-hidden="true">
                                {getCurrencyFlag(rate.displayCode)}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[10px] font-bold leading-4 text-zinc-950">{getCurrencyShortLabel(rate.displayCode)}</span>
                                <span className="block truncate text-[9px] font-semibold leading-3 text-zinc-500">{formatCompactRateDate(rate.fetchedAt)}</span>
                            </span>
                            <span className="whitespace-nowrap text-[11px] font-extrabold text-teal-700">{formatValue(rate.dealBasRate, 2)}</span>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="grid min-h-24 place-items-center rounded-xl bg-zinc-50 px-4 text-center text-sm font-medium text-zinc-500">{text}</div>;
}

function formatChangePercent(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return '-';
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getPercentTextClass(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return 'text-zinc-500';
    }
    return value > 0 ? 'text-teal-400' : 'text-rose-400';
}

// ==========================================
// Utils & Helpers
// ==========================================

function getMajorIndicatorChanges(indicators: DomesticIndicator[]) {
    const dailyPriority = [
        'US_TREASURY_2Y',
        'US_10Y_TREASURY',
        'SOFR',
        'SOFR_30D_AVG',
        'KOFR',
        'CD_91D',
        'VIX',
        'WTI_OIL',
        'GLOBAL_CREDIT_SPREAD_PROXY'
    ];
    const eventDrivenPriority = [
        'KR_POLICY_RATE',
        'US_POLICY_RATE',
        'KR_US_RATE_GAP',
        'M2',
        'FOREIGN_RESERVES',
        'RESERVES_TO_SHORT_TERM_DEBT',
        'CURRENT_ACCOUNT',
        'GOODS_ACCOUNT',
        'TRADE_BALANCE',
        'FISCAL_BALANCE',
        'GOVERNMENT_DEBT'
    ];
    const dailyOrder = new Map(dailyPriority.map((code, index) => [code, index]));
    const eventOrder = new Map(eventDrivenPriority.map((code, index) => [code, index]));

    const eventDrivenChanges = indicators
        .filter((indicator) => eventOrder.has(indicator.code) && isRecentlyChangedIndicator(indicator))
        .sort((a, b) => (eventOrder.get(a.code) ?? 999) - (eventOrder.get(b.code) ?? 999));
    const dailyIndicators = indicators
        .filter((indicator) => dailyOrder.has(indicator.code) && indicator.value !== null)
        .sort((a, b) => (dailyOrder.get(a.code) ?? 999) - (dailyOrder.get(b.code) ?? 999));

    return [...eventDrivenChanges, ...dailyIndicators].slice(0, 10);
}

function isRecentlyChangedIndicator(indicator: DomesticIndicator) {
    if (indicator.value === null || indicator.previousValue === null || indicator.value === indicator.previousValue) {
        return false;
    }
    if (!indicator.baseDate) {
        return false;
    }

    const baseDateTime = new Date(`${indicator.baseDate}T00:00:00+09:00`).getTime();
    if (!Number.isFinite(baseDateTime)) {
        return false;
    }

    return Date.now() - baseDateTime <= 3 * 24 * 60 * 60 * 1000;
}

function getNumericChange(indicator: DomesticIndicator) {
    if (indicator.value === null || indicator.previousValue === null) {
        return null;
    }
    return indicator.value - indicator.previousValue;
}

function formatIndicatorMarketValue(indicator: DomesticIndicator) {
    if (indicator.value === null) {
        return '-';
    }

    const suffix = indicator.unit === 'PERCENT' || indicator.unit === 'PERCENT_POINT'
        ? '%'
        : indicator.unit === 'INDEX'
            ? ''
            : indicator.unit === 'USD'
                ? '달러'
                : '';
    return `${formatValue(indicator.value, indicator.unit === 'INDEX' || indicator.unit === 'USD' ? 2 : 2)}${suffix}`;
}

function formatSignedNumber(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return '-';
    }
    return `${value >= 0 ? '+' : ''}${formatValue(value, 2)}`;
}

function getDirectionTextClass(value: number | null) {
    if (value === null || !Number.isFinite(value) || value === 0) {
        return 'text-zinc-500';
    }
    return value > 0 ? 'text-teal-400' : 'text-rose-400';
}

function getDirection(changeRate: number | null): Direction {
    if (changeRate === null || !Number.isFinite(changeRate)) {
        return 'unknown';
    }
    if (changeRate > 0.03) {
        return 'up';
    }
    if (changeRate < -0.03) {
        return 'down';
    }
    return 'flat';
}

function getDirectionLabel(direction: Direction) {
    switch (direction) {
        case 'up':
            return '상승';
        case 'down':
            return '하락';
        case 'flat':
            return '보합';
        default:
            return '대기';
    }
}

function getDirectionBadgeClass(direction: Direction) {
    if (direction === 'up') {
        return 'bg-rose-50 text-rose-700';
    }
    if (direction === 'down') {
        return 'bg-blue-50 text-blue-700';
    }
    return 'bg-zinc-100 text-zinc-600';
}

function formatPercentChange(value: number | null) {
    if (value === null || !Number.isFinite(value)) {
        return '-';
    }
    return `${value >= 0 ? '+' : ''}${formatValue(value, 2)}%`;
}

function getImportantRecentNews(items: NewsArticle[], limit: number) {
    return getRecentPriorityItems(items, limit, (item) => [
        item.title,
        item.description ?? '',
        item.aiSummary ?? '',
        item.marketSentiment ?? ''
    ].join(' '), (item) => (
        (item.aiSummary ? 2 : 0) + (item.marketSentiment ? 1 : 0)
    ));
}

function getImportantRecentBriefings(items: GovernmentBriefingArticle[], limit: number) {
    return getRecentPriorityItems(items, limit, (item) => [
        item.title,
        item.subtitle ?? '',
        item.ministry ?? '',
        item.category ?? ''
    ].join(' '), (item) => (
        item.ministry ? 1 : 0
    ));
}

function getRecentPriorityItems<T extends { fetchedAt: string; publishedAt?: string | null }>(
    items: T[],
    limit: number,
    getText: (item: T) => string,
    getBaseScore: (item: T) => number
) {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const recentItems = items.filter((item) => {
        const time = getItemTime(item);
        return Number.isFinite(time) && now - time <= weekMs;
    });
    const candidates = recentItems.length > 0 ? recentItems : items;

    return [...candidates]
        .sort((a, b) => getPriorityScore(b, now, getText(b), getBaseScore(b)) - getPriorityScore(a, now, getText(a), getBaseScore(a)))
        .slice(0, limit);
}

function getPriorityScore(item: { fetchedAt: string; publishedAt?: string | null }, now: number, text: string, baseScore: number) {
    const normalizedText = text.toLowerCase();
    const keywordScore = importantNewsKeywords.reduce((score, keyword) => (
        normalizedText.includes(keyword.toLowerCase()) ? score + 2 : score
    ), 0);
    const ageHours = Math.max(0, (now - getItemTime(item)) / (60 * 60 * 1000));
    const recencyScore = Math.max(0, 8 - ageHours / 12);
    return baseScore + keywordScore + recencyScore;
}

const importantNewsKeywords = [
    '환율',
    '원/달러',
    '달러',
    '금리',
    '물가',
    '인플레이션',
    '무역수지',
    '경상수지',
    '외환',
    '유가',
    '증시',
    '채권',
    'fomc',
    'fed',
    '한국은행',
    '기획재정부',
    '관세',
    '수출',
    '수입'
];

function sortByRecent<T extends { fetchedAt: string; publishedAt?: string | null }>(items: T[]) {
    return [...items].sort((a, b) => getItemTime(b) - getItemTime(a));
}

function getItemTime(item: { fetchedAt: string; publishedAt?: string | null }) {
    return new Date(item.publishedAt ?? item.fetchedAt).getTime();
}

function formatCompactRateDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 10);
    }
    return new Intl.DateTimeFormat('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul'
    }).format(date);
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

    return flags[code] ?? '¤';
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
