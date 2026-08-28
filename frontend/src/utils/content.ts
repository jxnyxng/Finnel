// Content freshness and identity helpers for news and government briefing feeds.
import type { GovernmentBriefingArticle, NewsArticle } from '../types';

export function getLatestFetchedAt(items: Array<NewsArticle | GovernmentBriefingArticle>) {
  const latestMs = items
    .map((item) => new Date(item.fetchedAt).getTime())
    .filter(Number.isFinite)
    .reduce<number | null>((latest, fetchedAt) => latest === null ? fetchedAt : Math.max(latest, fetchedAt), null);

  return latestMs === null ? null : new Date(latestMs).toISOString();
}

export function getNewsArticleKey(article: NewsArticle) {
  return `${article.categoryCode}-${article.link || article.originLink || article.title}`;
}

export function getGovernmentBriefingArticleKey(article: GovernmentBriefingArticle) {
  return article.originalUrl || `${article.title}-${article.publishedAt ?? ''}`;
}

export function formatForeignExchangeUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date);
}

export function formatDataFetchedAt(value: string | null) {
  if (!value) {
    return '-';
  }
  return formatForeignExchangeUpdatedAt(new Date(value));
}

export function getContentSyncStatusLabel(status: string) {
  if (status === 'SUCCESS') {
    return '성공';
  }
  if (status === 'RUNNING') {
    return '진행중';
  }
  return '실패';
}

export function getStatusDetails({
  attemptedAt,
  latestUpdatedAt,
  syncStatus
}: {
  attemptedAt?: string | null;
  latestUpdatedAt?: string | null;
  syncStatus?: string | null;
}) {
  const details: string[] = [];
  if (latestUpdatedAt) {
    details.push(`최근 업데이트 ${formatDataFetchedAt(latestUpdatedAt)}`);
  }
  if (syncStatus) {
    details.push(`마지막 시도 ${formatDataFetchedAt(attemptedAt ?? null)} · ${getContentSyncStatusLabel(syncStatus)}`);
  }
  return details;
}
