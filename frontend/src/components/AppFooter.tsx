export function AppFooter() {
  return (
    <footer className="mt-6 border-t border-white/10 bg-zinc-950/35 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 text-xs text-white/55 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">코리아원</p>
          <p className="mt-1 leading-5">개인 개발자가 운영하는 환율 모니터링 서비스입니다. 제공 데이터는 정보 확인용이며 투자 조언이 아닙니다.</p>
          <p className="mt-1 leading-5">데이터 출처와 갱신 주기는 서비스 안내 및 각 화면의 출처 표기를 기준으로 확인해 주세요.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
          <a className="font-semibold text-teal-100 hover:text-white" href="mailto:kim0607mi@gmail.com">
            kim0607mi@gmail.com
          </a>
          <a className="font-semibold text-teal-100 hover:text-white" href="https://github.com/jxnyxng" rel="noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
