import { InfoBlock } from '../components/InfoBlock';

export function DeveloperInfoPage() {
  return (
    <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
      <div className="w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-72 flex-col items-center justify-center bg-zinc-900 p-6 text-white">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-teal-600 text-4xl font-semibold">KJY</div>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal">개발자</h2>
            <p className="mt-1 text-sm text-zinc-300">KRW Watcher Creator</p>
          </div>
          <div className="p-6">
            <p className="text-xs font-semibold text-teal-700">DEVELOPER PROFILE</p>
            <h3 className="mt-3 text-2xl font-semibold">환율 리스크를 직접 추적하는 개인 프로젝트</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              원화 소득으로 해외 자산을 투자할 때 확인해야 하는 환율·금리·실효환율 정보를 한곳에 모으기 위해 만들었습니다.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <InfoBlock title="프로젝트" text="React, Spring Boot, MySQL 기반 원화 가치 및 환율 리스크 모니터" />
              <InfoBlock title="데이터 원칙" text="브라우저가 외부 API를 직접 호출하지 않고, 백엔드 배치가 DB에 저장한 데이터를 제공합니다." />
              <InfoBlock title="관심 지표" text="USD/KRW, 선진국 달러 지수, 광의 달러 지수, BIS NEER/REER, 기준금리, 외환보유액" />
              <InfoBlock title="개발 방향" text="실제 배포 환경에서도 API 호출량과 데이터 출처를 명확히 관리하는 구조를 유지합니다." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
