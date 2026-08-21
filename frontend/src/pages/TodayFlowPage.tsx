import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RelatedNewsBanner, type RelatedBannerArticle } from '../components/RelatedNewsBanner';
import type {
    ContentSyncStatus,
    DailyDashboardResponse,
    DomesticIndicator,
    ForeignExchangeRate,
    GovernmentBriefingArticle,
    MetricSnapshot,
    NewsArticle,
    TimeSeriesPoint
} from '../types';
import { formatMetricValue, formatValue } from '../utils/format';
import { getSeoulDateString } from '../utils/time';

type TodayFlowPageProps = {
    dashboard: DailyDashboardResponse | null;
    dashboardEmptyText: string;
    dashboardLoadState: 'idle' | 'loading' | 'ready' | 'error';
    governmentBriefings: GovernmentBriefingArticle[];
    governmentBriefingsConfigured: boolean;
    governmentBriefingsSyncStatus: ContentSyncStatus | null;
    foreignExchangeRates: ForeignExchangeRate[];
    newsArticles: NewsArticle[];
    newsConfigured: boolean;
    newsSyncStatus: ContentSyncStatus | null;
};

type Direction = 'up' | 'down' | 'flat' | 'unknown';
type PositionBand = 'top' | 'middle' | 'bottom' | 'unknown';

export function TodayFlowPage({
                                  dashboard,
                                  dashboardEmptyText,
                                  dashboardLoadState,
                                  foreignExchangeRates,
                                  governmentBriefings,
                                  newsArticles,
                                  newsConfigured
                              }: TodayFlowPageProps) {
    const today = getSeoulDateString(new Date());
    const metrics = dashboard?.metrics ?? [];
    const usdKrwMetric = metrics.find((metric) => metric.code === 'USD/KRW') ?? null;
    const dollarMetric = metrics.find((metric) => metric.code === 'BROAD_DOLLAR_INDEX')
        ?? metrics.find((metric) => metric.code === 'ADVANCED_DOLLAR_INDEX')
        ?? null;
    const usdKrwThreeMonthPosition = getPositionBand((dashboard?.usdKrwSeries ?? []).slice(-66), usdKrwMetric?.value ?? null);
    const majorIndicatorChanges = getMajorIndicatorChanges(dashboard?.domesticIndicators ?? []);
    const latestNews = React.useMemo(() => sortByRecent(newsArticles).slice(0, 9), [newsArticles]);
    const todayBriefingCount = governmentBriefings.filter((article) => isToday(article.publishedAt ?? article.fetchedAt, today)).length;
    const activeDollarSeries = dashboard?.dollarIndexSeries?.length
        ? dashboard.dollarIndexSeries
        : dashboard?.dxyIndexSeries ?? [];
    const previousDollarPoint = activeDollarSeries.length >= 2 ? activeDollarSeries[activeDollarSeries.length - 2] : null;
    const latestDollarPoint = activeDollarSeries[activeDollarSeries.length - 1] ?? null;
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

            <header className="page-tab-header today-flow-header" style={fadeUpStyle('0')}>
                <div className="min-w-0">
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
            </header>

            <section className="grid min-w-0 items-stretch gap-3 xl:h-[30rem] xl:grid-cols-[21rem_minmax(0,1fr)_20rem]">
                <section className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]" style={fadeUpStyle('0.1')}>
                    <div className="grid min-w-0 grid-cols-2 gap-3">
                        <TodayPolicyBriefingCard
                            count={todayBriefingCount}
                        />
                        <DollarIndexCard
                            latestPoint={latestDollarPoint}
                            metric={dollarMetric}
                            previousPoint={previousDollarPoint}
                        />
                    </div>
                    <MiniSparkline
                        caption={getThreeMonthFlowText(usdKrwThreeMonthPosition)}
                        compact
                        label="최근 3개월 환율 흐름"
                        metric={usdKrwMetric}
                        series={(dashboard?.usdKrwSeries ?? []).slice(-66)}
                    />
                    <ComingSoonCard
                        body="SNS 발언과 시장 반응을 분리해서 표시할 예정입니다."
                        fill
                        title="트럼프 SNS"
                    />
                </section>

                <section className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]" style={fadeUpStyle('0.2')}>
                    <ComingSoonCard
                        body="환율·금리·뉴스 기반 리포트"
                        compact
                        title="Gemini 시장 리포트"
                        variant="gemini"
                    />
                    <div className="grid min-h-0 min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)]">
                        <MajorIndicatorChangesCard indicators={majorIndicatorChanges} />
                        <ForeignExchangeRateCard rates={foreignExchangeRates} />
                    </div>
                </section>

                <section className="grid min-h-0 min-w-0" style={fadeUpStyle('0.2')}>
                    <ComingSoonCard
                        body="주식 지수, 섹터 흐름, 주요 종목 이슈를 대시보드 신호와 함께 연결할 예정입니다."
                        fill
                        tall
                        title="주식시장 소식"
                    />
                </section>
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

