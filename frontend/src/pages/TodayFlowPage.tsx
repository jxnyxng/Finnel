import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RelatedNewsBanner } from '../components/RelatedNewsBanner';
import type {
    ContentSyncStatus,
    DailyDashboardResponse,
    DomesticIndicator,
    ForeignExchangeRate,
    FreshnessStatus,
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
    statusNode?: React.ReactNode;
};

type Direction = 'up' | 'down' | 'flat' | 'unknown';
type PositionBand = 'top' | 'middle' | 'bottom' | 'unknown';

export function TodayFlowPage({
                                  dashboard,
                                  dashboardEmptyText,
                                  dashboardLoadState,
                                  foreignExchangeRates,
                                  governmentBriefings,
                                  governmentBriefingsConfigured,
                                  governmentBriefingsSyncStatus,
                                  newsArticles,
                                  newsConfigured,
                                  newsSyncStatus
                              }: TodayFlowPageProps) {
    const today = getSeoulDateString(new Date());
    const metrics = dashboard?.metrics ?? [];
    const usdKrwMetric = metrics.find((metric) => metric.code === 'USD/KRW') ?? null;
    const dollarMetric = metrics.find((metric) => metric.code === 'BROAD_DOLLAR_INDEX')
        ?? metrics.find((metric) => metric.code === 'ADVANCED_DOLLAR_INDEX')
        ?? null;
    const usdKrwDirection = getDirection(usdKrwMetric?.changeRate ?? null);
    const dollarDirection = getDirection(dollarMetric?.changeRate ?? null);
    const usdKrwPosition = getPositionBand(dashboard?.usdKrwSeries ?? [], usdKrwMetric?.value ?? null);
    const usdKrwThreeMonthPosition = getPositionBand((dashboard?.usdKrwSeries ?? []).slice(-66), usdKrwMetric?.value ?? null);
    const recentIndicators = getRecentIndicators(dashboard?.domesticIndicators ?? []);
    const latestNews = React.useMemo(() => sortByRecent(newsArticles).slice(0, 6), [newsArticles]);
    const latestBriefings = React.useMemo(() => sortByRecent(governmentBriefings).slice(0, 6), [governmentBriefings]);
    const todayBriefingCount = governmentBriefings.filter((article) => isToday(article.publishedAt ?? article.fetchedAt, today)).length;
    const hasTodayNews = latestNews.some((article) => isToday(article.publishedAt ?? article.fetchedAt, today));
    const hasTodayBriefing = latestBriefings.some((article) => isToday(article.publishedAt ?? article.fetchedAt, today));
    const staleSignals = getStaleSignals(dashboard?.freshnessStatus ?? null, newsSyncStatus, governmentBriefingsSyncStatus);
    const brief = buildBrief({
        dollarDirection,
        hasTodayBriefing,
        hasTodayNews,
        recentIndicators,
        staleSignals,
        usdKrwDirection,
        usdKrwPosition
    });
    const activeDollarSeries = dashboard?.dollarIndexSeries?.length
        ? dashboard.dollarIndexSeries
        : dashboard?.dxyIndexSeries ?? [];
    const previousDollarPoint = activeDollarSeries.length >= 2 ? activeDollarSeries[activeDollarSeries.length - 2] : null;
    const latestDollarPoint = activeDollarSeries[activeDollarSeries.length - 1] ?? null;
    // 애니메이션용 인라인 스타일 헬퍼
    const fadeUpStyle = (delay: string) => ({
        opacity: 0,
        animation: `todayFlowFadeInUp 0.4s ease-out ${delay}s forwards`
    });

    return (
        <section className="grid min-w-0 gap-3">
            {/* CSS Keyframes (의존성 없이 작동하도록 내부 주입) */}
            <style>{`
        @keyframes todayFlowFadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            <header className="page-tab-header today-flow-header" style={fadeUpStyle('0')}>
                <div className="min-w-0">
                    {newsConfigured ? (
                        <RelatedNewsBanner configured={newsConfigured} desktopGroupSize={3} label="뉴스룸 배너" topic="exchange" />
                    ) : (
                        <EmptyState text={newsConfigured ? '최근 뉴스 수집 대기' : '뉴스 수집 설정 확인 중'} />
                    )}
                </div>
            </header>

            <section className="grid min-w-0 items-stretch gap-3 xl:h-[30rem] xl:grid-cols-[21rem_minmax(0,1fr)_20rem]">
                <section className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]" style={fadeUpStyle('0.1')}>
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
                    <BriefingPanel brief={brief} />
                </section>

                <section className="grid min-h-0 min-w-0 gap-3 xl:grid-rows-[minmax(0,1fr)_auto]" style={fadeUpStyle('0.2')}>
                    <div className="grid min-h-0 min-w-0 gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
                        <MiniSparkline
                            caption={getThreeMonthFlowText(usdKrwThreeMonthPosition)}
                            fill
                            label="최근 3개월 환율 흐름"
                            metric={usdKrwMetric}
                            series={(dashboard?.usdKrwSeries ?? []).slice(-66)}
                        />
                        <ForeignExchangeRateCard rates={foreignExchangeRates} />
                    </div>
                    <ComingSoonCard
                        body="트럼프 SNS와 시장 반응을 연결해 보여주는 영역을 준비 중입니다."
                        compact
                        title="트럼프 SNS"
                    />
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
                <p className="mt-1 text-2xl font-black leading-none tracking-normal text-zinc-950">{metric ? formatMetricValue(metric) : '-'}</p>
            </div>
        </article>
    );
}

function BriefingPanel({ brief }: { brief: string[] }) {
    return (
        <section className="glass-card grid min-h-48 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white p-3 shadow-sm xl:h-full xl:min-h-0">
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
            </svg>
          </span>
                    <h3 className="text-sm font-bold text-zinc-950">흐름 요약</h3>
                </div>
            </div>
            <div className="scrollbar-none min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
                {brief.length === 0 ? (
                    <p className="text-sm font-medium text-zinc-500">요약할 데이터가 없습니다.</p>
                ) : (
                    brief.slice(0, 2).map((line, idx) => (
                        <div key={idx} className="flex gap-2 rounded-xl border border-zinc-100 bg-white/80 p-2.5 shadow-sm">
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"></div>
                            <p className="line-clamp-3 text-xs font-medium leading-5 text-zinc-700">{line}</p>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

function MiniSparkline({ caption, fill = false, label, metric, series }: { caption: string; fill?: boolean; label: string; metric: MetricSnapshot | null; series: TimeSeriesPoint[] }) {
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
        <div className={`glass-card relative overflow-hidden rounded-2xl border border-zinc-100 p-4 shadow-sm ${fill ? 'grid min-h-[19rem] grid-rows-[auto_minmax(0,1fr)] xl:h-full xl:min-h-0' : ''}`}>
            <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase tracking-wider text-teal-700">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-950">
                        {latestValue === null ? '-' : `${formatValue(latestValue, 2)}원`}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">{caption}</p>
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

            <div className={`mt-3 w-full ${fill ? 'h-36 xl:h-full xl:min-h-0' : 'h-24 xl:h-24'}`}>
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

function ComingSoonCard({ body, compact = false, fill = false, tall = false, title }: { body: string; compact?: boolean; fill?: boolean; tall?: boolean; title: string }) {
    return (
        <section className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm ${fill ? 'min-h-64 xl:h-full xl:min-h-0' : tall ? 'min-h-[20rem]' : compact ? 'min-h-28' : ''}`}>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(248,250,252,0.88),rgba(255,255,255,0.72))] backdrop-blur-[1px]" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(110deg,rgba(17,24,39,0.04)_0,rgba(17,24,39,0.04)_1px,transparent_1px,transparent_12px)]" />
            <div className={`relative grid place-items-center rounded-xl border border-dashed border-zinc-300 bg-white/60 px-4 text-center ${fill ? 'min-h-[15rem] xl:h-full xl:min-h-0' : tall ? 'min-h-[18.5rem]' : compact ? 'min-h-24' : 'min-h-24'}`}>
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">COMING SOON</p>
                    <h3 className="mt-1 text-base font-extrabold text-zinc-700">{title}</h3>
                    <p className={`mx-auto max-w-48 text-xs font-semibold leading-5 text-zinc-400 ${compact ? 'mt-1 line-clamp-1' : 'mt-2'}`}>{body}</p>
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

