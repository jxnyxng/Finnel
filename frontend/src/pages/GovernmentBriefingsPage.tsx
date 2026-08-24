import React from 'react';
import { createPortal } from 'react-dom';
import { FadeIn } from '../components/FadeIn';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { GovernmentBriefingArticle, GovernmentBriefingCategory, GovernmentBriefingFilters } from '../types';
import { lockBodyScroll } from '../utils/scrollLock';
import { getSeoulDateString } from '../utils/time';

type BriefingContentThemeKey = 'paper' | 'memo' | 'dark';

type GovernmentBriefingsPageProps = {
    articles: GovernmentBriefingArticle[];
    categories: GovernmentBriefingCategory[];
    configured: boolean;
    filters: GovernmentBriefingFilters;
    isLoading: boolean;
    isPendingInitialLoad?: boolean;
    page: number;
    selectedCategory: string;
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
                                            totalCount,
                                            totalPages
                                        }: GovernmentBriefingsPageProps) {
    const [draftFilters, setDraftFilters] = React.useState(filters);
    const [hasEnteredPage, setHasEnteredPage] = React.useState(false);
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [selectedArticle, setSelectedArticle] = React.useState<GovernmentBriefingArticle | null>(null);
    const [contentTheme, setContentTheme] = React.useState<BriefingContentThemeKey>('dark');
    const categoryScrollerRef = React.useRef<HTMLDivElement | null>(null);
    const categoryTabs = React.useMemo(
        () => [
            { key: 'all', label: '전체' },
            ...categories.map((category) => ({ key: category.code, label: getGovernmentBriefingCategoryLabel(category.code) }))
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
            <FadeIn as="header" className="page-tab-header" delay={0}>
                <div className="min-w-0">
                    <p className="page-tab-eyebrow">GOVERNMENT POLICY</p>
                    <h2 className="page-tab-title">정책뉴스</h2>
                    <p className="page-tab-description">대한민국 정책브리핑 공개 API에서 수집한 정부 부처 공식 발표입니다. 원문 링크와 발행일을 함께 보존해 출처를 확인할 수 있습니다.</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">평일 공개 자료를 기준으로 업데이트합니다.</p>
                </div>
                <div className="grid min-w-0 justify-items-start gap-1 md:justify-items-end">
                    <div className="page-tab-meta">
                        <span>총 {totalCount}건</span>
                        <span>{articles.length}건 표시</span>
                    </div>
                </div>
            </FadeIn>

            {/* 2. 필터 영역: 0.1초 등장 */}
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
                            <span className="sr-only">검색어</span>
                            <input
                                className="glass-field h-9 w-full rounded-full px-3 text-sm font-medium outline-none lg:h-8 lg:text-xs"
                                onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
                                placeholder="제목, 부제목, 본문 검색"
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
            <FadeIn as="nav" className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1 sm:block" aria-label="정책뉴스 카테고리" delay={0.2}>
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

            {/* 4. 정책 리스트 컨테이너: 0.3초 등장 */}
            <FadeIn as="section" className="glass-card min-w-0 rounded-2xl p-2.5 shadow-sm sm:p-3" delay={0.3}>
                <div className="mb-2 flex justify-end px-1 text-[11px] font-semibold text-white/45">
                    {selectedCategoryCount}건
                </div>
                {!configured ? (
                    <div className="grid min-h-40 place-items-center px-4 text-center text-sm font-medium text-zinc-700">현재 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</div>
                ) : isLoading && articles.length === 0 ? (
                    <div className="grid min-h-40 place-items-center text-sm text-white/45">정책뉴스를 불러오는 중입니다.</div>
                ) : isPendingInitialLoad ? (
                    <div className="min-h-40" />
                ) : articles.length === 0 ? (
                    <div className="grid min-h-40 place-items-center text-sm text-white/45">저장된 정책뉴스가 없습니다.</div>
                ) : (
                    <div className={`${hasEnteredPage ? 'content-smooth-refresh' : ''} grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4`}>
                        {articles.map((article, index) => {
                            const isInitialPageItem = index < 12;
                            const cardElement = (
                                <GovernmentBriefingCard
                                    article={article}
                                    onOpen={setSelectedArticle}
                                />
                            );

                            return isInitialPageItem && !hasEnteredPage ? (
                                <FadeIn className="h-full" key={`${article.originalUrl ?? article.title}-${article.publishedAt ?? ''}`} delay={0.35 + (index % 12) * 0.05}>
                                    {cardElement}
                                </FadeIn>
                            ) : (
                                <div className="h-full" key={`${article.originalUrl ?? article.title}-${article.publishedAt ?? ''}`}>
                                    {cardElement}
                                </div>
                            );
                        })}
                    </div>
                )}
                <BriefingPagination
                    currentPage={page}
                    hasItems={articles.length > 0}
                    isLoading={isLoading}
                    onPageChange={onLoadMore}
                    totalPages={totalPages}
                />
            </FadeIn>

            <GovernmentBriefingModal
                article={selectedArticle}
                contentTheme={contentTheme}
                onClose={() => setSelectedArticle(null)}
                onContentThemeChange={setContentTheme}
            />
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
            className="glass-list-card group/card relative h-full min-w-0 cursor-pointer overflow-hidden rounded-2xl transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300 motion-reduce:transform-none motion-reduce:transition-none"
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
            <div className="relative h-28 overflow-hidden bg-zinc-100 sm:h-32">
                {imageUrl ? (
                    <img
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
                        loading="lazy"
                        src={imageUrl}
                    />
                ) : (
                    <div className="grid h-full place-items-center border border-teal-300/20 bg-zinc-950 px-5 text-center">
                        <div className="grid w-full max-w-[14rem] place-items-center">
                            <img
                                alt=""
                                className="h-auto max-h-12 w-full object-contain"
                                loading="lazy"
                                src="/assets/korea-policy-briefing-logo-on-dark.png"
                            />
                            <p className="mt-2 border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[11px] font-semibold text-teal-100">{categoryLabel}</p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-zinc-950/18 to-transparent" />
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
        <span className="new-badge absolute right-2 top-2 z-10 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-normal text-white shadow-sm">
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
            return '외환·금융';
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

const briefingContentThemes: Array<{
    key: BriefingContentThemeKey;
    label: string;
    checkClassName: string;
    swatchClassName: string;
}> = [
    { key: 'dark', label: '다크그레이 본문', checkClassName: 'text-white', swatchClassName: 'briefing-theme-swatch-dark' },
    { key: 'paper', label: '흰색 본문', checkClassName: 'text-stone-900', swatchClassName: 'briefing-theme-swatch-paper' },
    { key: 'memo', label: '노란색 본문', checkClassName: 'text-stone-900', swatchClassName: 'briefing-theme-swatch-memo' }
];

function getBriefingContentThemeClassName(theme: BriefingContentThemeKey) {
    if (theme === 'memo') {
        return 'briefing-content-theme-memo';
    }

    if (theme === 'dark') {
        return 'briefing-content-theme-dark';
    }

    return 'briefing-content-theme-paper';
}

function GovernmentBriefingModal({
                                     article,
                                     contentTheme,
                                     onClose,
                                     onContentThemeChange
                                 }: {
    article: GovernmentBriefingArticle | null;
    contentTheme: BriefingContentThemeKey;
    onClose: () => void;
    onContentThemeChange: (theme: BriefingContentThemeKey) => void;
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
    const briefingContent = getBriefingContentSections(article.body || article.subtitle || '본문 요약 정보가 제공되지 않았습니다. 원문에서 전체 내용을 확인하세요.');
    const contentThemeClassName = getBriefingContentThemeClassName(contentTheme);

    return createPortal(
        <div className="modal-overlay responsive-modal-overlay fixed inset-0 z-[100] flex bg-zinc-950/35" onClick={onClose}>
            <section
                className="modal-panel glass-modal responsive-modal-panel overflow-hidden rounded-2xl shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="modal-scroll-area responsive-modal-scroll">
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
                                <div className="mt-3 flex items-center gap-1.5" aria-label="본문 색상">
                                    {briefingContentThemes.map((theme) => (
                                        <button
                                            aria-label={theme.label}
                                            className={`h-6 w-6 rounded border transition-[border-color,box-shadow,transform] duration-150 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-200/50 ${
                                                theme.swatchClassName
                                            } ${contentTheme === theme.key ? 'border-teal-200 shadow-sm shadow-teal-200/30' : 'border-white/20'}`}
                                            key={theme.key}
                                            onClick={() => onContentThemeChange(theme.key)}
                                            title={theme.label}
                                            type="button"
                                        >
                                            {contentTheme === theme.key ? (
                                                <span className={`grid h-full place-items-center text-[13px] font-extrabold leading-none ${theme.checkClassName}`}>✓</span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                aria-label="정책뉴스 닫기"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-lg font-semibold leading-none text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-950"
                                onClick={onClose}
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                        <div className={`mx-auto mt-4 max-w-2xl rounded-2xl px-4 py-4 text-sm font-medium leading-7 shadow-sm md:px-5 md:py-5 ${contentThemeClassName}`}>
                            {briefingContent.bodyParagraphs.map((paragraph, index) => (
                                <p className={index === 0 ? '' : 'mt-4'} key={`${paragraph.slice(0, 24)}-${index}`}>
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                        {briefingContent.noticeParagraphs.length > 0 ? (
                            <div className="mx-auto mt-3 max-w-2xl rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-[11px] leading-5 text-white/45">
                                {briefingContent.noticeParagraphs.map((paragraph, index) => (
                                    <p className={index === 0 ? '' : 'mt-1.5'} key={`${paragraph.slice(0, 24)}-${index}`}>
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                        ) : null}
                        <div className="mx-auto mt-4 flex max-w-2xl justify-end">
                            {article.originalUrl ? (
                                <a
                                    className="inline-flex h-8 items-center text-xs font-semibold text-zinc-950 underline-offset-4 hover:underline"
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

function getBriefingContentSections(value: string) {
    const paragraphs = getBriefingParagraphs(value);
    const noticeParagraphs = paragraphs.filter(isBriefingNoticeParagraph);
    const bodyParagraphs = paragraphs.filter((paragraph) => !isBriefingNoticeParagraph(paragraph));

    return {
        bodyParagraphs: bodyParagraphs.length > 0 ? bodyParagraphs : ['본문 요약 정보가 제공되지 않았습니다. 원문에서 전체 내용을 확인하세요.'],
        noticeParagraphs
    };
}

function isBriefingNoticeParagraph(paragraph: string) {
    return /^문의\s*:/.test(paragraph) || paragraph.startsWith('정책브리핑의 자료는');
}

function BriefingPagination({
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

function getPaginationPages(currentPage: number, totalPages: number) {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
