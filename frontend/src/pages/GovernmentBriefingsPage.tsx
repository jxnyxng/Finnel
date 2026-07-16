import React from 'react';
import { createPortal } from 'react-dom';
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
  onPageChange: (page: number) => void;
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
  onPageChange,
  page,
  selectedCategory,
  statusNode,
  totalCount,
  totalPages
}: GovernmentBriefingsPageProps) {
  const [draftFilters, setDraftFilters] = React.useState(filters);
  const [selectedArticle, setSelectedArticle] = React.useState<GovernmentBriefingArticle | null>(null);

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
      <header className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-700">정책브리핑 공식 콘텐츠</p>
            <h2 className="text-base font-semibold text-zinc-950">정부 정책</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              대한민국 정책브리핑 공개 API에서 수집한 정부 부처 공식 발표입니다. 원문 링크와 발행일을 함께 보존해 출처를 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] text-zinc-500">총 {totalCount}건 · {page}/{Math.max(1, totalPages)}쪽</p>
            {statusNode}
          </div>
        </div>
        <form className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 md:grid-cols-[auto_140px_140px_minmax(180px,1fr)_auto_auto]" onSubmit={submitFilters}>
          <button
            className={`h-8 self-end rounded-full border px-3.5 text-xs font-semibold ${
              isTodayFilterActive ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900'
            }`}
            onClick={applyTodayFilter}
            type="button"
          >
            오늘
          </button>
          <label className="grid gap-1 text-[10px] font-semibold text-zinc-500">
            시작일
            <input
              className="h-8 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-800 outline-none focus:border-teal-600"
              max={draftFilters.toDate || undefined}
              onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
              type="date"
              value={draftFilters.fromDate}
            />
          </label>
          <label className="grid gap-1 text-[10px] font-semibold text-zinc-500">
            종료일
            <input
              className="h-8 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-800 outline-none focus:border-teal-600"
              min={draftFilters.fromDate || undefined}
              onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
              type="date"
              value={draftFilters.toDate}
            />
          </label>
          <label className="grid gap-1 text-[10px] font-semibold text-zinc-500">
            검색어
            <input
              className="h-8 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-teal-600"
              onChange={(event) => setDraftFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="제목, 부제목, 본문 검색"
              type="search"
              value={draftFilters.keyword}
            />
          </label>
          <button className="h-8 self-end rounded-full border border-teal-600 bg-teal-600 px-3.5 text-xs font-semibold text-white hover:bg-teal-700" type="submit">
            검색
          </button>
          <button className="h-8 self-end rounded-full border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900" onClick={resetFilters} type="button">
            초기화
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
          <CategoryButton active={selectedCategory === 'all'} label="전체" onClick={() => onCategoryChange('all')} />
          {categories.map((category) => (
            <CategoryButton
              active={selectedCategory === category.code}
              key={category.code}
              label={`${category.name} ${category.articleCount}`}
              onClick={() => onCategoryChange(category.code)}
            />
          ))}
        </div>
      </header>

      {!configured ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          정책브리핑 API 키가 아직 설정되지 않았습니다. `backend/.env`에 `POLICY_BRIEFING_API_KEY`를 추가한 뒤 백엔드를 다시 실행하세요.
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        {isLoading ? (
          <div className="grid min-h-40 place-items-center text-sm text-zinc-400">정부 정책을 불러오는 중입니다.</div>
        ) : isPendingInitialLoad ? (
          <div className="min-h-40" />
        ) : articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-zinc-400">저장된 정부 정책이 없습니다.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <GovernmentBriefingCard
                article={article}
                key={`${article.originalUrl ?? article.title}-${article.publishedAt ?? ''}`}
                onOpen={setSelectedArticle}
              />
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        ) : null}
      </section>

      <GovernmentBriefingModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </section>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`h-8 rounded-full border px-3.5 text-xs font-semibold ${
        active ? 'border-teal-700 bg-teal-700 text-white shadow-md shadow-teal-900/15 ring-1 ring-teal-600/30' : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

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
      className="group/card relative cursor-pointer overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-teal-50/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100 motion-reduce:transform-none motion-reduce:transition-none"
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
      <div className="relative h-32 overflow-hidden bg-zinc-800">
        {imageUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-105"
            loading="lazy"
            src={imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#0f766e,#3f3f46)] text-center text-white">
            <div>
              <span className="inline-grid h-10 w-10 place-items-center rounded-md bg-white text-lg font-bold text-teal-700">₩</span>
              <p className="mt-2 text-xs font-semibold">{categoryLabel}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/55 to-transparent" />
      </div>
      <div className="flex min-h-40 flex-col p-3">
        <div className="flex justify-start">
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">{formatBriefingDate(article.publishedAt)}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-zinc-950">{article.title}</h3>
        {article.subtitle ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600">{article.subtitle}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">{categoryLabel}</span>
          {keywords.map((keyword) => (
            <span className="text-[11px] font-semibold text-teal-700" key={keyword}>
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

  if (!article) {
    return null;
  }

  const imageUrl = article.imageUrl || article.thumbnailUrl;
  const bodyParagraphs = getBriefingParagraphs(article.body || article.subtitle || '본문 요약 정보가 제공되지 않았습니다. 원문에서 전체 내용을 확인하세요.');

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/35 px-4 py-6" onClick={onClose}>
      <section
        className="modal-panel w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-scroll-area max-h-[min(760px,calc(100vh-3rem))] overflow-y-auto">
          {imageUrl ? (
            <img alt="" className="h-44 w-full object-cover md:h-52" src={imageUrl} />
          ) : null}
          <div className="px-4 py-4 md:px-6 md:py-5">
            <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 border-b border-zinc-100 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                  <span className="rounded bg-teal-50 px-2 py-0.5 font-semibold text-teal-700">{article.category || '정책뉴스'}</span>
                  <span className="font-medium">{formatBriefingDate(article.publishedAt)}</span>
                </div>
                <h3 className="mt-2 text-lg font-semibold leading-7 text-zinc-950 md:text-xl md:leading-8">{article.title}</h3>
                {article.subtitle ? <p className="mt-2 text-sm leading-6 text-zinc-600">{article.subtitle}</p> : null}
              </div>
              <button
                className="h-7 shrink-0 rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="mx-auto mt-4 max-w-2xl rounded-md border border-zinc-100 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-800 md:px-5 md:py-5">
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

function Pagination({
  currentPage,
  onPageChange,
  totalPages
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 border-t border-zinc-100 pt-4">
      <PageButton disabled={currentPage <= 1} label="이전" onClick={() => onPageChange(currentPage - 1)} />
      <span className="px-2 text-xs font-semibold text-zinc-500">{currentPage}/{totalPages}</span>
      <PageButton disabled={currentPage >= totalPages} label="다음" onClick={() => onPageChange(currentPage + 1)} />
    </div>
  );
}

function PageButton({
  disabled = false,
  label,
  onClick
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="h-8 rounded border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
