import { chartHeightPx } from '../constants';
import type { ChartHoverState, ChartPoint, RangeKey } from '../types';
import { formatValue } from '../utils/format';

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

export function getActiveChartHover(state: unknown, series: ChartPoint[]): ChartHoverState | null {
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
