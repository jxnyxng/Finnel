import React from 'react';
import ReactDOM from 'react-dom/client';
import axios, { AxiosError } from 'axios';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';

type RangeKey = '1D' | '3M' | '1Y' | '5Y';

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: '1D', label: '1일' },
  { key: '3M', label: '3개월' },
  { key: '1Y', label: '1년' },
  { key: '5Y', label: '5년' }
];

const longRangeOptions: Array<{ key: Exclude<RangeKey, '1D'>; label: string }> = [
  { key: '3M', label: '3개월' },
  { key: '1Y', label: '1년' },
  { key: '5Y', label: '5년' }
];

const intradaySessionStartMinutes = 9 * 60;
const intradaySessionEndMinutes = 26 * 60;
const chartHeightPx = 320;
const chartTopMarginPx = 8;
const chartBottomMarginPx = 18;
const compactXAxisHeightPx = 8;
const intradayXAxisHeightPx = 28;

type MetricSnapshot = {
  code: string;
  label: string;
  value: number | null;
  unit: string;
  changeRate: number | null;
};

type TimeSeriesPoint = {
  baseDate: string;
  value: number;
};

type IntradayTimeSeriesPoint = {
  observedAt: string;
  value: number;
};

type DailyDashboardResponse = {
  baseDate: string;
  metrics: MetricSnapshot[];
  usdKrwSeries: TimeSeriesPoint[];
  usdKrwIntradaySeries: IntradayTimeSeriesPoint[];
  dollarIndexSeries: TimeSeriesPoint[];
};

type SyncResult = {
  exchangeRateRows: number;
  intradayExchangeRateRows: number;
  dollarIndexRows: number;
  usPolicyRateRows: number;
  krPolicyRateRows: number;
  foreignReserveRows: number;
  status: string;
  message: string;
  trigger: string;
  startedAt: string | null;
  nextAllowedAt: string | null;
  remainingCooldownSeconds: number;
};

