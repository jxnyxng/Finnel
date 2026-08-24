import React from 'react';
import axios from 'axios';
import { FadeIn } from '../components/FadeIn';
import { ChartHelpTooltip } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank, ExchangeRateCalculatorMeta, ExchangeRateSnapshotResponse, ForeignExchangeRate } from '../types';

const featureSections = [
    {
        eyebrow: 'TODAY BRIEF',
        title: '오늘 주목해야 할 경제 변화,\n한 화면에 담았습니다.',
        body: '환율과 주요 지표부터 최신 뉴스와 정책까지\n핵심만 짚어 밤사이 달라진 흐름을 파악해 보세요.',
        preview: 'today'
    },
    {
        eyebrow: 'FX DASHBOARD',
        title: '원/달러 환율과 달러인덱스를\n직관적으로 비교해 보세요.',
        body: '핀넬이 제공하는 차트로 오늘의 환율을 읽고\n글로벌 달러 강세 흐름까지 한눈에 확인해 보세요.',
        preview: 'fx'
    },
    {
        eyebrow: 'CONTEXT',
        title: '단순한 숫자를 넘어,\n변화의 진짜 배경을 읽어보세요.',
        body: '물가, 무역수지 등 딱딱한 지표를 뉴스와 연결해\n시장이 움직이는 맥락을 자연스럽게 이해해 보세요.',
        preview: 'context'
    }
];

type HomePageProps = {
    calculatorMeta?: ExchangeRateCalculatorMeta | null;
    currencyStrengthRanks?: CurrencyStrengthRank[];
    rates?: ForeignExchangeRate[];
    onGoDashboard?: (tabName?: string) => void;
};

type CalculatorSelectOption = {
    label: React.ReactNode;
    menuLabel?: React.ReactNode;
    value: string;
};

