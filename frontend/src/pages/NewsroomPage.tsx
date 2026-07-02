import type { NewsArticle, NewsCategory } from '../types';

type NewsroomPageProps = {
  articles: NewsArticle[];
  categories: NewsCategory[];
  configured: boolean;
  isLoading: boolean;
  selectedCategory: string;
  syncMessage: string;
  onCategoryChange: (category: string) => void;
};

export function NewsroomPage({
  articles,
  categories,
  configured,
  isLoading,
  selectedCategory,
  syncMessage,
  onCategoryChange
}: NewsroomPageProps) {
  return (
    <section className="grid gap-4">
      <header className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-teal-700">네이버 뉴스 기반</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-950">환율·금리 뉴스룸</h2>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500">
              원달러 환율, 외환시장, 기준금리, FOMC, 외환당국 관련 뉴스를 카테고리별로 수집합니다.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
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
        <p className="mt-3 text-[11px] text-zinc-500">
          {configured ? syncMessage || '네이버 뉴스 API 설정이 연결되었습니다.' : 'NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 backend/.env에 넣으면 작동합니다.'}
        </p>
      </header>

      {!configured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          네이버 뉴스 API 키가 아직 설정되지 않았습니다. `backend/.env`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 추가한 뒤 백엔드를 다시 실행하세요.
        </section>
      ) : null}

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-semibold text-zinc-950">최신 기사</h3>
          <span className="text-xs text-zinc-500">{articles.length}건</span>
        </div>
        {isLoading ? (
          <div className="grid min-h-40 place-items-center text-sm text-zinc-400">뉴스를 불러오는 중입니다.</div>
        ) : articles.length === 0 ? (
          <div className="grid min-h-40 place-items-center text-sm text-zinc-400">저장된 뉴스가 없습니다.</div>
        ) : (
          <div className="grid gap-3">
            {articles.map((article) => (
              <NewsArticleCard article={article} key={`${article.categoryCode}-${article.link}`} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`h-8 rounded-md border px-3 text-xs font-semibold ${
        active ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function NewsArticleCard({ article }: { article: NewsArticle }) {
  return (
    <article className="rounded-md border border-zinc-100 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="rounded bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600">{article.categoryName}</span>
            <span>{formatNewsDate(article.publishedAt)}</span>
            <span>검색어 {article.queryText}</span>
          </div>
          <a
            className="mt-2 block text-sm font-semibold leading-5 text-zinc-950 hover:text-teal-700"
            href={article.link}
            rel="noreferrer"
            target="_blank"
          >
            {article.title}
          </a>
        </div>
        {article.originLink ? (
          <a className="shrink-0 text-xs font-semibold text-zinc-400 hover:text-teal-700" href={article.originLink} rel="noreferrer" target="_blank">
            원문
          </a>
        ) : null}
      </div>
      {article.description ? <p className="mt-2 text-xs leading-5 text-zinc-600">{article.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
        <span>수집 {formatNewsDate(article.fetchedAt)}</span>
        {article.aiSummary ? <span>AI 요약 있음</span> : <span>AI 요약 대기</span>}
        {article.marketSentiment ? <span>{article.marketSentiment}</span> : null}
      </div>
    </article>
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
