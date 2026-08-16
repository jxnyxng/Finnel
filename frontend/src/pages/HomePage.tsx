import React from 'react';
import axios from 'axios';
import { ChartHelpTooltip } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank, ExchangeRateCalculatorMeta, ExchangeRateSnapshotResponse, ForeignExchangeRate } from '../types';

const featureSections = [
  {
    eyebrow: 'TODAY BRIEF',
    title: '오늘 먼저 봐야 할 변화를 한 화면에 모읍니다.',
    body: '오늘의 현황에서는 환율, 주요 지표, 뉴스와 정책 브리핑을 함께 묶어 보여줍니다.\n오늘 달라진 항목부터 빠르게 확인할 수 있습니다.',
    preview: 'today'
  },
  {
    eyebrow: 'FX DASHBOARD',
    title: '원/달러 환율과 달러인덱스 그래프를 제공합니다.',
    body: '핀넬의 원/달러 환율 그래프로 오늘 환율 흐름을 확인합니다.\n달러인덱스 그래프로 달러강도도 함께 볼 수 있습니다. 환율 현황 탭에서 확인해보세요.',
    preview: 'fx'
  },
  {
    eyebrow: 'CONTEXT',
    title: '숫자가 움직인 배경을 뉴스와 정책에서 찾습니다.',
    body: '금리, 물가, 무역수지, 외환보유액 같은 지표를 관련 뉴스와 함께 봅니다.\n정부 브리핑까지 연결해 변화의 배경을 확인합니다.',
    preview: 'context'
  }
];

type HomePageProps = {
  calculatorMeta?: ExchangeRateCalculatorMeta | null;
  currencyStrengthRanks?: CurrencyStrengthRank[];
  rates?: ForeignExchangeRate[];
  onGoDashboard?: () => void;
};

export function HomePage({ currencyStrengthRanks = [], onGoDashboard }: HomePageProps) {
  const [activeSection, setActiveSection] = React.useState(0);
  const [ctaHighlightKey, setCtaHighlightKey] = React.useState(0);
  const lastMoveAtRef = React.useRef(0);
  const previousSectionRef = React.useRef(0);
  const touchStartYRef = React.useRef<number | null>(null);
  const touchCurrentYRef = React.useRef<number | null>(null);
  const sectionCount = featureSections.length + 3;
  const isMobileDeck = () => window.matchMedia('(max-width: 1023px)').matches;

  const moveSection = React.useCallback((direction: 1 | -1) => {
    const now = window.performance.now();
    if (now - lastMoveAtRef.current < 720) {
      return;
    }
    lastMoveAtRef.current = now;
    setActiveSection((current) => Math.min(sectionCount - 1, Math.max(0, current + direction)));
  }, []);

  const handleWheel = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (isMobileDeck()) {
      return;
    }
    if (Math.abs(event.deltaY) < 18) {
      return;
    }
    event.preventDefault();
    moveSection(event.deltaY > 0 ? 1 : -1);
  }, [moveSection]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (isMobileDeck()) {
      return;
    }
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
    if (isMobileDeck()) {
      return;
    }
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchCurrentYRef.current = touchStartYRef.current;
  }, []);

  const handleTouchMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isMobileDeck()) {
      return;
    }
    touchCurrentYRef.current = event.touches[0]?.clientY ?? touchCurrentYRef.current;
    if (touchStartYRef.current == null || touchCurrentYRef.current == null) {
      return;
    }
    if (Math.abs(touchStartYRef.current - touchCurrentYRef.current) > 8) {
      event.preventDefault();
    }
  }, []);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isMobileDeck()) {
      return;
    }
    const startY = touchStartYRef.current;
    const endY = touchCurrentYRef.current ?? event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;
    touchCurrentYRef.current = null;
    if (startY == null || endY == null || Math.abs(startY - endY) < 68) {
      return;
    }
    moveSection(startY > endY ? 1 : -1);
  }, [moveSection]);

  React.useEffect(() => {
    if (activeSection === sectionCount - 1 && previousSectionRef.current !== activeSection) {
      setCtaHighlightKey((current) => current + 1);
    }
    previousSectionRef.current = activeSection;
  }, [activeSection]);

  return (
    <section
      aria-label="Finnel 서비스 소개"
      className="home-deck page-content-enter relative -mx-3 -mb-2 mt-0 overflow-hidden px-3 text-zinc-950 sm:-mx-5 sm:-mb-3 sm:mt-0 sm:px-5"
      onKeyDown={handleKeyDown}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      tabIndex={0}
    >
      <div
        className="home-deck-track"
        style={{ transform: `translate3d(0, -${activeSection * 100}%, 0)` }}
      >
      <div className="home-funnel-bg" aria-hidden="true">
        <div className="home-funnel-bowl" />
        <div className="home-funnel-stem" />
      </div>
      <section className="home-snap-section home-copy relative mx-auto grid max-w-6xl content-center justify-items-center py-4 text-center sm:py-6">
        <div className="grid w-full min-w-0 -translate-y-6 gap-4 sm:-translate-y-5 sm:gap-5 xl:-translate-y-6">
          <div className="mx-auto min-w-0 max-w-4xl">
            <p className="mt-2 text-xs font-bold tracking-[0.18em] text-teal-700 sm:mt-3 sm:text-sm sm:tracking-[0.22em]">FINNEL DATA BOARD</p>
            <h1 className="mx-auto mt-2 max-w-[760px] text-3xl font-extrabold leading-[1.16] tracking-normal sm:text-4xl md:text-5xl md:leading-[1.1]">
              흩어진 경제 신호를 놓치지 않게
            </h1>
            <div className="mx-auto mt-5 hidden max-w-2xl items-center justify-center gap-4 text-teal-700 sm:flex" aria-hidden="true">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-teal-300 to-teal-700" />
              <span className="text-xs font-black tracking-[0.28em] text-zinc-400">FINANCE + FUNNEL</span>
              <span className="h-px flex-1 bg-gradient-to-r from-teal-700 via-teal-300 to-transparent" />
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-balance text-center text-sm font-medium leading-6 text-zinc-600 sm:text-base sm:leading-7">
              Finnel은 매일 업데이트되는 환율, 금융 지표, 정책, 뉴스를 깔때기처럼 모아 우리나라 경제 흐름을 따라갈 수 있도록 돕는 웹서비스입니다.
            </p>
            <p className="home-hero-coffee-copy mx-auto mt-4 max-w-2xl text-balance text-center font-extrabold text-teal-700">
              매일 아침 커피 한 잔과 함께 경제 소식을 가볍게 확인해보세요.
            </p>
          </div>
        </div>
        <p className="home-hero-scroll-copy inline-flex w-full max-w-md flex-col items-center justify-center gap-1 px-4 text-center font-semibold text-zinc-950">
          <span>스크롤해서 더 많은 기능을 알아보세요</span>
          <span className="home-scroll-cue" aria-hidden="true">⌄</span>
        </p>
      </section>

      {featureSections.map((section, index) => (
        <section className="home-snap-section home-copy mx-auto grid max-w-6xl content-center justify-items-center py-5 text-center sm:py-8 lg:text-left" key={section.title}>
          <div className={`home-feature-layout home-feature-layout-${section.preview} ${index % 2 === 1 ? 'home-feature-layout-reversed' : ''}`}>
            <div className="home-feature-copy">
              <p className="mb-3 text-xs font-bold tracking-[0.22em] text-teal-700 sm:mb-4">{section.eyebrow}</p>
              <h2 className="mx-auto max-w-[680px] text-xl font-extrabold leading-[1.25] tracking-normal sm:text-2xl md:text-4xl md:leading-[1.18] xl:mx-0">
                {section.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-zinc-600 sm:mt-5 sm:text-base sm:leading-8 xl:mx-0">
                {renderIntroLines(section.body)}
              </p>
            </div>
            <FeaturePreview type={section.preview} />
          </div>
        </section>
      ))}

      <section className="home-snap-section home-copy mx-auto grid max-w-6xl content-center justify-items-center py-5 text-center sm:py-8 lg:text-left">
        <ExchangeToolsSection currencyStrengthRanks={currencyStrengthRanks} />
      </section>

      <section className="home-snap-section home-copy home-final-section mx-auto grid max-w-5xl content-center justify-items-center py-6 text-center sm:py-10">
        <div className="grid max-w-4xl justify-items-center">
          <h2 className="max-w-[760px] text-2xl font-extrabold leading-[1.22] tracking-normal sm:text-3xl md:text-5xl md:leading-[1.14]">
            <span
              className="home-cta-shine-word"
              key={`${ctaHighlightKey}-title`}
              style={{ animationDelay: '180ms' }}
            >
              대한민국 경제의 흐름을 손쉽게 따라가세요.
            </span>
          </h2>
          <div className="mt-6 grid justify-items-center sm:mt-8">
            <button
              className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-950 bg-zinc-950 px-4 text-sm font-extrabold text-white shadow-sm transition-colors duration-150 hover:bg-zinc-800 sm:h-11 sm:px-5"
              onClick={onGoDashboard}
              type="button"
            >
              핀넬 시작하기
            </button>
          </div>
        </div>
      </section>
      </div>
    </section>
  );
}

