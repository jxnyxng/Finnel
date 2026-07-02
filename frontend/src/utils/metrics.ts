import type { MetricSnapshot } from '../types';

export function sortMetrics(metrics: MetricSnapshot[]) {
  const order = [
    'USD/KRW',
    'ADVANCED_DOLLAR_INDEX',
    'BROAD_DOLLAR_INDEX',
    'FOREIGN_RESERVES',
    'US_POLICY_RATE',
    'KR_POLICY_RATE',
    'KR_US_RATE_GAP'
  ];

  return [...metrics].sort((a, b) => {
    const aIndex = order.indexOf(a.code);
    const bIndex = order.indexOf(b.code);
    return (aIndex === -1 ? order.length : aIndex) - (bIndex === -1 ? order.length : bIndex);
  });
}

export function findMetric(metrics: MetricSnapshot[], code: string) {
  return metrics.find((metric) => metric.code === code) ?? null;
}
