import type { DataSourceInfo } from '../types';

const sourceIcons: Record<string, string> = {
  ADVANCED_DOLLAR_INDEX: '🏛️',
  BROAD_DOLLAR_INDEX: '🌐',
  CAPITAL_FLOW: '💸',
  CURRENCY_STRENGTH: '📊',
  FISCAL_POLICY: '🏦',
  FOREIGN_EXCHANGE: '💱',
  MACRO: '📈',
  USD_KRW: '💵'
};

export function DataSourceGuide({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="grid min-w-0 gap-4">
      <header className="page-tab-header">
        <div className="min-w-0">
          <p className="page-tab-eyebrow">DATA SOURCES</p>
          <h2 className="page-tab-title">데이터 출처</h2>
          <p className="page-tab-description">
            Finnel은 화면에서 외부 서비스를 직접 호출하지 않습니다. 서버 수집 작업이 아래 공개 API와 데이터 파일에서 값을 가져와 저장하고, 화면은 저장된 최신 값을 조회합니다.
          </p>
        </div>
        <div className="page-tab-meta" />
      </header>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {dataSources.map((source) => (
          <article key={source.code} className="glass-card min-w-0 rounded-2xl p-4 shadow-sm">
            <div className="flex min-w-0 items-start gap-3 border-b border-white/10 pb-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl" aria-hidden="true">
                {sourceIcons[source.code] ?? '🔎'}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">{source.title}</h3>
                <p className="mt-1 break-words text-[11px] font-medium leading-5 text-teal-100">{source.api}</p>
              </div>
            </div>
            <dl className="mt-3 grid gap-3 text-xs">
              <div>
                <dt className="font-semibold text-white/55">어디서 가져오나요</dt>
                <dd className="mt-1 break-words leading-5 text-white/85">{source.api}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white/55">언제 갱신하나요</dt>
                <dd className="mt-1 break-words leading-5 text-white/80">{source.updatePolicy}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white/55">화면에서 어떻게 쓰나요</dt>
                <dd className="mt-1 break-words leading-5 text-white/65">{source.note}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className="glass-card min-w-0 rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-white">확인 기준</h3>
        <p className="mt-2 text-xs leading-5 text-white/65">
          최신 표시일, 발표 주기, API 제한 때문에 지표별 최신 날짜가 다를 수 있습니다. 각 값은 수집 시점에 저장된 값을 기준으로 보여주며, 실패한 수집은 기존 최신값을 유지합니다.
        </p>
      </section>
    </section>
  );
}