function FeaturePreview({ type }: { type: string }) {
  if (type === 'today') {
    return (
      <div className="home-preview-frame">
        <div className="home-preview-tab-header">
          <p>TODAY BRIEF</p>
          <h3>오늘의 현황</h3>
          <span>환율·지표·뉴스를 오늘 변화 중심으로 정리</span>
        </div>
        <div className="home-preview-status-row">
          <span>오늘 우선 확인</span>
          <strong>정상 수집</strong>
        </div>
        <div className="grid gap-2">
          <div className="home-preview-focus">
            <span>먼저 볼 항목</span>
            <strong>원/달러 장중 +0.42%</strong>
            <p>달러 강세와 수입 물가 지표를 함께 확인</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PreviewMetric label="소비자물가" value="2.1%" tone="up" />
            <PreviewMetric label="무역수지" value="+42억$" tone="flat" />
          </div>
          <div className="home-preview-list">
            <span>관련 뉴스</span>
            <p>환율 상승 배경 점검</p>
            <p>수출입 지표 발표 예정</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'fx') {
    return (
      <div className="home-preview-frame home-preview-frame-fx">
        <div className="home-preview-tab-header">
          <p>FX DASHBOARD</p>
          <h3>환율 현황</h3>
          <span>원/달러 환율과 달러 지수를 함께 확인</span>
        </div>
        <div className="home-preview-chart-stack" aria-hidden="true">
          <PreviewLineChartCard
            className="home-preview-chart-card-back"
            metric="104.2"
            status="일별 지수 · 최신"
            title="달러인덱스"
            variant="dollar"
          />
          <PreviewLineChartCard
            className="home-preview-chart-card-front"
            metric="1,386.4"
            status="1일 5분봉"
            title="원달러 환율 현황"
            variant="usdKrw"
          />
        </div>
      </div>
    );
  }

  if (type === 'context') {
    return (
      <div className="home-preview-frame home-preview-frame-context">
        <div className="home-preview-tab-header">
          <p>KOREA INDICATORS</p>
          <h3>지표 · 뉴스 · 정책</h3>
          <span>원화 흐름을 해석할 때 함께 보는 자료</span>
        </div>
        <div className="home-preview-range-row">
          <span className="home-preview-range-active">전체</span>
          <span>대외수급</span>
          <span>정책</span>
        </div>
        <div className="home-preview-timeline">
          <PreviewTimelineItem label="금리" value="기준금리 동결" />
          <PreviewTimelineItem label="정책" value="외환시장 안정 브리핑" />
        </div>
        <PreviewNewsCard />
      </div>
    );
  }

  return null;
}

function PreviewMetric({ label, tone, value }: { label: string; tone: 'flat' | 'up'; value: string }) {
  return (
    <div className="home-preview-metric">
      <span>{label}</span>
      <strong className={tone === 'up' ? 'text-teal-700' : 'text-zinc-800'}>{value}</strong>
    </div>
  );
}

function PreviewTimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="home-preview-timeline-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewNewsCard() {
  return (
    <article className="home-preview-news-card">
      <div className="home-preview-news-thumbnail" aria-hidden="true">
        <span>FX</span>
      </div>
      <div className="min-w-0">
        <div className="home-preview-news-meta">
          <span>경제</span>
          <span>연합뉴스 · 2026.08.02</span>
        </div>
        <h4>7월 원화 절상률 8.8%, 금융위기 후 최고</h4>
        <p>환율 변화와 달러 수급 이슈를 뉴스 카드에서 함께 확인합니다.</p>
      </div>
    </article>
  );
}

