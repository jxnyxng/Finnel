import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ChartHelpTooltip } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { ExchangeRateCalculatorMeta, ExchangeRateSnapshotResponse, ForeignExchangeRate } from '../types';

const servicePoints = [
  {
    emoji: '💸',
    title: '환차익 확인',
    body: '예전에 바꾼 외화가 지금 원화로 얼마나 달라졌는지 바로 확인합니다.'
  },
  {
    emoji: '📈',
    title: '원화 기준 비교',
    body: '달러, 엔, 유로처럼 자주 보는 통화를 원화 기준으로 나란히 비교합니다.'
  },
  {
    emoji: '🧭',
    title: '흩어진 지표 정리',
    body: '달러 지수, 금리, 물가처럼 환율을 볼 때 필요한 숫자를 한곳에 모읍니다.'
  },
  {
    emoji: '📰',
    title: '정책·뉴스 감지',
    body: '투자자가 민감하게 봐야 할 정부 브리핑과 최신 뉴스를 빠르게 확인합니다.'
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

const finalTitleWords = ['판단의', '재료들을', '확인해보세요.'];
const finalBodyWords = ['정부정책과', '최신', '뉴스까지', '함께', '확인하며', '환율을', '움직이는', '맥락을', '따라갑니다.'];

type HomePageProps = {
  calculatorMeta?: ExchangeRateCalculatorMeta | null;
  rates?: ForeignExchangeRate[];
  onGoDashboard?: () => void;
};

export function HomePage({ calculatorMeta, rates = [], onGoDashboard }: HomePageProps) {
  const [activeSection, setActiveSection] = React.useState(0);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = React.useState(false);
  const [ctaHighlightKey, setCtaHighlightKey] = React.useState(0);
  const lastMoveAtRef = React.useRef(0);
  const previousSectionRef = React.useRef(0);
  const touchStartYRef = React.useRef<number | null>(null);
  const sectionCount = 4;

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
    if (isCalculatorModalOpen) {
      if (event.key === 'Escape') {
        setIsCalculatorModalOpen(false);
      }
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
  }, [isCalculatorModalOpen, moveSection]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isCalculatorModalOpen) {
      return;
    }
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, [isCalculatorModalOpen]);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isCalculatorModalOpen) {
      return;
    }
    const startY = touchStartYRef.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartYRef.current = null;
    if (startY == null || endY == null || Math.abs(startY - endY) < 42) {
      return;
    }
    moveSection(startY > endY ? 1 : -1);
  }, [isCalculatorModalOpen, moveSection]);

  React.useEffect(() => {
    if (activeSection === sectionCount - 1 && previousSectionRef.current !== activeSection) {
      setCtaHighlightKey((current) => current + 1);
    }
    previousSectionRef.current = activeSection;
  }, [activeSection]);

  return (
    <section
      aria-label="코리아원 서비스 소개"
      className="home-deck page-content-enter relative -mx-3 -mb-2 -mt-2 overflow-hidden px-3 text-zinc-950 sm:-mx-5 sm:-mb-3 sm:-mt-3 sm:px-5"
      onKeyDown={handleKeyDown}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onWheel={isCalculatorModalOpen ? undefined : handleWheel}
      tabIndex={0}
    >
      <div
        className="home-deck-track"
      style={{ transform: `translate3d(0, -${activeSection * 100}%, 0)` }}
      >
      <section className="home-snap-section home-copy relative mx-auto grid max-w-6xl content-center justify-items-center py-4 text-center sm:py-6 xl:justify-items-stretch xl:text-left">
        <div className="grid w-full min-w-0 -translate-y-8 gap-4 sm:-translate-y-7 sm:gap-5 xl:-translate-y-8 xl:grid-cols-[minmax(0,0.86fr)_minmax(340px,0.58fr)] xl:items-center xl:gap-x-7 xl:gap-y-2">
          <div className="min-w-0 xl:-translate-y-12">
            <div className="text-2xl leading-none sm:text-3xl md:text-5xl" aria-hidden="true">₩</div>
            <p className="mt-2 text-xs font-bold tracking-[0.18em] text-teal-700 sm:mt-3 sm:text-sm sm:tracking-[0.22em]">KOREA WON MONITOR</p>
            <h1 className="mx-auto mt-2 max-w-[760px] text-3xl font-extrabold leading-[1.16] tracking-normal sm:text-4xl md:text-5xl md:leading-[1.1] xl:mx-0">
              그때 환전한 돈, 지금은 얼마일까요?
            </h1>
            <div className="mt-5 hidden items-center gap-4 text-teal-700 xl:flex" aria-hidden="true">
              <span className="h-px w-[31rem] max-w-full bg-gradient-to-r from-teal-100 via-teal-300 to-teal-700" />
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-600 sm:text-base sm:leading-7 xl:mx-0">
              과거 환전 시점의 환율과 현재 환율을 비교해
              <br />
              환차익과 환차손을 바로 계산합니다.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 xl:justify-start">
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-950 bg-zinc-950 px-4 text-sm font-extrabold text-white shadow-sm transition-colors duration-150 hover:bg-zinc-800 xl:hidden"
                onClick={() => setIsCalculatorModalOpen(true)}
                type="button"
              >
                환차익 계산하기
              </button>
            </div>
          </div>
          <div className="hidden justify-self-end xl:block xl:w-[430px] xl:translate-y-10">
            <ExchangeProfitCalculator calculatorMeta={calculatorMeta} rates={rates} />
          </div>
          <p className="inline-flex w-full max-w-md flex-col items-center justify-center gap-1 justify-self-center px-4 text-center text-sm font-semibold leading-6 text-teal-700 sm:text-base sm:leading-7 xl:col-start-1 xl:row-start-2 xl:w-fit xl:max-w-2xl xl:translate-y-1 xl:justify-self-start xl:px-0">
            <span>스크롤해서 더 많은 기능을 알아보세요</span>
            <span className="home-scroll-cue" aria-hidden="true">⌄</span>
          </p>
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid max-w-5xl content-center justify-items-center py-6 text-center sm:py-10 xl:justify-items-stretch xl:text-left">
        <div className="grid justify-items-center gap-6 xl:grid-cols-[0.95fr_1fr] xl:items-center xl:justify-items-stretch xl:gap-8">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.22em] text-teal-700 sm:mb-4">ABOUT KOREAWON</p>
            <h2 className="mx-auto max-w-[680px] text-xl font-extrabold leading-[1.25] tracking-normal sm:text-2xl md:text-4xl md:leading-[1.18] xl:mx-0">
              원화 환율은 시장 변화를 읽는 출발점입니다.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-zinc-600 sm:mt-6 sm:text-base md:text-lg xl:mx-0">
              환율이 움직이면 수출입 기업의 실적, 수입 물가, 원자재 비용, 달러 자산의 원화 가치가 함께 달라집니다.
            </p>
          </div>
          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 xl:mx-0 xl:max-w-none xl:grid-cols-1 xl:gap-6">
            {servicePoints.map((point) => (
              <section className="grid justify-items-center gap-1.5 rounded-xl bg-white px-2.5 py-3 text-center shadow-sm ring-1 ring-zinc-200 xl:grid-cols-[3.5rem_1fr] xl:justify-items-start xl:gap-5 xl:bg-transparent xl:p-0 xl:text-left xl:shadow-none xl:ring-0" key={point.title}>
                <span className="text-2xl leading-none sm:text-4xl md:text-5xl" aria-hidden="true">{point.emoji}</span>
                <span>
                  <h3 className="text-sm font-extrabold tracking-normal text-zinc-950 sm:text-lg md:text-xl">{point.title}</h3>
                  <p className="hidden mt-1 max-w-sm text-xs font-medium leading-5 text-zinc-600 min-[430px]:block sm:mt-2 sm:max-w-xl sm:text-sm sm:leading-7 md:text-base xl:text-left">{point.body}</p>
                </span>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid max-w-5xl content-center justify-items-center py-6 text-center sm:py-10">
        <div className="grid max-w-4xl justify-items-center">
          <h2 className="max-w-[760px] text-xl font-extrabold leading-[1.25] tracking-normal sm:text-2xl md:text-4xl md:leading-[1.18]">
            투자시장의 반응을 이해하기 위한 기초입니다.
          </h2>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-zinc-600 sm:mt-5 sm:text-base sm:leading-8 md:text-lg">
            금리와 물가, 무역 흐름, 정부 정책을 함께 보면 기업이 투자를 늘리거나 줄이는 이유와
            <br />
            금융시장의 반응을 더 차분하게 따라갈 수 있습니다.
          </p>
        </div>
        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3 sm:mt-10 sm:max-w-none sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {tabHints.map((hint) => (
            <section className="grid justify-items-center gap-1.5 rounded-xl bg-white px-2.5 py-3 text-center shadow-sm ring-1 ring-zinc-200 sm:bg-transparent sm:p-0 sm:shadow-none sm:ring-0" key={hint.title}>
              <span className="text-2xl leading-none sm:text-5xl" aria-hidden="true">{hint.emoji}</span>
              <h3 className="text-sm font-extrabold tracking-normal text-teal-700 sm:text-lg md:text-xl">{hint.title}</h3>
              <p className="hidden max-w-lg text-sm font-medium leading-6 text-zinc-600 sm:block sm:leading-7">{hint.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section className="home-snap-section home-copy mx-auto grid max-w-5xl content-center justify-items-center py-6 text-center sm:py-10">
        <div className="grid max-w-4xl justify-items-center">
          <h2 className="max-w-[760px] text-2xl font-extrabold leading-[1.22] tracking-normal sm:text-3xl md:text-5xl md:leading-[1.14]">
            <span className="inline-flex flex-wrap justify-center gap-x-3 gap-y-1">
              {finalTitleWords.map((word, index) => (
                <span
                  className="home-cta-shine-word"
                  key={`${ctaHighlightKey}-title-${word}`}
                  style={{ animationDelay: `${180 + index * 150}ms` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-zinc-600 sm:mt-6 sm:text-base sm:leading-8 md:text-lg">
            <span className="inline-flex flex-wrap justify-center gap-x-1.5">
              {finalBodyWords.map((word, index) => (
                <span
                  className="home-cta-shine-word"
                  key={`${ctaHighlightKey}-body-${word}`}
                  style={{ animationDelay: `${720 + index * 115}ms` }}
                >
                  {word}
                </span>
              ))}
            </span>
          </p>
          <button
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-zinc-950 bg-zinc-950 px-4 text-sm font-extrabold text-white shadow-sm transition-colors duration-150 hover:bg-zinc-800 sm:mt-8 sm:h-11 sm:px-5"
            onClick={onGoDashboard}
            type="button"
          >
            환율현황 보러가기
          </button>
        </div>
      </section>
      </div>
      {isCalculatorModalOpen && typeof document !== 'undefined' ? createPortal((
        <div
          aria-modal="true"
          className="modal-overlay responsive-modal-overlay fixed inset-0 z-[1000] isolate flex bg-zinc-950/35 xl:hidden"
          onClick={() => setIsCalculatorModalOpen(false)}
          onTouchEnd={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div
            className="modal-panel modal-scroll-area responsive-modal-panel responsive-calculator-modal responsive-modal-scroll"
            onClick={(event) => event.stopPropagation()}
          >
            <ExchangeProfitCalculator calculatorMeta={calculatorMeta} onClose={() => setIsCalculatorModalOpen(false)} rates={rates} />
          </div>
        </div>
      ), document.body) : null}
    </section>
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