function TodayPolicyBriefingCard({ count }: { count: number }) {
    return (
        <article className="glass-card grid min-h-28 min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-zinc-100 p-3 shadow-sm">
            <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-500">정책뉴스 업데이트</p>
            </div>
            <div className="flex min-w-0 items-center justify-center gap-1 text-rose-700">
                <span className="text-4xl font-black leading-none tracking-normal">{count}</span>
                <span className="pt-3 text-sm font-extrabold">건</span>
            </div>
        </article>
    );
}

function DollarIndexCard({ latestPoint, metric, previousPoint }: { latestPoint: TimeSeriesPoint | null; metric: MetricSnapshot | null; previousPoint: TimeSeriesPoint | null }) {
    const direction = getDirection(metric?.changeRate ?? null);

    return (
        <article className="glass-card grid min-h-28 min-w-0 rounded-2xl border border-zinc-100 p-3 shadow-sm">
            <div className="grid min-w-0 grid-cols-2 gap-2 text-[10px] font-bold text-zinc-400">
                <div className="min-w-0">
                    <p className="truncate">이전 기준일</p>
                    <p className="mt-0.5 truncate text-zinc-700">{previousPoint?.baseDate ?? '-'}</p>
                </div>
                <div className="min-w-0 text-right">
                    <p className="truncate">최근 기준일</p>
                    <p className="mt-0.5 truncate text-zinc-700">{latestPoint?.baseDate ?? '-'}</p>
                </div>
            </div>
            <div className="mt-2 min-w-0 self-end">
                <p className="truncate text-xs font-bold text-zinc-500">달러인덱스</p>
                <div className="mt-1 flex min-w-0 items-end gap-1.5">
                    <p className="min-w-0 truncate text-2xl font-black leading-none tracking-normal text-zinc-950">{metric ? formatMetricValue(metric) : '-'}</p>
                    <span className={`mb-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${getDirectionBadgeClass(direction)}`}>
                        {formatPercentChange(metric?.changeRate ?? null)}
                    </span>
                </div>
            </div>
        </article>
    );
}

