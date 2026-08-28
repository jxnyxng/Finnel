// Tests for feed identity and freshness helpers.
import { describe, expect, it } from 'vitest';

import {
  getContentSyncStatusLabel,
  getGovernmentBriefingArticleKey,
  getLatestFetchedAt,
  getNewsArticleKey,
  getStatusDetails
} from './content';
import type { GovernmentBriefingArticle, NewsArticle } from '../types';

describe('content helpers', () => {
  it('returns the latest valid fetched timestamp', () => {
    expect(getLatestFetchedAt([
      newsArticleFixture({ fetchedAt: 'invalid' }),
      newsArticleFixture({ fetchedAt: '2026-08-27T01:00:00.000Z' }),
      governmentBriefingFixture({ fetchedAt: '2026-08-27T03:30:00.000Z' })
    ])).toBe('2026-08-27T03:30:00.000Z');
  });

  it('keeps article identity keys compatible with existing feed merging', () => {
    expect(getNewsArticleKey(newsArticleFixture({
      categoryCode: 'fx',
      link: '',
      originLink: 'https://origin.example/news',
      title: '환율 뉴스'
    }))).toBe('fx-https://origin.example/news');

    expect(getGovernmentBriefingArticleKey(governmentBriefingFixture({
      originalUrl: null,
      publishedAt: '2026-08-27',
      title: '정책 발표'
    }))).toBe('정책 발표-2026-08-27');
  });

  it('builds status details from update and sync timestamps', () => {
    expect(getContentSyncStatusLabel('RUNNING')).toBe('진행중');
    expect(getStatusDetails({
      attemptedAt: null,
      latestUpdatedAt: '2026-08-27T03:30:00.000Z',
      syncStatus: 'FAILED'
    })).toEqual([
      '최근 업데이트 08. 27. 오후 12:30',
      '마지막 시도 - · 실패'
    ]);
  });
});

function newsArticleFixture(overrides: Partial<NewsArticle> = {}): NewsArticle {
  return {
    aiSummary: null,
    categoryCode: 'macro',
    categoryName: '거시경제',
    description: null,
    fetchedAt: '2026-08-27T00:00:00.000Z',
    imageUrl: null,
    link: 'https://example.com/news',
    marketSentiment: null,
    originLink: null,
    publishedAt: null,
    publisher: null,
    queryText: '환율',
    title: '뉴스',
    ...overrides
  };
}

function governmentBriefingFixture(overrides: Partial<GovernmentBriefingArticle> = {}): GovernmentBriefingArticle {
  return {
    body: null,
    category: null,
    fetchedAt: '2026-08-27T00:00:00.000Z',
    imageUrl: null,
    koglType: null,
    ministry: null,
    originalUrl: 'https://example.com/policy',
    publishedAt: null,
    subtitle: null,
    thumbnailUrl: null,
    title: '브리핑',
    ...overrides
  };
}