function buildBrief({
                        dollarDirection,
                        hasTodayBriefing,
                        hasTodayNews,
                        recentIndicators,
                        staleSignals,
                        usdKrwDirection,
                        usdKrwPosition
                    }: {
    dollarDirection: Direction;
    hasTodayBriefing: boolean;
    hasTodayNews: boolean;
    recentIndicators: DomesticIndicator[];
    staleSignals: string[];
    usdKrwDirection: Direction;
    usdKrwPosition: PositionBand;
}) {
    const lines: string[] = [];
    if (usdKrwDirection === 'up' && dollarDirection === 'up') {
        lines.push('원/달러 환율과 달러지수가 함께 상승했습니다. 원화 흐름에는 글로벌 달러 강세 영향이 함께 반영된 상태입니다.');
    } else if (usdKrwDirection === 'up' && dollarDirection === 'down') {
        lines.push('원/달러 환율은 상승했고 달러지수는 하락했습니다. 달러 전체 흐름보다 원화 관련 요인의 비중이 커진 구간입니다.');
    } else if (usdKrwDirection === 'down' && dollarDirection === 'down') {
        lines.push('원/달러 환율과 달러지수가 함께 하락했습니다. 달러 약세 흐름과 원화 수급 개선이 같은 방향으로 나타난 상태입니다.');
    } else if (usdKrwDirection === 'down' && dollarDirection === 'up') {
        lines.push('달러지수는 상승했고 원/달러 환율은 하락했습니다. 글로벌 달러 강세와 다른 방향의 원화 흐름이 나타난 구간입니다.');
    } else {
        lines.push('원/달러 환율과 달러지수 변화가 제한적이거나 일부 값이 아직 확인되지 않았습니다. 현재 요약은 기준 시각과 최근 범위에 따라 구성됩니다.');
    }

    if (usdKrwPosition === 'top') {
        lines.push('현재 원/달러 환율은 최근 흐름에서 높은 구간에 있습니다. 단기 변동과 과거 평균 대비 위치가 모두 높은 쪽에 놓여 있습니다.');
    } else if (usdKrwPosition === 'bottom') {
        lines.push('현재 원/달러 환율은 최근 흐름에서 낮은 구간에 있습니다. 최근 범위 안에서는 원화 부담이 낮아진 쪽에 가깝습니다.');
    }

    if (recentIndicators.length > 0) {
        lines.push(`국내 지표 중 ${recentIndicators[0].title} 등 최근 발표값과 직전값을 비교할 수 있는 항목이 있습니다. 환율 숫자의 배경 데이터로 함께 집계됐습니다.`);
    }

    if (hasTodayNews || hasTodayBriefing) {
        lines.push('최근 수집된 뉴스와 정책뉴스에 환율 또는 금융시장 관련 이슈가 포함되어 있습니다. 대시보드 요약에 해당 배경 신호가 반영됐습니다.');
    }

    if (staleSignals.length > 0) {
        lines.push('일부 데이터가 아직 오늘 기준으로 업데이트되지 않았습니다. 현재 요약에는 표시값의 기준일과 수집 상태 차이가 반영됩니다.');
    }

    return lines.slice(0, 5);
}

function getRecentIndicators(indicators: DomesticIndicator[]) {
    return indicators
        .filter((indicator) => indicator.value !== null && indicator.previousValue !== null)
        .sort((a, b) => Math.abs(getNumericChange(b) ?? 0) - Math.abs(getNumericChange(a) ?? 0));
}

function getNumericChange(indicator: DomesticIndicator) {
    if (indicator.value === null || indicator.previousValue === null) {
        return null;
    }
    return indicator.value - indicator.previousValue;
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

function getStaleSignals(
    dashboardFreshness: FreshnessStatus | null,
    newsSyncStatus: ContentSyncStatus | null,
    governmentBriefingsSyncStatus: ContentSyncStatus | null
) {
    return [
        dashboardFreshness === 'STALE' ? 'dashboard' : null,
        newsSyncStatus?.freshnessStatus === 'STALE' || newsSyncStatus?.latestSyncStatus === 'FAILED' ? 'news' : null,
        governmentBriefingsSyncStatus?.freshnessStatus === 'STALE' || governmentBriefingsSyncStatus?.latestSyncStatus === 'FAILED' ? 'policy' : null
    ].filter(Boolean) as string[];
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