function MajorIndicatorChangesCard({ indicators }: { indicators: DomesticIndicator[] }) {
    return (
        <section className="glass-card grid min-h-32 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-zinc-100 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">DAILY INDICATORS</p>
                    <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">오늘의 주요지표 변동</h3>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">{indicators.length}개</span>
            </div>
            {indicators.length === 0 ? (
                <EmptyState text="시장 지표 데이터 대기" />
            ) : (
                <div className="scrollbar-none grid min-h-0 min-w-0 content-start gap-1.5 overflow-y-auto pr-1">
                    {indicators.map((indicator) => {
                        const change = getNumericChange(indicator);
                        return (
                            <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 px-2.5 py-2" key={indicator.code}>
                                <span className="grid min-w-0 content-center">
                                    <span className="block truncate text-[11px] font-bold leading-none text-zinc-950">{indicator.title}</span>
                                    <span className="mt-1 block truncate text-[9px] font-medium leading-none text-zinc-400">기준 {indicator.baseDate ?? '-'}</span>
                                </span>
                                <span className="grid justify-items-end gap-0.5">
                                    <span className="whitespace-nowrap text-xs font-extrabold text-teal-700">{formatIndicatorMarketValue(indicator)}</span>
                                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${getDirectionBadgeClass(change !== null && change > 0 ? 'up' : change !== null && change < 0 ? 'down' : 'unknown')}`}>
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

function MiniSparkline({ caption, compact = false, fill = false, label, metric, series }: { caption: string; compact?: boolean; fill?: boolean; label: string; metric: MetricSnapshot | null; series: TimeSeriesPoint[] }) {
    const chartData = series.slice(-48).map((point, index) => ({
        ...point,
        index,
        label: formatMiniChartTime(point.baseDate)
    }));
    const latestValue = series[series.length - 1]?.value ?? null;
    const firstValue = series[0]?.value ?? null;
    const change = latestValue !== null && firstValue !== null && firstValue !== 0
        ? ((latestValue - firstValue) / firstValue) * 100
        : null;
    const values = chartData.map((point) => point.value).filter(Number.isFinite);
    const domainPadding = values.length > 0 ? Math.max((Math.max(...values) - Math.min(...values)) * 0.18, 0.6) : 1;
    const yDomain: [number, number] | undefined = values.length > 0
        ? [Math.min(...values) - domainPadding, Math.max(...values) + domainPadding]
        : undefined;

    return (
        <div className={`glass-card relative overflow-hidden rounded-2xl border border-zinc-100 p-3 shadow-sm ${fill ? 'grid min-h-[19rem] grid-rows-[auto_minmax(0,1fr)] xl:h-full xl:min-h-0' : compact ? 'grid min-h-32 grid-rows-[auto_minmax(0,1fr)] xl:h-full xl:min-h-0' : ''}`}>
            <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase tracking-wider text-teal-700">{label}</p>
                    <p className={`${compact ? 'mt-0.5 text-lg' : 'mt-1 text-2xl'} font-extrabold tracking-tight text-zinc-950`}>
                        {latestValue === null ? '-' : `${formatValue(latestValue, 2)}원`}
                    </p>
                    <p className={`${compact ? 'mt-0.5 line-clamp-1 text-[11px] leading-4' : 'mt-1 text-xs leading-5'} font-semibold text-zinc-500`}>{caption}</p>
                </div>
                <div className="absolute right-3 top-3 grid justify-items-end gap-1">
                    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${getDirectionBadgeClass(getDirection(metric?.changeRate ?? null))}`}>
                        전일대비 {formatPercentChange(metric?.changeRate ?? null)}
                    </span>
                    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${getDirectionBadgeClass(change !== null && change >= 0 ? 'up' : change !== null && change < 0 ? 'down' : 'unknown')}`}>
                        3개월대비 {formatPercentChange(change)}
                    </span>
                </div>
            </div>

            <div className={`w-full ${fill ? 'mt-3 h-36 xl:h-full xl:min-h-0' : compact ? 'mt-2 h-full min-h-0' : 'mt-3 h-24 xl:h-24'}`}>
                {chartData.length > 1 ? (
                    <ResponsiveContainer height="100%" width="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#18a999" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#18a999" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="index" hide />
                            <YAxis domain={yDomain} hide />
                            <Tooltip
                                content={<MiniChartTooltip />}
                                cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 4' }}
                                isAnimationActive={false}
                            />
                            <Area
                                dataKey="value"
                                fill="url(#colorValue)"
                                fillOpacity={1}
                                isAnimationActive={false}
                                stroke="#18a999"
                                strokeWidth={2.5}
                                type="monotone"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="grid h-full place-items-center text-xs font-bold text-zinc-400 bg-zinc-50 rounded-xl">데이터 대기</div>
                )}
            </div>
        </div>
    );
}

function ComingSoonCard({
                            body,
                            compact = false,
                            fill = false,
                            tall = false,
                            title,
                            variant = 'default'
                        }: {
    body: string;
    compact?: boolean;
    fill?: boolean;
    tall?: boolean;
    title: string;
    variant?: 'default' | 'gemini';
}) {
    const isGemini = variant === 'gemini';

    return (
        <section className={`relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm ${isGemini ? 'border-blue-100' : 'border-zinc-200'} ${fill ? 'min-h-64 xl:h-full xl:min-h-0' : tall ? 'min-h-[20rem]' : compact ? 'min-h-28' : ''}`}>
            <div className={isGemini ? 'absolute inset-0 bg-[linear-gradient(135deg,rgba(66,133,244,0.12),rgba(168,85,247,0.10)_52%,rgba(251,188,5,0.12))]' : 'absolute inset-0 bg-[linear-gradient(135deg,rgba(248,250,252,0.88),rgba(255,255,255,0.72))] backdrop-blur-[1px]'} />
            <div className={isGemini ? 'absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(66,133,244,0.18),transparent_26%),radial-gradient(circle_at_82%_74%,rgba(168,85,247,0.16),transparent_28%)]' : 'absolute inset-0 bg-[repeating-linear-gradient(110deg,rgba(17,24,39,0.04)_0,rgba(17,24,39,0.04)_1px,transparent_1px,transparent_12px)]'} />
            <div className={`relative grid place-items-center rounded-xl px-4 text-center ${isGemini ? 'border border-white/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]' : 'border border-dashed border-zinc-300 bg-white/60'} ${fill ? 'min-h-[15rem] xl:h-full xl:min-h-0' : tall ? 'min-h-[18.5rem]' : compact ? 'min-h-24' : 'min-h-24'}`}>
                <div>
                    <p className={isGemini ? 'text-xs font-bold uppercase tracking-wider text-blue-500' : 'text-xs font-bold uppercase tracking-wider text-zinc-400'}>COMING SOON</p>
                    <h3 className={`mt-1 text-base font-extrabold ${isGemini ? 'bg-[linear-gradient(90deg,#4285f4,#a855f7,#fbbc05)] bg-clip-text text-transparent' : 'text-zinc-700'}`}>{title}</h3>
                    <p className={`mx-auto max-w-56 text-xs font-semibold leading-5 ${isGemini ? 'text-zinc-500' : 'text-zinc-400'} ${compact ? 'mt-1 line-clamp-1' : 'mt-2'}`}>{body}</p>
                </div>
            </div>
        </section>
    );
}

function MiniChartTooltip({
                              active,
                              payload
                          }: {
    active?: boolean;
    payload?: Array<{ payload?: { label: string; value: number } }>;
}) {
    const point = payload?.[0]?.payload;
    if (!active || !point) {
        return null;
    }

    return (
        <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-600 shadow-lg shadow-zinc-950/10">
            <p className="text-zinc-950">{point.label}</p>
            <p className="mt-1 text-teal-700">{formatValue(point.value, 2)}원</p>
        </div>
    );
}

function ForeignExchangeRateCard({ rates }: { rates: ForeignExchangeRate[] }) {
    return (
        <section className="glass-card grid min-h-56 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-zinc-100 p-3 shadow-sm xl:h-full xl:min-h-0">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-700">FX RATES</p>
                    <h3 className="mt-0.5 text-sm font-extrabold text-zinc-950">각국 통화 환율</h3>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">{rates.length}개</span>
            </div>
            {rates.length === 0 ? (
                <EmptyState text="환율 데이터 대기" />
            ) : (
                <div className="scrollbar-none grid max-h-44 min-h-0 min-w-0 content-start gap-1.5 overflow-y-auto pr-1 xl:max-h-none">
                    {rates.map((rate) => (
                        <article className="grid min-w-0 grid-cols-[1.8rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 px-2.5 py-2" key={rate.currencyCode}>
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-base shadow-sm" aria-hidden="true">
                                {getCurrencyFlag(rate.displayCode)}
                            </span>
                            <span className="grid min-w-0 content-center">
                                <span className="block truncate text-[9px] font-extrabold leading-none text-zinc-400">{rate.displayCode}</span>
                                <span className="mt-0.5 block truncate text-[11px] font-bold leading-none text-zinc-950">{getCurrencyShortLabel(rate.displayCode)}</span>
                                <span className="mt-1 block truncate text-[9px] font-medium leading-none text-zinc-400">{formatCompactRateDate(rate.fetchedAt)}</span>
                            </span>
                            <span className="whitespace-nowrap text-xs font-extrabold text-teal-700">{formatValue(rate.dealBasRate, 2)}원</span>
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
    if (value === null || !Number.isFinite(value)) {
        return '-';
    }
    return `${value >= 0 ? '+' : ''}${formatValue(value, 2)}`;
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

function getPositionBand(series: TimeSeriesPoint[], latestValue: number | null): PositionBand {
    if (latestValue === null || series.length < 8) {
        return 'unknown';
    }
    const values = series.slice(-260).map((point) => point.value).filter(Number.isFinite);
    if (values.length < 8) {
        return 'unknown';
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) {
        return 'middle';
    }
    const ratio = (latestValue - min) / (max - min);
    if (ratio >= 0.67) {
        return 'top';
    }
    if (ratio <= 0.33) {
        return 'bottom';
    }
    return 'middle';
}

function getThreeMonthFlowText(position: PositionBand) {
    switch (position) {
        case 'top':
            return '최근 3개월 범위에서 높은 쪽에 있습니다.';
        case 'bottom':
            return '최근 3개월 범위에서 낮은 쪽에 있습니다.';
        case 'middle':
            return '최근 3개월 범위의 중간권에 있습니다.';
        default:
            return '최근 3개월 위치를 계산할 데이터가 더 필요합니다.';
    }
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

function sortByRecent<T extends { fetchedAt: string; publishedAt?: string | null }>(items: T[]) {
    return [...items].sort((a, b) => getItemTime(b) - getItemTime(a));
}

function getItemTime(item: { fetchedAt: string; publishedAt?: string | null }) {
    return new Date(item.publishedAt ?? item.fetchedAt).getTime();
}

function isToday(value: string | null, today: string) {
    if (!value) {
        return false;
    }
    return getSeoulDateString(new Date(value)) === today;
}

function formatMiniChartTime(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value.slice(5).replace('-', '.');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value.slice(11, 16) || value.slice(0, 10);
    }

    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul'
    }).format(date);
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
