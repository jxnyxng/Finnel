import { InfoBlock } from '../components/InfoBlock';

export function ServiceGuidePage() {
  return (
    <section className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
      <div className="w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-72 flex-col justify-between bg-teal-700 p-6 text-white">
            <div>
              <p className="text-xs font-semibold text-teal-100">SERVICE GUIDE</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">KRW Watcher 이용 안내</h2>
              <p className="mt-3 text-sm leading-6 text-teal-50">
                환율·실효환율·금리 지표를 함께 보며 원화 투자 환경을 점검하는 정보형 대시보드입니다.
              </p>
            </div>
            <div className="mt-6 flex h-24 w-24 items-center justify-center rounded-md bg-white/15 text-4xl font-semibold">₩</div>
          </div>
          <div className="p-6">
            <div className="max-w-3xl">
              <h3 className="text-xl font-semibold">투자 판단 전에 확인할 것</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                이 서비스는 저장된 외부 데이터를 정리해 보여주는 모니터링 도구이며, 투자 권유나 매매 신호가 아닙니다.
              </p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <InfoBlock title="투자 판단" text="실제 환전, 투자, 대출, 송금 판단은 본인의 책임으로 별도 확인이 필요합니다." />
              <InfoBlock title="데이터 지연" text="실시간 체결가가 아니며 발표 지연, 휴일, API 장애가 반영될 수 있습니다." />
              <InfoBlock title="환율 표시" text="USD/KRW 1일 차트는 Twelve Data 5분봉, 긴 기간은 Koreaexim/FRED 일별 저장값을 사용합니다." />
              <InfoBlock title="랭킹 기준" text="통화가치 랭킹은 BIS broad NEER 낮은 값 순이며, REER는 보조 실질 지표로 표시합니다." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
