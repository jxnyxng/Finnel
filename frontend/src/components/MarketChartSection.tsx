import { type PointerEvent, type ReactElement, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
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

type MarketChartSectionProps<T extends RangeKey> = {
  title: string;
  helpAriaLabel: string;
  helpTitle: string;
  helpWidthClassName?: string;
  helpContent: ReactNode;
  range: T;
  rangeColumns: 3 | 4;
  rangeOptions: Array<RangeSelectorOption<T>>;
  onRangeChange: (range: T) => void;
  subtitle: ReactNode;
  keepHeaderSingleLineOnMobile?: boolean;
  statusText: ReactNode;
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
  usePointerHover?: boolean;
  hover: ChartHoverState | null;
  onHoverChange: (hover: ChartHoverState | null) => void;
  plotLeft: number;
  plotRight: number;
  referenceStroke: string;
  lineStroke: string;
  metric?: MetricSnapshot | null;
  panelDetails?: Array<{ label: string; value: string }>;
  panelFooterText?: string;
  statusNode?: ReactNode;
  headerAction?: ReactNode;
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
  metric,
  keepHeaderSingleLineOnMobile = false,
  onHoverChange,
  onRangeChange,
  panelDetails = [],
  panelFooterText,
  headerAction,
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
  subtitle,
  title,
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
  const hoverFrameRef = useRef<number | null>(null);
  const hoverCommitTimeoutRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<ChartHoverState | null>(null);
  const [chartPixelHeight, setChartPixelHeight] = useState(chartHeightPx);
  const plotBottom = chartPixelHeight - chartBottom;
  const axisWidth = 58;
  const plotInsetLeft = 18;

  useLayoutEffect(() => {
    const element = chartSurfaceRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = element.getBoundingClientRect().height;
      if (nextHeight > 0) {
        setChartPixelHeight(nextHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useLayoutEffect(() => () => {
    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current);
    }
    if (hoverCommitTimeoutRef.current !== null) {
      window.clearTimeout(hoverCommitTimeoutRef.current);
    }
  }, []);

  const commitHoverChange = () => {
    onHoverChange(pendingHoverRef.current);
  };

  const scheduleHoverChange = (nextHover: ChartHoverState | null, immediate = false) => {
    pendingHoverRef.current = nextHover;
    if (immediate) {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      if (hoverCommitTimeoutRef.current !== null) {
        window.clearTimeout(hoverCommitTimeoutRef.current);
        hoverCommitTimeoutRef.current = null;
      }
      commitHoverChange();
      return;
    }

    if (usePointerHover) {
      if (hoverCommitTimeoutRef.current !== null) {
        return;
      }
      hoverCommitTimeoutRef.current = window.setTimeout(() => {
        hoverCommitTimeoutRef.current = null;
        commitHoverChange();
      }, 120);
      return;
    }

    if (hoverFrameRef.current !== null) {
      return;
    }
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      onHoverChange(pendingHoverRef.current);
    });
  };

  const updateCrosshairPosition = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartSurfaceRef.current;
    if (!element || series.length === 0) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const plotRightEdge = rect.width - axisWidth;

    if (x < plotInsetLeft || x > plotRightEdge || y < chartTopMarginPx || y > plotBottom) {
      element.classList.remove('chart-crosshair-active');
      return;
    }

    const clampedY = Math.min(plotBottom, Math.max(chartTopMarginPx, y));
    const axisLabelY = Math.min(chartPixelHeight - 36, Math.max(10, clampedY));
    const axisTimeX = Math.min(rect.width - 37, Math.max(37, x));
    element.style.setProperty('--chart-crosshair-x', `${x}px`);
    element.style.setProperty('--chart-crosshair-y', `${clampedY}px`);
    element.style.setProperty('--chart-axis-label-y', `${axisLabelY}px`);
    element.style.setProperty('--chart-axis-time-x', `${axisTimeX}px`);
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
      }
    }
  };

  const hideCrosshair = () => {
    chartSurfaceRef.current?.classList.remove('chart-crosshair-active');
    scheduleHoverChange(null, true);
  };

  return (
    <div className="relative">
      <article className="glass-card min-w-0 rounded-2xl shadow-sm">
        <div className="grid gap-4 p-3.5 sm:gap-5 sm:p-4">
          <div className={`relative flex min-w-0 gap-2 px-1 ${
            keepHeaderSingleLineOnMobile ? 'flex-row items-center justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between'
          }`}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className={`text-base font-semibold text-white ${keepHeaderSingleLineOnMobile ? 'shrink-0 whitespace-nowrap' : ''}`}>{title}</h2>
              <ChartHelpTooltip ariaLabel={helpAriaLabel} title={helpTitle} widthClassName={helpWidthClassName}>
                {helpContent}
              </ChartHelpTooltip>
              {statusText ? <span className={`whitespace-nowrap text-xs ${statusClassName}`}>{statusText}</span> : null}
            </div>
            <div className={`flex shrink-0 items-center gap-2 sm:justify-end ${keepHeaderSingleLineOnMobile ? 'flex-nowrap' : 'flex-wrap'}`}>
              {subtitle ? (
                <p className="whitespace-nowrap text-left text-xs text-white/70 sm:text-right">
                  {subtitle}
                </p>
              ) : null}
              {headerAction}
            </div>
          </div>

          <div className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="order-1 flex min-w-0 items-center justify-between gap-4 px-1 py-2 lg:hidden">
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="min-w-0 break-words text-[1.78rem] font-semibold leading-none tracking-normal text-white">{metric ? formatMetricValue(metric) : '-'}</p>
                <span className="shrink-0 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
              </div>
              <div className="min-w-[9rem] max-w-[58%] shrink-0">
                <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
              </div>
            </div>

            <div
              className="chart-grid-surface relative order-2 h-72 min-w-0 overflow-hidden rounded-2xl sm:h-80 lg:order-1 lg:h-full lg:min-h-96"
              onPointerLeave={hideCrosshair}
              onPointerMove={updateCrosshairPosition}
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
                        scheduleHoverChange(nextHover);
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
                        strokeWidth={2}
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
                <div className="flex items-end justify-between gap-3">
                  <p className="min-w-0 break-words text-2xl font-semibold tracking-normal text-white sm:text-3xl">{metric ? formatMetricValue(metric) : '-'}</p>
                  <span className="shrink-0 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
                </div>
                <div className="mt-4">
                  <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
                </div>
              </div>
              <div className="glass-subcard flex min-w-0 flex-1 flex-col justify-center rounded-2xl p-4">
                <div className="grid gap-4">
                  {statusNode ? (
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                      {statusNode}
                    </div>
                  ) : null}
                </div>
                <dl className={`${statusNode ? 'mt-4' : ''} flex flex-col gap-3 text-xs`}>
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
              {statusNode ? (
                <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                  {statusNode}
                </div>
              ) : null}
              <dl className={`${statusNode ? 'mt-5' : ''} flex flex-col gap-2.5 text-xs`}>
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
