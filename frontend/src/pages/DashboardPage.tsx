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
import { getCurrencyFlag, getCurrencyShortLabel } from '../utils/currency';
import {
    formatCompactRateDate,
    formatIndicatorMarketValue,
    formatSignedNumber,
    getImportantRecentBriefings,
    getImportantRecentNews,
    getMajorIndicatorChanges,
    getNumericChange,
    getDirectionTextClass,
    sortByRecent
} from '../utils/dashboardSummary';
import { formatValue } from '../utils/format';

type DashboardPageProps = {
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

export function DashboardPage({
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
                              }: DashboardPageProps) {
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
        animation: `dashboardFadeInUp 0.32s ease-out ${delay}s forwards`
    });

    return (
        <section className="grid min-w-0 gap-3">
            {/* CSS Keyframes (의존성 없이 작동하도록 내부 주입) */}
            <style>{`
        @keyframes dashboardFadeInUp {
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
                <div className="dashboard-gemini-desktop-slot min-w-0">
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

                <aside className="dashboard-market-indicator-column dashboard-mobile-coming-soon grid min-h-0 min-w-0 gap-3" style={fadeUpStyle('0.18')}>
                    <ComingSoonCard
                        body="주식 지수, 섹터 흐름, 주요 종목 이슈를 연결할 예정입니다."
                        className="dashboard-side-full-card dashboard-stock-coming-soon-card"
                        fill
                        title="주식시장 정보"
                    />
                    <MajorIndicatorChangesCard indicators={majorIndicatorChanges} />
                    <div className="dashboard-mobile-coming-soon-stack min-w-0">
                        <div className="dashboard-gemini-mobile-slot min-w-0">
                            <ComingSoonCard
                                body="환율·금리·뉴스 기반 리포트"
                                className="dashboard-gemini-card"
                                compact
                                title="Gemini 시장 리포트"
                                variant="gemini"
                            />
                        </div>
                        <ComingSoonCard
                            body="주식 지수, 섹터 흐름, 주요 종목 이슈를 연결할 예정입니다."
                            title="주식시장 정보"
                        />
                    </div>
                    {chartSupplement ? <div className="dashboard-trump-mobile-slot min-w-0">{chartSupplement}</div> : null}
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
                <div className={`dashboard-scroll-shadow-frame ${scrollShadow.shadowClassName}`}>
                    <ol className="news-card-list dashboard-scroll-shadow grid min-h-0 min-w-0 content-start gap-1 overflow-y-auto" ref={scrollShadow.ref}>
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
                </div>
            )}
        </section>
    );
}

function NewsFlowTitle({ title }: { title: string }) {
    const containerRef = React.useRef<HTMLSpanElement | null>(null);
    const textRef = React.useRef<HTMLSpanElement | null>(null);
    const [isOverflowing, setIsOverflowing] = React.useState(false);
    const [animationDuration, setAnimationDuration] = React.useState('9s');

    React.useLayoutEffect(() => {
        const measure = () => {
            const container = containerRef.current;
            const text = textRef.current;
            if (!container || !text) {
                return;
            }
            const nextIsOverflowing = text.scrollWidth > container.clientWidth + 2;
            setIsOverflowing(nextIsOverflowing);

            if (nextIsOverflowing) {
                const track = text.parentElement;
                const gap = track ? Number.parseFloat(window.getComputedStyle(track).columnGap || '0') || 0 : 0;
                const scrollDistance = text.scrollWidth + gap;
                const seconds = Math.min(24, Math.max(9.5, scrollDistance / 28));
                setAnimationDuration(`${seconds.toFixed(2)}s`);
            }
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [title]);

    return (
        <span
            className={`news-flow-title block text-[11px] font-extrabold leading-5 text-zinc-950 ${isOverflowing ? 'news-flow-title-overflow' : ''}`}
            ref={containerRef}
            style={{ '--news-title-flow-duration': animationDuration } as React.CSSProperties}
        >
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
                <div className={`dashboard-scroll-shadow-frame ${scrollShadow.shadowClassName}`}>
                    <div className="dashboard-scroll-shadow grid min-h-0 min-w-0 content-start gap-1.5 overflow-y-auto pr-1" ref={scrollShadow.ref}>
                    {indicators.map((indicator) => {
                        const change = getNumericChange(indicator);
                        return (
                            <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 px-2.5 py-2" key={indicator.code}>
                                <span className="grid min-w-0 content-center">
                                    <span className="block truncate text-[11px] font-bold leading-none text-zinc-950">{indicator.title}</span>
                                    <span className="mt-1 block truncate text-[9px] font-medium leading-none text-zinc-400">기준 {indicator.baseDate ?? '-'}</span>
                                </span>
                                <span className="grid justify-items-end gap-0.5">
                                    <span className="current-market-value whitespace-nowrap text-xs font-extrabold">{formatIndicatorMarketValue(indicator)}</span>
                                    <span className={`text-[10px] font-extrabold ${getDirectionTextClass(change)}`}>
                                        {formatSignedNumber(change)}
                                    </span>
                                </span>
                            </article>
                        );
                    })}
                    </div>
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
                <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">환율 · 달러인덱스 변동표</h3>
            </div>
            <div className="change-comparison-table-wrap min-w-0 overflow-hidden border border-zinc-100 bg-zinc-50/70">
                <table className="change-comparison-table w-full table-fixed border-collapse">
                    <colgroup>
                        <col className="w-[34%]" />
                        <col className="w-[33%]" />
                        <col className="w-[33%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col">기간</th>
                            <th scope="col">환율</th>
                            <th scope="col">DXY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.label}>
                                <th scope="row">{row.label}</th>
                                <ChangeComparisonValue value={row.usdKrwChangeRate} />
                                <ChangeComparisonValue value={row.dollarIndexChangeRate} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function ChangeComparisonValue({ value }: { value: number | null }) {
    return (
        <td className={`text-right ${getPercentTextClass(value)}`}>{formatChangePercent(value)}</td>
    );
}

function ForeignExchangeRateCard({ className = '', rates }: { className?: string; rates: ForeignExchangeRate[] }) {
    const scrollShadow = useDashboardScrollShadow<HTMLDivElement>(rates.length);

    return (
        <section className={`glass-card grid max-h-[19rem] min-h-64 grid-rows-[auto_minmax(0,1fr)] border border-zinc-100 p-3.5 shadow-sm ${className}`}>
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">FX RATES</p>
                    <h3 className="mt-0.5 text-base font-extrabold text-zinc-950">각국 통화환율</h3>
                </div>
                <span className="bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">{rates.length}개</span>
            </div>
            {rates.length === 0 ? (
                <EmptyState text="환율 데이터 대기" />
            ) : (
                <div className={`dashboard-scroll-shadow-frame ${scrollShadow.shadowClassName}`}>
                    <div className="dashboard-fx-rate-list dashboard-scroll-shadow grid min-h-0 min-w-0 content-start gap-1.5 overflow-y-auto" ref={scrollShadow.ref}>
                    {rates.map((rate) => (
                        <article className="dashboard-fx-rate-row grid min-w-0 grid-cols-[1.55rem_minmax(0,1fr)_auto] items-center gap-2 border border-zinc-100 bg-zinc-50/70 px-2.5 py-2" key={rate.currencyCode}>
                            <span className="text-base leading-none" aria-hidden="true">
                                {getCurrencyFlag(rate.displayCode, '¤')}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[11px] font-bold leading-4 text-zinc-950">{getCurrencyShortLabel(rate.displayCode)}</span>
                                <span className="block truncate text-[10px] font-semibold leading-3 text-zinc-500">{formatCompactRateDate(rate.fetchedAt)}</span>
                            </span>
                            <span className="current-market-value whitespace-nowrap text-xs font-extrabold">{formatValue(rate.dealBasRate, 2)}</span>
                        </article>
                    ))}
                    </div>
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
    return value > 0 ? 'change-rate-up' : 'change-rate-down';
}
