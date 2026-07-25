import React from 'react';
import { createPortal } from 'react-dom';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { GovernmentBriefingArticle, GovernmentBriefingCategory, GovernmentBriefingFilters } from '../types';
import { lockBodyScroll } from '../utils/scrollLock';
import { getSeoulDateString } from '../utils/time';

type GovernmentBriefingsPageProps = {
  articles: GovernmentBriefingArticle[];
  categories: GovernmentBriefingCategory[];
  configured: boolean;
  filters: GovernmentBriefingFilters;
  isLoading: boolean;
  isPendingInitialLoad?: boolean;
  page: number;
  selectedCategory: string;
  statusNode?: React.ReactNode;
  totalCount: number;
  totalPages: number;
  onCategoryChange: (category: string) => void;
  onFiltersApply: (filters: GovernmentBriefingFilters) => void;
  onLoadMore: (page: number) => void;
};

export function GovernmentBriefingsPage({
  articles,
  categories,
  configured,
  filters,
  isLoading,
  isPendingInitialLoad = false,
  onCategoryChange,
  onFiltersApply,
  onLoadMore,
  page,
  selectedCategory,
  statusNode,
  totalCount,
  totalPages
}: GovernmentBriefingsPageProps) {
  const [draftFilters, setDraftFilters] = React.useState(filters);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [selectedArticle, setSelectedArticle] = React.useState<GovernmentBriefingArticle | null>(null);
  const categoryScrollerRef = React.useRef<HTMLDivElement | null>(null);
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
  const scrollCategories = (direction: -1 | 1) => {
    categoryScrollerRef.current?.scrollBy({
      behavior: 'smooth',
      left: direction * 180
    });
  };

  return (
    <section className="grid min-w-0 gap-3">
      <header className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-100">정책브리핑 공식 콘텐츠</p>
            <h2 className="text-base font-semibold text-white">정부 정책</h2>
            <p className="mt-1 hidden text-xs leading-5 text-white/60 sm:block">
              대한민국 정책브리핑 공개 API에서 수집한 정부 부처 공식 발표입니다. 원문 링크와 발행일을 함께 보존해 출처를 확인할 수 있습니다.
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
            <span className="sr-only">검색어</span>
            <input
              className="glass-field h-9 rounded-full px-3 text-sm font-medium outline-none lg:h-8 lg:text-xs"
              onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="제목, 부제목, 본문 검색"
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

      <nav className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1 sm:block" aria-label="정부 정책 카테고리">
        <CategoryScrollButton direction="left" onClick={() => scrollCategories(-1)} />
        <div className="scrollbar-none relative flex min-w-0 flex-nowrap gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/10 p-1 sm:flex-wrap sm:overflow-visible" ref={(node) => {
          categoryScrollerRef.current = node;
          categoryContainerRef.current = node;
        }}>
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
        <CategoryScrollButton direction="right" onClick={() => scrollCategories(1)} />
      </nav>

      {!configured ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-400/15 p-4 text-sm text-amber-100 shadow-sm">
          정책브리핑 API 키가 아직 설정되지 않았습니다. `backend/.env`에 `POLICY_BRIEFING_API_KEY`를 추가한 뒤 백엔드를 다시 실행하세요.
        </section>
      ) : null}

      <section className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3">
        {isLoading && articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">정부 정책을 불러오는 중입니다.</div>
        ) : isPendingInitialLoad ? (
          <div className="min-h-40" />
        ) : articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">저장된 정부 정책이 없습니다.</div>
        ) : (
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            {articles.map((article) => (
              <GovernmentBriefingCard
                article={article}
                key={`${article.originalUrl ?? article.title}-${article.publishedAt ?? ''}`}
                onOpen={setSelectedArticle}
              />
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

      <GovernmentBriefingModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </section>
  );
}

function DateFilterFields({
  draftFilters,
  setDraftFilters
}: {
  draftFilters: GovernmentBriefingFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<GovernmentBriefingFilters>>;
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

function CategoryScrollButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      aria-label={direction === 'left' ? '이전 카테고리 보기' : '다음 카테고리 보기'}
      className="grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white/70 shadow-sm hover:bg-white/15 hover:text-white sm:hidden"
      onClick={onClick}
      type="button"
    >
      {direction === 'left' ? '‹' : '›'}
    </button>
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

function GovernmentBriefingCard({
  article,
  onOpen
}: {
  article: GovernmentBriefingArticle;
  onOpen: (article: GovernmentBriefingArticle) => void;
}) {
  const imageUrl = article.thumbnailUrl || article.imageUrl;
  const isNew = isPublishedToday(article.publishedAt);
  const categoryLabel = getGovernmentBriefingCategoryLabel(article.category);
  const keywords = getGovernmentBriefingKeywords(article, categoryLabel);

  return (
    <article
      aria-label={`${article.title} 상세 보기`}
      className="glass-list-card group/card relative min-w-0 cursor-pointer overflow-hidden rounded-2xl transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/12 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-200/50 motion-reduce:transform-none motion-reduce:transition-none"
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(article);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {isNew ? <NewBadge /> : null}
      <div className="relative h-28 overflow-hidden bg-zinc-800 sm:h-32">
        {imageUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center bg-white px-5 text-center">
            <div className="grid w-full max-w-[14rem] place-items-center">
              <img
                alt=""
                className="h-auto max-h-12 w-full object-contain"
                loading="lazy"
                src="/assets/korea-policy-briefing-logo.png"
              />
              <p className="mt-2 text-[11px] font-semibold text-zinc-700">{categoryLabel}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 to-transparent" />
      </div>
      <div className="flex min-h-36 flex-col p-3 sm:min-h-40">
        <div className="flex justify-start">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">{formatBriefingDate(article.publishedAt)}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{article.title}</h3>
        {article.subtitle ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/65">{article.subtitle}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">{categoryLabel}</span>
          {keywords.map((keyword) => (
            <span className="text-[11px] font-semibold text-teal-100" key={keyword}>
              #{keyword}
            </span>
          ))}
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

function getGovernmentBriefingCategoryLabel(category: string | null) {
  switch (category) {
    case 'monetary':
      return '통화정책';
    case 'fiscal':
      return '재정정책';
    case 'fx':
      return '외환·금융시장';
    case 'trade':
      return '무역·수급';
    case 'inflation':
      return '물가·민생';
    default:
      return category || '정책뉴스';
  }
}

function getGovernmentBriefingKeywords(article: GovernmentBriefingArticle, categoryLabel: string) {
  const source = `${article.title} ${article.subtitle ?? ''} ${article.body ?? ''}`;
  const candidates = [
    categoryLabel,
    '환율',
    '외환',
    '금융시장',
    '금리',
    '물가',
    '민생',
    '무역',
    '수출',
    '수입',
    '재정',
    '예산',
    '통화정책',
    '한국은행',
    '기획재정부'
  ];

  return candidates
    .filter((keyword, index, values) => values.indexOf(keyword) === index)
    .filter((keyword) => keyword === categoryLabel || source.includes(keyword))
    .slice(0, 3);
}

function GovernmentBriefingModal({
  article,
  onClose
}: {
  article: GovernmentBriefingArticle | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!article) {
      return;
    }

    return lockBodyScroll();
  }, [article]);

  React.useEffect(() => {
    if (!article) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [article, onClose]);

  if (!article) {
    return null;
  }

  const imageUrl = article.imageUrl || article.thumbnailUrl;
  const bodyParagraphs = getBriefingParagraphs(article.body || article.subtitle || '본문 요약 정보가 제공되지 않았습니다. 원문에서 전체 내용을 확인하세요.');

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/35 px-4 py-6" onClick={onClose}>
      <section
        className="modal-panel glass-modal w-full max-w-3xl overflow-hidden rounded-2xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-scroll-area max-h-[min(760px,calc(100vh-3rem))] overflow-y-auto">
          {imageUrl ? (
            <img alt="" className="h-44 w-full object-cover md:h-52" src={imageUrl} />
          ) : null}
          <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                  <span className="rounded bg-teal-400/15 px-2 py-0.5 font-semibold text-teal-100">{article.category || '정책뉴스'}</span>
                  <span className="font-medium">{formatBriefingDate(article.publishedAt)}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold leading-7 text-white md:text-xl md:leading-8">{article.title}</h3>
                {article.subtitle ? <p className="mt-2 text-sm leading-6 text-white/65">{article.subtitle}</p> : null}
              </div>
              <button
                className="h-7 shrink-0 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold text-white/60 hover:text-white"
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-7 text-slate-800 shadow-sm md:px-5 md:py-5">
              {bodyParagraphs.map((paragraph, index) => (
                <p className={index === 0 ? '' : 'mt-4'} key={`${paragraph.slice(0, 24)}-${index}`}>
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mx-auto mt-4 flex max-w-2xl justify-end">
              {article.originalUrl ? (
                <a
                  className="inline-flex h-8 items-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
                  href={article.originalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  정책브리핑에서 보기
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}

function getBriefingParagraphs(value: string) {
  return value
    .replace(/\s+(◆|◇|문의\s*:|정책브리핑의 자료는)/g, '\n$1')
    .replace(/\s+(☞\s*)/g, '\n$1')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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
      {isLoading ? '정부 정책을 더 불러오는 중입니다.' : hasMore ? '아래로 스크롤하면 더 불러옵니다.' : '마지막 정부 정책입니다.'}
    </div>
  );
}

function formatBriefingDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeZone: 'Asia/Seoul'
  }).format(new Date(value));
}

function isPublishedToday(value: string | null) {
  if (!value) {
    return false;
  }

  return getSeoulDateString(new Date(value)) === getSeoulDateString(new Date());
}
