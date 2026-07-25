import React from 'react';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { NewsArticle, NewsCategory, NewsFilters } from '../types';
import { getSeoulDateString } from '../utils/time';

type NewsroomPageProps = {
  articles: NewsArticle[];
  categories: NewsCategory[];
  configured: boolean;
  filters: NewsFilters;
  isLoading: boolean;
  isPendingInitialLoad?: boolean;
  page: number;
  selectedCategory: string;
  statusNode?: React.ReactNode;
  totalCount: number;
  totalPages: number;
  onCategoryChange: (category: string) => void;
  onFiltersApply: (filters: NewsFilters) => void;
  onLoadMore: (page: number) => void;
};

export function NewsroomPage({
  articles,
  categories,
  configured,
  filters,
  isLoading,
  isPendingInitialLoad = false,
  page,
  selectedCategory,
  statusNode,
  totalCount,
  totalPages,
  onCategoryChange,
  onFiltersApply,
  onLoadMore
}: NewsroomPageProps) {
  const [draftFilters, setDraftFilters] = React.useState(filters);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const categoryTabs = React.useMemo(
    () => [
      { key: 'all', label: '전체' },
      ...categories.map((category) => ({ key: category.code, label: `${category.name} ${category.articleCount}` }))
    ],
    [categories]
  );
  const categoryTabKeys = React.useMemo(() => categoryTabs.map((tab) => tab.key), [categoryTabs]);
  const activeCategoryTabKey = categoryTabKeys.includes(selectedCategory) ? selectedCategory : null;
  const {
    buttonRefs: categoryButtonRefs,
    containerRef: categoryContainerRef,
    indicator: categoryIndicator,
    isMoving: isCategoryIndicatorMoving,
    startMoving: startCategoryIndicatorMoving
  } = useMovingTabIndicator({
    activeKey: activeCategoryTabKey,
    keys: categoryTabKeys
  });

  React.useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onFiltersApply({
      fromDate: draftFilters.fromDate,
      keyword: draftFilters.keyword.trim(),
      toDate: draftFilters.toDate
    });
  };

  const resetFilters = () => {
    const emptyFilters = { fromDate: '', keyword: '', toDate: '' };
    setDraftFilters(emptyFilters);
    onFiltersApply(emptyFilters);
  };
  const applyTodayFilter = () => {
    const today = getSeoulDateString(new Date());
    const isActive = filters.fromDate === today && filters.toDate === today;
    const nextFilters = {
      ...draftFilters,
      fromDate: isActive ? '' : today,
      toDate: isActive ? '' : today
    };
    setDraftFilters(nextFilters);
    onFiltersApply({
      fromDate: nextFilters.fromDate,
      keyword: nextFilters.keyword.trim(),
      toDate: nextFilters.toDate
    });
  };
  const isTodayFilterActive = filters.fromDate === getSeoulDateString(new Date()) && filters.toDate === getSeoulDateString(new Date());
  const hasMore = page < totalPages;

  return (
    <section className="grid min-w-0 gap-3">
      <header className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-100">네이버 뉴스 기반</p>
            <h2 className="text-base font-semibold text-white">뉴스 검색</h2>
            <p className="mt-1 hidden text-xs leading-5 text-white/60 sm:block">
              네이버 뉴스 검색 API에서 환율·원화 관련 기사를 수집해 최신 시장 이슈를 확인합니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="hidden text-[11px] text-white/55 sm:block">총 {totalCount}건 · {articles.length}건 표시</p>
          </div>
        </div>
        {statusNode ? <div className="mt-1 flex justify-end">{statusNode}</div> : null}
      </header>

      <form className="grid min-w-0 gap-2" onSubmit={submitFilters}>
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-1.5 lg:gap-2">
          <button
            aria-label="기간 필터"
            className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold lg:h-8 lg:w-8 ${
              isFilterOpen || filters.fromDate || filters.toDate ? 'border-teal-300/50 bg-teal-400/20 text-teal-100' : 'border-white/15 bg-white/10 text-white/65 hover:text-white'
            }`}
            onClick={() => setIsFilterOpen((current) => !current)}
            title="기간 필터"
            type="button"
          >
            ⚙
          </button>
          <label className="grid gap-1 text-[10px] font-semibold text-white/55">
            <span className="sr-only">제목</span>
            <input
              className="glass-field h-9 rounded-full px-3 text-sm font-medium outline-none lg:h-8 lg:text-xs"
              onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="제목 또는 설명 검색"
              type="search"
              value={draftFilters.keyword}
            />
          </label>
          <button className="h-9 rounded-full border border-teal-600 bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700 lg:h-8" type="submit">
            검색
          </button>
          <button className="h-9 rounded-full border border-white/15 bg-white/10 px-3.5 text-xs font-semibold text-white/60 hover:text-white lg:h-8" onClick={resetFilters} type="button">
            초기화
          </button>
        </div>
        {isFilterOpen ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
            <button
              className={`h-8 self-end rounded-full border px-3 text-xs font-semibold ${
                isTodayFilterActive ? 'border-teal-300/50 bg-teal-400/20 text-teal-100' : 'border-white/15 bg-white/10 text-white/60 hover:text-white'
              }`}
              onClick={applyTodayFilter}
              type="button"
            >
              오늘
            </button>
            <DateFilterFields draftFilters={draftFilters} setDraftFilters={setDraftFilters} />
          </div>
        ) : null}
      </form>

      <nav className="min-w-0" aria-label="뉴스 카테고리">
        <div className="scrollbar-none relative flex flex-nowrap gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/10 p-1 sm:flex-wrap sm:overflow-visible" ref={categoryContainerRef}>
          <MovingTabIndicator indicator={categoryIndicator} isMoving={isCategoryIndicatorMoving} />
          {categoryTabs.map((category) => (
            <CategoryButton
              active={selectedCategory === category.key}
              key={category.key}
              label={category.label}
              onClick={() => {
                if (selectedCategory !== category.key) {
                  startCategoryIndicatorMoving();
                }
                onCategoryChange(category.key);
              }}
              ref={(node) => {
                categoryButtonRefs.current[category.key] = node;
              }}
            />
          ))}
        </div>
      </nav>

      {!configured ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-400/15 p-4 text-sm text-amber-100 shadow-sm">
          네이버 뉴스 API 키가 아직 설정되지 않았습니다. `backend/.env`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 추가한 뒤 백엔드를 다시 실행하세요.
        </section>
      ) : null}

      <section className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3">
        {isLoading && articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">뉴스를 불러오는 중입니다.</div>
        ) : isPendingInitialLoad ? (
          <div className="min-h-40" />
        ) : articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">저장된 뉴스가 없습니다.</div>
        ) : (
          <div className="grid min-w-0 gap-2.5 sm:gap-3">
            {articles.map((article) => (
              <NewsArticleCard article={article} key={`${article.categoryCode}-${article.link}`} />
            ))}
          </div>
        )}
        <InfiniteLoadMarker
          hasItems={articles.length > 0}
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => onLoadMore(page + 1)}
        />
      </section>
    </section>
  );
}

function DateFilterFields({
  draftFilters,
  setDraftFilters
}: {
  draftFilters: NewsFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<NewsFilters>>;
}) {
  return (
    <>
      <label className="grid gap-1 text-[10px] font-semibold text-white/55">
        시작일
        <input
          className="glass-field h-8 rounded-md px-2 text-xs font-medium outline-none"
          max={draftFilters.toDate || undefined}
          onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
          type="date"
          value={draftFilters.fromDate}
        />
      </label>
      <label className="grid gap-1 text-[10px] font-semibold text-white/55">
        종료일
        <input
          className="glass-field h-8 rounded-md px-2 text-xs font-medium outline-none"
          min={draftFilters.fromDate || undefined}
          onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
          type="date"
          value={draftFilters.toDate}
        />
      </label>
    </>
  );
}

const CategoryButton = React.forwardRef<HTMLButtonElement, { active: boolean; label: string; onClick: () => void }>(function CategoryButton({
  active,
  label,
  onClick
}, ref) {
  return (
    <button
      className={`relative z-10 h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors duration-150 ${
        active ? 'text-white' : 'text-white/60 hover:text-white'
      }`}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      {label}
    </button>
  );
});

function NewsArticleCard({ article }: { article: NewsArticle }) {
  const articleUrl = article.link || article.originLink;
  const isNew = isPublishedToday(article.publishedAt);
  const openArticle = () => {
    if (!articleUrl) {
      return;
    }

    const opened = window.open(articleUrl, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.opener = null;
    }
  };

  const openArticleWithKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openArticle();
    }
  };

  return (
    <article
      className="glass-list-card group/card min-w-0 cursor-pointer overflow-hidden rounded-2xl transition-[background-color,box-shadow] duration-150 ease-out hover:bg-white/10 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-200/50 sm:h-32 md:h-36 motion-reduce:transition-none"
      onClick={openArticle}
      onKeyDown={openArticleWithKeyboard}
      role="link"
      tabIndex={0}
    >
      <div className="grid sm:h-full sm:grid-cols-[128px_minmax(0,1fr)] md:grid-cols-[144px_minmax(0,1fr)]">
        <NewsThumbnail article={article} isNew={isNew} />
        <div className="min-w-0 overflow-hidden p-3 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-white/55">
                <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white/70">{article.categoryName}</span>
                <span>{formatNewsDate(article.publishedAt)}</span>
                <span className="truncate">검색어 {article.queryText}</span>
              </div>
              <span className="text-clamp-2 mt-2 block text-sm font-semibold leading-5 text-white">
                {article.title}
              </span>
            </div>
            {article.originLink ? (
              <a
                className="shrink-0 text-xs font-semibold text-white/45 hover:text-teal-100"
                href={article.originLink}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                원문
              </a>
            ) : null}
          </div>
          {article.description ? <p className="text-clamp-1 mt-2 text-xs leading-5 text-white/65">{article.description}</p> : null}
          <div className="mt-3 flex min-w-0 gap-2 overflow-hidden whitespace-nowrap border-t border-white/10 pt-2 text-[11px] text-white/45">
            <span>수집 {formatNewsDate(article.fetchedAt)}</span>
            {article.aiSummary ? <span>AI 요약 있음</span> : <span>AI 요약 대기</span>}
            {article.marketSentiment ? <span className="truncate">{article.marketSentiment}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function NewBadge() {
  return (
    <span className="absolute right-2 top-2 z-10 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-normal text-white shadow-sm">
      New
    </span>
  );
}

function NewsThumbnail({ article, isNew }: { article: NewsArticle; isNew: boolean }) {
  const [hasImageError, setHasImageError] = React.useState(false);

  React.useEffect(() => {
    setHasImageError(false);
  }, [article.imageUrl]);

  if (article.imageUrl && !hasImageError) {
    return (
      <div className="relative h-28 w-full self-start overflow-hidden bg-zinc-900/50 sm:h-32 md:h-36">
        {isNew ? <NewBadge /> : null}
        <img
          alt=""
          className="block h-full w-full object-cover transition-opacity duration-200 ease-out group-hover/card:opacity-95"
          loading="lazy"
          onError={() => setHasImageError(true)}
          src={article.imageUrl}
        />
      </div>
    );
  }

  return (
    <div className="relative grid h-28 w-full self-start place-items-center overflow-hidden bg-[linear-gradient(135deg,#0f766e,#3f3f46)] text-center text-white sm:h-32 md:h-36">
      {isNew ? <NewBadge /> : null}
      <div>
        <span className="inline-grid h-10 w-10 place-items-center rounded-md bg-white text-lg font-bold text-teal-700">₩</span>
        <p className="mt-1 text-[11px] font-semibold leading-4">{article.categoryName}</p>
      </div>
    </div>
  );
}

function InfiniteLoadMarker({
  hasItems,
  hasMore,
  isLoading,
  onLoadMore
}: {
  hasItems: boolean;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const markerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !hasMore || isLoading) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          onLoadMore();
        }
      },
      { rootMargin: '360px 0px' }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  if (!hasItems) {
    return null;
  }

  return (
    <div className="mt-4 grid min-h-12 place-items-center border-t border-white/10 pt-4 text-xs font-semibold text-white/45" ref={markerRef}>
      {isLoading ? '뉴스를 더 불러오는 중입니다.' : hasMore ? '아래로 스크롤하면 더 불러옵니다.' : '마지막 뉴스입니다.'}
    </div>
  );
}

function formatNewsDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}

function isPublishedToday(value: string | null) {
  if (!value) {
    return false;
  }

  return getSeoulDateString(new Date(value)) === getSeoulDateString(new Date());
}
