import { cloneElement, type PointerEvent, type ReactElement, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx
} from '../constants';
import type { ChartHoverState, ChartPoint, MetricSnapshot, RangeKey } from '../types';
import { formatCrosshairDate } from '../utils/chart';
import { formatMetricUnit, formatMetricValue, formatValue } from '../utils/format';
import {
  ChartCrosshairOverlay,
  ChartEmptyState,
  ChartHelpTooltip,
  ChartPlotGrid,
  LatestValueDot,
  RangeSelector,
  getActiveChartHover
} from './ChartElements';

type RangeSelectorOption<T extends RangeKey> = {
  key: T;
  label: string;
};

type AxisTickProps = {
  x?: number;
  y?: number;
  payload?: {
    value?: number | string;
  };
};

type TooltipSide = 'left' | 'right';

type MarketChartSectionProps<T extends RangeKey> = {
  title: string;
  helpAriaLabel: string;
  helpTitle: string;
  helpWidthClassName?: string;
  helpContent: ReactNode;
  range: T;
  rangeColumns: 2 | 3 | 4;
  rangeOptions: Array<RangeSelectorOption<T>>;
  onRangeChange: (range: T) => void;
  subtitle: ReactNode;
  keepHeaderSingleLineOnMobile?: boolean;
  statusText: ReactNode;
  statusTextPlacement?: 'belowTitle' | 'headerRight';
  statusClassName?: string;
  series: ChartPoint[];
  emptyText: ReactNode;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
  xAxisHeight: number;
  xAxisPadding: { left: number; right: number };
  xTicks?: number[];
  xTickFormatter: (value: number) => string;
  yDomain: [number, number] | ['auto', 'auto'];
  tooltipContent: ReactElement;
  titleAction?: ReactNode;
  usePointerHover?: boolean;
  hover: ChartHoverState | null;
  onHoverChange: (hover: ChartHoverState | null) => void;
  plotLeft: number;
  plotRight: number;
  referenceStroke: string;
  lineStroke: string;
  lineStrokeWidth?: number;
  metric?: MetricSnapshot | null;
  panelDetails?: Array<{ label: string; value: string }>;
  panelFooterText?: string;
  statusNode?: ReactNode;
  headerAction?: ReactNode;
  headerActionPlacement?: 'header' | 'chartControls' | 'panel';
  headerStatus?: ReactNode;
  showLatestValueDot?: boolean;
  showLoadingOverlay?: boolean;
};

