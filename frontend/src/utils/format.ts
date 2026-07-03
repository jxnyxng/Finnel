import type { MetricSnapshot } from '../types';

export function formatValue(value: number | null, fractionDigits = 2) {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

export function formatMetricValue(metric: MetricSnapshot) {
  if (metric.unit === 'PERCENT' || metric.unit === 'PERCENT_POINT') {
    return formatValue(metric.value, 2);
  }

  if (metric.unit === 'USD_MILLION' || metric.unit === 'USD_1000' || metric.unit === 'KRW_100M') {
    return formatValue(metric.value, 0);
  }

  if (metric.unit === 'RANK') {
    return formatValue(metric.value, 0);
  }

  return formatValue(metric.value);
}

export function formatMetricUnit(unit: string) {
  if (unit === 'PERCENT') {
    return '%';
  }

  if (unit === 'PERCENT_POINT') {
    return '%p';
  }

  if (unit === 'USD_MILLION') {
    return '백만 달러';
  }

  if (unit === 'USD_1000') {
    return '천 달러';
  }

  if (unit === 'USD') {
    return '달러';
  }

  if (unit === 'BASIS_POINT') {
    return 'bp';
  }

  if (unit === 'KRW_100M') {
    return '억원';
  }

  if (unit === 'RANK') {
    return '위';
  }

  if (unit === 'UNAVAILABLE') {
    return '연동 전';
  }

  if (unit === 'TEXT') {
    return '문서';
  }

  return unit;
}
