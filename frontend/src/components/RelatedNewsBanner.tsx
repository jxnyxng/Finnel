import React from 'react';
import axios from 'axios';
type RelatedNewsBannerProps = {
  topic?: 'exchange' | 'indicators';
  actionSlot?: React.ReactNode;
  articles?: RelatedBannerArticle[];
  configured?: boolean;
  desktopGroupSize?: 1 | 2 | 3;
  fallbackArticles?: RelatedBannerArticle[];
  label?: string;
};

type RelatedNewsResponse = {
  configured: boolean;
  articles: RelatedBannerArticle[];
};

export type RelatedBannerArticle = {
  title: string;
  description?: string | null;
  originLink?: string | null;
  link?: string | null;
  publisher?: string | null;
  publishedAt?: string | null;
  aiSummary?: string | null;
  fetchedAt?: string | null;
  imageUrl?: string | null;
  categoryName?: string | null;
};

const topicLabels = {
  exchange: '환율 관련 소식',
  indicators: '지표 관련 소식'
};

const autoAdvanceMs = 7000;
const manualPauseMs = 10000;
const slideDurationMs = 420;
const relatedNewsDisplayCount = 9;
const relatedNewsRequestLimit = 30;
const relatedNewsRequestTimeoutMs = 6000;
const relatedNewsDesktopMediaQuery = '(min-width: 768px)';
const relatedNewsCache = new Map<NonNullable<RelatedNewsBannerProps['topic']>, RelatedNewsResponse>();
const relatedNewsRequestCache = new Map<NonNullable<RelatedNewsBannerProps['topic']>, Promise<RelatedNewsResponse>>();

export function prefetchRelatedNews(topic: NonNullable<RelatedNewsBannerProps['topic']>) {
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
      limit: relatedNewsRequestLimit,
      topic
    },
    timeout: relatedNewsRequestTimeoutMs
  }).then((response) => {
    const normalizedResponse = normalizeRelatedNewsResponse(response.data);
    relatedNewsCache.set(topic, normalizedResponse);
    relatedNewsRequestCache.delete(topic);
    return normalizedResponse;
  }).catch((error) => {
    relatedNewsRequestCache.delete(topic);
    throw error;
  });

  relatedNewsRequestCache.set(topic, request);
  return request;
}