function ExchangeToolsSection({ currencyStrengthRanks }: { currencyStrengthRanks: CurrencyStrengthRank[] }) {
  return (
    <div className="home-dual-feature-layout">
      <ExchangeCalculatorPreview />
      <div className="home-dual-feature-copy home-dual-feature-copy-top">
        <p>EXCHANGE CALCULATOR</p>
        <h2>환전했던 돈의 현재 가치를 확인합니다.</h2>
        <span>
          <span>과거에 바꿔둔 달러가 지금 환율로 얼마인지 계산합니다.</span>
          <span>지금 같은 금액을 환전하려면 필요한 원화도 함께 확인할 수 있습니다.</span>
        </span>
      </div>
      <div className="home-dual-feature-copy home-dual-feature-copy-bottom">
        <p>CURRENCY RANKING</p>
        <h2>한국 원화의 위치 변화를 매주 확인합니다.</h2>
        <span>화폐 랭킹에서 우리나라의 교역국 대비 화폐가치 변동을 매주 확인해보세요.</span>
      </div>
      <CurrencyRankingPreview ranks={currencyStrengthRanks} />
    </div>
  );
}

function renderIntroLines(text: string) {
  const lines = text.split('\n');
  return lines.map((line, index) => (
    <React.Fragment key={line}>
      {index > 0 ? <br /> : null}
      {line}
    </React.Fragment>
  ));
}

function ExchangeCalculatorPreview() {
  return (
    <div className="home-preview-frame home-preview-frame-calculator-ppt">
      <div className="home-preview-tab-header">
        <p>CALCULATOR</p>
        <h3>환전 계산</h3>
        <span>과거 환율과 현재 환율 비교</span>
      </div>
      <div className="home-preview-calculator-ppt">
        <div className="home-preview-calculator-date">
          <span>2023.10.04 환전</span>
          <strong>1,000 USD</strong>
        </div>
        <div className="home-preview-calculator-rate-grid">
          <div>
            <span>당시 기준</span>
            <strong>1,318,200원</strong>
            <p>1 USD = 1,318.20원</p>
          </div>
          <div>
            <span>현재 기준</span>
            <strong>1,386,400원</strong>
            <p>1 USD = 1,386.40원</p>
          </div>
        </div>
        <div className="home-preview-calculator-result">
          <span>현재 평가 차이</span>
          <strong>+68,200원</strong>
        </div>
      </div>
    </div>
  );
}

function CurrencyRankingPreview({ ranks }: { ranks: CurrencyStrengthRank[] }) {
  const sortedRanks = [...ranks].sort((a, b) => b.neerValue - a.neerValue);
  const koreaIndex = sortedRanks.findIndex((rank) => rank.areaCode === 'KR');
  const previewStartIndex = koreaIndex < 0
    ? 0
    : Math.min(Math.max(koreaIndex - 2, 0), Math.max(sortedRanks.length - 5, 0));
  const previewRanks = sortedRanks.slice(previewStartIndex, previewStartIndex + 5);
  const neerValues = sortedRanks.map((rank) => rank.neerValue);
  const minNeer = neerValues.length > 0 ? Math.min(...neerValues) : 0;
  const maxNeer = neerValues.length > 0 ? Math.max(...neerValues) : 0;

  return (
    <div className="home-preview-frame home-preview-ranking-frame">
      <div className="home-preview-tab-header">
        <p>CURRENCY RANKING</p>
        <h3>화폐 랭킹</h3>
        <span>{previewRanks[0]?.baseDate ?? '최신'} · 한국 주변 순위</span>
      </div>
      <div className="home-preview-ranking-list">
        {previewRanks.length === 0 ? (
          <div className="home-preview-ranking-empty">화폐 랭킹 데이터를 확인 중입니다.</div>
        ) : previewRanks.map((rank, index) => {
          const display = getAreaDisplay(rank.areaCode, rank.areaName);
          const displayRank = previewStartIndex + index + 1;
          return (
          <article className={`home-preview-ranking-row ${rank.areaCode === 'KR' ? 'home-preview-ranking-row-korea' : ''}`} key={rank.areaCode}>
            <span className="home-preview-ranking-movement">{getPreviewRankMovement(rank)}</span>
            <strong>{displayRank}</strong>
            <span className="home-preview-ranking-flag" aria-hidden="true">{display.flag}</span>
            <span className="home-preview-ranking-name">
              <b>{display.name}</b>
              <em>{rank.areaCode} · NEER {formatPreviewNumber(rank.neerValue)}</em>
            </span>
            <span className="home-preview-ranking-score">{getPreviewStrengthScore(rank.neerValue, minNeer, maxNeer)}점</span>
          </article>
          );
        })}
      </div>
    </div>
  );
}

function getAreaDisplay(areaCode: string, fallbackName: string) {
  const specialDisplay = specialAreaDisplays[areaCode];
  if (specialDisplay) {
    return specialDisplay;
  }

  return {
    name: koreanRegionNames.of(areaCode) ?? fallbackName,
    flag: getFlagEmoji(areaCode)
  };
}

