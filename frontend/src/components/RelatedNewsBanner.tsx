import React from 'react';
import axios from 'axios';
import type { NewsArticle } from '../types';

type RelatedNewsBannerProps = {
  topic: 'exchange' | 'indicators';
};

type RelatedNewsResponse = {
  configured: boolean;
  articles: NewsArticle[];
};

const topicLabels = {
  exchange: '환율 관련 뉴스',
  indicators: '지표 관련 뉴스'
};

const autoAdvanceMs = 7000;
const manualPauseMs = 10000;
const slideDurationMs = 420;
const relatedNewsCache = new Map<RelatedNewsBannerProps['topic'], RelatedNewsResponse>();
const relatedNewsRequestCache = new Map<RelatedNewsBannerProps['topic'], Promise<RelatedNewsResponse>>();

export function prefetchRelatedNews(topic: RelatedNewsBannerProps['topic']) {
  const cached = relatedNewsCache.get(topic);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pendingRequest = relatedNewsRequestCache.get(topic);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = axios.get<RelatedNewsResponse>('/api/v1/news/related', {
    params: {
      limit: 9,
      topic
    }
  }).then((response) => {
    relatedNewsCache.set(topic, response.data);
    relatedNewsRequestCache.delete(topic);
    return response.data;
  }).catch((error) => {
    relatedNewsRequestCache.delete(topic);
    throw error;
  });

  relatedNewsRequestCache.set(topic, request);
  return request;
}

