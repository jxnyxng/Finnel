import React from 'react';
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
  onPageChange: (page: number) => void;
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
  onPageChange
}: NewsroomPageProps) {
  const [draftFilters, setDraftFilters] = React.useState(filters);

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

  return (
    <section className="grid gap-3">
      <header className="glass-card rounded-2xl p-3 shadow-sm">
        <div className="grid gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-100">네이버 뉴스 기반</p>
            <h2 className="text-base font-semibold text-white">뉴스 검색</h2>
            <p className="mt-1 text-xs leading-5 text-white/60">
              네이버 뉴스 검색 API에서 환율·원화 관련 기사를 수집해 최신 시장 이슈를 확인합니다.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] text-white/55">총 {totalCount}건 · {page}/{Math.max(1, totalPages)}쪽</p>
            {statusNode}
          </div>
        </div>
        <form className="mt-2 grid gap-2 border-t border-white/10 pt-2 md:grid-cols-[auto_140px_140px_minmax(180px,1fr)_auto_auto]" onSubmit={submitFilters}>
          <button
            className={`h-8 self-end rounded-full border px-3.5 text-xs font-semibold ${
              isTodayFilterActive ? 'border-teal-300/50 bg-teal-400/20 text-teal-100' : 'border-white/15 bg-white/10 text-white/60 hover:text-white'
            }`}
            onClick={applyTodayFilter}
            type="button"
          >
            오늘
          </button>
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
          <label className="grid gap-1 text-[10px] font-semibold text-white/55">
            제목
            <input
              className="glass-field h-8 rounded-md px-2 text-xs font-medium outline-none"
              onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="제목 또는 설명 검색"
              type="search"
              value={draftFilters.keyword}
            />
          </label>
          <button className="h-8 self-end rounded-full border border-teal-600 bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700" type="submit">
            검색
          </button>
          <button className="h-8 self-end rounded-full border border-white/15 bg-white/10 px-3.5 text-xs font-semibold text-white/60 hover:text-white" onClick={resetFilters} type="button">
            초기화
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          <CategoryButton active={selectedCategory === 'all'} label="전체" onClick={() => onCategoryChange('all')} />
          {categories.map((category) => (
            <CategoryButton
              active={selectedCategory === category.code}
              key={category.code}
              label={category.name}
              onClick={() => onCategoryChange(category.code)}
            />
          ))}
        </div>
      </header>

      {!configured ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-400/15 p-4 text-sm text-amber-100 shadow-sm">
          네이버 뉴스 API 키가 아직 설정되지 않았습니다. `backend/.env`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 추가한 뒤 백엔드를 다시 실행하세요.
        </section>
      ) : null}

      <section className="glass-card rounded-2xl p-3 shadow-sm">
        {isLoading ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">뉴스를 불러오는 중입니다.</div>
        ) : isPendingInitialLoad ? (
          <div className="min-h-40" />
        ) : articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-white/45">저장된 뉴스가 없습니다.</div>
        ) : (
          <div className="grid gap-3">
            {articles.map((article) => (
              <NewsArticleCard article={article} key={`${article.categoryCode}-${article.link}`} />
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        ) : null}
      </section>
    </section>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`h-8 rounded-full border px-3.5 text-xs font-semibold ${
        active ? 'border-teal-300/45 bg-teal-600 text-white' : 'border-white/15 bg-white/10 text-white/60 hover:text-white'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

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
      className="glass-list-card group/card cursor-pointer overflow-hidden rounded-2xl transition-[background-color,box-shadow] duration-150 ease-out hover:bg-white/10 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-200/50 motion-reduce:transition-none"
      onClick={openArticle}
      onKeyDown={openArticleWithKeyboard}
      role="link"
      tabIndex={0}
    >
      <div className="grid sm:grid-cols-[144px_minmax(0,1fr)]">
        <NewsThumbnail article={article} isNew={isNew} />
        <div className="min-w-0 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white/70">{article.categoryName}</span>
                <span>{formatNewsDate(article.publishedAt)}</span>
                <span>검색어 {article.queryText}</span>
              </div>
              <span className="mt-2 block text-sm font-semibold leading-5 text-white">
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
          {article.description ? <p className="mt-2 text-xs leading-5 text-white/65">{article.description}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-2 text-[11px] text-white/45">
            <span>수집 {formatNewsDate(article.fetchedAt)}</span>
            {article.aiSummary ? <span>AI 요약 있음</span> : <span>AI 요약 대기</span>}
            {article.marketSentiment ? <span>{article.marketSentiment}</span> : null}
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
  if (article.imageUrl) {
    return (
      <div className="relative h-32 w-full overflow-hidden bg-zinc-900/50 sm:h-full sm:min-h-32">
        {isNew ? <NewBadge /> : null}
        <img
          alt=""
          className="h-full w-full object-cover transition-opacity duration-200 ease-out group-hover/card:opacity-95"
          loading="lazy"
          src={article.imageUrl}
        />
      </div>
    );
  }

  return (
    <div className="relative grid h-32 w-full place-items-center overflow-hidden bg-[linear-gradient(135deg,#0f766e,#3f3f46)] text-center text-white sm:h-full sm:min-h-32">
      {isNew ? <NewBadge /> : null}
      <div>
        <span className="inline-grid h-10 w-10 place-items-center rounded-md bg-white text-lg font-bold text-teal-700">₩</span>
        <p className="mt-1 text-[11px] font-semibold leading-4">{article.categoryName}</p>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  onPageChange,
  totalPages
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  const pages = [];
  for (let page = startPage; page <= endPage; page += 1) {
    pages.push(page);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4">
      <PageButton disabled={currentPage <= 1} label="이전" onClick={() => onPageChange(currentPage - 1)} />
      {pages.map((page) => (
        <PageButton
          active={page === currentPage}
          key={page}
          label={String(page)}
          onClick={() => onPageChange(page)}
        />
      ))}
      <PageButton disabled={currentPage >= totalPages} label="다음" onClick={() => onPageChange(currentPage + 1)} />
    </div>
  );
}

function PageButton({
  active = false,
  disabled = false,
  label,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-8 min-w-8 rounded border px-2 text-xs font-semibold ${
        active ? 'border-teal-300/50 bg-teal-400/20 text-teal-100' : 'border-white/15 bg-white/10 text-white/60 hover:text-white'
      } disabled:cursor-not-allowed disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
