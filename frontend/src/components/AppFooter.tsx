type AppFooterProps = {
  onDataSourcesClick?: () => void;
};

export function AppFooter({ onDataSourcesClick }: AppFooterProps) {
  return (
    <footer className="mt-6 border-t border-zinc-800 bg-black">
      <div className="flex w-full flex-col gap-4 px-3 py-6 text-xs text-zinc-500 sm:px-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-100">
            핀넬 finnel
            <button
              className="ml-2 align-baseline text-xs font-semibold text-teal-400 underline-offset-4 hover:text-teal-300 hover:underline"
              onClick={onDataSourcesClick}
              type="button"
            >
              출처
            </button>
          </p>
          <p className="mt-1 leading-5">Finance와 Funnel을 결합한 경제·금융 데이터 보드입니다. 제공 데이터는 정보 확인용이며 투자 조언이 아닙니다.</p>
          <p className="mt-1 leading-5">개인개발자가 잠시 운영하는 서비스로, 운영 상황에 따라 기능과 제공 범위가 변경될 수 있습니다.</p>
          <p className="mt-1 leading-5">출처와 갱신 주기는 서비스 안내 및 각 화면의 출처 표기를 기준으로 확인해 주세요.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
          <a className="font-semibold text-teal-700 hover:text-zinc-950" href="mailto:kim0607mi@gmail.com">
            kim0607mi@gmail.com
          </a>
          <a className="font-semibold text-teal-700 hover:text-zinc-950" href="https://github.com/jxnyxng" rel="noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
