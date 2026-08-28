import React from 'react';
import axios from 'axios';
import { FadeIn } from '../components/FadeIn';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { NewsArticle, NewsCategory, NewsFilters } from '../types';
import { getPaginationPages } from '../utils/pagination';
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
                                 totalCount,
                                 totalPages,
                                 onCategoryChange,
                                 onFiltersApply,
                                 onLoadMore
                             }: NewsroomPageProps) {
    const [draftFilters, setDraftFilters] = React.useState(filters);
    const [hasEnteredPage, setHasEnteredPage] = React.useState(false);
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const categoryScrollerRef = React.useRef<HTMLDivElement | null>(null);
    const categoryTabs = React.useMemo(
        () => [
            { key: 'all', label: '전체' },
            ...categories.map((category) => ({ key: category.code, label: category.name }))
        ],
        [categories]
    );
    const categoryTabKeys = React.useMemo(() => categoryTabs.map((tab) => tab.key), [categoryTabs]);
    const activeCategoryTabKey = categoryTabKeys.includes(selectedCategory) ? selectedCategory : null;
    const {
        buttonRefs: categoryButtonRefs,
        buttonWidth: categoryButtonWidth,
        containerRef: categoryContainerRef,
        indicator: categoryIndicator,
        isMoving: isCategoryIndicatorMoving,
        labelActiveKey: activeCategoryLabelKey,
        startMoving: startCategoryIndicatorMoving
    } = useMovingTabIndicator({
        activeKey: activeCategoryTabKey,
        equalizeButtonWidths: true,
        keys: categoryTabKeys,
        minButtonWidth: 82
    });

    React.useEffect(() => {
        setDraftFilters(filters);
    }, [filters]);

    React.useEffect(() => {
        setHasEnteredPage(true);
    }, []);

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
    const articleListKey = `${totalCount}-${articles[0]?.link ?? ''}-${articles[articles.length - 1]?.link ?? ''}`;
    const selectedCategoryCount = selectedCategory === 'all'
        ? totalCount
        : categories.find((category) => category.code === selectedCategory)?.articleCount ?? 0;
    const scrollCategories = (direction: -1 | 1) => {
        categoryScrollerRef.current?.scrollBy({
            behavior: 'smooth',
            left: direction * 180
        });
    };

    return (
        <section className="news-tab-shell grid min-w-0 gap-3">
            {/* 1. 헤더: 0초 등장 */}
            <FadeIn as="header" delay={0} className="page-tab-header">
                <div className="min-w-0">
                    <p className="page-tab-eyebrow">NEWS SEARCH</p>
                    <h2 className="page-tab-title">뉴스검색</h2>
                    <p className="page-tab-description">네이버 뉴스 검색 API에서 환율·원화 관련 기사를 수집해 최신 시장 이슈를 확인합니다.</p>
                </div>
                <div className="grid min-w-0 justify-items-start gap-1 md:justify-items-end">
                    <div className="page-tab-meta">
                        <span>총 {totalCount}건</span>
                        <span>{articles.length}건 표시</span>
                    </div>
                </div>
            </FadeIn>

            {/* 2. 검색 및 필터 Form: 0.1초 등장 */}
            <FadeIn delay={0.1}>
                <form className="grid min-w-0 gap-2" onSubmit={submitFilters}>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:gap-2">
                        <button
                            aria-label="기간 필터"
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold lg:h-8 lg:w-8 ${
                                isFilterOpen || filters.fromDate || filters.toDate ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                            }`}
                            onClick={() => setIsFilterOpen((current) => !current)}
                            title="기간 필터"
                            type="button"
                        >
                            ⚙
                        </button>
                        {isFilterOpen ? (
                            <>
                                <button
                                    className={`h-9 shrink-0 rounded-full border px-3 text-xs font-semibold lg:h-8 ${
                                        isTodayFilterActive ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                                    }`}
                                    onClick={applyTodayFilter}
                                    type="button"
                                >
                                    오늘
                                </button>
                                <DateFilterFields draftFilters={draftFilters} setDraftFilters={setDraftFilters} />
                            </>
                        ) : null}
                        <label className="min-w-[14rem] flex-1 text-[10px] font-semibold text-zinc-500">
                            <span className="sr-only">제목</span>
                            <input
                                className="glass-field h-9 w-full rounded-full px-3 text-sm font-medium outline-none lg:h-8 lg:text-xs"
                                onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
                                placeholder="제목 또는 설명 검색"
                                type="search"
                                value={draftFilters.keyword}
                            />
                        </label>
                        <button className="h-9 rounded-full border border-teal-600 bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700 lg:h-8" type="submit">
                            검색
                        </button>
                        <button className="h-9 rounded-full border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 lg:h-8" onClick={resetFilters} type="button">
                            초기화
                        </button>
                    </div>
                </form>
            </FadeIn>

            {/* 3. 카테고리 네비게이션: 0.2초 등장 */}
            <FadeIn as="nav" delay={0.2} className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1 sm:block" aria-label="뉴스 카테고리">
                <CategoryScrollButton direction="left" onClick={() => scrollCategories(-1)} />
                <div className="glass-card flex min-w-0 items-stretch rounded-full p-0.5 shadow-sm sm:items-center sm:justify-between">
                    <div className="scrollbar-none relative flex max-w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden" ref={(node) => {
                        categoryScrollerRef.current = node;
                        categoryContainerRef.current = node;
                    }}>
                        <MovingTabIndicator contained indicator={categoryIndicator} isMoving={isCategoryIndicatorMoving} />
                        {categoryTabs.map((category) => (
                            <CategoryButton
                                active={activeCategoryLabelKey === category.key}
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
                                width={categoryButtonWidth}
                            />
                        ))}
                    </div>
                </div>
                <CategoryScrollButton direction="right" onClick={() => scrollCategories(1)} />
            </FadeIn>

            {/* 4. 뉴스 리스트 섹션: 0.3초 등장 */}
            <FadeIn as="section" delay={0.3}>
                <div className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3">
                    <div className="mb-2 flex justify-end px-1 text-[11px] font-semibold text-white/45">
                        {selectedCategoryCount}건
                    </div>
                    {!configured ? (
                        <div className="grid min-h-40 place-items-center px-4 text-center text-sm font-medium text-zinc-700">현재 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</div>
                    ) : isLoading && articles.length === 0 ? (
                        <div className="grid min-h-40 place-items-center text-sm text-white/45">뉴스를 불러오는 중입니다.</div>
                    ) : isPendingInitialLoad ? (
                        <div className="min-h-40" />
                    ) : articles.length === 0 ? (
                        <div className="grid min-h-40 place-items-center text-sm text-white/45">저장된 뉴스가 없습니다.</div>
                    ) : (
                        <div className={`${hasEnteredPage ? 'content-smooth-refresh' : 'news-list-enter'} grid min-w-0 gap-2.5 sm:gap-3 2xl:grid-cols-2`} key={articleListKey}>
                            {articles.map((article, index) => {
                                const isInitialPageItem = index < 10;
                                const cardElement = <NewsArticleCard article={article} />;

                                return (
                                    <React.Fragment key={`${article.categoryCode}-${article.link}`}>
                                        {isInitialPageItem && !hasEnteredPage ? (
                                            <FadeIn delay={0.35 + (index % 10) * 0.04}>
                                                {cardElement}
                                            </FadeIn>
                                        ) : (
                                            cardElement
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                    <NewsPagination
                        currentPage={page}
                        hasItems={articles.length > 0}
                        isLoading={isLoading}
                        onPageChange={onLoadMore}
                        totalPages={totalPages}
                    />
                </div>
            </FadeIn>
        </section>
    );
}

function CategoryScrollButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
    return (
        <button
            aria-label={direction === 'left' ? '이전 카테고리 보기' : '다음 카테고리 보기'}
            className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-950 sm:hidden"
            onClick={onClick}
            type="button"
        >
            {direction === 'left' ? '‹' : '›'}
        </button>
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
            <label className="shrink-0 text-[10px] font-semibold text-zinc-500">
                <span className="sr-only">시작일</span>
                <input
                    className="glass-field h-9 w-[8.75rem] rounded-full px-3 text-xs font-medium outline-none lg:h-8"
                    max={draftFilters.toDate || undefined}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
                    type="date"
                    value={draftFilters.fromDate}
                />
            </label>
            <label className="shrink-0 text-[10px] font-semibold text-zinc-500">
                <span className="sr-only">종료일</span>
                <input
                    className="glass-field h-9 w-[8.75rem] rounded-full px-3 text-xs font-medium outline-none lg:h-8"
                    min={draftFilters.fromDate || undefined}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
                    type="date"
                    value={draftFilters.toDate}
                />
            </label>
        </>
    );
}

const CategoryButton = React.forwardRef<HTMLButtonElement, { active: boolean; label: string; onClick: () => void; width: number }>(function CategoryButton({
                                                                                                                                                               active,
                                                                                                                                                               label,
                                                                                                                                                               onClick,
                                                                                                                                                               width
                                                                                                                                                           }, ref) {
    return (
        <button
            className={`relative z-10 h-8 shrink-0 rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 sm:px-3 ${
                active ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
            }`}
            onClick={onClick}
            ref={ref}
            style={width > 0 ? { width } : undefined}
            type="button"
        >
            <span className="block truncate">{label}</span>
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
            className="glass-list-card group/card min-w-0 cursor-pointer overflow-hidden rounded-2xl transition-[background-color,box-shadow] duration-150 ease-out hover:bg-zinc-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:min-h-32 md:min-h-36 motion-reduce:transition-none"
            onClick={openArticle}
            onKeyDown={openArticleWithKeyboard}
            role="link"
            tabIndex={0}
        >
            <div className="grid sm:h-full sm:grid-cols-[120px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)]">
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
        <span className="new-badge absolute right-2 top-2 z-10 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-normal text-white shadow-sm">
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
            <div className="relative h-28 w-full self-start overflow-hidden bg-zinc-100 sm:h-32 md:h-36">
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
        <div className="relative grid h-28 w-full self-start place-items-center overflow-hidden border border-teal-300/20 bg-zinc-950 text-center text-teal-100 sm:h-32 md:h-36">
            {isNew ? <NewBadge /> : null}
            <div>
        <span className="inline-grid h-10 w-10 place-items-center border border-teal-300/25 bg-teal-400/10">
          <img alt="" aria-hidden="true" className="h-7 w-7" src="/assets/finnel_logo_rounded_final_white.svg" />
        </span>
                <p className="mt-2 border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[11px] font-semibold leading-4 text-teal-100">{article.categoryName}</p>
            </div>
        </div>
    );
}

function NewsPagination({
                            currentPage,
                            hasItems,
                            isLoading,
                            onPageChange,
                            totalPages
                        }: {
    currentPage: number;
    hasItems: boolean;
    isLoading: boolean;
    onPageChange: (page: number) => void;
    totalPages: number;
}) {
    if (!hasItems || totalPages <= 1) {
        return null;
    }

    const pageNumbers = getPaginationPages(currentPage, totalPages);

    return (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 border-t border-white/10 pt-4 text-xs font-semibold text-white/55">
            <button
                className="h-8 border border-white/10 bg-white/5 px-3 text-white/65 hover:border-teal-300/45 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-35"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => onPageChange(currentPage - 1)}
                type="button"
            >
                이전
            </button>
            {pageNumbers.map((pageNumber) => (
                <button
                    className={`h-8 min-w-8 border px-2.5 ${
                        pageNumber === currentPage ? 'border-teal-300/65 bg-teal-400/15 text-teal-100' : 'border-white/10 bg-white/5 text-white/60 hover:border-teal-300/45 hover:text-teal-100'
                    } disabled:cursor-not-allowed disabled:opacity-35`}
                    disabled={isLoading || pageNumber === currentPage}
                    key={pageNumber}
                    onClick={() => onPageChange(pageNumber)}
                    type="button"
                >
                    {pageNumber}
                </button>
            ))}
            <button
                className="h-8 border border-white/10 bg-white/5 px-3 text-white/65 hover:border-teal-300/45 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-35"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => onPageChange(currentPage + 1)}
                type="button"
            >
                다음
            </button>
            <span className="ml-1 text-white/35">{currentPage}/{totalPages}</span>
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
