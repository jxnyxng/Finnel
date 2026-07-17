import React from 'react';

const servicePoints = [
  {
    emoji: '💸',
    title: '환전 타이밍',
    body: '여행, 유학, 송금 전에 지금 원화가 비싼지 싼지 먼저 봅니다.'
  },
  {
    emoji: '📈',
    title: '해외 주식 투자',
    body: '주가만큼 중요한 환율 비용을 원화 관점에서 함께 확인합니다.'
  },
  {
    emoji: '🧭',
    title: '원화 가치 흐름',
    body: '달러 강세인지, 한국 고유 요인인지 나눠서 읽습니다.'
  },
  {
    emoji: '📰',
    title: '정책·뉴스 팔로우',
    body: '매일 업데이트되는 정부정책과 최신 뉴스를 편하게 따라갑니다.'
  }
];

const tabHints = [
  {
    emoji: '📊',
    title: '환율 현황',
    body: '원/달러 환율과 달러 지수로 오늘의 위치를 봅니다.'
  },
  {
    emoji: '🏦',
    title: '관련 지표',
    body: '금리, 물가, 무역수지처럼 원화 뒤의 숫자를 확인합니다.'
  },
  {
    emoji: '📰',
    title: '정부 정책',
    body: '매일 업데이트되는 발표로 외환 정책 흐름을 놓치지 않습니다.'
  },
  {
    emoji: '⚡',
    title: '최신 뉴스',
    body: '환율 이슈를 모아 보고 시장의 설명을 빠르게 확인합니다.'
  },
  {
    emoji: '🌏',
    title: '화폐 랭킹',
    body: '원화가 주요 통화 사이에서 어느 위치인지 비교합니다.'
  }
];

const ctaWords = ['상단', '탭에서', '바로', '이어서', '확인하세요.'];

type HomePageProps = {
  onGoDashboard?: () => void;
  onReachLastSection?: () => void;
};

