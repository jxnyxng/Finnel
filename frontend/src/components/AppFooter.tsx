type AppFooterProps = {
  onDataSourcesClick?: () => void;
};

export function AppFooter({ onDataSourcesClick }: AppFooterProps) {
  return (
    <footer className="mt-6 border-t border-zinc-800 bg-[var(--app-bg)]">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-3 px-4 py-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <img
            alt=""
            aria-hidden="true"
            className="h-6 w-6 shrink-0"
            src="/assets/finnel_logo_rounded_final_white.svg"
          />
          <span className="brand-name-en text-base leading-none">
            <span className="brand-name-en-accent">fin</span>nel.kr
          </span>
        </div>
        <p className="min-w-0 text-[11px] font-medium leading-4 text-white/55">핀넬(finnel.kr)에서 제공하는 데이터는 정보 확인용이며 투자 조언이 아닙니다.</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="데이터 출처"
            className="footer-icon-button"
            onClick={onDataSourcesClick}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M5 6.5c0-1.38 3.13-2.5 7-2.5s7 1.12 7 2.5-3.13 2.5-7 2.5-7-1.12-7-2.5Z" />
              <path d="M5 6.5v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" />
              <path d="M5 11.5v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" />
            </svg>
          </button>
          <a className="footer-icon-button" href="mailto:kim0607mi@gmail.com" aria-label="이메일 보내기">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M4 6.5h16v11H4z" />
              <path d="m4.8 7.4 7.2 5.35 7.2-5.35" />
            </svg>
          </a>
          <a className="footer-icon-button" href="https://github.com/jxnyxng" rel="noreferrer" target="_blank" aria-label="GitHub 열기">
            <img alt="" aria-hidden="true" src="/assets/github-white-icon.svg" />
          </a>
        </div>
      </div>
    </footer>
  );
}
