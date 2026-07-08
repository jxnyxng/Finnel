import { chartHeightPx } from '../constants';
import type { ChartHoverState, ChartPoint, RangeKey } from '../types';
import { formatCrosshairDate } from '../utils/chart';
import { formatValue } from '../utils/format';

const firstPointHoverTolerancePx = 24;

type ChartTooltipPayload = {
  payload?: ChartPoint;
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
  activeCoordinate?: {
    x?: number;
    y?: number;
  };
};

export function getActiveChartHover(
  state: unknown,
  series: ChartPoint[],
  bounds: { plotLeft: number; plotTop: number; plotBottom: number }
): ChartHoverState | null {
  const typedState = state as RechartsMouseState | null;
  const activeIndex = typedState?.activeIndex ?? typedState?.activeTooltipIndex;
  const numericIndex = Number(activeIndex);
  const pointFromIndex = Number.isFinite(numericIndex) ? series[numericIndex] : null;
  const point = typedState?.activePayload?.[0]?.payload ?? pointFromIndex;
  const x = typedState?.activeCoordinate?.x;
  const y = typedState?.activeCoordinate?.y;

  if (!point || typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }

  if (x < bounds.plotLeft || y < bounds.plotTop || y > bounds.plotBottom) {
    return null;
  }

  if (point === series[0] && x > bounds.plotLeft + firstPointHoverTolerancePx) {
    return null;
  }

  return { point, x, y };
}

export function getAxisValueLabelTop(value: number) {
  return Math.min(chartHeightPx - 10, Math.max(10, value));
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
    <div className="chart-hover-tooltip w-44 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900">원/달러 환율</p>
      <dl className="mt-2 grid gap-1.5">
        <TooltipRow label="시점" value={formatTooltipDate(point.dateValue, range)} />
        <TooltipRow label="환율" value={`${formatValue(point.value)}원`} />
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
    <div className="chart-hover-tooltip w-44 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-zinc-900">{title} 지수</p>
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
  title,
  widthClassName = 'w-72'
}: {
  ariaLabel: string;
  children: React.ReactNode;
  title: string;
  widthClassName?: string;
}) {
  return (
    <div className="group relative">
      <button
        aria-label={ariaLabel}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-teal-600 hover:text-teal-700"
        type="button"
      >
        i
      </button>
      <div className={`chart-help-tooltip pointer-events-none absolute top-7 z-20 hidden ${widthClassName} rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg group-hover:block`}>
        <p className="font-semibold text-zinc-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

type RangeSelectorOption<T extends string> = {
  key: T;
  label: string;
};

export function RangeSelector<T extends string>({
  columns,
  onChange,
  options,
  value
}: {
  columns: 3 | 4;
  onChange: (value: T) => void;
  options: Array<RangeSelectorOption<T>>;
  value: T;
}) {
  return (
    <div className={`grid h-9 shrink-0 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-3'} rounded-md border border-zinc-200 bg-zinc-100 p-1`}>
      {options.map((option) => (
        <button
          className={`h-7 min-w-14 px-3 text-xs font-semibold ${
            value === option.key ? 'rounded bg-white text-teal-700 shadow-sm' : 'text-zinc-500'
          }`}
          key={option.key}
          onClick={() => onChange(option.key)}
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
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-500">
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
  hover,
  left,
  range,
  right,
  top,
  yDomain
}: {
  bottom: number;
  hover: ChartHoverState | null;
  left: number;
  range: RangeKey;
  right: number;
  top: number;
  yDomain: [number, number] | ['auto', 'auto'];
}) {
  if (!hover) {
    return null;
  }

  const displayValue = getHoverAxisValue(hover.y, top, bottom, yDomain, hover.point.value);

  return (
    <>
      <div
        className="chart-crosshair-x"
        style={{
          bottom,
          left: hover.x,
          top
        }}
      />
      <div
        className="chart-crosshair-y"
        style={{
          left,
          right,
          top: hover.y
        }}
      />
      <div className="chart-axis-value-label" style={{ top: getAxisValueLabelTop(hover.y) }}>
        <span>{formatValue(displayValue)}</span>
      </div>
      <div className="chart-axis-time-label" style={{ left: getAxisTimeLabelLeft(hover.x) }}>
        {formatCrosshairDate(hover.point.dateValue, range)}
      </div>
    </>
  );
}

function getHoverAxisValue(
  y: number,
  top: number,
  bottom: number,
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
  const plotBottom = chartHeightPx - bottom;
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
      <dt className="text-zinc-500">{label}</dt>
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
