import type { DomesticIndicator, TimeSeriesPoint } from '../types';
import { formatValue } from './format';
import { getSeoulDateString } from './time';

export function getHistoryValueDomain(points: TimeSeriesPoint[]): [number, number] {
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.abs(maxValue - minValue);
  const padding = Math.max(valueRange * 0.12, Math.abs(maxValue) * 0.02, 1);
  const lowerBound = Math.floor(minValue - padding);
  const upperBound = Math.ceil(maxValue + padding);

  if (upperBound <= lowerBound) {
    return [lowerBound, lowerBound + 1];
  }

  return [lowerBound, upperBound];
}

export function formatIndicatorValue(indicator: DomesticIndicator) {
  if (indicator.value === null) {
    return '-';
  }

  return formatHistoryValue(indicator.value, indicator.unit);
}

export function formatHistoryValue(value: number, unit: string) {
  if (unit === 'PERCENT' || unit === 'PERCENT_POINT') {
    return formatValue(value, 2);
  }

  if (unit === 'USD_MILLION' || unit === 'USD_1000' || unit === 'KRW_100M' || unit === 'RANK') {
    return formatValue(value, 0);
  }

  if (unit === 'KRW_TRILLION') {
    return formatValue(value, 1);
  }

  if (unit === 'BASIS_POINT' || unit === 'DOCUMENT') {
    return formatValue(value, 0);
  }

  return formatValue(value, 2);
}

export function formatHistoryAxisValue(value: number, unit: string) {
  if (unit === 'USD_MILLION' || unit === 'USD_1000' || unit === 'KRW_100M') {
    return formatValue(value, 0);
  }

  if (unit === 'KRW_TRILLION' || unit === 'PERCENT' || unit === 'PERCENT_POINT' || unit === 'INDEX' || unit === 'USD') {
    return formatValue(value, 1);
  }

  return formatValue(value, 0);
}

export function formatHistoryTick(baseDate: string) {
  return baseDate.slice(2, 7).replace('-', '.');
}

export function formatCompactBaseDate(value: string | null) {
  return value ?? '-';
}

export function formatIndicatorSource(source: string | null): string {
  if (!source) {
    return '-';
  }

  const cleanSource = source.split('|', 1)[0];

  if (cleanSource.startsWith('Twelve Data')) {
    return 'Twelve Data 실시간 환율';
  }

  if (cleanSource.startsWith('FRED:')) {
    return '미국 연방준비은행 경제데이터';
  }

  if (cleanSource === 'FRED') {
    return '미국 연방준비은행 경제데이터';
  }

  if (cleanSource.startsWith('ECOS:')) {
    return '한국은행 경제통계시스템';
  }

  if (cleanSource === 'ECOS') {
    return '한국은행 경제통계시스템';
  }

  if (cleanSource.startsWith('OPENFISCAL:')) {
    return '열린재정 재정정보';
  }

  if (cleanSource.startsWith('KOREAEXIM') || cleanSource.startsWith('Koreaexim')) {
    return '한국수출입은행 환율정보';
  }

  if (cleanSource.includes('/')) {
    return cleanSource
      .split('/')
      .map((part) => formatIndicatorSource(part))
      .join(' / ');
  }

  return cleanSource
    .replace(/_/g, ' ')
    .replace(/:/g, ' ');
}

export function formatCollectedAt(indicator: DomesticIndicator) {
  return formatCollectedDate(indicator.fetchedAt);
}

export function formatCollectedDate(value: string | null) {
  return value ? getSeoulDateString(new Date(value)) : '-';
}

export function collectionStatusLabel(indicator: DomesticIndicator) {
  if (indicator.status === '연동 필요') {
    return '대기';
  }

  if (indicator.freshnessStatus === 'STALE') {
    return '지연';
  }

  if (indicator.value === null || indicator.status === '데이터 없음') {
    return '대기';
  }

  return '정상';
}
