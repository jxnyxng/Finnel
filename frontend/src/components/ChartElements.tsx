import React from 'react';
import { chartHeightPx } from '../constants';
import { MovingTabIndicator, useMovingTabIndicator } from './MovingTabs';
import type { ChartCandlestickPoint, ChartHoverState, ChartPoint, RangeKey } from '../types';
import { formatCrosshairDate } from '../utils/chart';
import { formatValue } from '../utils/format';

const firstPointHoverTolerancePx = 24;

type ChartTooltipPayload = {
  payload?: ChartPoint | ChartCandlestickPoint;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
};

type RechartsMouseState = {
  activePayload?: Array<{ payload?: ChartPoint }>;
  activeIndex?: number | string;
  activeTooltipIndex?: number | string;
  chartX?: number;
  chartY?: number;
  yAxisMap?: Record<string, {
    scale?: {
      invert?: (value: number) => number;
    };
  }>;
  activeCoordinate?: {
    x?: number;
    y?: number;
  };
};

export function getActiveChartHover(
  state: unknown,
  series: ChartPoint[],
  bounds: { chartBottom: number; plotLeft: number; plotTop: number; plotBottom: number }
): ChartHoverState | null {
  const typedState = state as RechartsMouseState | null;
  const activeIndex = typedState?.activeIndex ?? typedState?.activeTooltipIndex;
  const numericIndex = Number(activeIndex);
  const pointFromIndex = Number.isFinite(numericIndex) ? series[numericIndex] : null;
  const point = typedState?.activePayload?.[0]?.payload ?? pointFromIndex;
  const x = typedState?.chartX ?? typedState?.activeCoordinate?.x;
  const y = typedState?.chartY ?? typedState?.activeCoordinate?.y;

  if (!point || typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  if (x < bounds.plotLeft || y < bounds.plotTop || y > bounds.chartBottom) {
    return null;
  }

  if (point === series[0] && x > bounds.plotLeft + firstPointHoverTolerancePx) {
    return null;
  }

  const hoverY = Math.min(bounds.chartBottom, Math.max(bounds.plotTop, y));
  return { point, value: getScaledHoverValue(typedState, hoverY), x, y: hoverY };
}

function getScaledHoverValue(state: RechartsMouseState | null, y: number) {
  const yAxis = Object.values(state?.yAxisMap ?? {})[0];
  const value = yAxis?.scale?.invert?.(y);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getAxisValueLabelTopForChart(value: number, chartHeight: number) {
  return Math.min(chartHeight - 36, Math.max(10, value));
}

export function getAxisTimeLabelLeft(value: number) {
  return `clamp(37px, ${value}px, calc(100% - 37px))`;
}

export function UsdKrwTooltip({ active, payload, range }: ChartTooltipProps & { range: RangeKey }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-hover-tooltip w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg shadow-zinc-950/10">
      <p className="font-semibold text-zinc-950">원/달러 환율</p>
      <dl className="mt-2 grid gap-1.5">
        <TooltipRow label="시점" value={formatTooltipDate(point.dateValue, range)} />
        <TooltipRow label="환율" value={`${formatValue(point.value)}원`} />
      </dl>
    </div>
  );
}

export function UsdKrwCandlestickTooltip({ active, payload }: ChartTooltipProps) {
  const point = payload?.[0]?.payload as ChartCandlestickPoint | undefined;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-hover-tooltip w-48 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg shadow-zinc-950/10">
      <p className="font-semibold text-zinc-950">원/달러 5분봉</p>
      <dl className="mt-2 grid gap-1.5">
        <TooltipRow label="시점" value={formatTooltipDate(point.dateValue, '1D')} />
        <TooltipRow label="시가" value={`${formatValue(point.open)}원`} />
        <TooltipRow label="고가" value={`${formatValue(point.high)}원`} />
        <TooltipRow label="저가" value={`${formatValue(point.low)}원`} />
        <TooltipRow label="종가" value={`${formatValue(point.close)}원`} />
        <TooltipRow label="상태" value={point.complete ? '완성' : '진행 중'} />
      </dl>
    </div>
  );
}

type DollarIndexTooltipPayload = {
  payload?: ChartPoint;
};

export function DollarIndexTooltip({
  active,
  payload,
  title
}: {
  active?: boolean;
  payload?: DollarIndexTooltipPayload[];
  title: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-hover-tooltip w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg shadow-zinc-950/10">
      <p className="font-semibold text-zinc-950">{title} 지수</p>
      <dl className="mt-2 grid gap-1.5">
        <TooltipRow label="날짜" value={point.dateValue.slice(0, 10)} />
        <TooltipRow label="지수" value={formatValue(point.value)} />
      </dl>
    </div>
  );
}

