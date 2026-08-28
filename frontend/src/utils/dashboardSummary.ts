// Dashboard summary helpers for indicator changes and priority content selection.
import type { DomesticIndicator, GovernmentBriefingArticle, NewsArticle } from '../types';
import { formatValue } from './format';

export type Direction = 'up' | 'down' | 'flat' | 'unknown';

const importantNewsKeywords = [
  '환율',
  '원/달러',
  '달러',
  '금리',
  '물가',
  '인플레이션',
  '무역수지',
  '경상수지',
  '외환',
  '유가',
  '증시',
  '채권',
  'fomc',
  'fed',
  '한국은행',
  '기획재정부',
  '관세',
  '수출',
  '수입'
];

export function getMajorIndicatorChanges(indicators: DomesticIndicator[]) {
  const dailyPriority = [
    'US_TREASURY_2Y',
    'US_10Y_TREASURY',
    'SOFR',
    'SOFR_30D_AVG',
    'KOFR',
    'CD_91D',
    'VIX',
    'WTI_OIL',
    'GLOBAL_CREDIT_SPREAD_PROXY'
  ];
  const eventDrivenPriority = [
    'KR_POLICY_RATE',
    'US_POLICY_RATE',
    'KR_US_RATE_GAP',
    'M2',
    'FOREIGN_RESERVES',
    'RESERVES_TO_SHORT_TERM_DEBT',
    'CURRENT_ACCOUNT',
    'GOODS_ACCOUNT',
    'TRADE_BALANCE',
    'FISCAL_BALANCE',
    'GOVERNMENT_DEBT'
  ];
  const dailyOrder = new Map(dailyPriority.map((code, index) => [code, index]));
  const eventOrder = new Map(eventDrivenPriority.map((code, index) => [code, index]));

  const eventDrivenChanges = indicators
    .filter((indicator) => eventOrder.has(indicator.code) && isRecentlyChangedIndicator(indicator))
    .sort((a, b) => (eventOrder.get(a.code) ?? 999) - (eventOrder.get(b.code) ?? 999));
  const dailyIndicators = indicators
    .filter((indicator) => dailyOrder.has(indicator.code) && indicator.value !== null)
    .sort((a, b) => (dailyOrder.get(a.code) ?? 999) - (dailyOrder.get(b.code) ?? 999));

  return [...eventDrivenChanges, ...dailyIndicators].slice(0, 10);
}

export function isRecentlyChangedIndicator(indicator: DomesticIndicator) {
  if (indicator.value === null || indicator.previousValue === null || indicator.value === indicator.previousValue) {
    return false;
  }
  if (!indicator.baseDate) {
    return false;
  }

  const baseDateTime = new Date(`${indicator.baseDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(baseDateTime)) {
    return false;
  }

  return Date.now() - baseDateTime <= 3 * 24 * 60 * 60 * 1000;
}

export function getNumericChange(indicator: DomesticIndicator) {
  if (indicator.value === null || indicator.previousValue === null) {
    return null;
  }
  return indicator.value - indicator.previousValue;
}

export function formatIndicatorMarketValue(indicator: DomesticIndicator) {
  if (indicator.value === null) {
    return '-';
  }

  const suffix = indicator.unit === 'PERCENT' || indicator.unit === 'PERCENT_POINT'
    ? '%'
    : indicator.unit === 'INDEX'
      ? ''
      : indicator.unit === 'USD'
        ? '달러'
        : '';
  return `${formatValue(indicator.value, indicator.unit === 'INDEX' || indicator.unit === 'USD' ? 2 : 2)}${suffix}`;
}

export function formatSignedNumber(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return '-';
  }
  return `${value >= 0 ? '+' : ''}${formatValue(value, 2)}`;
}

export function getDirectionTextClass(value: number | null) {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return 'text-zinc-500';
  }
  return value > 0 ? 'change-rate-up' : 'change-rate-down';
}

export function getDirection(changeRate: number | null): Direction {
  if (changeRate === null || !Number.isFinite(changeRate)) {
    return 'unknown';
  }
  if (changeRate > 0.03) {
    return 'up';
  }
  if (changeRate < -0.03) {
    return 'down';
  }
  return 'flat';
}

export function getDirectionLabel(direction: Direction) {
  switch (direction) {
    case 'up':
      return '상승';
    case 'down':
      return '하락';
    case 'flat':
      return '보합';
    default:
      return '대기';
  }
}

export function getDirectionBadgeClass(direction: Direction) {
  if (direction === 'up') {
    return 'bg-blue-50 text-blue-700';
  }
  if (direction === 'down') {
    return 'bg-rose-50 text-rose-700';
  }
  return 'bg-zinc-100 text-zinc-600';
}

export function formatPercentChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }
  return `${value >= 0 ? '+' : ''}${formatValue(value, 2)}%`;
}

export function getImportantRecentNews(items: NewsArticle[], limit: number) {
  return getRecentPriorityItems(items, limit, (item) => [
    item.title,
    item.description ?? '',
    item.aiSummary ?? '',
    item.marketSentiment ?? ''
  ].join(' '), (item) => (
    (item.aiSummary ? 2 : 0) + (item.marketSentiment ? 1 : 0)
  ));
}

export function getImportantRecentBriefings(items: GovernmentBriefingArticle[], limit: number) {
  return getRecentPriorityItems(items, limit, (item) => [
    item.title,
    item.subtitle ?? '',
    item.ministry ?? '',
    item.category ?? ''
  ].join(' '), (item) => (
    item.ministry ? 1 : 0
  ));
}

export function getRecentPriorityItems<T extends { fetchedAt: string; publishedAt?: string | null }>(
  items: T[],
  limit: number,
  getText: (item: T) => string,
  getBaseScore: (item: T) => number
) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentItems = items.filter((item) => {
    const time = getItemTime(item);
    return Number.isFinite(time) && now - time <= weekMs;
  });
  const candidates = recentItems.length > 0 ? recentItems : items;

  return [...candidates]
    .sort((a, b) => getPriorityScore(b, now, getText(b), getBaseScore(b)) - getPriorityScore(a, now, getText(a), getBaseScore(a)))
    .slice(0, limit);
}

export function getPriorityScore(item: { fetchedAt: string; publishedAt?: string | null }, now: number, text: string, baseScore: number) {
  const normalizedText = text.toLowerCase();
  const keywordScore = importantNewsKeywords.reduce((score, keyword) => (
    normalizedText.includes(keyword.toLowerCase()) ? score + 2 : score
  ), 0);
  const ageHours = Math.max(0, (now - getItemTime(item)) / (60 * 60 * 1000));
  const recencyScore = Math.max(0, 8 - ageHours / 12);
  return baseScore + keywordScore + recencyScore;
}

export function sortByRecent<T extends { fetchedAt: string; publishedAt?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => getItemTime(b) - getItemTime(a));
}

export function getItemTime(item: { fetchedAt: string; publishedAt?: string | null }) {
  return new Date(item.publishedAt ?? item.fetchedAt).getTime();
}

export function formatCompactRateDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date);
}