export function RelatedNewsBanner({ actionSlot, articles: controlledArticles, configured, desktopGroupSize = 3, fallbackArticles = [], label, topic }: RelatedNewsBannerProps) {
  const cachedResponse = topic ? relatedNewsCache.get(topic) : undefined;
  const isControlled = controlledArticles !== undefined;
  const normalizedFallbackArticles = React.useMemo(
    () => limitRelatedArticles(normalizeRelatedArticles(fallbackArticles), relatedNewsDisplayCount),
    [fallbackArticles]
  );
  const [articles, setArticles] = React.useState<RelatedBannerArticle[]>(() => mergeRelatedArticles(
    controlledArticles ?? cachedResponse?.articles ?? (topic ? [] : normalizedFallbackArticles),
    normalizedFallbackArticles,
    relatedNewsDisplayCount
  ));
  const [isConfigured, setIsConfigured] = React.useState(configured ?? cachedResponse?.configured ?? true);
  const [activeGroup, setActiveGroup] = React.useState(0);
  const [previousGroup, setPreviousGroup] = React.useState<number | null>(null);
  const [slideDirection, setSlideDirection] = React.useState<SlideDirection>('next');
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isAutoPaused, setIsAutoPaused] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(() => Boolean(topic && articles.length === 0));
  const [groupSize, setGroupSize] = React.useState(() => getResponsiveGroupSize(desktopGroupSize));
  const manualPauseUntilRef = React.useRef(0);
  const animationTimerRef = React.useRef<number | null>(null);
  const groupCount = Math.max(1, Math.ceil(articles.length / groupSize));
  const visibleArticles = getArticleGroup(articles, activeGroup, groupSize);
  const previousArticles = previousGroup === null ? [] : getArticleGroup(articles, previousGroup, groupSize);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(relatedNewsDesktopMediaQuery);
    const updateGroupSize = () => {
      setGroupSize(mediaQuery.matches ? desktopGroupSize : 1);
    };

    updateGroupSize();
    mediaQuery.addEventListener('change', updateGroupSize);
    return () => mediaQuery.removeEventListener('change', updateGroupSize);
  }, [desktopGroupSize]);

  React.useEffect(() => {
    setActiveGroup((current) => Math.min(current, Math.max(0, groupCount - 1)));
    setPreviousGroup(null);
    setIsAnimating(false);
  }, [groupCount, groupSize]);

  React.useEffect(() => {
    if (isControlled) {
      setArticles(mergeRelatedArticles(controlledArticles ?? [], normalizedFallbackArticles, relatedNewsDisplayCount));
      setIsConfigured(configured ?? true);
      setIsLoading(false);
      return;
    }
    if (!topic) {
      setArticles(normalizedFallbackArticles);
      setIsConfigured(configured ?? true);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const cached = relatedNewsCache.get(topic);

    setActiveGroup(0);
    setPreviousGroup(null);
    setIsAnimating(false);
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    if (cached) {
      setArticles(mergeRelatedArticles(cached.articles, normalizedFallbackArticles, relatedNewsDisplayCount));
      setIsConfigured(cached.configured);
      setIsLoading(false);
    } else if (normalizedFallbackArticles.length > 0) {
      setArticles(normalizedFallbackArticles);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    prefetchRelatedNews(topic).then((response) => {
      if (!isMounted) {
        return;
      }

      setArticles(mergeRelatedArticles(response.articles, normalizedFallbackArticles, relatedNewsDisplayCount));
      setIsConfigured(response.configured);
      setIsLoading(false);
    }).catch(() => {
      if (isMounted && !relatedNewsCache.has(topic)) {
        setArticles(normalizedFallbackArticles);
      }
      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [configured, controlledArticles, isControlled, normalizedFallbackArticles, topic]);

  React.useEffect(() => {
    if (groupCount <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (isAnimating || isAutoPaused || Date.now() < manualPauseUntilRef.current) {
        return;
      }

      moveGroup(1, 'auto');
    }, autoAdvanceMs);

    return () => window.clearInterval(timer);
  }, [groupCount, isAnimating, isAutoPaused]);

  React.useEffect(() => () => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }
  }, []);

  if (!isConfigured || (articles.length === 0 && !isLoading)) {
    return null;
  }

  function moveGroup(direction: -1 | 1, trigger: 'auto' | 'manual') {
    if (groupCount <= 1 || isAnimating) {
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
    <section className="related-news-banner mx-auto w-full" aria-label={label ?? (topic ? topicLabels[topic] : '관련 소식')}>
      <div className="relative">
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
          {isAnimating && previousGroup !== null ? (
            <div className={`related-news-slide related-news-slide-exit related-news-slide-exit-${slideDirection}`}>
              <RelatedNewsGroup articles={previousArticles} columns={groupSize} />
            </div>
          ) : null}
          <div className={isAnimating ? `related-news-slide related-news-slide-enter related-news-slide-enter-${slideDirection}` : undefined}>
            {articles.length > 0 ? <RelatedNewsGroup articles={visibleArticles} columns={groupSize} /> : <RelatedNewsLoadingGroup columns={groupSize} />}
          </div>
          {groupCount > 1 ? (
            <div className="related-news-controls absolute right-2 top-2 z-20 inline-flex rounded-full border border-zinc-200 bg-white/95 p-px text-zinc-700 shadow-sm backdrop-blur">
              <button
                aria-label="이전 뉴스"
                className="grid h-6 w-6 place-items-center rounded-full text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isAnimating}
                onClick={() => moveGroup(-1, 'manual')}
                type="button"
              >
                ‹
              </button>
              <button
                aria-label={isAutoPaused ? '뉴스 자동 넘김 재개' : '뉴스 자동 넘김 일시정지'}
                className="grid h-6 min-w-6 place-items-center rounded-full px-1 text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                onClick={() => setIsAutoPaused((current) => !current)}
                type="button"
              >
                {isAutoPaused ? '▶' : 'Ⅱ'}
              </button>
              <button
                aria-label="다음 뉴스"
                className="grid h-6 w-6 place-items-center rounded-full text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isAnimating}
                onClick={() => moveGroup(1, 'manual')}
                type="button"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {actionSlot ? <div className="mt-2 min-w-0">{actionSlot}</div> : null}
    </section>
  );
}

type SlideDirection = 'next' | 'previous';

function RelatedNewsGroup({ articles, columns }: { articles: RelatedBannerArticle[]; columns: number }) {
  return (
    <div className={columns >= 3 ? 'grid md:grid-cols-3' : columns === 2 ? 'grid md:grid-cols-2' : 'grid'}>
      {articles.map((article) => (
        <RelatedNewsCard article={article} key={getArticleIdentity(article)} />
      ))}
    </div>
  );
}

function RelatedNewsLoadingGroup({ columns }: { columns: number }) {
  return (
    <div className={columns >= 3 ? 'grid md:grid-cols-3' : columns === 2 ? 'grid md:grid-cols-2' : 'grid'}>
      {Array.from({ length: columns }).map((_, index) => (
        <div className="h-36 animate-pulse bg-zinc-100" key={index}>
          <div className="flex h-full flex-col justify-end p-3">
            <div className="mb-2 h-4 w-28 rounded bg-zinc-200" />
            <div className="h-4 w-4/5 rounded bg-zinc-200" />
            <div className="mt-2 h-3 w-3/5 rounded bg-zinc-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RelatedNewsCard({ article }: { article: RelatedBannerArticle }) {
  const articleUrl = article.link || article.originLink || '#';
  const summary = article.aiSummary || article.description || article.categoryName;
  const [hasImageError, setHasImageError] = React.useState(false);

  React.useEffect(() => {
    setHasImageError(false);
  }, [article.imageUrl]);

  return (
    <a
      className="group relative block h-36 overflow-hidden bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-2"
      href={articleUrl}
      rel="noreferrer"
      target="_blank"
    >
      {article.imageUrl && !hasImageError ? (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out group-hover:opacity-95"
          loading="lazy"
          onError={() => setHasImageError(true)}
          src={article.imageUrl}
        />
      ) : (
        <DefaultNewsImage />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/45 to-zinc-950/10" />
      <div className="relative flex h-full flex-col justify-end p-3 text-white">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-white/75">
          <span className="rounded bg-white/15 px-1.5 py-0.5">{article.categoryName ?? article.publisher ?? '소식'}</span>
          <span>{formatCompactNewsDate(article.publishedAt)}</span>
        </div>
        <h2 className="line-clamp-2 text-sm font-semibold leading-5">{article.title}</h2>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/80">{summary}</p>
      </div>
    </a>
  );
}

function DefaultNewsImage() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-teal-50">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.96))]" />
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-teal-100" />
        <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full border border-teal-100" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid place-items-center text-center text-teal-800">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-white shadow-sm ring-1 ring-teal-100">
              <img alt="" aria-hidden="true" className="h-9 w-9" src="/assets/finnel_logo_rounded_final_deepnavy.svg" />
            </span>
            <span className="mt-2 text-sm font-semibold tracking-normal">Finnel</span>
            <span className="mt-0.5 text-[10px] font-medium text-teal-700/70">경제·금융 데이터 보드</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getArticleGroup(articles: RelatedBannerArticle[], group: number, groupSize: number) {
  return articles.slice(group * groupSize, group * groupSize + groupSize);
}

function normalizeRelatedNewsResponse(response: RelatedNewsResponse): RelatedNewsResponse {
  return {
    ...response,
    articles: limitRelatedArticles(normalizeRelatedArticles(response.articles), relatedNewsDisplayCount)
  };
}

function limitRelatedArticles(articles: RelatedBannerArticle[], maxCount: number) {
  return articles.slice(0, maxCount);
}

function mergeRelatedArticles(primaryArticles: RelatedBannerArticle[], fallbackArticles: RelatedBannerArticle[], maxCount: number) {
  return limitRelatedArticles(normalizeRelatedArticles([...primaryArticles, ...fallbackArticles]), maxCount);
}

function normalizeRelatedArticles(articles: RelatedBannerArticle[]) {
  const seen = new Set<string>();
  const normalizedArticles: RelatedBannerArticle[] = [];
  for (const article of articles) {
    const url = canonicalizeArticleUrl(article.link || article.originLink || '');
    if (url && seen.has(url)) {
      continue;
    }

    if (url) {
      seen.add(url);
    }
    normalizedArticles.push(article);
  }
  return normalizedArticles;
}

function getArticleIdentity(article: RelatedBannerArticle) {
  const url = canonicalizeArticleUrl(article.link || article.originLink || '');
  if (url) {
    return `url:${url}`;
  }

  return `title:${normalizeArticleTitle(article.title)}:${formatArticleDate(article.publishedAt)}`;
}

function canonicalizeArticleUrl(value: string) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.trim();
  }
}

function normalizeArticleTitle(value: string) {
  return value
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function formatArticleDate(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function getResponsiveGroupSize(desktopGroupSize = 3) {
  if (typeof window === 'undefined') {
    return desktopGroupSize;
  }

  return window.matchMedia(relatedNewsDesktopMediaQuery).matches ? desktopGroupSize : 1;
}

function formatCompactNewsDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}
