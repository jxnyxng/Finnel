import type { ChartCandlestickPoint, ChartHoverState, ChartPoint } from '../types';

export function getNearestPointFromPointerX({
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

export function getPointXPosition({
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

export function hoverStateKey(hover: ChartHoverState | null) {
  return hover ? `${hover.point.dateValue}|${hover.point.value}` : null;
}

export function getDisplayOhlcPoint(point: ChartPoint | null, candles: ChartCandlestickPoint[]) {
  if (point && isCandlestickPoint(point)) {
    return point;
  }

  if (!point) {
    return null;
  }

  return candles.find((candle) => candle.dateValue === point.dateValue) ?? null;
}

export function isCandlestickPoint(point: ChartPoint): point is ChartCandlestickPoint {
  return 'open' in point && 'high' in point && 'low' in point && 'close' in point;
}
