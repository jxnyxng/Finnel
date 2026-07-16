import type { DataSourceInfo } from '../types';

export function DataSourceGuide({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="glass-card rounded-2xl p-4 shadow-sm">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-base font-semibold text-white">데이터 출처와 업데이트</h2>
        <p className="mt-1 text-xs text-white/60">화면은 외부 API를 직접 호출하지 않고, 백엔드 배치가 DB에 저장한 최신 데이터를 조회합니다.</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {dataSources.map((source) => (
          <article key={source.code} className="glass-subcard rounded-2xl p-3">
            <h3 className="text-sm font-semibold text-white">{source.title}</h3>
            <dl className="mt-3 grid gap-2 text-xs">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-white/55">API</dt>
                <dd className="min-w-0 font-medium leading-5 text-white/85">{source.api}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-white/55">업데이트</dt>
                <dd className="min-w-0 font-medium leading-5 text-white/85">{source.updatePolicy}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-white/55">비고</dt>
                <dd className="min-w-0 leading-5 text-white/70">{source.note}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