export function HomePage({ onGoDashboard, onReachLastSection }: HomePageProps) {
  const [activeSection, setActiveSection] = React.useState(0);
  const [ctaHighlightKey, setCtaHighlightKey] = React.useState(0);
  const lastMoveAtRef = React.useRef(0);
  const onReachLastSectionRef = React.useRef(onReachLastSection);
  const previousSectionRef = React.useRef(0);
  const touchStartYRef = React.useRef<number | null>(null);
  const sectionCount = 4;

  React.useEffect(() => {
    onReachLastSectionRef.current = onReachLastSection;
  }, [onReachLastSection]);

  const moveSection = React.useCallback((direction: 1 | -1) => {
    const now = window.performance.now();
    if (now - lastMoveAtRef.current < 720) {
      return;
    }
    lastMoveAtRef.current = now;
    setActiveSection((current) => Math.min(sectionCount - 1, Math.max(0, current + direction)));
  }, []);

  const handleWheel = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaY) < 18) {
      return;
    }
    event.preventDefault();
    moveSection(event.deltaY > 0 ? 1 : -1);
  }, [moveSection]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      moveSection(1);
    }
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      moveSection(-1);
    }
  }, [moveSection]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;
    if (startY == null || endY == null || Math.abs(startY - endY) < 42) {
      return;
    }
    moveSection(startY > endY ? 1 : -1);
  }, [moveSection]);

  React.useEffect(() => {
    let tabHighlightTimeout: number | undefined;
    if (activeSection === sectionCount - 1 && previousSectionRef.current !== activeSection) {
      setCtaHighlightKey((current) => current + 1);
      tabHighlightTimeout = window.setTimeout(() => {
        onReachLastSectionRef.current?.();
      }, 1850);
    }
    previousSectionRef.current = activeSection;

    return () => {
      if (tabHighlightTimeout !== undefined) {
        window.clearTimeout(tabHighlightTimeout);
      }
    };
  }, [activeSection]);

  return (
    <section
      aria-label="코리아원 서비스 소개"
      className="home-deck page-content-enter relative -mx-3 -my-3 h-[calc(100vh-112px)] overflow-hidden px-3 text-white sm:-mx-5 sm:-my-4 sm:h-[calc(100vh-86px)] sm:px-5"
      onKeyDown={handleKeyDown}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      tabIndex={0}
    >
      <div
        className="home-deck-track"
      style={{ transform: `translate3d(0, -${activeSection * 100}%, 0)` }}
      >
      <section className="home-snap-section home-copy mx-auto grid h-[calc(100vh-112px)] max-w-6xl content-center py-8 sm:h-[calc(100vh-86px)] sm:py-14">
        <div className="max-w-5xl sm:-translate-y-8 md:-translate-y-10">
          <div className="text-5xl leading-none md:text-7xl" aria-hidden="true">₩</div>
          <p className="mt-5 text-xs font-bold tracking-[0.2em] text-teal-100/80 sm:mt-8 sm:text-sm sm:tracking-[0.24em]">KOREA WON MONITOR</p>
          <h1 className="mt-4 max-w-[980px] text-3xl font-extrabold leading-[1.22] tracking-normal sm:mt-5 sm:text-4xl md:text-6xl md:leading-[1.12]">
            환전하기 전, 원화의 위치부터.
          </h1>
          <p className="mt-5 max-w-4xl text-sm font-medium leading-7 text-white/72 sm:mt-7 sm:text-base sm:leading-8 md:text-lg md:leading-8">
            코리아원은 환전을 자주 하거나 해외 주식에 투자하는 사람이 환율을 더 똑똑하게 볼 수 있도록 만든 원화 중심 모니터입니다.
          </p>
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid h-[calc(100vh-112px)] max-w-6xl content-center py-8 sm:h-[calc(100vh-86px)] sm:py-14">
        <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-center md:gap-10">
          <div>
            <h2 className="max-w-[760px] text-2xl font-extrabold leading-[1.22] tracking-normal sm:text-3xl md:text-5xl md:leading-[1.14]">
              환율은 매번 찾아보기 어렵습니다.
            </h2>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/68 sm:mt-6 sm:text-base md:text-lg">
              정책, 뉴스, 지표, 달러 흐름이 흩어져 있으면 환전 판단은 느려집니다.
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6">
            {servicePoints.map((point) => (
              <section className="grid grid-cols-[2.75rem_1fr] items-start gap-3 sm:grid-cols-[3.5rem_1fr] sm:gap-5" key={point.title}>
                <span className="text-3xl leading-none sm:text-4xl md:text-5xl" aria-hidden="true">{point.emoji}</span>
                <span>
                  <h3 className="text-base font-extrabold tracking-normal text-white sm:text-lg md:text-xl">{point.title}</h3>
                  <p className="mt-1 max-w-xl text-sm font-medium leading-6 text-white/64 sm:mt-2 sm:leading-7 md:text-base">{point.body}</p>
                </span>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid h-[calc(100vh-112px)] max-w-6xl content-center py-8 sm:h-[calc(100vh-86px)] sm:py-14">
        <div className="max-w-5xl">
          <h2 className="max-w-[840px] text-2xl font-extrabold leading-[1.22] tracking-normal sm:text-3xl md:text-5xl md:leading-[1.14]">
            필요한 정보만 한 흐름으로 봅니다.
          </h2>
          <p className="mt-4 max-w-4xl text-sm font-medium leading-7 text-white/68 sm:mt-6 sm:text-base sm:leading-8 md:text-lg">
            숫자를 먼저 보고, 이유가 궁금할 때만 지표와 정책, 뉴스로 한 단계 더 들어갑니다.
          </p>
        </div>
        <div className="mt-7 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3">
          {tabHints.map((hint) => (
            <section className="grid gap-3" key={hint.title}>
              <span className="text-3xl leading-none sm:text-5xl" aria-hidden="true">{hint.emoji}</span>
              <h3 className="text-base font-extrabold tracking-normal text-teal-100 sm:text-lg md:text-xl">{hint.title}</h3>
              <p className="max-w-lg text-sm font-medium leading-6 text-white/64 sm:leading-7">{hint.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid h-[calc(100vh-112px)] max-w-6xl content-center justify-items-center py-8 text-center sm:h-[calc(100vh-86px)] sm:py-14">
        <div className="grid max-w-5xl justify-items-center">
          <h2 className="max-w-[840px] text-2xl font-extrabold leading-[1.22] tracking-normal sm:text-3xl md:text-5xl md:leading-[1.14]">
            정답 대신, 판단 재료를 모읍니다.
          </h2>
          <p className="mt-4 max-w-4xl text-sm font-medium leading-7 text-white/68 sm:mt-6 sm:text-base sm:leading-8 md:text-lg">
            오늘 환율만 보고 끝내도 좋습니다. 정부정책과 최신 뉴스까지 팔로우하고 싶다면,
            <br className="hidden sm:block" />
            <span className="inline-flex flex-wrap gap-x-1.5">
              {ctaWords.map((word, index) => (
                <span
                  className="home-cta-shine-word"
                  key={`${ctaHighlightKey}-${word}`}
                  style={{ animationDelay: `${520 + index * 150}ms` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </p>
          <button
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-teal-200/30 bg-teal-400/18 px-4 text-sm font-extrabold text-white shadow-lg shadow-teal-950/20 backdrop-blur-md transition-colors duration-150 hover:bg-teal-300/28 sm:mt-8 sm:h-11 sm:px-5"
            onClick={onGoDashboard}
            type="button"
          >
            환율현황 보러가기
          </button>
        </div>
      </section>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-7" aria-hidden="true">
        {Array.from({ length: sectionCount }).map((_, index) => (
          <span
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activeSection === index ? 'w-8 bg-white' : 'w-1.5 bg-white/35'
            }`}
            key={index}
          />
        ))}
      </div>
    </section>
  );
}