export function MarketChartSection<T extends RangeKey>({
  emptyText,
  helpAriaLabel,
  helpContent,
  helpTitle,
  helpWidthClassName,
  hover,
  lineStroke,
  lineStrokeWidth = 2,
  metric,
  keepHeaderSingleLineOnMobile = false,
  onHoverChange,
  onRangeChange,
  panelDetails = [],
  panelFooterText,
  headerAction,
  headerActionPlacement = 'header',
  headerStatus,
  showLatestValueDot = false,
  showLoadingOverlay = false,
  plotLeft,
  plotRight,
  range,
  rangeColumns,
  rangeOptions,
  referenceStroke,
  series,
  statusClassName = 'text-zinc-500',
  statusNode,
  statusText,
  statusTextPlacement = 'belowTitle',
  subtitle,
  title,
  titleAction,
  tooltipContent,
  usePointerHover = false,
  xAxisHeight,
  xAxisPadding,
  xDomain,
  xTickFormatter,
  xTicks,
  yDomain
}: MarketChartSectionProps<T>) {
  const latestPoint = series[series.length - 1] ?? null;
  const chartBottom = chartBottomMarginPx + xAxisHeight;
  const chartSurfaceRef = useRef<HTMLDivElement | null>(null);
  const axisValueTextRef = useRef<HTMLSpanElement | null>(null);
  const axisTimeTextRef = useRef<HTMLDivElement | null>(null);
  const pointerTooltipRef = useRef<HTMLDivElement | null>(null);
  const pointerTooltipTimeRef = useRef<HTMLElement | null>(null);
  const pointerTooltipValueRef = useRef<HTMLElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const latestVibratedPointKeyRef = useRef<string | null>(null);
  const latestVibrationAtRef = useRef(0);
  const pendingHoverRef = useRef<ChartHoverState | null>(null);
  const hoverAnimationFrameRef = useRef<number | null>(null);
  const committedHoverKeyRef = useRef<string | null>(null);
  const tooltipSideRef = useRef<TooltipSide>('right');
  const [chartPixelHeight, setChartPixelHeight] = useState(chartHeightPx);
  const plotBottom = chartPixelHeight - chartBottom;
  const axisWidth = 58;
  const plotInsetLeft = 18;

  useLayoutEffect(() => {
    const element = chartSurfaceRef.current;
    if (!element) {
      return;
    }

    const updateChartSize = () => {
      const { height: nextHeight } = element.getBoundingClientRect();
      if (nextHeight > 0) {
        setChartPixelHeight(nextHeight);
      }
    };

    updateChartSize();
    const resizeObserver = new ResizeObserver(updateChartSize);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const commitHoverChange = () => {
    hoverAnimationFrameRef.current = null;
    const nextHover = pendingHoverRef.current;
    committedHoverKeyRef.current = hoverStateKey(nextHover);
    onHoverChange(nextHover);
  };

  const scheduleHoverChange = (nextHover: ChartHoverState | null, options: { commitOnSamePoint?: boolean; positionOnly?: boolean } = {}) => {
    const nextKey = hoverStateKey(nextHover);
    if (options.positionOnly && committedHoverKeyRef.current !== null && nextKey !== null) {
      pendingHoverRef.current = nextHover;
      return;
    }
    if (!options.commitOnSamePoint && nextKey === committedHoverKeyRef.current) {
      pendingHoverRef.current = nextHover;
      return;
    }
    pendingHoverRef.current = nextHover;
    if (nextKey === null || committedHoverKeyRef.current === null) {
      if (hoverAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverAnimationFrameRef.current);
        hoverAnimationFrameRef.current = null;
      }
      commitHoverChange();
      return;
    }
    if (hoverAnimationFrameRef.current !== null) {
      return;
    }
    hoverAnimationFrameRef.current = window.requestAnimationFrame(commitHoverChange);
  };

  useEffect(() => () => {
    if (hoverAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverAnimationFrameRef.current);
    }
  }, []);

  const updateCrosshairPosition = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartSurfaceRef.current;
    if (!element || series.length === 0) {
      return;
    }

    const isTouchPointer = event.pointerType === 'touch';

    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const plotRightEdge = rect.width - axisWidth;

    if (x < plotInsetLeft || x > plotRightEdge || y < chartTopMarginPx || y > plotBottom) {
      element.classList.remove('chart-crosshair-active');
      scheduleHoverChange(null);
      return;
    }

    const chartCenterX = rect.width / 2;
    const sideSwitchBuffer = Math.min(72, Math.max(36, rect.width * 0.12));
    const hasActiveTooltip = pendingHoverRef.current !== null;
    let nextTooltipSide = hasActiveTooltip ? tooltipSideRef.current : x > chartCenterX ? 'left' : 'right';
    if (tooltipSideRef.current === 'right' && x > chartCenterX + sideSwitchBuffer) {
      nextTooltipSide = 'left';
    } else if (tooltipSideRef.current === 'left' && x < chartCenterX - sideSwitchBuffer) {
      nextTooltipSide = 'right';
    }
    if (tooltipSideRef.current !== nextTooltipSide) {
      tooltipSideRef.current = nextTooltipSide;
    }

    const clampedY = Math.min(plotBottom, Math.max(chartTopMarginPx, y));
    const tooltipPosition = getTooltipPosition({
      chartHeight: rect.height,
      chartWidth: rect.width,
      isTouchPointer,
      side: nextTooltipSide,
      x,
      y: clampedY
    });
    const axisLabelY = Math.min(chartPixelHeight - 36, Math.max(10, clampedY));
    const axisTimeX = Math.min(rect.width - 37, Math.max(37, x));
    element.style.setProperty('--chart-crosshair-x', `${x}px`);
    element.style.setProperty('--chart-crosshair-y', `${clampedY}px`);
    element.style.setProperty('--chart-axis-label-y', `${axisLabelY}px`);
    element.style.setProperty('--chart-axis-time-x', `${axisTimeX}px`);
    element.style.setProperty('--chart-tooltip-left', `${tooltipPosition.x}px`);
    element.style.setProperty('--chart-tooltip-top', `${tooltipPosition.y}px`);
    if (pointerTooltipRef.current?.isConnected) {
      pointerTooltipRef.current.style.transform = `translate3d(${tooltipPosition.x}px, ${tooltipPosition.y}px, 0)`;
    }
    element.classList.add('chart-crosshair-active');

    if (usePointerHover) {
      const point = getNearestPointFromPointerX({
        plotLeft: plotInsetLeft,
        plotRight: plotRightEdge,
        series,
        x,
        xDomain
      });

      if (point) {
        const axisValue = getPointerAxisValue({
          chartBottom,
          chartHeight: chartPixelHeight,
          fallbackValue: point.value,
          y: clampedY,
          yDomain
        });
        const valueTextNode = axisValueTextRef.current?.isConnected
          ? axisValueTextRef.current
          : element.querySelector<HTMLSpanElement>('.chart-axis-value-label span');
        const timeTextNode = axisTimeTextRef.current?.isConnected
          ? axisTimeTextRef.current
          : element.querySelector<HTMLDivElement>('.chart-axis-time-label');
        axisValueTextRef.current = valueTextNode;
        axisTimeTextRef.current = timeTextNode;
        if (valueTextNode) {
          valueTextNode.textContent = formatValue(axisValue);
        }
        if (timeTextNode) {
          timeTextNode.textContent = formatCrosshairDate(point.dateValue, range);
        }
        if (pointerTooltipTimeRef.current?.isConnected) {
          pointerTooltipTimeRef.current.textContent = formatCrosshairDate(point.dateValue, range);
        }
        if (pointerTooltipValueRef.current?.isConnected) {
          pointerTooltipValueRef.current.textContent = `${formatValue(point.value)}원`;
        }
        const nextHover = { point, value: axisValue, x, y: clampedY };
        scheduleHoverChange(nextHover, { positionOnly: true });
        vibrateForTouchPoint(event, point);
      }
    }
  };

  const hideCrosshair = () => {
    chartSurfaceRef.current?.classList.remove('chart-crosshair-active');
    activePointerIdRef.current = null;
    latestVibratedPointKeyRef.current = null;
    scheduleHoverChange(null);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateCrosshairPosition(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }
    updateCrosshairPosition(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    activePointerIdRef.current = null;
  };

  const vibrateForTouchPoint = (event: PointerEvent<HTMLDivElement>, point: ChartPoint) => {
    if (event.pointerType !== 'touch' || typeof navigator.vibrate !== 'function') {
      return;
    }

    const pointKey = `${point.dateValue}-${point.value}`;
    const now = Date.now();
    if (latestVibratedPointKeyRef.current === pointKey || now - latestVibrationAtRef.current < 80) {
      return;
    }

    latestVibratedPointKeyRef.current = pointKey;
    latestVibrationAtRef.current = now;
    navigator.vibrate(8);
  };

  const chartControls = (
    <div className={`chart-control-row ${headerActionPlacement === 'chartControls' && headerAction ? 'chart-control-row-with-action' : ''}`}>
      <div className="chart-range-control">
        <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
      </div>
      {headerActionPlacement === 'chartControls' && headerAction ? (
        <div className="chart-secondary-control">
          {headerAction}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative">
      <article className="glass-card min-w-0 rounded-2xl shadow-sm">
        <div className="grid gap-4 p-3.5 sm:gap-5 sm:p-4">
          <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-1">
            <div className="grid min-w-0 gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className={`text-base font-semibold text-white ${keepHeaderSingleLineOnMobile ? 'shrink-0 whitespace-nowrap' : ''}`}>{title}</h2>
                <ChartHelpTooltip ariaLabel={helpAriaLabel} title={helpTitle} widthClassName={helpWidthClassName}>
                  {helpContent}
                </ChartHelpTooltip>
                {titleAction}
              </div>
              {statusText && statusTextPlacement === 'belowTitle' ? <span className={`block text-xs leading-5 ${statusClassName}`}>{statusText}</span> : null}
            </div>
            <div className={`flex shrink-0 items-center justify-end gap-2 text-right ${keepHeaderSingleLineOnMobile ? 'flex-nowrap' : 'flex-wrap'}`}>
              {statusText && statusTextPlacement === 'headerRight' ? <span className={`block max-w-[58vw] whitespace-nowrap text-right text-xs leading-5 sm:max-w-none ${statusClassName}`}>{statusText}</span> : null}
              {subtitle ? (
                <p className="whitespace-nowrap text-left text-xs text-white/70 sm:text-right">
                  {subtitle}
                </p>
              ) : null}
              {headerStatus}
              {headerActionPlacement === 'header' ? headerAction : null}
            </div>
          </div>

          <div className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="order-1 grid min-w-0 justify-items-center gap-2 px-1 pb-1 pt-2 text-center lg:hidden">
              <div className="chart-price-divider flex min-w-0 max-w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
                <p className="min-w-0 break-words text-[1.78rem] font-semibold leading-none tracking-normal text-white">{metric ? formatMetricValue(metric) : '-'}</p>
                <span className="shrink-0 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
              </div>
              {chartControls}
            </div>

            <div
              className="chart-grid-surface relative order-2 h-72 min-w-0 overflow-hidden rounded-2xl sm:h-80 lg:order-1 lg:h-full lg:min-h-96"
              onPointerCancel={hideCrosshair}
              onPointerDown={handlePointerDown}
              onPointerLeave={hideCrosshair}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              ref={chartSurfaceRef}
            >
              <div className="chart-range-enter absolute inset-0" key={range}>
                <ChartPlotGrid bottom={chartBottom} left={plotInsetLeft} right={axisWidth} top={chartTopMarginPx} />
                {series.length === 0 ? (
                  <ChartEmptyState>{emptyText}</ChartEmptyState>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={series}
                      margin={{ top: chartTopMarginPx, right: 0, bottom: 0, left: plotInsetLeft }}
                      onMouseLeave={hideCrosshair}
                      onMouseMove={usePointerHover ? undefined : (state) => {
                        const nextHover = getActiveChartHover(state, series, {
                          chartBottom: chartPixelHeight,
                          plotBottom,
                          plotLeft: plotInsetLeft,
                          plotTop: chartTopMarginPx
                        });
                        scheduleHoverChange(nextHover, { commitOnSamePoint: true });
                      }}
                    >
                      <XAxis
                        dataKey="x"
                        type="number"
                        domain={xDomain}
                        height={xAxisHeight}
                        padding={xAxisPadding}
                        ticks={xTicks}
                        tickFormatter={(value) => xTickFormatter(value)}
                        tick={{ fontSize: 10, fill: 'rgba(75,85,99,0.82)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis
                        orientation="right"
                        domain={yDomain}
                        tick={<YAxisTick />}
                        tickLine={false}
                        axisLine={false}
                        tickCount={8}
                        width={axisWidth}
                      />
                      {!usePointerHover ? (
                        <Tooltip
                          animationDuration={120}
                          content={tooltipContent}
                          cursor={false}
                          wrapperStyle={{ outline: 'none', transition: 'none' }}
                        />
                      ) : null}
                      {latestPoint ? (
                        <ReferenceLine
                          y={latestPoint.value}
                          stroke={referenceStroke}
                          strokeDasharray="4 4"
                          strokeOpacity={0.45}
                        />
                      ) : null}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={lineStroke}
                        strokeWidth={lineStrokeWidth}
                        dot={false}
                        activeDot={usePointerHover ? false : { r: 4, strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                      {showLatestValueDot ? (
                        <Line
                          type="monotone"
                          dataKey="latestValue"
                          stroke="transparent"
                          dot={<LatestValueDot />}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <ChartCrosshairOverlay
                  bottom={chartBottom}
                  chartHeight={chartPixelHeight}
                  hover={hover}
                  left={plotInsetLeft}
                  range={range}
                  right={axisWidth}
                  top={chartTopMarginPx}
                  yDomain={yDomain}
                />
                {hover ? usePointerHover ? (
                  <div
                    className="chart-pointer-tooltip"
                    ref={pointerTooltipRef}
                  >
                    <div className="chart-hover-tooltip w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg shadow-zinc-950/10">
                      <p className="font-semibold text-zinc-950">{title}</p>
                      <dl className="mt-2 grid gap-1.5">
                        <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
                          <dt className="text-zinc-400">시점</dt>
                          <dd className="min-w-0 font-medium leading-5 text-zinc-800" ref={pointerTooltipTimeRef}>
                            {formatCrosshairDate(hover.point.dateValue, range)}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
                          <dt className="text-zinc-400">환율</dt>
                          <dd className="min-w-0 font-medium leading-5 text-zinc-800" ref={pointerTooltipValueRef}>
                            {formatValue(hover.point.value)}원
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ) : (() => {
                  return (
                    <div
                      className="chart-pointer-tooltip"
                      ref={pointerTooltipRef}
                    >
                      {cloneElement(tooltipContent, {
                        active: true,
                        payload: [{ payload: hover.point, value: hover.point.value }]
                      })}
                    </div>
                  );
                })() : null}
              </div>
              {showLoadingOverlay ? (
                <div className="chart-loading-overlay absolute inset-0 z-20 grid place-items-center px-4 text-center">
                  <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-lg shadow-zinc-950/10">
                    새로운 정보를 받아오는 중...
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="order-2 hidden min-w-0 flex-col gap-2 lg:flex lg:min-h-96">
              <div className="px-1 pb-1 pt-3">
                <div className="chart-price-divider flex items-end justify-between gap-3">
                  <p className="min-w-0 break-words text-2xl font-semibold tracking-normal text-white sm:text-3xl">{metric ? formatMetricValue(metric) : '-'}</p>
                  <span className="shrink-0 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
                </div>
                <div className="mt-4">
                  {chartControls}
                </div>
              </div>
              <div className="glass-subcard flex min-w-0 flex-1 flex-col justify-center rounded-2xl p-4">
                {headerActionPlacement === 'panel' && headerAction ? (
                  <div className="panel-action-row">
                    {headerAction}
                  </div>
                ) : null}
                <div className="grid gap-4">
                  {statusNode ? (
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                      {statusNode}
                    </div>
                  ) : null}
                </div>
                <dl className={`${statusNode ? 'mt-4' : headerActionPlacement === 'panel' && headerAction ? 'mt-2' : ''} flex flex-col gap-3 text-xs`}>
                  {panelDetails.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-white/55">{item.label}</dt>
                      <dd className="min-w-0 text-right font-medium leading-5 text-white/85">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {panelFooterText ? <p className="mt-4 text-xs text-white/55">{panelFooterText}</p> : null}
              </div>
            </aside>

            <div className="glass-subcard order-3 min-w-0 rounded-2xl px-3 py-4 lg:hidden">
              {headerActionPlacement === 'panel' && headerAction ? (
                <div className="panel-action-row">
                  {headerAction}
                </div>
              ) : null}
              {statusNode ? (
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                  {statusNode}
                </div>
              ) : null}
              <dl className={`${statusNode ? 'mt-5' : headerActionPlacement === 'panel' && headerAction ? 'mt-2' : ''} flex flex-col gap-2.5 text-xs`}>
                {panelDetails.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-white/55">{item.label}</dt>
                    <dd className="min-w-0 text-right font-medium leading-5 text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {panelFooterText ? <p className="mt-4 text-xs text-white/55">{panelFooterText}</p> : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function getNearestPointFromPointerX({
  plotLeft,
  plotRight,
  series,
  x,
  xDomain
}: {
  plotLeft: number;
  plotRight: number;
  series: ChartPoint[];
  x: number;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
}) {
  if (series.length === 0 || plotRight <= plotLeft) {
    return null;
  }

  const minX = typeof xDomain[0] === 'number' ? xDomain[0] : series[0].x;
  const maxX = typeof xDomain[1] === 'number' ? xDomain[1] : series[series.length - 1].x;
  if (maxX <= minX) {
    return series[series.length - 1];
  }

  const ratio = Math.min(1, Math.max(0, (x - plotLeft) / (plotRight - plotLeft)));
  const targetX = minX + ratio * (maxX - minX);
  let low = 0;
  let high = series.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (series[mid].x < targetX) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const current = series[low];
  const previous = series[low - 1];
  if (!previous) {
    return current;
  }

  return Math.abs(previous.x - targetX) <= Math.abs(current.x - targetX) ? previous : current;
}

function hoverStateKey(hover: ChartHoverState | null) {
  return hover ? `${hover.point.dateValue}|${hover.point.value}` : null;
}

function getPointerAxisValue({
  chartHeight,
  chartBottom,
  fallbackValue,
  y,
  yDomain
}: {
  chartBottom: number;
  chartHeight: number;
  fallbackValue: number;
  y: number;
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return fallbackValue;
  }

  const [min, max] = yDomain;
  const plotTop = chartTopMarginPx;
  const plotBottom = chartHeight - chartBottom;
  if (max === min || plotBottom <= plotTop) {
    return fallbackValue;
  }

  const ratio = (Math.min(plotBottom, Math.max(plotTop, y)) - plotTop) / (plotBottom - plotTop);
  return max - ratio * (max - min);
}

function getTooltipPosition({
  chartHeight,
  chartWidth,
  isTouchPointer,
  side,
  x,
  y
}: {
  chartHeight: number;
  chartWidth: number;
  isTouchPointer: boolean;
  side: TooltipSide;
  x: number;
  y: number;
}) {
  const tooltipWidth = 192;
  const tooltipHeight = 88;
  const tooltipGap = isTouchPointer ? 72 : 26;
  const rawX = side === 'left' ? x - tooltipWidth - tooltipGap : x + tooltipGap;

  return {
    x: Math.min(Math.max(8, chartWidth - tooltipWidth - 8), Math.max(8, rawX)),
    y: Math.min(Math.max(8, chartHeight - tooltipHeight - 8), Math.max(8, y - (isTouchPointer ? 82 : 58)))
  };
}

function YAxisTick({ payload, x = 0, y = 0 }: AxisTickProps) {
  return (
    <text
      dy={4}
      fill="rgba(75,85,99,0.82)"
      fontSize={10}
      textAnchor="start"
      x={x}
      y={y}
    >
      {formatValue(Number(payload?.value))}
    </text>
  );
}
