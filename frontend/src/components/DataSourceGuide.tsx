import type { DataSourceInfo } from '../types';

export function DataSourceGuide({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="standard-tab-shell data-source-guide grid min-w-0 gap-4">
      <header className="page-tab-header">
        <div className="min-w-0">
          <p className="page-tab-eyebrow">DATA SOURCES</p>
          <h2 className="page-tab-title">출처</h2>
          <p className="page-tab-description">
            Finnel은 화면에서 외부 서비스를 직접 호출하지 않습니다. 서버 수집 작업이 아래 공개 API와 데이터 파일에서 값을 가져와 저장하고, 화면은 저장된 최신 값을 조회합니다.
          </p>
        </div>
        <div className="page-tab-meta" />
      </header>

      <article className="data-source-document">
        <section className="data-source-document-intro">
          <h3>확인 기준</h3>
          <p>
            최신 표시일, 발표 주기, API 제한 때문에 지표별 최신 날짜가 다를 수 있습니다. 각 값은 수집 시점에 저장된 값을 기준으로 보여주며, 실패한 수집은 기존 최신값을 유지합니다.
          </p>
        </section>
        {dataSources.map((source) => (
          <section className="data-source-document-section" key={source.code}>
            <h3>{source.title}</h3>
            <dl>
              <div>
                <dt>출처</dt>
                <dd>{source.api}</dd>
              </div>
              <div>
                <dt>갱신</dt>
                <dd>{source.updatePolicy}</dd>
              </div>
              <div>
                <dt>사용</dt>
                <dd>{source.note}</dd>
              </div>
            </dl>
          </section>
        ))}
      </article>
    </section>
  );
}