function getFlagEmoji(areaCode: string) {
  if (!/^[A-Z]{2}$/.test(areaCode)) {
    return '💱';
  }

  return areaCode
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

function getPreviewRankMovement(rank: CurrencyStrengthRank) {
  if (rank.previousNeerRank === null) {
    return '▬';
  }
  const currentStrongRank = rank.totalCount - rank.neerRank + 1;
  const previousStrongRank = rank.totalCount - rank.previousNeerRank + 1;
  if (currentStrongRank < previousStrongRank) {
    return '▲';
  }
  if (currentStrongRank > previousStrongRank) {
    return '▼';
  }
  return '▬';
}

function getPreviewStrengthScore(value: number, minValue: number, maxValue: number) {
  if (maxValue <= minValue) {
    return 100;
  }
  return Math.round(Math.min(100, Math.max(0, ((value - minValue) / (maxValue - minValue)) * 100)));
}

function formatPreviewNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function PreviewLineChartCard({
  className = '',
  metric,
  status,
  title,
  variant
}: {
  className?: string;
  metric: string;
  status: string;
  title: string;
  variant: 'dollar' | 'usdKrw';
}) {
  const linePath = variant === 'usdKrw'
    ? 'M8 70 C24 64 32 48 48 52 C64 56 70 34 88 38 C106 42 112 24 132 30 C148 34 154 20 172 26'
    : 'M8 54 C24 50 34 58 50 46 C66 34 78 38 92 30 C112 18 126 30 142 22 C156 16 164 24 172 18';

  return (
    <div className={`home-preview-market-card ${className}`}>
      <div className="home-preview-market-card-header">
        <div>
          <h4>{title}</h4>
          <p>{status}</p>
        </div>
        <strong>{metric}</strong>
      </div>
      <svg className="home-preview-line-chart" viewBox="0 0 180 84" role="img" aria-label={`${title} 꺾은선 그래프`}>
        <path className="home-preview-line-grid" d="M8 20 H172 M8 44 H172 M8 68 H172" />
        <path className="home-preview-line-reference" d="M8 52 H172" />
        <path className="home-preview-line-path" d={linePath} />
        <circle className="home-preview-line-dot" cx="172" cy={variant === 'usdKrw' ? 26 : 18} r="3.5" />
      </svg>
    </div>
  );
}

export function ExchangeProfitCalculator({
  calculatorMeta,
  className = '',
  onClose,
  rates,
  variant = 'default'
}: {
  calculatorMeta?: ExchangeRateCalculatorMeta | null;
  className?: string;
  onClose?: () => void;
  rates: ForeignExchangeRate[];
  variant?: 'default' | 'tab';
}) {
  const [currencyCode, setCurrencyCode] = React.useState('');
  const [exchangeDate, setExchangeDate] = React.useState(() => calculatorMeta?.latestAllowedDate ?? new Date().toISOString().slice(0, 10));
  const [amountInputMode, setAmountInputMode] = React.useState<'foreign' | 'krw'>('foreign');
  const amountInputModeKeys = React.useMemo(() => ['foreign', 'krw'] as const, []);
  const {
    buttonRefs: amountInputModeButtonRefs,
    containerRef: amountInputModeContainerRef,
    indicator: amountInputModeIndicator,
    isMoving: isAmountInputModeIndicatorMoving,
    labelActiveKey: activeAmountInputModeLabelKey,
    startMoving: startAmountInputModeIndicatorMoving
  } = useMovingTabIndicator({
    activeKey: amountInputMode,
    keys: amountInputModeKeys
  });
  const [foreignAmount, setForeignAmount] = React.useState('');
  const [krwAmount, setKrwAmount] = React.useState('');
  const [snapshot, setSnapshot] = React.useState<ExchangeRateSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingRateKey, setEditingRateKey] = React.useState<'historical' | 'current' | null>(null);
  const [manualHistoricalRate, setManualHistoricalRate] = React.useState('');
  const [manualCurrentRate, setManualCurrentRate] = React.useState('');
  const selectedRate = rates.find((rate) => rate.currencyCode === currencyCode) ?? null;
  const latestAllowedDate = selectedRate?.historyEndDate ?? calculatorMeta?.latestAllowedDate ?? new Date().toISOString().slice(0, 10);
  const earliestAllowedDate = selectedRate?.historyStartDate ?? calculatorMeta?.earliestAllowedDate ?? shiftYear(latestAllowedDate, -5);

  React.useEffect(() => {
    if (exchangeDate < earliestAllowedDate) {
      setExchangeDate(earliestAllowedDate);
    } else if (exchangeDate > latestAllowedDate) {
      setExchangeDate(latestAllowedDate);
    }
  }, [earliestAllowedDate, exchangeDate, latestAllowedDate]);

  React.useEffect(() => {
    if (!currencyCode || !exchangeDate) {
      setSnapshot(null);
      return;
    }

    let ignore = false;
    setIsLoading(true);
    axios.get<ExchangeRateSnapshotResponse>('/api/v1/dashboard/exchange-rate-snapshot', {
      params: {
        currencyCode,
        date: exchangeDate
      }
    }).then((response) => {
      if (!ignore) {
        setSnapshot(response.data);
      }
    }).catch(() => {
      if (!ignore) {
        setSnapshot(null);
      }
    }).finally(() => {
      if (!ignore) {
        setIsLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [currencyCode, exchangeDate]);

  React.useEffect(() => {
    setManualHistoricalRate('');
    setManualCurrentRate('');
    setEditingRateKey(null);
  }, [currencyCode, exchangeDate]);

  const historicalRate = snapshot?.historicalRate ?? null;
  const currentRate = snapshot?.currentRate ?? selectedRate;
  const effectiveHistoricalRate = applyManualDealBasRate(historicalRate, manualHistoricalRate);
  const effectiveCurrentRate = applyManualDealBasRate(currentRate, manualCurrentRate);
  const foreignInputAmount = parseNumber(foreignAmount);
  const krwInputAmount = parseNumber(krwAmount);
  const calculatedForeignAmount = amountInputMode === 'foreign' ? foreignInputAmount : calculateForeignAmountFromKrw(krwInputAmount, effectiveHistoricalRate);
  const historicalKrw = amountInputMode === 'foreign' ? calculateKrwAmount(foreignInputAmount, effectiveHistoricalRate) : krwInputAmount;
  const currentKrw = calculateKrwAmount(calculatedForeignAmount, effectiveCurrentRate);
  const profit = historicalKrw === null || currentKrw === null ? null : currentKrw - historicalKrw;
  const returnRate = profit === null || historicalKrw === null || historicalKrw === 0 ? null : (profit / historicalKrw) * 100;
  const resultTone = profit === null ? 'text-white' : profit >= 0 ? 'text-teal-100' : 'text-rose-200';
  const hasResult = historicalKrw !== null && currentKrw !== null;
  const selectedDateParts = splitDate(exchangeDate);
  const availableYears = buildYearOptions(earliestAllowedDate, latestAllowedDate);
  const availableMonths = buildMonthOptions(selectedDateParts.year, earliestAllowedDate, latestAllowedDate);
  const availableDays = buildDayOptions(selectedDateParts.year, selectedDateParts.month, earliestAllowedDate, latestAllowedDate);
  const selectedDisplayCode = selectedRate?.displayCode ?? currentRate?.displayCode ?? '';
  const isTabLayout = variant === 'tab';

  const updateDatePart = (part: 'year' | 'month' | 'day', value: number) => {
    const nextParts = {
      ...selectedDateParts,
      [part]: value
    };
    const maxDay = daysInMonth(nextParts.year, nextParts.month);
    const nextDate = formatDateParts(nextParts.year, nextParts.month, Math.min(nextParts.day, maxDay));
    setExchangeDate(clampDate(nextDate, earliestAllowedDate, latestAllowedDate));
  };

  if (!isTabLayout) {
    return (
      <section className={`glass-card grid min-h-[32rem] min-w-0 content-start rounded-[1.35rem] p-3 shadow-xl shadow-zinc-950/20 lg:min-h-[36.5rem] lg:rounded-[1.6rem] lg:p-4 ${className}`}>
        <div className="border-b border-white/10 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-base font-extrabold leading-tight text-white sm:text-lg">환차익 계산기</p>
                <ChartHelpTooltip ariaLabel="환차익 계산기 안내" title="환차익 계산 기준" widthClassName="w-80">
                  <p className="mt-2">선택일 데이터가 없으면 직전 기준일 환율을 사용합니다.</p>
                  <p className="mt-2">수수료와 은행별 스프레드는 제외한 기준 환율 계산입니다.</p>
                </ChartHelpTooltip>
              </div>
              <h2 className="mt-1.5 text-[11px] font-semibold text-white/55 sm:text-xs">과거 환전과 현재 가치 비교</h2>
            </div>
            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/55 min-[380px]:inline-flex">
              {earliestAllowedDate}~{latestAllowedDate}
            </span>
            {onClose ? (
              <button
                aria-label="환차익 계산기 닫기"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 shadow-sm transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-950"
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
            ) : null}
          </div>
          <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/55 min-[380px]:hidden">
            {earliestAllowedDate}~{latestAllowedDate}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-[10px] font-semibold text-white/55">
            <span className="flex h-5 items-center gap-2">통화</span>
            <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
              <span className="grid h-9 place-items-center rounded-md border border-white/15 bg-white/10 text-xl" aria-hidden="true">
                {selectedRate ? getCurrencyFlag(selectedRate.displayCode) : '💱'}
              </span>
              <select
                className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                onChange={(event) => setCurrencyCode(event.target.value)}
                value={currencyCode}
              >
                <option value="">통화 선택</option>
                {rates.map((rate) => (
                  <option key={rate.currencyCode} value={rate.currencyCode}>
                    {getCurrencyFlag(rate.displayCode)} {rate.displayCode} · {getCurrencyKoreanName(rate.displayCode)}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="grid gap-2 text-[10px] font-semibold text-white/55">
            <span className="flex min-h-6 items-center justify-between gap-2">
              <span>{amountInputMode === 'foreign' ? '환전한 외화 금액' : '당시 사용한 원화 금액'}</span>
              <span className="relative grid h-6 w-[4.75rem] grid-cols-2 rounded-full border border-white/10 bg-white/10 p-0.5 shadow-sm" ref={amountInputModeContainerRef}>
                <MovingTabIndicator compact contained indicator={amountInputModeIndicator} isMoving={isAmountInputModeIndicatorMoving} />
                {(['foreign', 'krw'] as const).map((mode) => (
                  <button
                    className={`relative z-10 h-5 rounded-full px-2 text-[10px] font-extrabold leading-5 transition-colors duration-150 ${
                      activeAmountInputModeLabelKey === mode ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
                    }`}
                    key={mode}
                    onClick={() => {
                      if (amountInputMode !== mode) {
                        startAmountInputModeIndicatorMoving();
                      }
                      setAmountInputMode(mode);
                    }}
                    ref={(node) => {
                      amountInputModeButtonRefs.current[mode] = node;
                    }}
                    type="button"
                  >
                    {mode === 'foreign' ? '외화' : '원화'}
                  </button>
                ))}
              </span>
            </span>
            <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                className="glass-field h-9 min-w-0 rounded-md px-3 text-center text-sm font-semibold outline-none"
                inputMode="decimal"
                onChange={(event) => {
                  const nextValue = sanitizeNumberInput(event.target.value);
                  if (amountInputMode === 'foreign') {
                    setForeignAmount(nextValue);
                  } else {
                    setKrwAmount(nextValue);
                  }
                }}
                placeholder="금액 입력"
                value={amountInputMode === 'foreign' ? foreignAmount : krwAmount}
              />
              <span className="grid h-9 min-w-12 place-items-center rounded-md border border-white/10 bg-white/8 px-2 text-xs font-extrabold text-white/45">
                {amountInputMode === 'foreign' ? selectedDisplayCode || '단위' : 'KRW'}
              </span>
            </span>
          </label>
          <label className="grid gap-2 text-[10px] font-semibold text-white/55 sm:col-span-2">
            <span className="flex h-5 items-center">환전한 날짜</span>
            <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-1.5">
              <select
                aria-label="환전 연도"
                className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                onChange={(event) => updateDatePart('year', Number(event.target.value))}
                value={selectedDateParts.year}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select
                aria-label="환전 월"
                className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                onChange={(event) => updateDatePart('month', Number(event.target.value))}
                value={selectedDateParts.month}
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <select
                aria-label="환전 일"
                className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                onChange={(event) => updateDatePart('day', Number(event.target.value))}
                value={selectedDateParts.day}
              >
                {availableDays.map((day) => (
                  <option key={day} value={day}>{day}일</option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/7 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-teal-100">계산에 사용한 환율</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-white/40">
              {isLoading ? '조회 중' : `${selectedRate ? getCurrencyFlag(selectedRate.displayCode) : '💱'} 저장 환율`}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 divide-x divide-white/10">
            <RateSnapshotCard
              fallbackDate={exchangeDate}
              isEditable={false}
              isEditing={false}
              label="환전 당시 환율"
              manualValue=""
              onManualValueChange={() => undefined}
              onResetManualValue={() => undefined}
              onStartEditing={() => undefined}
              onStopEditing={() => undefined}
              rate={historicalRate}
            />
            <RateSnapshotCard
              fallbackDate={latestAllowedDate}
              isEditable={false}
              isEditing={false}
              label="현재 기준 환율"
              manualValue=""
              onManualValueChange={() => undefined}
              onResetManualValue={() => undefined}
              onStartEditing={() => undefined}
              onStopEditing={() => undefined}
              rate={currentRate}
            />
          </div>

          {isLoading ? (
            <p className="mt-1.5 rounded-lg bg-black/15 px-2.5 py-1.5 text-[10px] leading-4 text-white/45 sm:mt-2">
              과거 환율을 조회하고 있습니다.
            </p>
          ) : null}
        </div>

        <div className="mt-3 min-h-[7.5rem] rounded-xl border border-white/10 bg-white/10 p-3 lg:min-h-[8.4rem]">
          <p className="text-left text-[11px] font-semibold text-white/55">계산 결과</p>
          <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,9.5rem)] sm:items-center">
            <div className="min-w-0">
              <p className="grid min-h-14 content-center justify-items-start gap-1 text-white" title={hasResult ? formatResultSentence(historicalKrw, currentKrw) : '환전 시점과 금액을 입력해 주세요.'}>
                {!hasResult ? (
                  <span className="text-[0.9rem] font-extrabold text-white/58">환전 시점과 금액을 입력해 주세요.</span>
                ) : (
                  <>
                    <span className="block max-w-full truncate text-[0.88rem] font-extrabold leading-none text-white/75">{formatKrw(historicalKrw)}</span>
                    <span className="block text-sm font-black leading-none text-white/45" aria-hidden="true">↓</span>
                    <span className="block max-w-full truncate text-[1.18rem] font-extrabold leading-none text-teal-100">{formatKrw(currentKrw)}</span>
                  </>
                )}
              </p>
            </div>
            <div className="grid min-w-0 place-items-center gap-1.5 overflow-hidden rounded-lg bg-black/15 p-2.5 text-center sm:w-[9.5rem]">
              <div className="min-w-0 max-w-full">
                <p className="text-[9px] font-semibold text-white/45">환차익/환차손</p>
                <p className={`mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-extrabold ${resultTone}`} title={formatKrw(profit)}>
                  {profit === null ? '-' : `${profit >= 0 ? '+' : ''}${formatKrw(profit)}`}
                </p>
              </div>
              <div className="min-w-0 max-w-full">
                <p className="text-[9px] font-semibold text-white/45">수익률</p>
                <p className={`mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-extrabold ${resultTone}`}>
                  {returnRate === null ? '-' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`glass-card grid min-h-[32rem] min-w-0 content-start rounded-[1.35rem] p-3 shadow-xl shadow-zinc-950/20 lg:min-h-[36.5rem] lg:rounded-[1.6rem] lg:p-4 ${className}`}>
      <div className="calculator-card-header border-b border-white/10 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="calculator-card-title">환차익 계산기</p>
              <ChartHelpTooltip ariaLabel="환차익 계산기 안내" title="환차익 계산 기준" widthClassName="w-80">
                <p className="mt-2">선택일 데이터가 없으면 직전 기준일 환율을 사용합니다.</p>
                <p className="mt-2">수수료와 은행별 스프레드는 제외한 기준 환율 계산입니다.</p>
              </ChartHelpTooltip>
            </div>
            <h2 className="calculator-card-description">과거 환전과 현재 가치 비교</h2>
          </div>
          <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/55 min-[380px]:inline-flex">
            {earliestAllowedDate}~{latestAllowedDate}
          </span>
          {onClose ? (
            <button
              aria-label="환차익 계산기 닫기"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 shadow-sm transition-colors duration-150 hover:bg-zinc-50 hover:text-zinc-950"
              onClick={onClose}
              type="button"
            >
              닫기
            </button>
          ) : null}
        </div>
        <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/55 min-[380px]:hidden">
          {earliestAllowedDate}~{latestAllowedDate}
        </span>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(13.5rem,15rem)] xl:items-stretch">
        <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[10px] font-semibold text-white/55">
              <span className="flex h-5 items-center gap-2">
                통화
              </span>
              <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
                <span className="grid h-9 place-items-center rounded-md border border-white/15 bg-white/10 text-xl" aria-hidden="true">
                  {selectedRate ? getCurrencyFlag(selectedRate.displayCode) : '💱'}
                </span>
                <select
                  className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                  onChange={(event) => setCurrencyCode(event.target.value)}
                  value={currencyCode}
                >
                  <option value="">통화 선택</option>
                  {rates.map((rate) => (
                    <option key={rate.currencyCode} value={rate.currencyCode}>
                      {getCurrencyFlag(rate.displayCode)} {rate.displayCode} · {getCurrencyKoreanName(rate.displayCode)}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="grid gap-2 text-[10px] font-semibold text-white/55">
              <span className="flex min-h-6 items-center justify-between gap-2">
                <span>{amountInputMode === 'foreign' ? '환전한 외화 금액' : '당시 사용한 원화 금액'}</span>
                <span className="relative grid h-6 w-[4.75rem] grid-cols-2 rounded-full border border-white/10 bg-white/10 p-0.5 shadow-sm" ref={amountInputModeContainerRef}>
                  <MovingTabIndicator compact contained indicator={amountInputModeIndicator} isMoving={isAmountInputModeIndicatorMoving} />
                  {(['foreign', 'krw'] as const).map((mode) => (
                    <button
                      className={`relative z-10 h-5 rounded-full px-2 text-[10px] font-extrabold leading-5 transition-colors duration-150 ${
                        activeAmountInputModeLabelKey === mode ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
                      }`}
                      key={mode}
                      onClick={() => {
                        if (amountInputMode !== mode) {
                          startAmountInputModeIndicatorMoving();
                        }
                        setAmountInputMode(mode);
                      }}
                      ref={(node) => {
                        amountInputModeButtonRefs.current[mode] = node;
                      }}
                      type="button"
                    >
                      {mode === 'foreign' ? '외화' : '원화'}
                    </button>
                  ))}
                </span>
              </span>
              <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  className="glass-field h-9 min-w-0 rounded-md px-3 text-center text-sm font-semibold outline-none"
                  inputMode="decimal"
                  onChange={(event) => {
                    const nextValue = sanitizeNumberInput(event.target.value);
                    if (amountInputMode === 'foreign') {
                      setForeignAmount(nextValue);
                    } else {
                      setKrwAmount(nextValue);
                    }
                  }}
                  placeholder="금액 입력"
                  value={amountInputMode === 'foreign' ? foreignAmount : krwAmount}
                />
                <span className="grid h-9 min-w-12 place-items-center rounded-md border border-white/10 bg-white/8 px-2 text-xs font-extrabold text-white/45">
                  {amountInputMode === 'foreign' ? selectedDisplayCode || '단위' : 'KRW'}
                </span>
              </span>
            </label>
            <label className="grid gap-2 text-[10px] font-semibold text-white/55 sm:col-span-2">
              <span className="flex h-5 items-center">환전한 날짜</span>
              <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-1.5">
                <select
                  aria-label="환전 연도"
                  className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                  onChange={(event) => updateDatePart('year', Number(event.target.value))}
                  value={selectedDateParts.year}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}년</option>
                  ))}
                </select>
                <select
                  aria-label="환전 월"
                  className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                  onChange={(event) => updateDatePart('month', Number(event.target.value))}
                  value={selectedDateParts.month}
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>{month}월</option>
                  ))}
                </select>
                <select
                  aria-label="환전 일"
                  className="glass-field h-9 min-w-0 rounded-md px-2 text-sm font-semibold outline-none"
                  onChange={(event) => updateDatePart('day', Number(event.target.value))}
                  value={selectedDateParts.day}
                >
                  {availableDays.map((day) => (
                    <option key={day} value={day}>{day}일</option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="mt-3 grid min-h-[12.5rem] grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-white/10 bg-white/10 p-3 xl:min-h-0">
            <p className="text-left text-[11px] font-semibold text-white/55">계산 결과</p>
            <div className="grid min-w-0 content-center gap-3 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,10rem)] sm:items-center">
              <div className="grid min-w-0 place-items-center sm:place-items-start">
                <p className="grid min-h-24 content-center justify-items-center gap-2 text-center text-white sm:justify-items-start sm:text-left" title={hasResult ? formatResultSentence(historicalKrw, currentKrw) : '환전 시점과 금액을 입력해 주세요.'}>
                  {!hasResult ? (
                    <span className="text-[0.9rem] font-extrabold text-white/58">환전 시점과 금액을 입력해 주세요.</span>
                  ) : (
                    <>
                      <span className="block max-w-full truncate text-sm font-extrabold leading-none text-white/75">{formatKrw(historicalKrw)}</span>
                      <span className="block text-base font-black leading-none text-white/45" aria-hidden="true">↓</span>
                      <span className="block max-w-full truncate text-2xl font-extrabold leading-none text-teal-100">{formatKrw(currentKrw)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="grid min-w-0 place-items-center gap-3 self-stretch overflow-hidden rounded-lg bg-black/15 p-3 text-center sm:w-[10rem]">
                <div className="min-w-0 max-w-full">
                  <p className="text-[9px] font-semibold text-white/45">환차익/환차손</p>
                  <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold ${resultTone}`} title={formatKrw(profit)}>
                    {profit === null ? '-' : `${profit >= 0 ? '+' : ''}${formatKrw(profit)}`}
                  </p>
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="text-[9px] font-semibold text-white/45">수익률</p>
                  <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold ${resultTone}`}>
                    {returnRate === null ? '-' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid content-start gap-2">
          <div className="rounded-xl border border-white/10 bg-white/7 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-teal-100">계산에 사용한 환율</p>
              <span className="shrink-0 text-[10px] font-semibold text-white/40">
                {isLoading ? '조회 중' : `${selectedRate ? getCurrencyFlag(selectedRate.displayCode) : '💱'} 저장 환율`}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-medium leading-4 text-white/45">
              기준 환율 숫자를 클릭하면 직접 입력값으로 계산해볼 수 있습니다.
            </p>
            {isLoading ? (
              <p className="mt-1.5 rounded-lg bg-black/15 px-2.5 py-1.5 text-[10px] leading-4 text-white/45">
                과거 환율을 조회하고 있습니다.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/7 p-3">
            <RateSnapshotCard
              fallbackDate={exchangeDate}
              isEditing={editingRateKey === 'historical'}
              label="환전 당시 환율"
              manualValue={manualHistoricalRate}
              onManualValueChange={setManualHistoricalRate}
              onResetManualValue={() => setManualHistoricalRate('')}
              onStartEditing={() => setEditingRateKey('historical')}
              onStopEditing={() => setEditingRateKey(null)}
              rate={effectiveHistoricalRate}
            />
            <RateSnapshotCard
              fallbackDate={latestAllowedDate}
              isEditing={editingRateKey === 'current'}
              label="현재 기준 환율"
              manualValue={manualCurrentRate}
              onManualValueChange={setManualCurrentRate}
              onResetManualValue={() => setManualCurrentRate('')}
              onStartEditing={() => setEditingRateKey('current')}
              onStopEditing={() => setEditingRateKey(null)}
              rate={effectiveCurrentRate}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function RateSnapshotCard({
  fallbackDate,
  isEditable = true,
  isEditing,
  label,
  manualValue,
  onManualValueChange,
  onResetManualValue,
  onStartEditing,
  onStopEditing,
  rate
}: {
  fallbackDate: string;
  isEditable?: boolean;
  isEditing: boolean;
  label: string;
  manualValue: string;
  onManualValueChange: (value: string) => void;
  onResetManualValue: () => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  rate: ForeignExchangeRate | null;
}) {
  const displayCode = rate?.displayCode ?? '';
  const currencyLabel = displayCode ? getCurrencyKoreanName(displayCode) : '통화';
  const isManual = parsePositiveNumber(manualValue) !== null;

  return (
    <article className="min-w-0 rounded-lg bg-white/8 p-1.5 sm:p-2">
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-1.5 sm:grid-cols-[28px_minmax(0,1fr)] sm:gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/10 text-sm leading-none sm:h-7 sm:w-7 sm:text-base" aria-hidden="true">
          {displayCode ? getCurrencyFlag(displayCode) : '💱'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] font-semibold text-white/55 sm:text-[11px]">{label}</p>
            <span className="shrink-0 text-[9px] font-semibold text-white/40 sm:text-[10px]">{rate?.baseDate ?? fallbackDate}</span>
          </div>
          <p className="mt-0.5 truncate text-xs font-extrabold text-white sm:text-sm">{currencyLabel} {displayCode}</p>
        </div>
      </div>
      <div className="mt-1.5">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold text-white/40">{rate ? formatRateUnit(rate) : '-'}</p>
            {isEditable && isManual ? (
              <button
                className="shrink-0 text-[9px] font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                onClick={onResetManualValue}
                type="button"
              >
                초기화
              </button>
            ) : null}
          </div>
          {isEditable && isEditing ? (
            <input
              autoFocus
              className="glass-field mt-1 h-8 w-full rounded-md px-2 text-right text-sm font-extrabold text-teal-700 outline-none"
              inputMode="decimal"
              onBlur={onStopEditing}
              onChange={(event) => onManualValueChange(sanitizeNumberInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.currentTarget.blur();
                }
              }}
              placeholder={rate ? formatRateNumber(rate.dealBasRate) : '환율 입력'}
              value={manualValue}
            />
          ) : isEditable ? (
            <button
              className="mt-0.5 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[clamp(0.8rem,3.5vw,1rem)] font-extrabold leading-tight text-teal-100 underline-offset-2 hover:underline"
              onClick={onStartEditing}
              title={rate ? `${formatRate(rate)} 직접 입력` : '환율 직접 입력'}
              type="button"
            >
              {rate ? formatRate(rate) : '환율 입력'}
            </button>
          ) : (
            <p className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(0.8rem,3.5vw,1rem)] font-extrabold leading-tight text-teal-100" title={rate ? formatRate(rate) : '-'}>
              {rate ? formatRate(rate) : '-'}
            </p>
          )}
        </div>
      </div>
      <p className="mt-1.5 truncate text-[10px] font-medium text-white/35">
        {isManual ? '직접 입력' : rate?.source ?? '저장 환율 없음'} · {rate && !isManual ? formatSnapshotUpdatedAt(new Date(rate.fetchedAt)) : '-'}
      </p>
    </article>
  );
}

function calculateKrwAmount(amount: number | null, rate: ForeignExchangeRate | null) {
  if (amount === null || !rate || rate.unitSize === 0) {
    return null;
  }

  return (amount * rate.dealBasRate) / rate.unitSize;
}

function applyManualDealBasRate(rate: ForeignExchangeRate | null, manualValue: string) {
  const manualRate = parsePositiveNumber(manualValue);
  if (!rate || manualRate === null) {
    return rate;
  }

  return {
    ...rate,
    dealBasRate: manualRate
  };
}

function calculateForeignAmountFromKrw(amount: number | null, rate: ForeignExchangeRate | null) {
  if (amount === null || !rate || rate.dealBasRate === 0) {
    return null;
  }

  return (amount * rate.unitSize) / rate.dealBasRate;
}

function formatKrw(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(value))}원`;
}

function formatResultSentence(previousValue: number | null, currentValue: number | null) {
  if (previousValue === null || currentValue === null) {
    return '-';
  }

  return `한국돈으로 ${formatKrw(previousValue)}이 ${formatKrw(currentValue)}이 되었어요!`;
}

function formatRate(rate: ForeignExchangeRate | null) {
  if (!rate) {
    return '-';
  }

  return `${formatRateNumber(rate.dealBasRate)}원`;
}

function formatRateNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
}

function formatRateUnit(rate: ForeignExchangeRate) {
  return rate.unitSize > 1 ? `${rate.unitSize}${rate.displayCode} 기준` : `1${rate.displayCode} 기준`;
}

function formatSnapshotUpdatedAt(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date);
}

function parseNumber(value: string) {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumber(value: string) {
  const parsed = parseNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function sanitizeNumberInput(value: string) {
  return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
}

function shiftYear(dateValue: string, amount: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  date.setFullYear(date.getFullYear() + amount);
  return date.toISOString().slice(0, 10);
}

function splitDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    const now = new Date();
    return {
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear()
    };
  }

  return { day, month, year };
}

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function clampDate(value: string, minDate: string, maxDate: string) {
  if (value < minDate) {
    return minDate;
  }

  if (value > maxDate) {
    return maxDate;
  }

  return value;
}

function buildYearOptions(minDate: string, maxDate: string) {
  const minYear = splitDate(minDate).year;
  const maxYear = splitDate(maxDate).year;
  const years = [];
  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(year);
  }
  return years;
}

function buildMonthOptions(year: number, minDate: string, maxDate: string) {
  const min = splitDate(minDate);
  const max = splitDate(maxDate);
  const startMonth = year === min.year ? min.month : 1;
  const endMonth = year === max.year ? max.month : 12;
  const months = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(month);
  }
  return months;
}

function buildDayOptions(year: number, month: number, minDate: string, maxDate: string) {
  const min = splitDate(minDate);
  const max = splitDate(maxDate);
  const startDay = year === min.year && month === min.month ? min.day : 1;
  const endDay = year === max.year && month === max.month ? max.day : daysInMonth(year, month);
  const days = [];
  for (let day = startDay; day <= endDay; day += 1) {
    days.push(day);
  }
  return days;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getCurrencyFlag(code: string) {
  const regionCode = {
    AUD: 'AU',
    CAD: 'CA',
    CHF: 'CH',
    CNY: 'CN',
    CNH: 'CN',
    EUR: 'EU',
    GBP: 'GB',
    HKD: 'HK',
    JPY: 'JP',
    SGD: 'SG',
    USD: 'US'
  }[code];

  if (!regionCode) {
    return '💱';
  }

  if (regionCode === 'EU') {
    return '🇪🇺';
  }

  return regionCode
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}

function getCurrencyKoreanName(code: string) {
  return {
    AUD: '호주 달러',
    CAD: '캐나다 달러',
    CHF: '스위스 프랑',
    CNY: '중국 위안',
    CNH: '역외 위안',
    EUR: '유로',
    GBP: '영국 파운드',
    HKD: '홍콩 달러',
    JPY: '일본 엔',
    SGD: '싱가포르 달러',
    USD: '미국 달러'
  }[code] ?? code;
}