export function LatestValueDot({ cx, cy }: { cx?: number; cy?: number }) {
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

export function ChartHelpTooltip({
  ariaLabel,
  children,
  placement = 'left',
  title,
  widthClassName = 'w-72'
}: {
  ariaLabel: string;
  children: React.ReactNode;
  placement?: 'left' | 'right';
  title: string;
  widthClassName?: string;
}) {
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);

  const hideTooltip = React.useCallback(() => {
    setIsTooltipOpen(false);
  }, []);

  return (
    <div className="relative inline-flex">
      <button
        aria-label={ariaLabel}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-teal-600 hover:text-teal-700"
        onBlur={hideTooltip}
        onFocus={() => setIsTooltipOpen(true)}
        onMouseEnter={() => setIsTooltipOpen(true)}
        onMouseLeave={hideTooltip}
        type="button"
      >
        i
      </button>
      {isTooltipOpen ? (
        <div
          className={`chart-help-tooltip chart-help-tooltip-${placement} pointer-events-none absolute top-full z-50 mt-2 max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg ${widthClassName}`}
          role="tooltip"
        >
          <p className="font-semibold text-zinc-900">{title}</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}

type RangeSelectorOption<T extends string> = {
  key: T;
  label: string;
};

export function RangeSelector<T extends string>({
  columns,
  compact = false,
  onChange,
  options,
  value
}: {
  columns: 2 | 3 | 4;
  compact?: boolean;
  onChange: (value: T) => void;
  options: Array<RangeSelectorOption<T>>;
  value: T;
}) {
  const keys = React.useMemo(() => options.map((option) => option.key), [options]);
  const { buttonRefs, containerRef, indicator, isMoving, labelActiveKey, startMoving } = useMovingTabIndicator({
    activeKey: value,
    keys
  });

  return (
    <div
      className={`relative grid ${compact ? 'h-7' : 'h-10'} w-full min-w-0 shrink-0 gap-0.5 ${
        columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2'
      } rounded-full border border-zinc-200 bg-white p-0.5`}
      ref={containerRef}
    >
      <MovingTabIndicator compact={compact} contained indicator={indicator} isMoving={isMoving} />
      {options.map((option) => (
        <button
          className={`relative z-10 inline-flex ${compact ? 'h-6 min-w-0 whitespace-nowrap px-1.5 text-[9px]' : 'h-full min-w-0 px-2 text-xs'} items-center justify-center rounded-full text-center font-semibold leading-none transition-colors ${
            labelActiveKey === option.key ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
          }`}
          key={option.key}
          onClick={() => {
            if (value !== option.key) {
              startMoving();
            }
            onChange(option.key);
          }}
          ref={(node) => {
            buttonRefs.current[option.key] = node;
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChartPlotGrid({
  bottom,
  left,
  right,
  top
}: {
  bottom: number;
  left: number;
  right: number;
  top: number;
}) {
  return (
    <div
      className="chart-plot-grid"
      style={{
        bottom,
        left,
        right,
        top
      }}
    />
  );
}

export function ChartEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-white px-4 text-center text-sm font-medium text-zinc-700">
      {children}
    </div>
  );
}

export function LatestValueFloatingLabel({
  topPercent,
  value
}: {
  topPercent: number | null;
  value: number | null;
}) {
  if (value === null || topPercent === null) {
    return null;
  }

  return (
    <div className="latest-value-floating-label" style={{ top: `${topPercent}%` }}>
      <span>{formatValue(value)}</span>
    </div>
  );
}

export function ChartCrosshairOverlay({
  bottom,
  chartHeight,
  hover,
  left,
  range,
  right,
  top,
  yDomain
}: {
  bottom: number;
  chartHeight: number;
  hover: ChartHoverState | null;
  left: number;
  range: RangeKey;
  right: number;
  top: number;
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  const displayValue = hover
    ? hover.value ?? getHoverAxisValue(hover.y, top, bottom, chartHeight, yDomain, hover.point.value)
    : null;
  const fallbackX = hover?.x ?? left;
  const fallbackY = hover?.y ?? top;

  return (
    <div className="chart-crosshair-layer z-[18]">
      <div
        className="chart-crosshair-x"
        style={{
          bottom,
          top,
          transform: `translate3d(var(--chart-crosshair-x, ${fallbackX}px), 0, 0) translateX(-50%)`
        }}
      />
      <div
        className="chart-crosshair-y"
        style={{
          left,
          right,
          transform: `translate3d(0, var(--chart-crosshair-y, ${fallbackY}px), 0) translateY(-50%)`
        }}
      />
      <div
        className="chart-axis-value-label"
        style={{
          right: 'var(--chart-axis-value-right, 0px)',
          transform: `translate3d(0, var(--chart-axis-label-y, ${getAxisValueLabelTopForChart(fallbackY, chartHeight)}px), 0) translateY(-50%)`
        }}
      >
        <span>{displayValue === null ? '' : formatValue(displayValue)}</span>
      </div>
      <div className="chart-axis-time-label" style={{ transform: `translate3d(var(--chart-axis-time-x, ${fallbackX}px), 0, 0) translateX(-50%)` }}>
        {hover ? formatCrosshairDate(hover.point.dateValue, range) : ''}
      </div>
    </div>
  );
}

function getHoverAxisValue(
  y: number,
  top: number,
  bottom: number,
  chartHeight: number,
  domain: [number, number] | ['auto', 'auto'],
  fallbackValue: number
) {
  if (typeof domain[0] !== 'number' || typeof domain[1] !== 'number') {
    return fallbackValue;
  }

  const [min, max] = domain;
  if (max === min) {
    return fallbackValue;
  }

  const plotTop = top;
  const plotBottom = chartHeight - bottom;
  if (plotBottom <= plotTop) {
    return fallbackValue;
  }

  const clampedY = Math.min(plotBottom, Math.max(plotTop, y));
  const ratio = (clampedY - plotTop) / (plotBottom - plotTop);
  return max - ratio * (max - min);
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="min-w-0 font-medium leading-5 text-zinc-800">{value}</dd>
    </div>
  );
}

function formatTooltipDate(value: string, range: RangeKey) {
  if (range === '1D') {
    return `${value.slice(0, 10)} ${value.slice(11, 16)}`;
  }

  return value.slice(0, 10);
}
