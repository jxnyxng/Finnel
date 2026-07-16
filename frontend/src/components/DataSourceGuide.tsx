import type { DataSourceInfo } from '../types';

export function DataSourceGuide({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="border-b border-zinc-100 pb-3">
        <h2 className="text-base font-semibold">데이터 출처와 업데이트</h2>
        <p className="mt-1 text-xs text-zinc-500">화면은 외부 API를 직접 호출하지 않고, 백엔드 배치가 DB에 저장한 최신 데이터를 조회합니다.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {dataSources.map((source) => (
          <article key={source.code} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
            <h3 className="text-sm font-semibold text-zinc-950">{source.title}</h3>
            <dl className="mt-3 grid gap-2 text-xs">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-zinc-500">API</dt>
                <dd className="min-w-0 font-medium leading-5 text-zinc-800">{source.api}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-zinc-500">업데이트</dt>
                <dd className="min-w-0 font-medium leading-5 text-zinc-800">{source.updatePolicy}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-zinc-500">비고</dt>
                <dd className="min-w-0 leading-5 text-zinc-600">{source.note}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