export function HomePage({ currencyStrengthRanks = [], onGoDashboard }: HomePageProps) {
    const [activeSection, setActiveSection] = React.useState(0);
    const [visitedSections, setVisitedSections] = React.useState<Set<number>>(new Set([0]));
    const [ctaHighlightKey, setCtaHighlightKey] = React.useState(0);
    const sectionRefs = React.useRef<(HTMLElement | null)[]>([]);

    const [isDesktopDeck, setIsDesktopDeck] = React.useState(() => (
        typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
    ));
    const lastMoveAtRef = React.useRef(0);
    const previousSectionRef = React.useRef(0);
    const touchStartYRef = React.useRef<number | null>(null);
    const touchCurrentYRef = React.useRef<number | null>(null);
    const sectionCount = featureSections.length + 3;

    // ✅ 모바일 스크롤 문제 해결: 화면에 영역이 들어오는지 감지하는 Intersection Observer
    React.useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                setVisitedSections((prev) => {
                    let hasChanges = false;
                    const next = new Set(prev);
                    entries.forEach((entry) => {
                        // 영역이 15% 이상 화면에 들어왔을 때
                        if (entry.isIntersecting) {
                            const index = Number(entry.target.getAttribute('data-index'));
                            if (!next.has(index)) {
                                next.add(index);
                                hasChanges = true;
                            }
                        }
                    });
                    return hasChanges ? next : prev;
                });
            },
            { threshold: 0.15 }
        );

        const currentRefs = sectionRefs.current;
        currentRefs.forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => {
            currentRefs.forEach((ref) => {
                if (ref) observer.unobserve(ref);
            });
        };
    }, []);

    const moveSection = React.useCallback((direction: 1 | -1) => {
        const now = window.performance.now();
        if (now - lastMoveAtRef.current < 720) {
            return;
        }
        lastMoveAtRef.current = now;
        setActiveSection((current) => Math.min(sectionCount - 1, Math.max(0, current + direction)));
    }, [sectionCount]);

    const handleWheel = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
        if (!isDesktopDeck) return;
        if (Math.abs(event.deltaY) < 18) return;
        event.preventDefault();
        moveSection(event.deltaY > 0 ? 1 : -1);
    }, [isDesktopDeck, moveSection]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        if (!isDesktopDeck) return;
        if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
            event.preventDefault();
            moveSection(1);
        }
        if (event.key === 'ArrowUp' || event.key === 'PageUp') {
            event.preventDefault();
            moveSection(-1);
        }
    }, [isDesktopDeck, moveSection]);

    const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
        if (!isDesktopDeck) return;
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
        touchCurrentYRef.current = touchStartYRef.current;
    }, [isDesktopDeck]);

    const handleTouchMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
        if (!isDesktopDeck) return;
        touchCurrentYRef.current = event.touches[0]?.clientY ?? touchCurrentYRef.current;
        if (touchStartYRef.current == null || touchCurrentYRef.current == null) return;
        if (Math.abs(touchStartYRef.current - touchCurrentYRef.current) > 8) {
            event.preventDefault();
        }
    }, [isDesktopDeck]);

    const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
        if (!isDesktopDeck) return;
        const startY = touchStartYRef.current;
        const endY = touchCurrentYRef.current ?? event.changedTouches[0]?.clientY;
        touchStartYRef.current = null;
        touchCurrentYRef.current = null;
        if (startY == null || endY == null || Math.abs(startY - endY) < 68) return;
        moveSection(startY > endY ? 1 : -1);
    }, [isDesktopDeck, moveSection]);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const updateLayoutMode = () => {
            setIsDesktopDeck(mediaQuery.matches);
            if (!mediaQuery.matches) {
                setActiveSection(0);
                touchStartYRef.current = null;
                touchCurrentYRef.current = null;
            }
        };

        updateLayoutMode();
        mediaQuery.addEventListener('change', updateLayoutMode);
        return () => mediaQuery.removeEventListener('change', updateLayoutMode);
    }, []);

    React.useEffect(() => {
        if (activeSection === sectionCount - 1 && previousSectionRef.current !== activeSection) {
            setCtaHighlightKey((current) => current + 1);
        }
        // 데스크탑 모드일 때는 activeSection 기준으로도 방문 처리를 강제 연동
        setVisitedSections((prev) => {
            if (prev.has(activeSection)) return prev;
            const next = new Set(prev);
            next.add(activeSection);
            return next;
        });
        previousSectionRef.current = activeSection;
    }, [activeSection, sectionCount]);

    return (
        <section
            aria-label="Finnel 서비스 소개"
            className="home-deck page-content-enter relative -mx-3 -mb-2 mt-0 overflow-hidden px-3 text-zinc-950 sm:-mx-4 sm:-mb-3 sm:mt-0 sm:px-4"
            onKeyDown={handleKeyDown}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
            tabIndex={0}
        >
            <style>{`
                @keyframes trendyFadeUp {
                    from { opacity: 0; transform: translateY(32px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes trendyScaleUp {
                    from { opacity: 0; transform: scale(0.96) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .anim-fade-up {
                    opacity: 0;
                    animation: trendyFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .anim-scale-up {
                    opacity: 0;
                    animation: trendyScaleUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .anim-delay-100 { animation-delay: 100ms; }
                .anim-delay-200 { animation-delay: 200ms; }
                .anim-delay-300 { animation-delay: 300ms; }
            `}</style>

            <div
                className="home-deck-track"
                style={isDesktopDeck ? { transform: `translate3d(0, -${activeSection * 100}%, 0)` } : undefined}
            >
                <div className="home-funnel-bg" aria-hidden="true">
                    <div className="home-funnel-bowl" />
                    <div className="home-funnel-stem" />
                </div>
                <section className="home-snap-section home-copy relative mx-auto grid max-w-[82rem] content-center justify-items-center py-4 text-center sm:py-6">
                    <div className="grid w-full min-w-0 -translate-y-6 gap-4 sm:-translate-y-5 sm:gap-5 xl:-translate-y-6">
                        <div className="mx-auto min-w-0 max-w-4xl px-4 sm:px-6">
                            <FadeIn delay={0.1}>
                                <p className="mt-2 text-xs font-bold tracking-[0.2em] text-teal-600 sm:mt-3 sm:text-sm sm:tracking-[0.25em]">FINNEL DATA BOARD</p>
                            </FadeIn>
                            <FadeIn delay={0.2}>
                                <h1 className="mx-auto mt-3 max-w-[760px] break-keep text-3xl font-black leading-[1.4] tracking-wider text-zinc-900 sm:text-4xl md:text-5xl md:leading-[1.3] md:tracking-[0.1em] transform scale-x-[1.06]">
                                    흩어진 경제 신호들이 도착했어요!
                                </h1>
                            </FadeIn>
                            <FadeIn delay={0.3} className="mx-auto mt-6 hidden max-w-2xl items-center justify-center gap-4 text-teal-700 sm:flex" aria-hidden="true">
                                <span className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-teal-300 to-teal-700" />
                                <span className="text-[10px] font-black tracking-[0.3em] text-zinc-400">FINANCE + FUNNEL</span>
                                <span className="h-[1px] flex-1 bg-gradient-to-r from-teal-700 via-teal-300 to-transparent" />
                            </FadeIn>
                            <FadeIn delay={0.4}>
                                <p className="mx-auto mt-5 max-w-2xl break-keep text-center text-[0.95rem] font-medium leading-relaxed text-zinc-500 sm:text-lg sm:leading-[1.8]">
                                    환율, 금융 지표, 정책 및 경제 뉴스 등<br className="hidden sm:block" />
                                    경제 신호를 매일 업데이트하여 직관적으로 제공합니다.
                                </p>
                            </FadeIn>
                            <FadeIn delay={0.5}>
                                <p className="home-hero-coffee-copy mx-auto mt-5 max-w-2xl break-keep text-center text-sm font-extrabold sm:text-base">
                                    <span className="bg-gradient-to-r from-teal-500 to-teal-800 bg-clip-text text-transparent">
                                        복잡한 경제의 흐름을 쉽게 따라가보세요
                                    </span>
                                </p>
                            </FadeIn>
                        </div>
                    </div>
                    <p className="home-hero-scroll-copy inline-flex w-full max-w-md flex-col items-center justify-center gap-1 px-4 text-center text-sm font-semibold text-zinc-400">
                        <FadeIn delay={0.7} className="flex flex-col items-center break-keep">
                            <span>아래로 스크롤해 더 자세히 알아보세요</span>
                            <span className="home-scroll-cue mt-1 text-lg" aria-hidden="true">⌄</span>
                        </FadeIn>
                    </p>
                </section>

                {featureSections.map((section, index) => {
                    const sectionIndex = index + 1;
                    const isVisited = visitedSections.has(sectionIndex);
                    const isTextLeft = index % 2 === 0;

                    return (
                        <section
                            className="home-snap-section home-copy mx-auto grid max-w-[82rem] content-center justify-items-center py-6 text-center sm:py-10 lg:text-left px-4"
                            key={section.title}
                            data-index={sectionIndex}
                            ref={(el) => { sectionRefs.current[sectionIndex] = el; }}
                        >
                            <div className={`home-feature-layout home-feature-layout-${section.preview} ${!isTextLeft ? 'home-feature-layout-reversed' : ''}`}>

                                <div className={`home-feature-copy ${isVisited ? 'anim-fade-up' : 'opacity-0'}`}>
                                    <p className="mb-3 text-xs font-bold tracking-[0.2em] text-teal-600 sm:mb-4">{section.eyebrow}</p>
                                    <h2 className="mx-auto max-w-[680px] break-keep text-2xl font-extrabold leading-[1.4] tracking-wider text-zinc-900 sm:text-3xl md:text-[2.5rem] md:leading-[1.3] md:tracking-[0.05em] xl:mx-0">
                                        {renderIntroLines(section.title)}
                                    </h2>
                                    <p className="mx-auto mt-4 max-w-2xl break-keep text-[0.95rem] font-medium leading-relaxed text-zinc-500 sm:mt-6 sm:text-lg sm:leading-[1.8] xl:mx-0">
                                        {renderIntroLines(section.body)}
                                    </p>
                                </div>

                                <FeaturePreview
                                    type={section.preview}
                                    className={isVisited ? 'anim-scale-up anim-delay-200' : 'opacity-0'}
                                />
                            </div>
                        </section>
                    );
                })}

                <section
                    className="home-snap-section home-copy mx-auto grid max-w-[82rem] content-center justify-items-center py-6 text-center sm:py-10 lg:text-left px-4"
                    data-index={4}
                    ref={(el) => { sectionRefs.current[4] = el; }}
                >
                    <ExchangeToolsSection
                        currencyStrengthRanks={currencyStrengthRanks}
                        isVisited={visitedSections.has(4)}
                    />
                </section>

                <section
                    className="home-snap-section home-copy home-final-section mx-auto grid max-w-[72rem] content-center justify-items-center py-8 text-center sm:py-12 px-4"
                    data-index={5}
                    ref={(el) => { sectionRefs.current[5] = el; }}
                >
                    <div className={`grid max-w-4xl justify-items-center ${visitedSections.has(5) ? 'anim-fade-up' : 'opacity-0'}`}>
                        <h2 className="max-w-[760px] break-keep text-3xl font-black leading-[1.4] tracking-wider sm:text-4xl md:text-5xl md:leading-[1.4] md:tracking-[0.05em]">
                            <span
                                className="home-cta-shine-word text-zinc-900"
                                key={`${ctaHighlightKey}-title`}
                                style={{ animationDelay: '180ms' }}
                            >
                              흩어지고 복잡한 경제의 흐름<br />핀넬과 함께
                            </span>
                        </h2>
                        <div className="mt-8 grid justify-items-center sm:mt-10">
                            <button
                                className="home-primary-cta"
                                onClick={() => onGoDashboard?.('todayFlow')}
                                type="button"
                            >
                                무료로 시작하기
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    );
}

