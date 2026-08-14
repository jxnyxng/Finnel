import { cloneElement, type PointerEvent, type ReactElement, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx
} from '../constants';
import type { ChartCandlestickPoint, ChartHoverState, ChartPoint, MetricSnapshot, RangeKey } from '../types';
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
  chartVariant?: 'line' | 'candlestick';
  candlestickSeries?: ChartCandlestickPoint[];
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
  showExtremaLines?: boolean;
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
  showExtremaLines = false,
  showLoadingOverlay = false,
  plotLeft,
  plotRight,
  range,
  rangeColumns,
  rangeOptions,
  referenceStroke,
  series,
  chartVariant = 'line',
  candlestickSeries = [],
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
  const showCandlesticks = chartVariant === 'candlestick' && candlestickSeries.length > 0;
  const renderSeries = showCandlesticks ? candlestickSeries : series;
  const latestPoint = renderSeries[renderSeries.length - 1] ?? null;
  const extrema = showExtremaLines ? getChartExtrema(renderSeries, showCandlesticks) : null;
  const chartBottom = chartBottomMarginPx + xAxisHeight;
  const chartSurfaceRef = useRef<HTMLDivElement | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const chartContentRef = useRef<HTMLDivElement | null>(null);
  const axisValueTextRef = useRef<HTMLSpanElement | null>(null);
  const axisTimeTextRef = useRef<HTMLDivElement | null>(null);
  const pointerTooltipRef = useRef<HTMLDivElement | null>(null);
  const pointerTooltipTimeRef = useRef<HTMLElement | null>(null);
  const pointerTooltipValueRef = useRef<HTMLElement | null>(null);
  const ohlcTimeValueRef = useRef<HTMLElement | null>(null);
  const ohlcOpenValueRef = useRef<HTMLElement | null>(null);
  const ohlcHighValueRef = useRef<HTMLElement | null>(null);
  const ohlcLowValueRef = useRef<HTMLElement | null>(null);
  const ohlcCloseValueRef = useRef<HTMLElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const latestVibratedPointKeyRef = useRef<string | null>(null);
  const latestVibrationAtRef = useRef(0);
  const pendingHoverRef = useRef<ChartHoverState | null>(null);
  const hoverAnimationFrameRef = useRef<number | null>(null);
  const committedHoverKeyRef = useRef<string | null>(null);
  const tooltipSideRef = useRef<TooltipSide>('right');
  const lastAutoCenteredPointKeyRef = useRef<string | null>(null);
  const hasUserScrolledCandlesRef = useRef(false);
  const ignoreNextChartScrollRef = useRef(false);
  const [chartPixelHeight, setChartPixelHeight] = useState(chartHeightPx);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [chartScrollLeft, setChartScrollLeft] = useState(0);
  const plotBottom = chartPixelHeight - chartBottom;
  const axisWidth = 58;
  const plotInsetLeft = 18;
  const candleSlotWidthPx = 9;
  const sessionCandleSlotCount = typeof xDomain[0] === 'number' && typeof xDomain[1] === 'number'
    ? Math.ceil((xDomain[1] - xDomain[0]) / 5) + 1
    : candlestickSeries.length;
  const chartPixelWidth = showCandlesticks
    ? Math.max(chartViewportWidth, sessionCandleSlotCount * candleSlotWidthPx + axisWidth + plotInsetLeft)
    : chartViewportWidth;
  const chartContentStyle = showCandlesticks
    ? { width: chartPixelWidth, minWidth: '100%' }
    : undefined;
  const xDomainKey = `${xDomain[0]}:${xDomain[1]}`;
  const chartTopAction = headerActionPlacement === 'chartControls' ? headerAction : null;
  const chartPlotTop = chartTopMarginPx + (chartTopAction ? 38 : 0);
  const effectiveYDomain = getExtremaPaddedYDomain({
    enabled: showExtremaLines,
    plotHeight: plotBottom - chartPlotTop,
    yDomain
  });
  const isNativeYAxisVisible = showCandlesticks
    && chartViewportWidth > 0
    && chartPixelWidth > chartViewportWidth
    && chartScrollLeft + chartViewportWidth >= chartPixelWidth - axisWidth;
  const visibleOhlcPoint = getDisplayOhlcPoint(hover?.point ?? null, candlestickSeries)
    ?? candlestickSeries[candlestickSeries.length - 1]
    ?? null;
  const showOhlcSummary = range === '1D' && candlestickSeries.length > 0;
  const ohlcItems = visibleOhlcPoint ? getOhlcSummaryItems(visibleOhlcPoint, range) : [];
  const effectiveXTicks = chartViewportWidth > 0 && chartViewportWidth < 520 && xTicks && xTicks.length > 8
    ? xTicks.filter((_, index) => index % 2 === 0)
    : xTicks;

  useLayoutEffect(() => {
    const element = chartSurfaceRef.current;
    if (!element) {
      return;
    }

    const updateChartSize = () => {
      const { height: nextHeight, width: nextWidth } = element.getBoundingClientRect();
      if (nextHeight > 0) {
        setChartPixelHeight(nextHeight);
      }
      if (nextWidth > 0) {
        setChartViewportWidth(nextWidth);
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

  useLayoutEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!showCandlesticks && scrollElement) {
      scrollElement.scrollLeft = 0;
      setChartScrollLeft(0);
      lastAutoCenteredPointKeyRef.current = null;
      hasUserScrolledCandlesRef.current = false;
      ignoreNextChartScrollRef.current = false;
    }
  }, [showCandlesticks]);

  useLayoutEffect(() => {
    hasUserScrolledCandlesRef.current = false;
    ignoreNextChartScrollRef.current = false;
    lastAutoCenteredPointKeyRef.current = null;
  }, [range, showCandlesticks, xDomainKey]);

  useLayoutEffect(() => {
    const scrollElement = chartScrollRef.current;
    if (!showCandlesticks || hasUserScrolledCandlesRef.current || !scrollElement || !latestPoint || chartViewportWidth <= 0 || chartPixelWidth <= chartViewportWidth) {
      return;
    }

    const latestPointKey = `${latestPoint.dateValue}-${latestPoint.value}`;
    if (lastAutoCenteredPointKeyRef.current === latestPointKey) {
      return;
    }

    const latestPointX = getPointXPosition({
      plotLeft: plotInsetLeft,
      plotRight: chartPixelWidth - axisWidth,
      point: latestPoint,
      xDomain
    });
    if (latestPointX === null) {
      return;
    }

    const maxScrollLeft = Math.max(0, chartPixelWidth - chartViewportWidth);
    const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, latestPointX - chartViewportWidth / 2));
    ignoreNextChartScrollRef.current = true;
    scrollElement.scrollLeft = nextScrollLeft;
    setChartScrollLeft(nextScrollLeft);
    lastAutoCenteredPointKeyRef.current = latestPointKey;
  }, [chartPixelWidth, chartViewportWidth, latestPoint, showCandlesticks, xDomain]);

  const updateCrosshairPosition = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartSurfaceRef.current;
    const scrollElement = chartScrollRef.current;
    if (!element || renderSeries.length === 0) {
      return;
    }

    const isTouchPointer = event.pointerType === 'touch';

    const rect = element.getBoundingClientRect();
    const scrollLeft = scrollElement?.scrollLeft ?? 0;
    const viewportX = event.clientX - rect.left;
    const x = viewportX + scrollLeft;
    const y = event.clientY - rect.top;
    const plotRightEdge = chartPixelWidth - axisWidth;

    if (isInsideChartSurfaceAction(event.target) || viewportX < 0 || viewportX > rect.width || x < plotInsetLeft || x > plotRightEdge || y < chartPlotTop || y > plotBottom) {
      element.classList.remove('chart-crosshair-active');
      scheduleHoverChange(null);
      return;
    }

    const chartCenterX = rect.width / 2;
    const sideSwitchBuffer = Math.min(72, Math.max(36, rect.width * 0.12));
    const hasActiveTooltip = pendingHoverRef.current !== null;
    let nextTooltipSide = hasActiveTooltip ? tooltipSideRef.current : viewportX > chartCenterX ? 'left' : 'right';
    if (tooltipSideRef.current === 'right' && viewportX > chartCenterX + sideSwitchBuffer) {
      nextTooltipSide = 'left';
    } else if (tooltipSideRef.current === 'left' && viewportX < chartCenterX - sideSwitchBuffer) {
      nextTooltipSide = 'right';
    }
    if (tooltipSideRef.current !== nextTooltipSide) {
      tooltipSideRef.current = nextTooltipSide;
    }

    const clampedY = Math.min(plotBottom, Math.max(chartPlotTop, y));
    const tooltipPosition = getTooltipPosition({
      chartHeight: rect.height,
      chartWidth: rect.width,
      isTouchPointer,
      side: nextTooltipSide,
      x: viewportX,
      y: clampedY
    });
    const axisLabelY = Math.min(chartPixelHeight - 36, Math.max(10, clampedY));
    const axisTimeX = x;
    const axisValueRight = Math.max(0, chartPixelWidth - scrollLeft - rect.width);
    element.style.setProperty('--chart-crosshair-x', `${x}px`);
    element.style.setProperty('--chart-crosshair-y', `${clampedY}px`);
    element.style.setProperty('--chart-axis-label-y', `${axisLabelY}px`);
    element.style.setProperty('--chart-axis-value-right', `${axisValueRight}px`);
    element.style.setProperty('--chart-axis-time-x', `${axisTimeX}px`);
    element.style.setProperty('--chart-tooltip-left', `${tooltipPosition.x + scrollLeft}px`);
    element.style.setProperty('--chart-tooltip-top', `${tooltipPosition.y}px`);
    if (pointerTooltipRef.current?.isConnected) {
      pointerTooltipRef.current.style.transform = `translate3d(${tooltipPosition.x + scrollLeft}px, ${tooltipPosition.y}px, 0)`;
    }
    element.classList.add('chart-crosshair-active');

    if (usePointerHover) {
      const point = getNearestPointFromPointerX({
        plotLeft: plotInsetLeft,
        plotRight: plotRightEdge,
        series: renderSeries,
        x,
        xDomain
      });

      if (point) {
        const snappedX = getPointXPosition({
          plotLeft: plotInsetLeft,
          plotRight: plotRightEdge,
          point,
          xDomain
        }) ?? x;
        element.style.setProperty('--chart-crosshair-x', `${snappedX}px`);
        element.style.setProperty('--chart-axis-time-x', `${snappedX}px`);
        const axisValue = getPointerAxisValue({
          chartBottom,
          chartHeight: chartPixelHeight,
          fallbackValue: point.value,
          y: clampedY,
          yDomain: effectiveYDomain,
          plotTop: chartPlotTop
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
        updateOhlcSummaryRefs(getDisplayOhlcPoint(point, candlestickSeries));
        const nextHover = { point, value: axisValue, x: snappedX, y: clampedY };
        scheduleHoverChange(nextHover, { positionOnly: true });
        vibrateForTouchPoint(event, point);
      }
    }
  };

  const hideCrosshair = () => {
    chartSurfaceRef.current?.classList.remove('chart-crosshair-active');
    activePointerIdRef.current = null;
    latestVibratedPointKeyRef.current = null;
    updateOhlcSummaryRefs(candlestickSeries[candlestickSeries.length - 1] ?? null);
    scheduleHoverChange(null);
  };

  const handleChartScroll = () => {
    setChartScrollLeft(chartScrollRef.current?.scrollLeft ?? 0);
    if (ignoreNextChartScrollRef.current) {
      ignoreNextChartScrollRef.current = false;
    } else if (showCandlesticks) {
      hasUserScrolledCandlesRef.current = true;
    }
    hideCrosshair();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isInsideChartSurfaceAction(event.target)) {
      return;
    }
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateCrosshairPosition(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isInsideChartSurfaceAction(event.target)) {
      return;
    }
    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }
    updateCrosshairPosition(event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    activePointerIdRef.current = null;
  };

  const updateOhlcSummaryRefs = (point: ChartCandlestickPoint | null) => {
    const items = point ? getOhlcSummaryItems(point, range) : [];
    const valuesByKey = new Map(items.map((item) => [item.key, item.value]));
    if (ohlcTimeValueRef.current?.isConnected) {
      ohlcTimeValueRef.current.textContent = valuesByKey.get('time') ?? '-';
    }
    if (ohlcOpenValueRef.current?.isConnected) {
      ohlcOpenValueRef.current.textContent = valuesByKey.get('open') ?? '-';
    }
    if (ohlcHighValueRef.current?.isConnected) {
      ohlcHighValueRef.current.textContent = valuesByKey.get('high') ?? '-';
    }
    if (ohlcLowValueRef.current?.isConnected) {
      ohlcLowValueRef.current.textContent = valuesByKey.get('low') ?? '-';
    }
    if (ohlcCloseValueRef.current?.isConnected) {
      ohlcCloseValueRef.current.textContent = valuesByKey.get('close') ?? '-';
    }
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
    <div className="chart-control-stack w-full">
      <div className="chart-range-control">
        <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
      </div>
    </div>
  );
  const sectionLabel = getSectionLabel(title);
  const collectionStatusSummary = getCollectionStatusSummary({
    panelDetails,
    range,
    sectionLabel,
    showCandlesticks
  });
  const collectionStatusDetails = collectionStatusSummary.filter((item) => item.label !== '수집' && item.label !== '점검');
  const compactPanelDetails = getCompactPanelDetails(panelDetails);
  const panelInfoDetails = [...collectionStatusDetails, ...compactPanelDetails];
  const renderAdSlot = () => (
    <div className="chart-ad-slot grid min-h-24 flex-1 place-items-center rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-3 py-4 text-[10px] font-semibold uppercase tracking-normal text-white/35">
      광고
    </div>
  );
  const collectionStatusCard = (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5">
      {headerStatus ? (
        <div className="rounded-lg bg-black/15 px-2.5 py-1.5">
          {headerStatus}
        </div>
      ) : statusText ? (
        <div className="rounded-lg bg-black/15 px-2.5 py-1.5">
          <p className="text-[11px] font-medium leading-4 text-white/45">업데이트</p>
          <p className="mt-0.5 text-xs font-semibold leading-4 text-white/85">{statusText}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-2">
      <article className="glass-card min-w-0 rounded-2xl shadow-sm">
        <div className="grid gap-4 p-3.5 sm:gap-5 sm:p-4">
          <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-1">
            <div className="grid min-w-0 gap-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="text-xs font-semibold leading-none text-white/45">{sectionLabel}</p>
                <ChartHelpTooltip ariaLabel={helpAriaLabel} placement="right" title={helpTitle} widthClassName={helpWidthClassName}>
                  {helpContent}
                </ChartHelpTooltip>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className={`min-w-0 break-words text-[1.85rem] font-semibold leading-none tracking-normal text-white sm:text-4xl ${keepHeaderSingleLineOnMobile ? 'shrink-0 whitespace-nowrap' : ''}`}>
                  {metric ? formatMetricValue(metric) : '-'}
                </h2>
                <span className="shrink-0 self-end pb-1 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
                {titleAction}
              </div>
            </div>
            <div className={`flex shrink-0 items-center justify-end gap-2 text-right ${keepHeaderSingleLineOnMobile ? 'flex-nowrap' : 'flex-wrap'}`}>
              {statusText && statusTextPlacement === 'headerRight' ? <span className={`block max-w-[58vw] whitespace-nowrap text-right text-xs leading-5 sm:max-w-none ${statusClassName}`}>{statusText}</span> : null}
              {subtitle ? (
                <p className="whitespace-nowrap text-left text-xs text-white/70 sm:text-right">
                  {subtitle}
                </p>
              ) : null}
              {headerActionPlacement === 'header' ? headerAction : null}
            </div>
          </div>

          <div className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="order-1 grid min-w-0 justify-items-stretch gap-2 px-1 pb-1 pt-2 text-center lg:hidden">
              {chartControls}
            </div>

            <div
              className="chart-grid-surface relative order-2 h-[23rem] min-w-0 overflow-hidden rounded-2xl sm:h-[27rem] lg:order-1 lg:h-full lg:min-h-[32rem]"
              onPointerCancel={hideCrosshair}
              onPointerDown={handlePointerDown}
              onPointerLeave={hideCrosshair}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              ref={chartSurfaceRef}
            >
              {chartTopAction ? (
                <div
                  className="chart-surface-action"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerMove={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                >
                  {chartTopAction}
                </div>
              ) : null}
              {showOhlcSummary ? (
                <dl className="chart-ohlc-summary pointer-events-none absolute left-3 top-3 z-20 flex max-w-[calc(100%-7.25rem)] flex-wrap gap-x-3 gap-y-1 text-left text-[11px] font-semibold leading-none text-zinc-500 sm:left-4 sm:gap-x-4">
                  {ohlcItems.map((item) => (
                    <div
                      className="inline-flex min-w-0 items-baseline gap-1.5 whitespace-nowrap"
                      key={item.label}
                    >
                      <dt className="shrink-0 text-zinc-400">{item.label}:</dt>
                      <dd
                        className="min-w-0 whitespace-nowrap text-zinc-700"
                        ref={item.key === 'time'
                          ? ohlcTimeValueRef
                          : item.key === 'open'
                            ? ohlcOpenValueRef
                            : item.key === 'high'
                              ? ohlcHighValueRef
                              : item.key === 'low'
                                ? ohlcLowValueRef
                                : ohlcCloseValueRef}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div
                className={`chart-scroll-layer absolute inset-0 ${showCandlesticks ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}
                onScroll={handleChartScroll}
                ref={chartScrollRef}
                style={{ touchAction: showCandlesticks ? 'pan-x' : undefined }}
              >
                <div
                  className={`chart-range-enter ${showCandlesticks ? 'relative h-full' : 'absolute inset-0'}`}
                  key={`${range}-${chartVariant}`}
                  ref={chartContentRef}
                  style={chartContentStyle}
                >
                  <ChartPlotGrid bottom={chartBottom} left={plotInsetLeft} right={axisWidth} top={chartPlotTop} />
                  {renderSeries.length === 0 ? (
                    <ChartEmptyState>{emptyText}</ChartEmptyState>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={renderSeries}
                        margin={{ top: chartPlotTop, right: 0, bottom: 0, left: plotInsetLeft }}
                        onMouseLeave={hideCrosshair}
                        onMouseMove={usePointerHover ? undefined : (state) => {
                          const nextHover = getActiveChartHover(state, renderSeries, {
                            chartBottom: chartPixelHeight,
                            plotBottom,
                            plotLeft: plotInsetLeft,
                            plotTop: chartPlotTop
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
                          ticks={effectiveXTicks}
                          tickFormatter={(value) => xTickFormatter(value)}
                          tick={{ fontSize: 10, fill: 'rgba(75,85,99,0.82)' }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                        />
                        <YAxis
                          orientation="right"
                          domain={effectiveYDomain}
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
                        {!showCandlesticks ? (
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={lineStroke}
                            strokeWidth={lineStrokeWidth}
                            dot={false}
                            activeDot={usePointerHover ? false : { r: 4, strokeWidth: 2 }}
                            isAnimationActive={false}
                          />
                        ) : (
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="transparent"
                            strokeWidth={1}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                          />
                        )}
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
                  {showCandlesticks ? (
                    <CandlestickOverlay
                      axisWidth={axisWidth}
                      candles={candlestickSeries}
                      chartHeight={chartPixelHeight}
                      chartWidth={chartPixelWidth}
                      plotBottom={plotBottom}
                      plotLeft={plotInsetLeft}
                      plotTop={chartPlotTop}
                      xDomain={xDomain}
                      yDomain={effectiveYDomain}
                    />
                  ) : null}
                  <ChartCrosshairOverlay
                    bottom={chartBottom}
                    chartHeight={chartPixelHeight}
                    hover={hover}
                    left={plotInsetLeft}
                    range={range}
                    right={axisWidth}
                    top={chartPlotTop}
                    yDomain={effectiveYDomain}
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
                  {extrema ? (
                    <ExtremaLabels
                      axisWidth={axisWidth}
                      bottom={chartBottom}
                      chartHeight={chartPixelHeight}
                      chartWidth={chartPixelWidth}
                      extrema={extrema}
                      plotLeft={plotInsetLeft}
                      top={chartPlotTop}
                      xDomain={xDomain}
                      yDomain={effectiveYDomain}
                    />
                  ) : null}
                </div>
              </div>
              {showCandlesticks && !isNativeYAxisVisible ? (
                <FloatingYAxisLabels
                  bottom={chartBottom}
                  chartHeight={chartPixelHeight}
                  top={chartPlotTop}
                  yDomain={effectiveYDomain}
                />
              ) : null}
              {showLoadingOverlay ? (
                <div className="chart-loading-overlay absolute inset-0 z-20 grid place-items-center px-4 text-center">
                  <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-lg shadow-zinc-950/10">
                    새로운 정보를 받아오는 중...
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="order-2 hidden min-w-0 flex-col gap-2 lg:flex lg:min-h-96">
              <div className="px-0 pb-0 pt-0.5">
                {chartControls}
              </div>
              <div className="glass-subcard flex min-w-0 flex-none flex-col rounded-2xl p-2.5">
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
                <div className={statusNode || headerActionPlacement === 'panel' && headerAction ? 'mt-1' : ''}>
                  {collectionStatusCard}
                </div>
                <dl className="mx-1.5 mb-1 mt-2 divide-y divide-white/10 text-xs">
                  {panelInfoDetails.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                      <dt className="shrink-0 text-white/55">{item.label}</dt>
                      <dd className="min-w-0 text-right font-medium leading-4 text-white/85">{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {panelFooterText ? <p className="mt-4 text-xs text-white/55">{panelFooterText}</p> : null}
              </div>
              {renderAdSlot()}
            </aside>

            <div className="glass-subcard order-3 min-w-0 rounded-2xl p-2.5 lg:hidden">
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
              <div className={statusNode || headerActionPlacement === 'panel' && headerAction ? 'mt-1' : ''}>
                {collectionStatusCard}
              </div>
              <dl className="mx-1.5 mb-1 mt-2 divide-y divide-white/10 text-xs">
                {panelInfoDetails.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                    <dt className="shrink-0 text-white/55">{item.label}</dt>
                    <dd className="min-w-0 text-right font-medium leading-4 text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {panelFooterText ? <p className="mt-4 text-xs text-white/55">{panelFooterText}</p> : null}
            </div>
            <div className="order-4 lg:hidden">
              {renderAdSlot()}
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

function getSectionLabel(title: string) {
  if (title.includes('원달러')) {
    return '원달러환율';
  }
  return title.replace(/^실시간\s+/, '');
}

function getCollectionStatusSummary({
  panelDetails,
  range,
  sectionLabel,
  showCandlesticks
}: {
  panelDetails: Array<{ label: string; value: string }>;
  range: RangeKey;
  sectionLabel: string;
  showCandlesticks: boolean;
}) {
  const source = panelDetails.find((item) => item.label === '출처')?.value;
  const period = panelDetails.find((item) => item.label === '기간')?.value;

  if (sectionLabel === '원달러환율' && range === '1D') {
    return [
      { label: '수집', value: '1분봉' },
      { label: '표시', value: `5분봉 ${showCandlesticks ? '캔들' : '라인'}` },
      { label: '점검', value: '5분마다 확인' },
      { label: '출처', value: source ?? 'Twelve Data' }
    ];
  }

  if (sectionLabel === '원달러환율') {
    return [
      { label: '수집', value: '일별 기준' },
      { label: '표시', value: '일별 환율' },
      { label: '출처', value: source ?? '저장 데이터' }
    ];
  }

  return [
    { label: '수집', value: '일별 기준' },
    { label: '표시', value: period ?? '선택 기간' },
    { label: '출처', value: source ?? 'FRED' }
  ];
}

function getCompactPanelDetails(panelDetails: Array<{ label: string; value: string }>) {
  const duplicatedLabels = new Set(['범위', '기간', '관측값', '최신 기준일', '세션', '출처', '구성', '해석']);
  return panelDetails.filter((item) => !duplicatedLabels.has(item.label));
}

function isInsideChartSurfaceAction(target: EventTarget | null) {
  return target instanceof Element && target.closest('.chart-surface-action') !== null;
}

function getPointXPosition({
  plotLeft,
  plotRight,
  point,
  xDomain
}: {
  plotLeft: number;
  plotRight: number;
  point: ChartPoint;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
}) {
  if (typeof xDomain[0] !== 'number' || typeof xDomain[1] !== 'number' || xDomain[1] <= xDomain[0]) {
    return null;
  }

  const ratio = (point.x - xDomain[0]) / (xDomain[1] - xDomain[0]);
  return plotLeft + ratio * (plotRight - plotLeft);
}

function hoverStateKey(hover: ChartHoverState | null) {
  return hover ? `${hover.point.dateValue}|${hover.point.value}` : null;
}

function getDisplayOhlcPoint(point: ChartPoint | null, candles: ChartCandlestickPoint[]) {
  if (point && isCandlestickPoint(point)) {
    return point;
  }

  if (!point) {
    return null;
  }

  return candles.find((candle) => candle.dateValue === point.dateValue) ?? null;
}

function isCandlestickPoint(point: ChartPoint): point is ChartCandlestickPoint {
  return 'open' in point && 'high' in point && 'low' in point && 'close' in point;
}

function getOhlcSummaryItems(point: ChartCandlestickPoint, range: RangeKey) {
  return [
    { key: 'time', label: '시간', value: formatOhlcTimeRange(point.dateValue, range) },
    { key: 'open', label: '시가', value: formatOhlcValue(point.open) },
    { key: 'high', label: '고가', value: formatOhlcValue(point.high) },
    { key: 'low', label: '저가', value: formatOhlcValue(point.low) },
    { key: 'close', label: '종가', value: formatOhlcValue(point.close) }
  ] as const;
}

function formatOhlcValue(value: number) {
  return `${formatValue(value)}원`;
}

function formatOhlcTimeRange(dateValue: string, range: RangeKey) {
  if (range !== '1D') {
    return formatCrosshairDate(dateValue, range);
  }

  const hour = Number(dateValue.slice(11, 13));
  const minute = Number(dateValue.slice(14, 16));
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return formatCrosshairDate(dateValue, range);
  }

  const endMinuteOfDay = hour * 60 + minute;
  const startMinuteOfDay = (endMinuteOfDay - 5 + 24 * 60) % (24 * 60);
  return `${formatMinuteOfDay(startMinuteOfDay)} ~ ${formatMinuteOfDay(endMinuteOfDay)}`;
}

function formatMinuteOfDay(minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function getChartExtrema(series: Array<ChartPoint | ChartCandlestickPoint>, useCandlestickRange: boolean) {
  if (series.length === 0) {
    return null;
  }

  let highPoint = series[0];
  let lowPoint = series[0];
  let high = useCandlestickRange && 'high' in highPoint ? highPoint.high : highPoint.value;
  let low = useCandlestickRange && 'low' in lowPoint ? lowPoint.low : lowPoint.value;

  for (const point of series.slice(1)) {
    const pointHigh = useCandlestickRange && 'high' in point ? point.high : point.value;
    const pointLow = useCandlestickRange && 'low' in point ? point.low : point.value;
    if (pointHigh > high) {
      high = pointHigh;
      highPoint = point;
    }
    if (pointLow < low) {
      low = pointLow;
      lowPoint = point;
    }
  }

  return { high: { point: highPoint, value: high }, low: { point: lowPoint, value: low } };
}

function FloatingYAxisLabels({
  bottom,
  chartHeight,
  top,
  yDomain
}: {
  bottom: number;
  chartHeight: number;
  top: number;
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return null;
  }

  const [min, max] = yDomain;
  if (max <= min) {
    return null;
  }

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, index) => max - ((max - min) / (tickCount - 1)) * index);

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]">
      {ticks.map((value) => (
        <div
          className="absolute right-2 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[rgba(75,85,99,0.82)] shadow-sm shadow-zinc-950/10"
          key={value}
          style={{
            top: getValueYPosition({
              chartHeight,
              plotBottom: chartHeight - bottom,
              plotTop: top,
              value,
              yDomain
            }),
            transform: 'translateY(-50%)'
          }}
        >
          {formatValue(value)}
        </div>
      ))}
    </div>
  );
}

function ExtremaLabels({
  axisWidth,
  bottom,
  chartHeight,
  chartWidth,
  extrema,
  plotLeft,
  top,
  xDomain,
  yDomain
}: {
  axisWidth: number;
  bottom: number;
  chartHeight: number;
  chartWidth: number;
  extrema: NonNullable<ReturnType<typeof getChartExtrema>>;
  plotLeft: number;
  top: number;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[11]">
      <ExtremaLabel
        axisWidth={axisWidth}
        chartHeight={chartHeight}
        chartWidth={chartWidth}
        label="최고"
        placement="above"
        plotBottom={chartHeight - bottom}
        plotLeft={plotLeft}
        plotTop={top}
        point={extrema.high.point}
        value={extrema.high.value}
        xDomain={xDomain}
        yDomain={yDomain}
      />
      {extrema.high.value !== extrema.low.value || extrema.high.point.dateValue !== extrema.low.point.dateValue ? (
        <ExtremaLabel
          axisWidth={axisWidth}
          chartHeight={chartHeight}
          chartWidth={chartWidth}
          label="최저"
          placement="below"
          plotBottom={chartHeight - bottom}
          plotLeft={plotLeft}
          plotTop={top}
          point={extrema.low.point}
          value={extrema.low.value}
          xDomain={xDomain}
          yDomain={yDomain}
        />
      ) : null}
    </div>
  );
}

function ExtremaLabel({
  chartHeight,
  chartWidth,
  axisWidth,
  label,
  placement,
  plotBottom,
  plotLeft,
  plotTop,
  point,
  value,
  xDomain,
  yDomain
}: {
  axisWidth: number;
  chartHeight: number;
  chartWidth: number;
  label: string;
  placement: 'above' | 'below';
  plotBottom: number;
  plotLeft: number;
  plotTop: number;
  point: ChartPoint | ChartCandlestickPoint;
  value: number;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
  yDomain: [number, number];
}) {
  const x = getPointXPosition({
    plotLeft,
    plotRight: chartWidth - axisWidth,
    point,
    xDomain
  });
  if (x === null) {
    return null;
  }

  const y = getValueYPosition({
    chartHeight,
    plotBottom,
    plotTop,
    value,
    yDomain
  });
  const yOffset = placement === 'above' ? -34 : 34;
  const clampedX = Math.min(chartWidth - axisWidth - 34, Math.max(plotLeft + 34, x));
  const clampedY = Math.min(plotBottom - 10, Math.max(plotTop + 10, y + yOffset));

  return (
    <div
      className="absolute rounded bg-[var(--surface-muted)] px-1.5 py-1 text-[10px] font-bold leading-none text-[rgba(75,85,99,0.82)] shadow-sm shadow-zinc-950/10"
      style={{ left: clampedX, top: clampedY, transform: 'translate(-50%, -50%)' }}
    >
      {label} {formatValue(value)}
    </div>
  );
}

function getExtremaPaddedYDomain({
  enabled,
  plotHeight,
  yDomain
}: {
  enabled: boolean;
  plotHeight: number;
  yDomain: [number, number] | ['auto', 'auto'];
}): [number, number] | ['auto', 'auto'] {
  if (!enabled || typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return yDomain;
  }

  const [min, max] = yDomain;
  const range = max - min;
  const baseRange = range > 0 ? range : Math.max(Math.abs(max), 1) * 0.01;
  const labelClearancePx = 46;
  const drawableHeight = Math.max(1, plotHeight - labelClearancePx * 2);
  const padding = baseRange * (labelClearancePx / drawableHeight);

  return [min - padding, max + padding];
}

function getValueYPosition({
  chartHeight,
  plotBottom,
  plotTop,
  value,
  yDomain
}: {
  chartHeight: number;
  plotBottom: number;
  plotTop: number;
  value: number;
  yDomain: [number, number];
}) {
  const [min, max] = yDomain;
  if (max === min || plotBottom <= plotTop || chartHeight <= 0) {
    return plotTop;
  }

  const ratio = (max - value) / (max - min);
  return Math.min(plotBottom, Math.max(plotTop, plotTop + ratio * (plotBottom - plotTop)));
}

function CandlestickOverlay({
  axisWidth,
  candles,
  chartHeight,
  chartWidth,
  plotBottom,
  plotLeft,
  plotTop,
  xDomain,
  yDomain
}: {
  axisWidth: number;
  candles: ChartCandlestickPoint[];
  chartHeight: number;
  chartWidth: number;
  plotBottom: number;
  plotLeft: number;
  plotTop: number;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (chartWidth <= 0 || typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return null;
  }

  const xMin = typeof xDomain[0] === 'number' ? xDomain[0] : Math.min(...candles.map((candle) => candle.x));
  const xMax = typeof xDomain[1] === 'number' ? xDomain[1] : Math.max(...candles.map((candle) => candle.x));
  const yMin = yDomain[0];
  const yMax = yDomain[1];
  if (xMax <= xMin || yMax <= yMin) {
    return null;
  }

  const plotRight = chartWidth - axisWidth;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const candleGapWidth = plotWidth / Math.max(1, (xMax - xMin) / 5);
  const candleWidth = Math.max(2, Math.min(7, candleGapWidth * 0.58));
  const xScale = (value: number) => plotLeft + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const yScale = (value: number) => plotTop + ((yMax - value) / (yMax - yMin)) * plotHeight;

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-[1]" height={chartHeight} width={chartWidth}>
      {candles.map((candle) => {
        const x = xScale(candle.x);
        const openY = yScale(candle.open);
        const closeY = yScale(candle.close);
        const highY = yScale(candle.high);
        const lowY = yScale(candle.low);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
        const rising = candle.close >= candle.open;
        const wickStroke = '#374151';
        const stroke = rising ? '#dc2626' : '#2563eb';
        const fill = stroke;

        return (
          <g key={`${candle.dateValue}-${candle.sourcePointCount}`}>
            <line x1={x} x2={x} y1={highY} y2={lowY} stroke={wickStroke} strokeWidth={1.15} />
            <rect
              fill={fill}
              height={bodyHeight}
              rx={1}
              stroke={stroke}
              strokeWidth={1}
              width={candleWidth}
              x={x - candleWidth / 2}
              y={bodyTop}
            />
          </g>
        );
      })}
    </svg>
  );
}

function getPointerAxisValue({
  chartHeight,
  chartBottom,
  fallbackValue,
  plotTop,
  y,
  yDomain
}: {
  chartBottom: number;
  chartHeight: number;
  fallbackValue: number;
  plotTop: number;
  y: number;
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') {
    return fallbackValue;
  }

  const [min, max] = yDomain;
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