export function RelatedNewsBanner({ topic }: RelatedNewsBannerProps) {
  const cachedResponse = relatedNewsCache.get(topic);
  const [articles, setArticles] = React.useState<NewsArticle[]>(cachedResponse?.articles ?? []);
  const [isConfigured, setIsConfigured] = React.useState(cachedResponse?.configured ?? true);
  const [activeGroup, setActiveGroup] = React.useState(0);
  const [previousGroup, setPreviousGroup] = React.useState<number | null>(null);
  const [slideDirection, setSlideDirection] = React.useState<SlideDirection>('next');
  const [isAnimating, setIsAnimating] = React.useState(false);
  const manualPauseUntilRef = React.useRef(0);
  const animationTimerRef = React.useRef<number | null>(null);
  const groupCount = Math.max(1, Math.ceil(articles.length / 3));
  const visibleArticles = getArticleGroup(articles, activeGroup);
  const previousArticles = previousGroup === null ? [] : getArticleGroup(articles, previousGroup);

  React.useEffect(() => {
    let isMounted = true;
    const cached = relatedNewsCache.get(topic);

    if (cached) {
      setArticles(cached.articles);
      setIsConfigured(cached.configured);
      setActiveGroup(0);
      setPreviousGroup(null);
      setIsAnimating(false);
    }

    prefetchRelatedNews(topic).then((response) => {
      if (!isMounted) {
        return;
      }

      setArticles(response.articles);
      setIsConfigured(response.configured);
      setActiveGroup(0);
      setPreviousGroup(null);
      setIsAnimating(false);
    }).catch(() => {
      if (isMounted && !relatedNewsCache.has(topic)) {
        setArticles([]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [topic]);

  React.useEffect(() => {
    if (groupCount <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (Date.now() < manualPauseUntilRef.current) {
        return;
      }

      moveGroup(1, 'auto');
    }, autoAdvanceMs);

    return () => window.clearInterval(timer);
  }, [groupCount]);

  React.useEffect(() => () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }
  }, []);

  if (!isConfigured || articles.length === 0) {
    return null;
  }

  function moveGroup(direction: -1 | 1, trigger: 'auto' | 'manual') {
    if (groupCount <= 1) {
      return;
    }

    if (trigger === 'manual') {
      manualPauseUntilRef.current = Date.now() + manualPauseMs;
    }

    setActiveGroup((current) => {
      const nextGroup = (current + direction + groupCount) % groupCount;
      if (nextGroup === current) {
        return current;
      }

      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }

      setPreviousGroup(current);
      setSlideDirection(direction === 1 ? 'next' : 'previous');
      setIsAnimating(true);
      animationTimerRef.current = window.setTimeout(() => {
        setPreviousGroup(null);
        setIsAnimating(false);
        animationTimerRef.current = null;
      }, slideDurationMs);

      return nextGroup;
    });
  };

  return (
    <section className="related-news-banner rounded-xl border border-zinc-200 bg-white shadow-sm" aria-label={topicLabels[topic]}>
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl bg-zinc-200">
          {isAnimating && previousGroup !== null ? (
            <div className={`related-news-slide related-news-slide-exit related-news-slide-exit-${slideDirection}`}>
              <RelatedNewsGroup articles={previousArticles} />
            </div>
          ) : null}
          <div className={isAnimating ? `related-news-slide related-news-slide-enter related-news-slide-enter-${slideDirection}` : undefined}>
            <RelatedNewsGroup articles={visibleArticles} />
          </div>
        </div>
        {groupCount > 1 ? (
          <div className="related-news-controls absolute inset-y-0 left-0 right-0 z-10">
            <button
              aria-label="이전 뉴스"
              className="pointer-events-auto absolute bottom-0 left-0 top-0 grid w-7 place-items-center rounded-l-md border-r border-white/10 bg-zinc-950/15 text-lg font-semibold text-white/80 shadow-lg backdrop-blur-[2px] hover:bg-zinc-950/35 hover:text-white"
              onClick={() => moveGroup(-1, 'manual')}
              type="button"
            >
              ‹
            </button>
            <button
              aria-label="다음 뉴스"
              className="pointer-events-auto absolute bottom-0 right-0 top-0 grid w-7 place-items-center rounded-r-md border-l border-white/10 bg-zinc-950/15 text-lg font-semibold text-white/80 shadow-lg backdrop-blur-[2px] hover:bg-zinc-950/35 hover:text-white"
              onClick={() => moveGroup(1, 'manual')}
              type="button"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type SlideDirection = 'next' | 'previous';

function RelatedNewsGroup({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="grid gap-px md:grid-cols-3">
      {articles.map((article) => (
        <RelatedNewsCard article={article} key={`${article.categoryCode}-${article.link}`} />
      ))}
    </div>
  );
}

function RelatedNewsCard({ article }: { article: NewsArticle }) {
  const articleUrl = article.link || article.originLink || '#';
  const summary = article.aiSummary || article.description || article.categoryName;

  return (
    <a
      className="group relative block h-36 overflow-hidden bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2"
      href={articleUrl}
      rel="noreferrer"
      target="_blank"
    >
      {article.imageUrl ? (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          loading="lazy"
          src={article.imageUrl}
        />
      ) : (
        <DefaultNewsImage />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/45 to-zinc-950/10" />
      <div className="relative flex h-full flex-col justify-end p-3 text-white">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-white/75">
          <span className="rounded bg-white/15 px-1.5 py-0.5">{article.categoryName}</span>
          <span>{formatCompactNewsDate(article.publishedAt)}</span>
        </div>
        <h2 className="line-clamp-2 text-sm font-semibold leading-5 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:scale-[1.015]">{article.title}</h2>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/80">{summary}</p>
      </div>
    </a>
  );
}

function DefaultNewsImage() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,#0f766e,#27272a)]">
      <div className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-105">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,rgba(15,118,110,0.92),rgba(39,39,42,0.98))]" />
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/10" />
        <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full border border-white/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid place-items-center text-center text-white">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-white text-2xl font-bold text-teal-700 shadow-lg">₩</span>
            <span className="mt-2 text-sm font-semibold tracking-normal">코리아원</span>
            <span className="mt-0.5 text-[10px] font-medium text-white/65">환율 모니터링 서비스</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getArticleGroup(articles: NewsArticle[], group: number) {
  return articles.slice(group * 3, group * 3 + 3);
}

function formatCompactNewsDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}
