import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx,
  intradaySessionEndMinutes,
  intradaySessionStartMinutes,
  longRangeOptions,
  rangeOptions
} from '../constants';
import type { ChartPoint, IntradayTimeSeriesPoint, RangeKey, TimeSeriesPoint } from '../types';

const intradayPointIntervalMinutes = 1;

export function getRangeLabel(range: RangeKey | Exclude<RangeKey, '1D'>) {
  return rangeOptions.find((option) => option.key === range)?.label
    ?? longRangeOptions.find((option) => option.key === range)?.label
    ?? range;
}

export function getUsdKrwPanelReferenceLabel(range: RangeKey, series: ChartPoint[]) {
  if (range === '1D') {
    return '영업일 · 09:00~익일 02:00';
  }

  return getPanelPeriodLabel(series);
}

export function getPanelPeriodLabel(series: ChartPoint[]) {
  if (series.length === 0) {
    return '-';
  }

  return `${formatCompactDate(series[0].dateValue)}~${formatCompactDate(series[series.length - 1].dateValue)}`;
}

export function formatCrosshairDate(value: string, range: RangeKey | Exclude<RangeKey, '1D'>) {
  if (range === '1D') {
    return value.slice(11, 19);
  }

  return value.slice(2, 10).replace(/-/g, '.');
}

export function buildVisibleUsdKrwSeries(
  dailySeries: TimeSeriesPoint[],
  intradaySeries: IntradayTimeSeriesPoint[],
  range: RangeKey
): ChartPoint[] {
  if (range === '1D' && intradaySeries.length === 0) {
    return [];
  }

  if (range === '1D') {
    const sessionStartDate = getIntradaySessionStartDate(intradaySeries[0].observedAt);
    const points = intradaySeries.map((point) => ({
      label: addMinutesToDateTime(point.observedAt, intradayPointIntervalMinutes).slice(11, 16),
      dateValue: addMinutesToDateTime(point.observedAt, intradayPointIntervalMinutes),
      x: getSessionMinute(addMinutesToDateTime(point.observedAt, intradayPointIntervalMinutes), sessionStartDate),
      value: point.value,
    })).filter((point) => point.x >= intradaySessionStartMinutes && point.x <= intradaySessionEndMinutes);

    if (points.length === 0) {
      return [];
    }

    return points.map((point, index) => ({
      ...point,
      latestValue: index === points.length - 1 ? point.value : null
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

export function buildVisibleDailySeries(series: TimeSeriesPoint[], range: Exclude<RangeKey, '1D'>): ChartPoint[] {
  const filteredSeries = filterDailySeriesByRange(series, range);
  return filteredSeries.map((point, index) => ({
    label: point.baseDate,
    dateValue: point.baseDate,
    x: Date.parse(point.baseDate),
    value: point.value,
    latestValue: index === filteredSeries.length - 1 ? point.value : null
  }));
}

export function getValueDomain(series: ChartPoint[], padding: number): [number, number] | ['auto', 'auto'] {
  if (series.length === 0) {
    return ['auto', 'auto'];
  }

  const values = series.map((point) => point.value);
  return [Math.floor(Math.min(...values) - padding), Math.ceil(Math.max(...values) + padding)];
}

export function getLatestValueLabelTop(value: number | null, domain: [number, number] | ['auto', 'auto'], xAxisHeight: number) {
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

export function getXDomain(series: ChartPoint[], range: RangeKey): [number, number] | ['dataMin', 'dataMax'] {
  if (range === '1D') {
    return [intradaySessionStartMinutes, intradaySessionEndMinutes];
  }

  if (series.length === 0) {
    return ['dataMin', 'dataMax'];
  }

  return [series[0].x, series[series.length - 1].x];
}

export function getUsdKrwXTicks(range: RangeKey) {
  if (range !== '1D') {
    return undefined;
  }

  const ticks: number[] = [];
  for (let minute = intradaySessionStartMinutes; minute <= intradaySessionEndMinutes; minute += 60) {
    ticks.push(minute);
  }

  return ticks;
}

export function getDailyXTicks(series: ChartPoint[]) {
  if (series.length === 0) {
    return undefined;
  }

  const maxTickCount = 7;
  if (series.length <= maxTickCount) {
    return series.map((point) => point.x);
  }

  const ticks: number[] = [];
  for (let index = 0; index < maxTickCount; index += 1) {
    const pointIndex = Math.round((index * (series.length - 1)) / (maxTickCount - 1));
    ticks.push(series[pointIndex].x);
  }
  return Array.from(new Set(ticks));
}

export function formatUsdKrwXTick(value: number) {
  const hour = Math.floor((value % (24 * 60)) / 60);
  return hour.toString().padStart(2, '0');
}

export function formatDailyXTick(value: number, range: RangeKey | Exclude<RangeKey, '1D'>) {
  const date = new Date(value);
  if (range === '5Y') {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: '2-digit',
      month: '2-digit'
    }).format(date).replace(/\.\s?/g, '.').replace(/\.$/, '');
  }

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit'
  }).format(date).replace(/\.\s?/g, '.').replace(/\.$/, '');
}

export function getUsdKrwReferenceLabel(range: RangeKey, series: ChartPoint[], baseDate?: string) {
  if (series.length === 0) {
    return '기준 데이터 없음';
  }

  if (range === '1D') {
    return formatIntradaySessionLabel(series);
  }

  return `${series[0].label} ~ ${series[series.length - 1].label} · 기준 ${baseDate ?? series[series.length - 1].label}`;
}

export function getDailyReferenceLabel(series: ChartPoint[]) {
  if (series.length === 0) {
    return '기준 데이터 없음';
  }

  return `${series[0].label} ~ ${series[series.length - 1].label}`;
}

export function getLatestIntradayDate(series: IntradayTimeSeriesPoint[]) {
  if (series.length === 0) {
    return null;
  }

  return series[series.length - 1].observedAt.slice(0, 10);
}

export function formatIntradayObservedAt(dateTime: string | null) {
  if (!dateTime) {
    return '-';
  }

  const displayDateTime = addMinutesToDateTime(dateTime, intradayPointIntervalMinutes);
  return `${displayDateTime.slice(0, 10)} ${displayDateTime.slice(11, 16)}`;
}

function formatCompactDate(value: string) {
  const date = value.slice(0, 10);
  return date.slice(2).replace(/-/g, '.');
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

function addMinutesToDateTime(dateTime: string, minutes: number) {
  const normalized = dateTime.includes('T') ? dateTime : dateTime.replace(' ', 'T');
  const [date, time] = normalized.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes, second));
  return value.toISOString().slice(0, 19);
}

function formatIntradaySessionLabel(series: ChartPoint[]) {
  const first = series[0].dateValue;
  const sessionStartDate = getIntradaySessionStartDate(first);
  return `${sessionStartDate} 세션 · 09:00~익일 02:00 · 1분`;
}
