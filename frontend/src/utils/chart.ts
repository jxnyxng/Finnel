import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx,
  longRangeOptions,
  rangeOptions
} from '../constants';
import type { ChartPoint, IntradayTimeSeriesPoint, RangeKey, TimeSeriesPoint } from '../types';

const daylightSavingSessionStartMinutes = 6 * 60;
const standardSessionStartMinutes = 7 * 60;
const intradaySessionDurationMinutes = 24 * 60;
const explicitTimeZonePattern = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function getRangeLabel(range: RangeKey | Exclude<RangeKey, '1D'>) {
  return rangeOptions.find((option) => option.key === range)?.label
    ?? longRangeOptions.find((option) => option.key === range)?.label
    ?? range;
}

export function getUsdKrwPanelReferenceLabel(range: RangeKey, series: ChartPoint[]) {
  if (range === '1D') {
    return series.length > 0 ? formatIntradaySessionLabel(series) : '주중 24시간 세션';
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
    const [sessionStartMinute, sessionEndMinute] = getIntradaySessionDomain(sessionStartDate);
    const points = intradaySeries.map((point) => {
      const displayDateTime = normalizeDateTime(point.observedAt);
      return {
        label: displayDateTime.slice(11, 16),
        dateValue: displayDateTime,
        x: getSessionMinute(displayDateTime, sessionStartDate),
        value: point.value,
      };
    }).filter((point) => point.x >= sessionStartMinute && point.x <= sessionEndMinute);

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
    if (series.length === 0) {
      return [daylightSavingSessionStartMinutes, daylightSavingSessionStartMinutes + intradaySessionDurationMinutes];
    }

    return getIntradaySessionDomain(getIntradaySessionStartDate(series[0].dateValue));
  }

  if (series.length === 0) {
    return ['dataMin', 'dataMax'];
  }

  return [series[0].x, series[series.length - 1].x];
}

export function getUsdKrwXTicks(range: RangeKey, series: ChartPoint[] = []) {
  if (range !== '1D') {
    return undefined;
  }

  const [sessionStartMinute, sessionEndMinute] = series.length > 0
    ? getIntradaySessionDomain(getIntradaySessionStartDate(series[0].dateValue))
    : [daylightSavingSessionStartMinutes, daylightSavingSessionStartMinutes + intradaySessionDurationMinutes];
  const ticks: number[] = [];
  for (let minute = sessionStartMinute; minute <= sessionEndMinute; minute += 120) {
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

  return normalizeDateTime(series[series.length - 1].observedAt).slice(0, 10);
}

export function isCurrentIntradaySession(series: IntradayTimeSeriesPoint[], seoulDate: string, seoulTime: string) {
  if (series.length === 0) {
    return false;
  }

  const currentSessionStartDate = getActiveIntradaySessionStartDate(seoulDate, seoulTime);
  if (!currentSessionStartDate) {
    return false;
  }

  const displayedSessionStartDate = getIntradaySessionStartDate(series[0].observedAt);
  return displayedSessionStartDate === currentSessionStartDate;
}

export function formatIntradayObservedAt(dateTime: string | null) {
  if (!dateTime) {
    return '-';
  }

  const displayDateTime = normalizeDateTime(dateTime);
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
  const displayDateTime = normalizeDateTime(dateTime);
  const date = displayDateTime.slice(0, 10);
  const time = displayDateTime.slice(11, 16);
  const [hour, minute] = time.split(':').map(Number);

  if (date === sessionStartDate) {
    return hour * 60 + minute;
  }

  return 24 * 60 + hour * 60 + minute;
}

export function getIntradaySessionStartDate(dateTime: string) {
  const displayDateTime = normalizeDateTime(dateTime);
  const date = displayDateTime.slice(0, 10);
  const [hour, minute] = displayDateTime.slice(11, 16).split(':').map(Number);
  const candidate = hour * 60 + minute >= getUsdKrwSessionStartMinutes(date)
    ? date
    : getPreviousUsdKrwSessionStartDate(date);
  if (isUsdKrwSessionStartDate(candidate)) {
    return candidate;
  }

  return getPreviousUsdKrwSessionStartDate(candidate);
}

function getPreviousUsdKrwSessionStartDate(date: string) {
  let candidate = shiftDate(date, -1);
  while (!isUsdKrwSessionStartDate(candidate)) {
    candidate = shiftDate(candidate, -1);
  }
  return candidate;
}

function getRawIntradaySessionStartDate(dateTime: string) {
  const date = dateTime.slice(0, 10);
  const [hour, minute] = dateTime.slice(11, 16).split(':').map(Number);
  if (hour * 60 + minute >= getUsdKrwSessionStartMinutes(date)) {
    return date;
  }

  return shiftDate(date, -1);
}

export function getActiveIntradaySessionStartDate(seoulDate: string, seoulTime: string) {
  const candidate = getRawIntradaySessionStartDate(`${seoulDate}T${seoulTime}`);
  return isUsdKrwSessionStartDate(candidate) ? candidate : null;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shiftedDate = new Date(Date.UTC(year, month - 1, day));
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function normalizeDateTime(dateTime: string) {
  const normalized = dateTime.includes('T') ? dateTime : dateTime.replace(' ', 'T');
  if (!explicitTimeZonePattern.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return formatDateTimeInSeoul(date);
}

function formatDateTimeInSeoul(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
}

function formatIntradaySessionLabel(series: ChartPoint[]) {
  const first = series[0].dateValue;
  const sessionStartDate = getIntradaySessionStartDate(first);
  const startHour = Math.floor(getUsdKrwSessionStartMinutes(sessionStartDate) / 60).toString().padStart(2, '0');
  return `${sessionStartDate} 세션 · ${startHour}:00~익일 ${startHour}:00 · 1분`;
}

function getIntradaySessionDomain(sessionStartDate: string): [number, number] {
  const sessionStartMinute = getUsdKrwSessionStartMinutes(sessionStartDate);
  return [sessionStartMinute, sessionStartMinute + intradaySessionDurationMinutes];
}

function getUsdKrwSessionStartMinutes(date: string) {
  return isNewYorkDaylightSavingDate(date) ? daylightSavingSessionStartMinutes : standardSessionStartMinutes;
}

function isUsdKrwSessionStartDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek !== 0
    && dayOfWeek !== 6
    && !(month === 1 && day === 1);
}

function isNewYorkDaylightSavingDate(date: string) {
  const year = Number(date.slice(0, 4));
  const starts = nthSunday(year, 3, 2);
  const ends = nthSunday(year, 11, 1);
  return date >= starts && date <= ends;
}

function nthSunday(year: number, month: number, nth: number) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysUntilSunday = (7 - firstDay.getUTCDay()) % 7;
  const sunday = new Date(Date.UTC(year, month - 1, 1 + daysUntilSunday + 7 * (nth - 1)));
  return sunday.toISOString().slice(0, 10);
}
