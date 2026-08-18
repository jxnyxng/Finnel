import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type {
    ContentSyncStatus,
    DailyDashboardResponse,
    DomesticIndicator,
    FreshnessStatus,
    GovernmentBriefingArticle,
    MetricSnapshot,
    NewsArticle,
    TimeSeriesPoint
} from '../types';
import { formatMetricUnit, formatMetricValue, formatValue } from '../utils/format';
import { formatDateTime, getSeoulDateString } from '../utils/time';

type TodayFlowPageProps = {
    dashboard: DailyDashboardResponse | null;
    dashboardEmptyText: string;
    dashboardLoadState: 'idle' | 'loading' | 'ready' | 'error';
    governmentBriefings: GovernmentBriefingArticle[];
    governmentBriefingsConfigured: boolean;
    governmentBriefingsSyncStatus: ContentSyncStatus | null;
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
                                  governmentBriefings,
                                  governmentBriefingsConfigured,
                                  governmentBriefingsSyncStatus,
                                  newsArticles,
                                  newsConfigured,
                                  newsSyncStatus,
                                  statusNode
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
    const latestNews = sortByRecent(newsArticles).slice(0, 4);
    const latestBriefings = sortByRecent(governmentBriefings).slice(0, 4);
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
    const threeMonthScore = getPositionScore(usdKrwThreeMonthPosition);
    const newsFeed = latestNews.slice(0, 2).map((article) => ({
        href: article.originLink || article.link,
        kind: '뉴스',
        meta: `${article.publisher ?? article.categoryName} · ${formatMaybeDate(article.publishedAt)}`,
        title: article.title
    }));
    const policyFeed = latestBriefings.slice(0, 2).map((article) => ({
        href: article.originalUrl,
        kind: '정책',
        meta: `${article.ministry ?? article.category ?? '정부 정책'} · ${formatMaybeDate(article.publishedAt)}`,
        title: article.title
    }));
    const combinedFeedCount = newsFeed.length + policyFeed.length;

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

            <header className="page-tab-header" style={fadeUpStyle('0')}>
                <div className="min-w-0">
                    <p className="page-tab-eyebrow">TODAY FLOW</p>
                    <h2 className="page-tab-title">오늘 흐름</h2>
                    <p className="page-tab-description">오늘의 환율, 달러, 지표, 소식 흐름을 빠르게 확인하세요</p>
                </div>
                <div className="flex min-w-0 items-start justify-start gap-2 pt-5 md:justify-end">
                    {statusNode ? <div className="min-w-0">{statusNode}</div> : null}
                </div>
            </header>

            <section className="grid min-w-0 gap-3 xl:min-h-[31rem] xl:grid-cols-[19rem_minmax(24rem,1.16fr)_minmax(0,0.84fr)]">
                {/* 1열: 주요 지표 */}
                <section className="grid min-w-0 gap-3" style={fadeUpStyle('0.1')}>
                    <MetricTile
                        helper={getMetricCurrentValue(usdKrwMetric)}
                        label="원/달러 환율"
                        tone={usdKrwDirection}
                        value={getMetricChangeValue(usdKrwMetric)}
                    />
                    <MetricTile
                        helper={getMetricCurrentValue(dollarMetric)}
                        label="달러지수"
                        tone={dollarDirection}
                        value={getMetricChangeValue(dollarMetric)}
                    />
                    <section className="glass-card rounded-2xl p-4 border border-zinc-100 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Indicators</p>
                                <h3 className="mt-1 text-base font-bold text-zinc-950">숫자 지표</h3>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            {recentIndicators.length === 0 ? (
                                <EmptyState text="지표 대기" />
                            ) : recentIndicators.slice(0, 3).map((indicator) => (
                                <IndicatorPill indicator={indicator} key={indicator.code} />
                            ))}
                        </div>
                    </section>
                </section>

                {/* 2열: 차트 & 피드 */}
                <section className="grid min-w-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]" style={fadeUpStyle('0.2')}>
                    <MiniSparkline
                        label="USD/KRW 1일"
                        series={dashboard?.usdKrwIntradaySeries.map((point) => ({ baseDate: point.observedAt, value: point.value })) ?? []}
                    />
                    <section className="glass-card rounded-2xl p-4 border border-zinc-100 shadow-sm xl:min-h-0">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-teal-700">News & Policy</p>
                                <h3 className="mt-1 text-base font-bold text-zinc-950">뉴스·정책</h3>
                            </div>
                            <span className="rounded bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600">{combinedFeedCount}건</span>
                        </div>
                        <div className="mt-4 grid gap-2 xl:max-h-[22rem] xl:overflow-y-auto xl:pr-1">
                            {!newsConfigured && !governmentBriefingsConfigured ? (
                                <EmptyState text="수집 상태 확인 중" />
                            ) : combinedFeedCount === 0 ? (
                                <EmptyState text="최근 소식 없음" />
                            ) : (
                                <>
                                    <FeedGroup emptyText="뉴스 없음" items={newsFeed} title="뉴스" />
                                    <FeedGroup emptyText="정책 없음" items={policyFeed} title="정책" />
                                </>
                            )}
                        </div>
                    </section>
                </section>

                {/* 3열: 3개월 흐름 & 요약 브리핑 */}
                <section className="grid min-w-0 gap-3 xl:grid-rows-[auto_minmax(0,1fr)]" style={fadeUpStyle('0.3')}>
                    <section className="glass-card grid min-w-0 gap-3 rounded-2xl p-4 border border-zinc-100 shadow-sm">
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">3M Flow</p>
                            <h3 className="mt-1 text-base font-extrabold leading-6 text-zinc-950">최근 3개월 환율 흐름</h3>
                            <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{getThreeMonthFlowText(usdKrwThreeMonthPosition)}</p>
                        </div>
                        <div className="grid justify-items-center rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                            <DonutGauge caption="3개월" compact score={threeMonthScore} title={getPositionShortLabel(usdKrwThreeMonthPosition)} />
                        </div>
                    </section>

                    <BriefingPanel brief={brief} />
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

function MetricTile({ helper, label, tone, value }: { helper: string; label: string; tone: Direction; value: string }) {
    return (
        <article className="glass-card min-w-0 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md border border-zinc-100">
            <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-bold text-zinc-500">{label}</p>
                <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${getDirectionBadgeClass(tone)}`}>
          {getDirectionLabel(tone)}
        </span>
            </div>
            <div className="mt-4">
                <p className="truncate text-2xl font-extrabold tracking-tight text-zinc-950">{value}</p>
                <p className="mt-1.5 text-clamp-1 text-sm font-medium text-zinc-500">{helper}</p>
            </div>
        </article>
    );
}

function BriefingPanel({ brief }: { brief: string[] }) {
    return (
        <section className="glass-card grid min-h-0 rounded-2xl p-4 border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
            </svg>
          </span>
                    <h3 className="text-base font-bold text-zinc-950">오늘의 흐름 요약</h3>
                </div>
            </div>
            <div className="scrollbar-none min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
                {brief.length === 0 ? (
                    <p className="text-sm font-medium text-zinc-500">요약할 데이터가 없습니다.</p>
                ) : (
                    brief.slice(0, 3).map((line, idx) => (
                        <div key={idx} className="flex gap-2.5 rounded-xl bg-white/80 p-3 shadow-sm border border-zinc-100">
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"></div>
                            <p className="text-sm font-medium leading-relaxed text-zinc-700">{line}</p>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

function MiniSparkline({ label, series }: { label: string; series: TimeSeriesPoint[] }) {
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
        <div className="glass-card overflow-hidden rounded-2xl p-4 shadow-sm border border-zinc-100">
            <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase tracking-wider text-teal-700">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-950">
                        {latestValue === null ? '-' : `${formatValue(latestValue, 2)}원`}
                    </p>
                </div>
                <span className={`mb-1 rounded-md px-2.5 py-1 text-xs font-bold ${getDirectionBadgeClass(change !== null && change >= 0 ? 'up' : 'down')}`}>
          {change === null ? '-' : `${change >= 0 ? '+' : ''}${formatValue(change, 2)}%`}
        </span>
            </div>

            <div className="mt-4 h-36 w-full">
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

function IndicatorPill({ indicator }: { indicator: DomesticIndicator }) {
    const change = getNumericChange(indicator);

    return (
        <article className="min-w-0 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-3 transition-colors hover:bg-white hover:shadow-sm">
            <p className="truncate text-xs font-bold text-zinc-500">{indicator.title}</p>
            <p className="mt-1 truncate text-base font-extrabold text-zinc-950">{formatIndicatorValue(indicator)}</p>
            <p className={`mt-1 truncate text-xs font-bold ${getNumberToneClass(change)}`}>{formatIndicatorChange(indicator)}</p>
        </article>
    );
}

function DonutGauge({ caption, compact = false, score, title }: { caption: string; compact?: boolean; score: number; title: string }) {
    const clampedScore = clamp(score, 0, 100);
    const color = clampedScore >= 67 ? '#e11d48' : clampedScore <= 33 ? '#2563eb' : '#18a999';
    const background = `conic-gradient(${color} ${clampedScore * 3.6}deg, #e5e7eb 0deg)`;
    const outerSize = compact ? 'h-24 w-24' : 'h-36 w-36';
    const innerSize = compact ? 'h-[4.7rem] w-[4.7rem]' : 'h-[6.6rem] w-[6.6rem]';

    return (
        <div className="grid justify-items-center">
            <div
                aria-label={`${caption} ${title}`}
                className={`relative grid place-items-center rounded-full shadow-inner ${outerSize}`}
                style={{ background }}
            >
                <div className={`grid place-items-center rounded-full bg-white text-center shadow-sm ${innerSize}`}>
                    <div>
                        <p className="text-[11px] font-bold uppercase text-zinc-400">{caption}</p>
                        <p className={`${compact ? 'mt-0.5 text-base' : 'mt-1 text-xl'} font-extrabold text-zinc-950`}>{title}</p>
                        <p className="text-xs font-bold text-zinc-500">{Math.round(clampedScore)}점</p>
                    </div>
                </div>
            </div>
        </div>
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

function FeedGroup({
                       emptyText,
                       items,
                       title
                   }: {
    emptyText: string;
    items: Array<{ href: string | null; kind: string; meta: string; title: string }>;
    title: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-extrabold text-zinc-800">{title}</p>
                <span className="text-[11px] font-bold text-zinc-400">{items.length}건</span>
            </div>
            <div className="grid gap-1.5">
                {items.length === 0 ? (
                    <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-400">{emptyText}</div>
                ) : items.map((item) => (
                    <FeedRow item={item} key={`${item.kind}-${item.title}-${item.meta}`} />
                ))}
            </div>
        </div>
    );
}

function FeedRow({ compact = false, item }: { compact?: boolean; item: { href: string | null; kind: string; meta: string; title: string } }) {
    const body = (
        <div className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-xl border border-zinc-200 bg-white px-3 transition-colors hover:border-teal-200 hover:bg-teal-50 ${compact ? 'py-2' : 'py-2.5'}`}>
            <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${item.kind === '뉴스' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'}`}>{item.kind}</span>
            <span className="min-w-0">
        <span className="text-clamp-1 block text-sm font-bold leading-5 text-zinc-950">{item.title}</span>
                {!compact ? <span className="mt-0.5 block truncate text-xs font-medium text-zinc-500">{item.meta}</span> : null}
      </span>
        </div>
    );

    if (!item.href) {
        return body;
    }

    return (
        <a href={item.href} rel="noreferrer" target="_blank">
            {body}
        </a>
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
        lines.push('원/달러 환율과 달러지수가 함께 상승했습니다. 원화만의 움직임이라기보다 달러 강세 흐름을 함께 확인할 필요가 있습니다.');
    } else if (usdKrwDirection === 'up' && dollarDirection === 'down') {
        lines.push('원/달러 환율은 상승했지만 달러지수는 하락했습니다. 달러 전체 흐름보다 원화 관련 요인이나 국내 지표를 함께 살펴볼 필요가 있습니다.');
    } else if (usdKrwDirection === 'down' && dollarDirection === 'down') {
        lines.push('원/달러 환율과 달러지수가 함께 하락했습니다. 달러 약세 흐름과 원화 수급 배경을 나란히 확인해보세요.');
    } else if (usdKrwDirection === 'down' && dollarDirection === 'up') {
        lines.push('달러지수는 올랐지만 원/달러 환율은 하락했습니다. 달러 강세와 다른 방향의 원화 흐름이 나타났는지 관련 지표를 함께 보는 것이 좋습니다.');
    } else {
        lines.push('원/달러 환율과 달러지수 변화가 크지 않거나 일부 값이 아직 확인되지 않았습니다. 숫자의 방향보다 기준 시각과 최근 범위를 함께 확인해주세요.');
    }

    if (usdKrwPosition === 'top') {
        lines.push('현재 원/달러 환율은 최근 흐름에서 높은 구간에 있습니다. 단기 변동뿐 아니라 과거 평균과 현재 위치를 함께 확인하는 것이 좋습니다.');
    } else if (usdKrwPosition === 'bottom') {
        lines.push('현재 원/달러 환율은 최근 흐름에서 낮은 구간에 있습니다. 하락 배경이 달러 약세인지 국내 요인인지 나누어 확인해보세요.');
    }

    if (recentIndicators.length > 0) {
        lines.push(`국내 지표 중 ${recentIndicators[0].title} 등 최근 발표값과 직전값을 비교할 수 있는 항목이 있습니다. 환율 숫자의 배경으로 함께 살펴볼 수 있습니다.`);
    }

    if (hasTodayNews || hasTodayBriefing) {
        lines.push('Finnel이 최근 수집한 뉴스와 정책 자료에서 환율 또는 금융시장 관련 이슈가 확인됩니다. 숫자의 변화만 보기보다 관련 배경을 함께 확인해보세요.');
    }

    if (staleSignals.length > 0) {
        lines.push('일부 데이터가 아직 오늘 기준으로 업데이트되지 않았습니다. 현재 표시되는 값의 기준일과 수집 상태를 함께 확인해주세요.');
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

function getPositionScore(position: PositionBand) {
    switch (position) {
        case 'top':
            return 82;
        case 'bottom':
            return 22;
        case 'middle':
            return 50;
        default:
            return 40;
    }
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

function getMetricChangeValue(metric: MetricSnapshot | null) {
    if (!metric || metric.changeRate === null || !Number.isFinite(metric.changeRate)) {
        return '전일 대비 -';
    }
    return `전일 대비 ${metric.changeRate >= 0 ? '+' : ''}${formatValue(metric.changeRate, 2)}%`;
}

function getMetricCurrentValue(metric: MetricSnapshot | null) {
    if (!metric) {
        return '현재값 확인 대기';
    }
    return `현재 ${formatMetricValue(metric)} ${formatMetricUnit(metric.unit)}`;
}

function getPositionShortLabel(position: PositionBand) {
    switch (position) {
        case 'top':
            return '높음';
        case 'bottom':
            return '낮음';
        case 'middle':
            return '중간';
        default:
            return '대기';
    }
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

function getNumberToneClass(value: number | null) {
    if (value === null || Math.abs(value) < 0.000001) {
        return 'text-zinc-500';
    }
    return value > 0 ? 'text-rose-700' : 'text-blue-700';
}

function formatIndicatorValue(indicator: DomesticIndicator) {
    if (indicator.value === null) {
        return '-';
    }
    return `${formatValue(indicator.value, indicator.unit === 'KRW_TRILLION' ? 1 : 2)} ${formatMetricUnit(indicator.unit)}`;
}

function formatIndicatorChange(indicator: DomesticIndicator) {
    const change = getNumericChange(indicator);
    if (change === null) {
        return '직전값 없음';
    }
    const fractionDigits = indicator.unit === 'KRW_TRILLION' ? 1 : 2;
    return `${change >= 0 ? '+' : ''}${formatValue(change, fractionDigits)} ${formatMetricUnit(indicator.unit)}`;
}

function formatMaybeDate(value: string | null) {
    if (!value) {
        return '-';
    }
    return formatDateTime(value);
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

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}