type SyncStatus = {
  latestStatus: string | null;
  latestStartedAt: string | null;
  latestEndedAt: string | null;
  latestMessage: string | null;
  nextAllowedAt: string | null;
  remainingCooldownSeconds: number;
  canSync: boolean;
};

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
  const [dollarIndexRange, setDollarIndexRange] = React.useState<Exclude<RangeKey, '1D'>>('3M');
  const [isMacroPanelOpen, setIsMacroPanelOpen] = React.useState(true);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const attemptedIntradayRefreshKey = React.useRef<string | null>(null);
  const attemptedDailyBackfillKey = React.useRef<string | null>(null);

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

  const metrics = sortMetrics(dashboard?.metrics ?? []);
  const usdKrwMetric = findMetric(metrics, 'USD/KRW');
  const dollarIndexMetric = findMetric(metrics, 'BROAD_DOLLAR_INDEX');
  const headerMetrics = [
    findMetric(metrics, 'US_POLICY_RATE'),
    findMetric(metrics, 'KR_POLICY_RATE'),
    findMetric(metrics, 'KR_US_RATE_GAP'),
    findMetric(metrics, 'FOREIGN_RESERVES')
  ].filter((metric): metric is MetricSnapshot => metric !== null);
  const usdKrwSeries = dashboard?.usdKrwSeries ?? [];
  const usdKrwIntradaySeries = dashboard?.usdKrwIntradaySeries ?? [];
  const dollarIndexSeries = dashboard?.dollarIndexSeries ?? [];
  const seoulToday = getSeoulDateString(new Date(nowMs));
  const seoulTime = getSeoulTimeString(new Date(nowMs));
  const latestIntradayDate = getLatestIntradayDate(usdKrwIntradaySeries);
  const visibleUsdKrwSeries = buildVisibleUsdKrwSeries(usdKrwSeries, usdKrwIntradaySeries, usdKrwRange, seoulToday, seoulTime);
  const latestUsdKrwPoint = visibleUsdKrwSeries[visibleUsdKrwSeries.length - 1] ?? null;
  const usdKrwDomain = getValueDomain(visibleUsdKrwSeries, 5);
  const latestUsdKrwLabelTop = getLatestValueLabelTop(
    latestUsdKrwPoint?.value ?? null,
    usdKrwDomain,
    usdKrwRange === '1D' ? intradayXAxisHeightPx : compactXAxisHeightPx
  );
  const usdKrwXDomain = getXDomain(visibleUsdKrwSeries, usdKrwRange);
  const usdKrwXTicks = getUsdKrwXTicks(usdKrwRange);
  const visibleDollarIndexSeries = buildVisibleDailySeries(dollarIndexSeries, dollarIndexRange);
  const latestDollarIndexPoint = visibleDollarIndexSeries[visibleDollarIndexSeries.length - 1] ?? null;
  const dollarIndexDomain = getValueDomain(visibleDollarIndexSeries, 1);
  const latestDollarIndexLabelTop = getLatestValueLabelTop(latestDollarIndexPoint?.value ?? null, dollarIndexDomain, compactXAxisHeightPx);
  const dollarIndexXDomain = getXDomain(visibleDollarIndexSeries, dollarIndexRange);
  const dollarIndexReferenceLabel = getDailyReferenceLabel(visibleDollarIndexSeries);
  const todayLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date());
  const usdKrwReferenceLabel = getUsdKrwReferenceLabel(usdKrwRange, visibleUsdKrwSeries, dashboard?.baseDate);
  const remainingCooldownSeconds = getRemainingCooldownSeconds(syncStatus, nowMs);
  const remainingIntradayCooldownSeconds = getRemainingCooldownSeconds(intradayStatus, nowMs);
  const remainingDailyBackfillCooldownSeconds = getRemainingCooldownSeconds(dailyBackfillStatus, nowMs);
  const hasRecentDailyGap = hasMissingRecentWeekday(usdKrwSeries, seoulToday);
  const latestSyncLabel = getLatestSyncLabel(syncStatus, remainingCooldownSeconds);
  const intradayStatusLabel = getIntradayStatusLabel(
    isIntradaySyncing,
    latestIntradayDate,
    usdKrwIntradaySeries.length,
    usdKrwIntradaySeries[usdKrwIntradaySeries.length - 1]?.observedAt ?? null,
    remainingIntradayCooldownSeconds
  );
  const estimatedBuyPrice = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 1.01;
  const estimatedSellPrice = usdKrwMetric?.value === null || usdKrwMetric?.value === undefined ? null : usdKrwMetric.value * 0.99;
  const usdKrwPanelDetails = [
    { label: '살 때 추정', value: `${formatValue(estimatedBuyPrice)} KRW` },
    { label: '팔 때 추정', value: `${formatValue(estimatedSellPrice)} KRW` },
    { label: '범위', value: getRangeLabel(usdKrwRange) },
    { label: usdKrwRange === '1D' ? '세션' : '기간', value: getUsdKrwPanelReferenceLabel(usdKrwRange, visibleUsdKrwSeries) },
    { label: '스프레드', value: '기준율 +/-1%' }
  ];
  const dollarIndexPanelDetails = [
    { label: '범위', value: getRangeLabel(dollarIndexRange) },
    { label: '기간', value: getPanelPeriodLabel(visibleDollarIndexSeries) },
    { label: '관측값', value: `${visibleDollarIndexSeries.length}개` },
    { label: '출처', value: 'FRED DTWEXBGS' }
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

    if (attemptedIntradayRefreshKey.current === seoulToday) {
      return;
    }

    attemptedIntradayRefreshKey.current = seoulToday;
    refreshIntraday();
  }, [
    isIntradaySyncing,
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
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-teal-700">KRW Watcher</p>
            <h1 className="text-3xl font-semibold tracking-normal">원화 가치 및 매크로 리스크 대시보드</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              오늘 {todayLabel} · {message}
            </p>
            <p className="text-xs text-zinc-500">{latestSyncLabel}</p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex w-fit items-center gap-2 text-xs font-medium text-zinc-500 underline underline-offset-4">
              <span className="on-air-dot" aria-hidden="true" />
              자동 갱신 중
            </div>
          </div>
        </header>

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
            <div className="relative h-80">
              {visibleUsdKrwSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  {usdKrwRange === '1D'
                    ? '09:00~다음날 02:00 세션 환율 데이터를 확인 중입니다.'
                    : '표시할 환율 데이터가 없습니다.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleUsdKrwSeries} margin={{ top: 8, right: 8, bottom: 18, left: 28 }}>
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={usdKrwXDomain}
                      height={usdKrwRange === '1D' ? intradayXAxisHeightPx : compactXAxisHeightPx}
                      padding={{ left: 0, right: 0 }}
                      ticks={usdKrwXTicks}
                      tickFormatter={formatUsdKrwXTick}
                      tick={usdKrwRange === '1D' ? { fontSize: 10, fill: '#71717a' } : false}
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
                    <Tooltip content={<UsdKrwTooltip range={usdKrwRange} />} />
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
            </div>
          </article>
          <MetricSidePanel
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
            <div className="relative h-80">
              {visibleDollarIndexSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
                  표시할 달러 지수 데이터가 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleDollarIndexSeries} margin={{ top: 8, right: 8, bottom: 18, left: 18 }}>
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={dollarIndexXDomain}
                      height={8}
                      padding={{ left: 16, right: 16 }}
                      tick={false}
                      tickLine={false}
                      axisLine={false}
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
                    <Tooltip content={<DollarIndexTooltip />} />
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
            </div>
          </article>
          <MetricSidePanel
            details={dollarIndexPanelDetails}
            footerText={`최신 발표 ${latestDollarIndexPoint?.dateValue.slice(0, 10) ?? '-'}`}
            metric={dollarIndexMetric}
          />
          </section>
        </section>
        <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 border-b border-zinc-100 pb-3">
            <h2 className="text-base font-semibold">환율 뉴스</h2>
            <p className="text-xs text-zinc-500">원화, 달러, 금리, 외환시장 관련 주요 뉴스를 이 영역에 표시할 예정입니다.</p>
          </div>
          <div className="grid min-h-40 place-items-center text-sm text-zinc-400">
            뉴스 연동 준비 중
          </div>
        </section>
        <StickyMacroPanel
          isLoading={isLoading}
          isOpen={isMacroPanelOpen}
          metrics={headerMetrics}
          onToggle={() => setIsMacroPanelOpen((current) => !current)}
        />
      </section>
    </main>
  );
}

function MetricSidePanel({
  metric,
  footerText,
  details
}: {
  metric: MetricSnapshot | null;
  footerText: string;
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <aside className="flex min-h-32 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-zinc-500">{metric?.label ?? '지표 확인 중'}</p>
        <div className="mt-4 flex items-end justify-between gap-3 lg:flex-col lg:items-start">
          <p className="text-3xl font-semibold tracking-normal">{metric ? formatMetricValue(metric) : '-'}</p>
          <span className="text-xs font-medium text-zinc-500">{metric ? formatMetricUnit(metric.unit) : ''}</span>
        </div>
      </div>
      <dl className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs">
        {details.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-zinc-500">{item.label}</dt>
            <dd className="min-w-0 text-right font-medium leading-5 text-zinc-800">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-zinc-500">{footerText}</p>
    </aside>
  );
}

function StickyMacroPanel({
  metrics,
  isLoading,
  isOpen,
  onToggle
}: {
  metrics: MetricSnapshot[];
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={`overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-all duration-300 ease-out 2xl:fixed 2xl:left-[calc(50%+36rem+12px)] 2xl:top-52 2xl:w-40 ${isOpen ? 'p-3' : 'px-3 py-2'}`}>
      <button
        aria-expanded={isOpen}
        className="flex h-7 w-full items-center gap-2 text-left text-sm font-semibold leading-none text-zinc-900"
        onClick={onToggle}
        type="button"
      >
        <span className={`text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>{'>'}</span>
        <span>금리·외환 여건</span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}>
        <dl className="grid min-h-0 gap-2 overflow-hidden text-xs sm:grid-cols-2 2xl:grid-cols-1">
          {isLoading ? (
            <div className="text-xs text-zinc-500 sm:col-span-2 2xl:col-span-1">요약 데이터 확인 중</div>
          ) : metrics.map((metric) => (
            <div key={metric.code} className="rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5">
              <dt className="truncate text-[10px] font-medium text-zinc-500">{metric.label}</dt>
              <dd className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="text-xs font-semibold text-zinc-950">{formatMetricValue(metric)}</span>
                <span className="text-[10px] font-medium text-zinc-500">{formatMetricUnit(metric.unit)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

type ChartTooltipPayload = {
  payload?: ChartPoint;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
};

function UsdKrwTooltip({ active, payload, range }: ChartTooltipProps & { range: RangeKey }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-zinc-900">{formatTooltipDate(point.dateValue, range)}</p>
      <p className="mt-1 text-zinc-600">USD/KRW {formatValue(point.value)} KRW</p>
    </div>
  );
}

type DollarIndexTooltipPayload = {
  payload?: ChartPoint;
};

function DollarIndexTooltip({ active, payload }: { active?: boolean; payload?: DollarIndexTooltipPayload[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-zinc-900">{point.dateValue.slice(0, 10)}</p>
      <p className="mt-1 text-zinc-600">광의 달러 지수 {formatValue(point.value)}</p>
    </div>
  );
}

function LatestValueDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (typeof cx !== 'number' || typeof cy !== 'number') {
    return null;
  }

  return (
    <g>
      <circle className="latest-value-pulse" cx={cx} cy={cy} r={9} />
      <circle className="latest-value-halo" cx={cx} cy={cy} r={5} />
      <circle className="latest-value-core" cx={cx} cy={cy} r={3} />
    </g>
  );
}

function formatValue(value: number | null, fractionDigits = 2) {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

function formatMetricValue(metric: MetricSnapshot) {
  if (metric.unit === 'PERCENT' || metric.unit === 'PERCENT_POINT') {
    return formatValue(metric.value, 2);
  }

  if (metric.unit === 'USD_MILLION') {
    return formatValue(metric.value, 0);
  }

  return formatValue(metric.value);
}

function formatMetricUnit(unit: string) {
  if (unit === 'PERCENT') {
    return '%';
  }

  if (unit === 'PERCENT_POINT') {
    return '%p';
  }

  if (unit === 'USD_MILLION') {
    return '백만 달러';
  }

  return unit;
}

function sortMetrics(metrics: MetricSnapshot[]) {
  const order = [
    'USD/KRW',
    'BROAD_DOLLAR_INDEX',
    'FOREIGN_RESERVES',
    'US_POLICY_RATE',
    'KR_POLICY_RATE',
    'KR_US_RATE_GAP'
  ];

  return [...metrics].sort((a, b) => {
    const aIndex = order.indexOf(a.code);
    const bIndex = order.indexOf(b.code);
    return (aIndex === -1 ? order.length : aIndex) - (bIndex === -1 ? order.length : bIndex);
  });
}

function findMetric(metrics: MetricSnapshot[], code: string) {
  return metrics.find((metric) => metric.code === code) ?? null;
}

function getRangeLabel(range: RangeKey | Exclude<RangeKey, '1D'>) {
  return rangeOptions.find((option) => option.key === range)?.label
    ?? longRangeOptions.find((option) => option.key === range)?.label
    ?? range;
}

function getUsdKrwPanelReferenceLabel(range: RangeKey, series: ChartPoint[]) {
  if (range === '1D') {
    return '영업일 · 09:00~익일 02:00';
  }

  return getPanelPeriodLabel(series);
}

function getPanelPeriodLabel(series: ChartPoint[]) {
  if (series.length === 0) {
    return '-';
  }

  return `${formatCompactDate(series[0].dateValue)}~${formatCompactDate(series[series.length - 1].dateValue)}`;
}

function formatCompactDate(value: string) {
  const date = value.slice(0, 10);
  return date.slice(2).replace(/-/g, '.');
}

function formatTooltipDate(value: string, range: RangeKey) {
  if (range === '1D') {
    return `${value.slice(0, 10)} ${value.slice(11, 16)}`;
  }

  return value.slice(0, 10);
}

type ChartPoint = {
  label: string;
  dateValue: string;
  x: number;
  value: number;
  latestValue?: number | null;
};

function buildVisibleUsdKrwSeries(
  dailySeries: TimeSeriesPoint[],
  intradaySeries: IntradayTimeSeriesPoint[],
  range: RangeKey,
  today: string,
  currentTime: string
): ChartPoint[] {
  if (range === '1D' && intradaySeries.length > 0) {
    const sessionStartDate = getIntradaySessionStartDate(intradaySeries[0].observedAt);
    const points = intradaySeries.map((point) => ({
      label: point.observedAt.slice(11, 16),
      dateValue: point.observedAt,
      x: getSessionMinute(point.observedAt, sessionStartDate),
      value: point.value,
    })).filter((point) => point.x >= intradaySessionStartMinutes && point.x <= intradaySessionEndMinutes);

    if (points.length === 0) {
      return [];
    }

    const latestPoint = points[points.length - 1];
    const currentDateTime = `${today}T${currentTime}:00`;
    const currentX = getSessionMinute(currentDateTime, sessionStartDate);
    const shouldExtendToNow = currentX > latestPoint.x && currentX <= intradaySessionEndMinutes;
    const visiblePoints = shouldExtendToNow
      ? [
          ...points,
          {
            label: currentTime,
            dateValue: `${today}T${currentTime}:00`,
            x: currentX,
            value: latestPoint.value
          }
        ]
      : points;

    return visiblePoints.map((point, index) => ({
      ...point,
      latestValue: index === visiblePoints.length - 1 ? point.value : null
    }));
  }

  const filteredDailySeries = filterDailySeriesByRange(dailySeries, range);
  return filteredDailySeries.map((point, index) => ({
    label: point.baseDate,
    dateValue: point.baseDate,
    x: Date.parse(point.baseDate),
    value: point.value,
    latestValue: index === filteredDailySeries.length - 1 ? point.value : null
  }));
}

function buildVisibleDailySeries(series: TimeSeriesPoint[], range: Exclude<RangeKey, '1D'>): ChartPoint[] {
  const filteredSeries = filterDailySeriesByRange(series, range);
  return filteredSeries.map((point, index) => ({
    label: point.baseDate,
    dateValue: point.baseDate,
    x: Date.parse(point.baseDate),
    value: point.value,
    latestValue: index === filteredSeries.length - 1 ? point.value : null
  }));
}

function filterDailySeriesByRange(series: TimeSeriesPoint[], range: RangeKey) {
  if (series.length === 0) {
    return series;
  }

  if (range === '1D') {
    return series.slice(-1);
  }

  if (range === '5Y') {
    return series;
  }

  const latestDate = new Date(series[series.length - 1].baseDate);
  const startDate = new Date(latestDate);

  if (range === '3M') {
    startDate.setMonth(latestDate.getMonth() - 3);
  }

  if (range === '1Y') {
    startDate.setFullYear(latestDate.getFullYear() - 1);
  }

  return series.filter((point) => new Date(point.baseDate) >= startDate);
}

function getValueDomain(series: ChartPoint[], padding: number): [number, number] | ['auto', 'auto'] {
  if (series.length === 0) {
    return ['auto', 'auto'];
  }

  const values = series.map((point) => point.value);
  return [Math.floor(Math.min(...values) - padding), Math.ceil(Math.max(...values) + padding)];
}

function getLatestValueLabelTop(value: number | null, domain: [number, number] | ['auto', 'auto'], xAxisHeight: number) {
  if (value === null || typeof domain[0] !== 'number') {
    return null;
  }

  const [min, max] = domain;
  if (max === min) {
    return 50;
  }

  const ratio = (max - value) / (max - min);
  const plotTop = chartTopMarginPx;
  const plotBottom = chartHeightPx - chartBottomMarginPx - xAxisHeight;
  return ((plotTop + ratio * (plotBottom - plotTop)) / chartHeightPx) * 100;
}

function getXDomain(series: ChartPoint[], range: RangeKey): [number, number] | ['dataMin', 'dataMax'] {
  if (range === '1D') {
    return [intradaySessionStartMinutes, intradaySessionEndMinutes];
  }

  if (series.length === 0) {
    return ['dataMin', 'dataMax'];
  }

  return [series[0].x, series[series.length - 1].x];
}

function getUsdKrwXTicks(range: RangeKey) {
  if (range !== '1D') {
    return undefined;
  }

  const ticks: number[] = [];
  for (let minute = intradaySessionStartMinutes; minute <= intradaySessionEndMinutes; minute += 60) {
    ticks.push(minute);
  }

  return ticks;
}

function formatUsdKrwXTick(value: number) {
  const hour = Math.floor((value % (24 * 60)) / 60);
  return hour.toString().padStart(2, '0');
}

function getSessionMinute(dateTime: string, sessionStartDate: string) {
  const date = dateTime.slice(0, 10);
  const time = dateTime.slice(11, 16);
  const [hour, minute] = time.split(':').map(Number);

  if (date === sessionStartDate) {
    return hour * 60 + minute;
  }

  return 24 * 60 + hour * 60 + minute;
}

function getIntradaySessionStartDate(dateTime: string) {
  const date = dateTime.slice(0, 10);
  const [hour, minute] = dateTime.slice(11, 16).split(':').map(Number);
  if (hour * 60 + minute >= intradaySessionStartMinutes) {
    return date;
  }

  return shiftDate(date, -1);
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shiftedDate = new Date(Date.UTC(year, month - 1, day));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function getUsdKrwReferenceLabel(range: RangeKey, series: ChartPoint[], baseDate?: string) {
  if (series.length === 0) {
    return '기준 데이터 없음';
  }

  if (range === '1D') {
    return formatIntradaySessionLabel(series);
  }

  return `${series[0].label} ~ ${series[series.length - 1].label} · 기준 ${baseDate ?? series[series.length - 1].label}`;
}

function getDailyReferenceLabel(series: ChartPoint[]) {
  if (series.length === 0) {
    return '기준 데이터 없음';
  }

  return `${series[0].label} ~ ${series[series.length - 1].label}`;
}

function getLatestIntradayDate(series: IntradayTimeSeriesPoint[]) {
  if (series.length === 0) {
    return null;
  }

  return series[series.length - 1].observedAt.slice(0, 10);
}

function getIntradayStatusLabel(
  isSyncing: boolean,
  latestIntradayDate: string | null,
  sessionPointCount: number,
  latestSessionObservedAt: string | null,
  remainingCooldownSeconds: number
) {
  if (isSyncing) {
    return '1일 세션 데이터 확인 중';
  }

  if (sessionPointCount > 0) {
    return `최신 ${formatIntradayObservedAt(latestSessionObservedAt)} · ${sessionPointCount}개`;
  }

  if (!latestIntradayDate) {
    return '1일 세션 데이터 확인 중';
  }

  if (remainingCooldownSeconds > 0) {
    return `최근 저장 세션 ${latestIntradayDate} · 다음 1일 데이터 확인까지 ${formatCooldown(remainingCooldownSeconds)}`;
  }

  return `최근 저장 세션 ${latestIntradayDate} · 자동 확인 대기 중`;
}

function formatIntradaySessionLabel(series: ChartPoint[]) {
  const first = series[0].dateValue;
  const sessionStartDate = getIntradaySessionStartDate(first);
  return `${sessionStartDate} 세션 · 09:00~익일 02:00 · 5분`;
}

function formatIntradayObservedAt(dateTime: string | null) {
  if (!dateTime) {
    return '-';
  }

  return `${dateTime.slice(0, 10)} ${dateTime.slice(11, 16)}`;
}

function getLatestSyncLabel(syncStatus: SyncStatus | null, remainingCooldownSeconds: number) {
  if (!syncStatus?.latestStartedAt) {
    return '전체 데이터 수집 이력 없음 · 화면은 저장된 DB 데이터를 자동으로 다시 확인합니다.';
  }

  const latestTime = formatDateTime(syncStatus.latestEndedAt ?? syncStatus.latestStartedAt);
  const status = syncStatus.latestStatus ?? 'UNKNOWN';
  if (remainingCooldownSeconds > 0) {
    return `전체 데이터 수집 ${latestTime} · ${status} · 다음 전체 수집까지 ${formatCooldown(remainingCooldownSeconds)}`;
  }

  return `전체 데이터 수집 ${latestTime} · ${status} · 수집 가능`;
}

function getSyncSkippedMessage(result: SyncResult) {
  if (result.status === 'SKIPPED_RUNNING') {
    return '이미 수집이 진행 중입니다. 저장된 데이터는 자동으로 다시 확인합니다.';
  }

  return `API 호출 제한 보호 중입니다. ${formatCooldown(result.remainingCooldownSeconds)} 후 다시 수집할 수 있습니다.`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return `${fallback} 백엔드 로그를 확인하세요.`;
  }

  const axiosError = error as AxiosError<{ message?: string; error?: string; status?: number }>;
  const status = axiosError.response?.status;
  const responseMessage = axiosError.response?.data?.message ?? axiosError.response?.data?.error;
  if (status && responseMessage) {
    return `${fallback} HTTP ${status}: ${responseMessage}`;
  }

  if (status) {
    return `${fallback} HTTP ${status}`;
  }

  return `${fallback} ${axiosError.message}`;
}

function formatCooldown(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return '곧';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}

function getRemainingCooldownSeconds(syncStatus: SyncStatus | null, nowMs: number) {
  if (!syncStatus?.nextAllowedAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(syncStatus.nextAllowedAt).getTime() - nowMs) / 1000));
}

function getSeoulDateString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function getSeoulTimeString(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

function hasMissingRecentWeekday(series: TimeSeriesPoint[], today: string) {
  if (series.length === 0) {
    return false;
  }

  const existingDates = new Set(series.map((point) => point.baseDate));
  for (let daysBack = 1; daysBack <= 7; daysBack += 1) {
    const date = addDaysToDateString(today, -daysBack);
    if (isWeekdayDateString(date) && !existingDates.has(date)) {
      return true;
    }
  }

  return false;
}

function addDaysToDateString(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function isWeekdayDateString(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