function FeaturePreview({ type, className = '' }: { type: string; className?: string }) {
    if (type === 'today') {
        return (
            <div className={`home-preview-frame shadow-xl shadow-zinc-200/50 ${className}`}>
                <div className="home-preview-tab-header">
                    <p>TODAY BRIEF</p>
                    <h3>오늘의 현황</h3>
                    <span>환율·지표·뉴스를 오늘 변화 중심으로 정리</span>
                </div>
                <div className="home-preview-status-row">
                    <span>오늘의 핵심 포인트</span>
                    <strong>데이터 수집 완료</strong>
                </div>
                <div className="grid gap-2">
                    <div className="home-preview-focus break-keep">
                        <span>주목할 지표</span>
                        <strong>원/달러 장중 +0.42%</strong>
                        <p>달러 강세 및 수입 물가 지표 동시 확인</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 break-keep">
                        <PreviewMetric label="소비자물가" value="2.1%" tone="up" />
                        <PreviewMetric label="무역수지" value="+42억$" tone="flat" />
                    </div>
                    <div className="home-preview-list break-keep">
                        <span>관련 최신 뉴스</span>
                        <p>환율 상승 배경 점검</p>
                        <p>수출입 지표 발표 예정</p>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'fx') {
        return (
            <div className={`home-preview-frame home-preview-frame-fx shadow-xl shadow-zinc-200/50 ${className}`}>
                <div className="home-preview-tab-header">
                    <p>FX DASHBOARD</p>
                    <h3>환율</h3>
                    <span>원/달러 환율과 달러 지수를 함께 확인</span>
                </div>
                <div className="home-preview-chart-stack break-keep" aria-hidden="true">
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
                        title="원달러 환율"
                        variant="usdKrw"
                    />
                </div>
            </div>
        );
    }

    if (type === 'context') {
        return (
            <div className={`home-preview-frame home-preview-frame-context shadow-xl shadow-zinc-200/50 ${className}`}>
                <div className="home-preview-tab-header">
                    <p>KOREA INDICATORS</p>
                    <h3>지표 · 뉴스 · 정책</h3>
                    <span>원화 흐름을 해석할 때 함께 보는 자료</span>
                </div>
                <div className="home-preview-range-row break-keep">
                    <span className="home-preview-range-active">전체</span>
                    <span>대외수급</span>
                    <span>정책</span>
                </div>
                <div className="home-preview-timeline break-keep">
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
        <article className="home-preview-news-card break-keep">
            <div className="home-preview-news-thumbnail" aria-hidden="true">
                <span>FX</span>
            </div>
            <div className="min-w-0">
                <div className="home-preview-news-meta">
                    <span>경제</span>
                    <span>연합뉴스 · 2026.08.02</span>
                </div>
                <h4 className="leading-snug">7월 원화 절상률 8.8%,<br />금융위기 후 최고</h4>
                <p>환율 변화와 달러 수급 이슈를<br />뉴스 카드에서 함께 확인합니다.</p>
            </div>
        </article>
    );
}

function ExchangeToolsSection({ currencyStrengthRanks, isVisited }: { currencyStrengthRanks: CurrencyStrengthRank[]; isVisited?: boolean }) {
    return (
        <div className="home-dual-feature-layout">
            <ExchangeCalculatorPreview className={isVisited ? 'anim-scale-up' : 'opacity-0'} />

            <div className={`home-dual-feature-copy home-dual-feature-copy-top break-keep ${isVisited ? 'anim-fade-up anim-delay-100' : 'opacity-0'}`}>
                <p className="mb-3 text-xs font-bold tracking-[0.2em] text-teal-600 sm:mb-4">EXCHANGE CALCULATOR</p>
                <h2 className="mx-auto max-w-[680px] break-keep text-2xl font-extrabold leading-[1.4] tracking-wider text-zinc-900 sm:text-3xl md:text-[2.5rem] md:leading-[1.3] md:tracking-[0.05em] xl:mx-0">
                    예전에 환전했던 내 돈,<br />지금은 얼마일까요?
                </h2>
               <div className="mx-auto mt-4 max-w-2xl break-keep text-[0.95rem] font-medium leading-relaxed text-zinc-500 sm:mt-6 sm:text-lg sm:leading-[1.8] xl:mx-0">
                    과거에 바꿔둔 외화가 지금은 얼마인지 확인하고<br />현재 환율로 필요한 원화도 쉽게 계산해 보세요.
                </div>
            </div>

            <div className={`home-dual-feature-copy home-dual-feature-copy-bottom break-keep mt-10 md:mt-0 ${isVisited ? 'anim-fade-up anim-delay-200' : 'opacity-0'}`}>
                <p className="mb-3 text-xs font-bold tracking-[0.2em] text-teal-600 sm:mb-4">CURRENCY RANKING</p>
                <h2 className="mx-auto max-w-[680px] break-keep text-2xl font-extrabold leading-[1.4] tracking-wider text-zinc-900 sm:text-3xl md:text-[2.5rem] md:leading-[1.3] md:tracking-[0.05em] xl:mx-0">
                    매주 업데이트되는<br />한국 원화의 글로벌 경쟁력
                </h2>
                <div className="mx-auto mt-4 max-w-2xl break-keep text-[0.95rem] font-medium leading-relaxed text-zinc-500 sm:mt-6 sm:text-lg sm:leading-[1.8] xl:mx-0">
                    주요 교역국 대비 원화 가치의 변화를<br />화폐랭킹 탭에서 매주 직관적으로 확인해 보세요.
                </div>
            </div>

            <CurrencyRankingPreview
                ranks={currencyStrengthRanks}
                className={isVisited ? 'anim-scale-up anim-delay-300' : 'opacity-0'}
            />
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

function ExchangeCalculatorPreview({ className = '' }: { className?: string }) {
    return (
        <div className={`home-preview-frame home-preview-frame-calculator-ppt break-keep shadow-xl shadow-zinc-200/50 ${className}`}>
            <div className="home-preview-tab-header">
                <p>CALCULATOR</p>
                <h3>환전계산기</h3>
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

function CalculatorSelect({
                              ariaLabel,
                              className = '',
                              menuClassName = '',
                              onChange,
                              options,
                              value
                          }: {
    ariaLabel: string;
    className?: string;
    menuClassName?: string;
    onChange: (value: string) => void;
    options: CalculatorSelectOption[];
    value: string;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const selectedOption = options.find((option) => option.value === value) ?? options[0];

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeOnOutside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        window.addEventListener('pointerdown', closeOnOutside);
        return () => window.removeEventListener('pointerdown', closeOnOutside);
    }, [isOpen]);

    return (
        <div className={`calculator-select relative min-w-0 ${className}`} ref={rootRef}>
            <button
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={ariaLabel}
                className="calculator-select-trigger glass-field h-9 w-full min-w-0 px-2 text-left text-sm font-semibold outline-none"
                onClick={() => setIsOpen((current) => !current)}
                type="button"
            >
                <span className="min-w-0 truncate">{selectedOption?.label ?? '선택'}</span>
                <span className="shrink-0 text-[0.72rem] text-teal-100" aria-hidden="true">⌄</span>
            </button>
            {isOpen ? (
                <div className={`calculator-select-menu ${menuClassName}`} role="listbox">
                    {options.map((option) => (
                        <button
                            aria-selected={option.value === value}
                            className="calculator-select-option"
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            role="option"
                            type="button"
                        >
                            {option.menuLabel ?? option.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CurrencyRankingPreview({ ranks, className = '' }: { ranks: CurrencyStrengthRank[]; className?: string }) {
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
        <div className={`home-preview-frame home-preview-ranking-frame break-keep shadow-xl shadow-zinc-200/50 ${className}`}>
            <div className="home-preview-tab-header">
                <p>CURRENCY RANKING</p>
                <h3>화폐랭킹</h3>
                <span>{previewRanks[0]?.baseDate ?? '최신'} · 한국 주변 순위</span>
            </div>
            <div className="home-preview-ranking-list">
                {previewRanks.length === 0 ? (
                    <div className="home-preview-ranking-empty">화폐랭킹 데이터를 확인 중입니다.</div>
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
    const currencyOptions = React.useMemo<CalculatorSelectOption[]>(() => [
        { label: '통화 선택', value: '' },
        ...rates.map((rate) => ({
            label: `${getCurrencyFlag(rate.displayCode)} ${rate.displayCode}`,
            menuLabel: `${getCurrencyFlag(rate.displayCode)} ${rate.displayCode} · ${getCurrencyKoreanName(rate.displayCode)}`,
            value: rate.currencyCode
        }))
    ], [rates]);
    const yearOptions = React.useMemo<CalculatorSelectOption[]>(
        () => availableYears.map((year) => ({ label: `${year}년`, value: String(year) })),
        [availableYears]
    );
    const monthOptions = React.useMemo<CalculatorSelectOption[]>(
        () => availableMonths.map((month) => ({ label: `${month}월`, value: String(month) })),
        [availableMonths]
    );
    const dayOptions = React.useMemo<CalculatorSelectOption[]>(
        () => availableDays.map((day) => ({ label: `${day}일`, value: String(day) })),
        [availableDays]
    );

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
            <FadeIn as="section" delay={0.1} className={`glass-card grid min-h-[32rem] min-w-0 content-start rounded-[1.35rem] p-3 shadow-xl shadow-zinc-950/20 lg:min-h-[36.5rem] lg:rounded-[1.6rem] lg:p-4 ${className}`}>
                <div className="border-b border-white/10 pb-3">
                    <div className="flex items-start justify-between gap-3 break-keep">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="text-base font-extrabold leading-tight text-white sm:text-lg tracking-tight">환차익 계산기</p>
                                <ChartHelpTooltip ariaLabel="환차익 계산기 안내" title="환차익 계산 기준" widthClassName="w-80">
                                    <p className="mt-2 text-sm leading-relaxed">선택일 데이터가 없으면 직전 기준일 환율을 사용합니다.</p>
                                    <p className="mt-2 text-sm leading-relaxed">수수료와 은행별 스프레드는 제외한 기준 환율 계산입니다.</p>
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
            <span className="flex min-h-6 items-center justify-between gap-2 break-keep">
              <span>{amountInputMode === 'foreign' ? '환전한 외화 금액' : '지불한 원화 금액'}</span>
              <span className="relative grid h-6 w-[5.75rem] grid-cols-2 rounded-full border border-white/10 bg-white/10 p-0.5 shadow-sm" ref={amountInputModeContainerRef}>
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
                            label="당시 적용 환율"
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
                            label="현재 적용 환율"
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

                <div className="mt-3 min-h-[7.5rem] rounded-xl border border-white/10 bg-white/10 p-3 lg:minh-[8.4rem]">
                    <p className="text-left text-[11px] font-semibold text-white/55">계산 결과</p>
                    <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(9.5rem,9.5rem)] sm:items-center">
                        <div className="min-w-0">
                            <p className="grid min-h-14 content-center justify-items-start gap-1 text-white break-keep" title={hasResult ? formatResultSentence(historicalKrw, currentKrw) : '환전 시점과 금액을 입력해 주세요.'}>
                                {!hasResult ? (
                                    <span className="text-[0.9rem] font-extrabold text-white/58">환전 시점과 금액을 입력해 주세요.</span>
                                ) : (
                                    <>
                                        <span className="block max-w-full truncate text-[0.88rem] font-extrabold leading-none text-white/75">{formatKrw(historicalKrw)}</span>
                                        <span className="block text-base font-black leading-none text-white/45" aria-hidden="true">↓</span>
                                        <span className="block max-w-full truncate text-[1.5rem] font-extrabold leading-none text-teal-100 tracking-tight sm:text-2xl">{formatKrw(currentKrw)}</span>
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="grid min-w-0 place-items-center gap-1.5 overflow-hidden rounded-lg bg-black/15 p-2.5 text-center sm:w-[9.5rem] break-keep">
                            <div className="min-w-0 max-w-full">
                                <p className="text-[9px] font-semibold text-white/45">환차익/환차손</p>
                                <p className={`mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-extrabold tracking-tight ${resultTone}`} title={formatKrw(profit)}>
                                    {profit === null ? '-' : `${profit >= 0 ? '+' : ''}${formatKrw(profit)}`}
                                </p>
                            </div>
                            <div className="min-w-0 max-w-full">
                                <p className="text-[9px] font-semibold text-white/45">수익률</p>
                                <p className={`mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-extrabold tracking-tight ${resultTone}`}>
                                    {returnRate === null ? '-' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </FadeIn>
        );
    }

    return (
        <FadeIn as="section" delay={0.1} className={`glass-card grid min-h-[32rem] min-w-0 content-start rounded-[1.35rem] p-3 shadow-xl shadow-zinc-950/20 lg:min-h-[36.5rem] lg:rounded-[1.6rem] lg:p-4 ${className}`}>
            <div className="calculator-card-header border-b border-white/10 pb-3">
                <div className="flex items-start justify-between gap-3 break-keep">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="calculator-card-title text-base font-extrabold leading-tight text-white sm:text-lg tracking-tight">환차익 계산기</p>
                            <ChartHelpTooltip ariaLabel="환차익 계산기 안내" title="환차익 계산 기준" widthClassName="w-80">
                                <p className="mt-2 text-sm leading-relaxed">선택일 데이터가 없으면 직전 기준일 환율을 사용합니다.</p>
                                <p className="mt-2 text-sm leading-relaxed">수수료와 은행별 스프레드는 제외한 기준 환율 계산입니다.</p>
                            </ChartHelpTooltip>
                        </div>
                        <h2 className="calculator-card-description mt-1.5 text-[11px] font-semibold text-white/55 sm:text-xs">과거 환전과 현재 가치 비교</h2>
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

            <div className="calculator-profit-tab-body mt-3 grid gap-4">
                <div className="grid min-w-0 content-start gap-4">
                    <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(10rem,0.78fr)_minmax(0,1.22fr)]">
                            <label className="grid gap-2 text-[10px] font-semibold text-white/55">
                                <span className="flex h-5 items-center gap-2">통화 선택</span>
                                <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
                                    <span className="grid h-9 place-items-center border border-white/15 bg-white/10 text-xl" aria-hidden="true">
                                      {selectedRate ? getCurrencyFlag(selectedRate.displayCode) : '💱'}
                                    </span>
                                    <CalculatorSelect
                                        ariaLabel="통화 선택"
                                        menuClassName="calculator-select-menu-wide"
                                        onChange={setCurrencyCode}
                                        options={currencyOptions}
                                        value={currencyCode}
                                    />
                                </div>
                            </label>
                            <label className="grid gap-2 text-[10px] font-semibold text-white/55">
                                <span className="flex h-5 items-center">환전한 날짜</span>
                                <div className="calculator-date-segment grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-1.5">
                                    <CalculatorSelect
                                        ariaLabel="환전 연도"
                                        onChange={(value) => updateDatePart('year', Number(value))}
                                        options={yearOptions}
                                        value={String(selectedDateParts.year)}
                                    />
                                    <CalculatorSelect
                                        ariaLabel="환전 월"
                                        onChange={(value) => updateDatePart('month', Number(value))}
                                        options={monthOptions}
                                        value={String(selectedDateParts.month)}
                                    />
                                    <CalculatorSelect
                                        ariaLabel="환전 일"
                                        onChange={(value) => updateDatePart('day', Number(value))}
                                        options={dayOptions}
                                        value={String(selectedDateParts.day)}
                                    />
                                </div>
                            </label>
                        </div>
                        <label className="grid gap-2 text-[10px] font-semibold text-white/55">
                            <span className="flex h-5 items-center break-keep">
                                {amountInputMode === 'foreign' ? '환전한 외화 금액' : '지불한 원화 금액'}
                            </span>
                            <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <span className="calculator-mode-segment relative grid h-9 w-[5.75rem] grid-cols-2 border border-white/10 bg-white/10 p-0.5 shadow-sm" ref={amountInputModeContainerRef}>
                  <MovingTabIndicator compact contained indicator={amountInputModeIndicator} isMoving={isAmountInputModeIndicatorMoving} />
                    {(['foreign', 'krw'] as const).map((mode) => (
                        <button
                            className={`relative z-10 h-8 rounded-full px-2 text-[0.7rem] font-extrabold leading-8 transition-colors duration-150 ${
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
                    </div>

                    <section className="grid content-start gap-2 break-keep">
                        <div className="grid gap-2 border border-white/10 bg-white/7 p-3 sm:grid-cols-2">
                            <RateSnapshotCard
                                fallbackDate={exchangeDate}
                                isEditing={editingRateKey === 'historical'}
                                label="당시 적용 환율"
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
                                label="현재 적용 환율"
                                manualValue={manualCurrentRate}
                                onManualValueChange={setManualCurrentRate}
                                onResetManualValue={() => setManualCurrentRate('')}
                                onStartEditing={() => setEditingRateKey('current')}
                                onStopEditing={() => setEditingRateKey(null)}
                                rate={effectiveCurrentRate}
                            />
                        </div>
                        {isLoading ? (
                            <p className="bg-black/15 px-2.5 py-1.5 text-[10px] leading-4 text-white/45">
                                과거 환율을 조회하고 있습니다.
                            </p>
                        ) : null}
                    </section>

                    <div className="grid min-h-[12.5rem] grid-rows-[auto_minmax(0,1fr)] border border-white/10 bg-white/10 p-4 xl:min-h-0">
                        <p className="text-left text-[11px] font-semibold text-white/55">계산 결과</p>
                        <div className="grid min-w-0 content-center gap-3 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,10rem)] sm:items-center">
                            <div className="grid min-w-0 place-items-center sm:place-items-start">
                                <p className="grid min-h-24 content-center justify-items-center gap-2 text-center text-white sm:justify-items-start sm:text-left break-keep" title={hasResult ? formatResultSentence(historicalKrw, currentKrw) : '환전 시점과 금액을 입력해 주세요.'}>
                                    {!hasResult ? (
                                        <span className="text-[0.9rem] font-extrabold text-white/58">환전 시점과 금액을 입력해 주세요.</span>
                                    ) : (
                                        <>
                                            <span className="block max-w-full truncate text-sm font-extrabold leading-none text-white/75">{formatKrw(historicalKrw)}</span>
                                            <span className="block text-base font-black leading-none text-white/45" aria-hidden="true">↓</span>
                                            <span className="block max-w-full truncate text-[1.5rem] font-extrabold leading-none text-teal-100 tracking-tight sm:text-2xl">{formatKrw(currentKrw)}</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="grid min-w-0 place-items-center gap-3 self-stretch overflow-hidden bg-black/15 p-3 text-center sm:w-[10rem] break-keep">
                                <div className="min-w-0 max-w-full">
                                    <p className="text-[9px] font-semibold text-white/45">환차익/환차손</p>
                                    <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold tracking-tight ${resultTone}`} title={formatKrw(profit)}>
                                        {profit === null ? '-' : `${profit >= 0 ? '+' : ''}${formatKrw(profit)}`}
                                    </p>
                                </div>
                                <div className="min-w-0 max-w-full">
                                    <p className="text-[9px] font-semibold text-white/45">수익률</p>
                                    <p className={`mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold tracking-tight ${resultTone}`}>
                                        {returnRate === null ? '-' : `${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(2)}%`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </FadeIn>
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
        <article className="min-w-0 rounded-lg bg-white/8 p-1.5 sm:p-2 break-keep">
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
                            className="mt-0.5 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[clamp(0.8rem,3.5vw,1rem)] font-extrabold leading-tight tracking-tight text-teal-100 underline-offset-2 hover:underline"
                            onClick={onStartEditing}
                            title={rate ? `${formatRate(rate)} 직접 입력` : '환율 직접 입력'}
                            type="button"
                        >
                            {rate ? formatRate(rate) : '환율 입력'}
                        </button>
                    ) : (
                        <p className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(0.8rem,3.5vw,1rem)] font-extrabold leading-tight tracking-tight text-teal-100" title={rate ? formatRate(rate) : '-'}>
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

    return `당시 ${formatKrw(previousValue)}이었던 가치가 현재 ${formatKrw(currentValue)}이 되었습니다.`;
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
