import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FadeIn } from '../components/FadeIn';
import { ChartEmptyState, ChartHelpTooltip } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { DomesticIndicator, DomesticIndicatorHistoryResponse, HistoryRangeKey, TimeSeriesPoint } from '../types';
import { formatMetricUnit, formatValue } from '../utils/format';
import { lockBodyScroll } from '../utils/scrollLock';

type KoreaStatusPageProps = {
    errorMessage?: string | null;
    indicators: DomesticIndicator[];
    isLoading: boolean;
    latestSyncLabel: string;
};

const sections = [
    {
        key: 'daily',
        label: '주요 시장지표',
        title: '환율 주요 시장지표',
        description: '금리, 유동성, 변동성, 원자재처럼 원/달러 환율을 해석할 때 먼저 확인하는 시장 지표입니다.',
        codes: ['US_TREASURY_2Y', 'US_10Y_TREASURY', 'SOFR', 'SOFR_30D_AVG', 'KOFR', 'CD_91D', 'VIX', 'WTI_OIL', 'GLOBAL_CREDIT_SPREAD_PROXY']
    },
    {
        key: 'liquidity',
        label: '통화·유동성',
        title: '통화량·단기금리·유동성',
        description: 'M2, SOFR, KOFR, CD금리는 원화와 달러 단기 유동성 여건을 보여줍니다.',
        codes: ['M2', 'SOFR', 'SOFR_30D_AVG', 'SOFR_90D_AVG', 'SOFR_180D_AVG', 'SOFR_INDEX', 'KOFR', 'CD_91D']
    },
    {
        key: 'curve',
        label: '미국채',
        title: '미국채 수익률곡선',
        description: '만기별 미국채 금리로 달러 금리 기대와 경기침체/재가속 신호를 함께 봅니다.',
        codes: ['US_TREASURY_1MO', 'US_TREASURY_3MO', 'US_TREASURY_6MO', 'US_TREASURY_1Y', 'US_TREASURY_2Y', 'US_TREASURY_3Y', 'US_TREASURY_5Y', 'US_TREASURY_7Y', 'US_10Y_TREASURY', 'US_TREASURY_20Y', 'US_TREASURY_30Y']
    },
    {
        key: 'reference',
        label: '참고',
        title: '정책금리 참고 지표',
        description: '기준금리와 한미 기준금리차는 중요하지만 발표 주기가 느려 일별 모니터링보다는 참고 지표로 봅니다.',
        codes: ['KR_POLICY_RATE', 'US_POLICY_RATE', 'KR_US_RATE_GAP']
    },
    {
        key: 'reference',
        label: '참고',
        title: '재정 정책 자료',
        description: '정부 재정 건전성은 국가 신뢰도와 환율 변동성에 영향을 줍니다.',
        codes: ['FISCAL_BALANCE', 'GOVERNMENT_DEBT']
    },
    {
        key: 'external',
        label: '대외수급',
        title: '외환 방어력',
        description: '단기외채 대비 외환보유액과 보유액 규모는 시장 충격을 버틸 여력을 보여줍니다.',
        codes: ['RESERVES_TO_SHORT_TERM_DEBT', 'FOREIGN_RESERVES']
    },
    {
        key: 'external',
        label: '대외수급',
        title: '대외수지와 달러 수급',
        description: '경상수지, 상품수지, 수출입은 국내로 들어오고 나가는 달러 흐름입니다.',
        codes: ['CURRENT_ACCOUNT', 'GOODS_ACCOUNT', 'EXPORT_AMOUNT', 'IMPORT_AMOUNT', 'TRADE_BALANCE']
    },
    {
        key: 'inflation',
        label: '물가·원자재',
        title: '물가와 금리 결정 압력',
        description: '물가 상승은 금리 정책과 실질 원화 가치에 동시에 영향을 줍니다.',
        codes: ['CPI', 'PPI', 'WTI_OIL', 'TERMS_OF_TRADE']
    },
    {
        key: 'risk',
        label: '자본·리스크',
        title: '자본 흐름과 대외 리스크',
        description: '외국인 자금, 미국 금리, 변동성, 신용위험은 원화 자산 선호를 바꿉니다.',
        codes: ['FOREIGN_STOCK_FLOW', 'FOREIGN_BOND_FLOW', 'VIX', 'GLOBAL_CREDIT_SPREAD_PROXY']
    }
];

const sectionTabs = [
    { key: 'all', label: '전체' },
    { key: 'daily', label: '주요 시장지표' },
    { key: 'liquidity', label: '통화·유동성' },
    { key: 'curve', label: '미국채' },
    { key: 'external', label: '대외수급' },
    { key: 'reference', label: '참고' },
    { key: 'inflation', label: '물가·원자재' },
    { key: 'risk', label: '자본·리스크' }
];

const sectionTabMinButtonWidth = 104;

const historyRangeOptions: Array<{ key: HistoryRangeKey; label: string }> = [
    { key: '1Y', label: '1년' },
    { key: '3Y', label: '3년' },
    { key: '5Y', label: '5년' }
];

export function KoreaStatusPage({ errorMessage, indicators, isLoading, latestSyncLabel }: KoreaStatusPageProps) {
    const [activeSectionKey, setActiveSectionKey] = React.useState(sectionTabs[0].key);
    const [hasAnimatedContent, setHasAnimatedContent] = React.useState(false);
    const [isDesktopSidePanelLayout, setIsDesktopSidePanelLayout] = React.useState(() => (
        typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1280px)').matches
    ));
    const [selectedIndicator, setSelectedIndicator] = React.useState<DomesticIndicator | null>(null);
    const [isIndicatorPanelDismissed, setIsIndicatorPanelDismissed] = React.useState(false);
    const layoutRef = React.useRef<HTMLDivElement | null>(null);
    const [openLayoutHeight, setOpenLayoutHeight] = React.useState<number | null>(null);
    const sectionTabKeys = React.useMemo(() => sectionTabs.map((tab) => tab.key), []);
    const {
        buttonRefs: sectionTabButtonRefs,
        buttonWidth: sectionTabButtonWidth,
        containerRef: sectionTabNavRef,
        indicator: sectionTabIndicator,
        isMoving: isSectionTabIndicatorMoving,
        labelActiveKey: activeSectionLabelKey,
        startMoving: startSectionTabIndicatorMoving
    } = useMovingTabIndicator({
        activeKey: activeSectionKey,
        equalizeButtonWidths: true,
        keys: sectionTabKeys,
        minButtonWidth: sectionTabMinButtonWidth
    });
    const indicatorMap = React.useMemo(() => new Map(indicators.map((indicator) => [indicator.code, indicator])), [indicators]);
    const collectedIndicators = indicators.filter((indicator) => indicator.value !== null);
    const visibleSections = React.useMemo(
        () => activeSectionKey === 'all' ? sections : sections.filter((section) => section.key === activeSectionKey),
        [activeSectionKey]
    );
    const visibleIndicators = React.useMemo(() => {
        const seenCodes = new Set<string>();
        return visibleSections
            .flatMap((section) => section.codes)
            .map((code) => indicatorMap.get(code))
            .filter((indicator): indicator is DomesticIndicator => {
                if (!indicator || seenCodes.has(indicator.code)) {
                    return false;
                }
                seenCodes.add(indicator.code);
                return true;
            });
    }, [indicatorMap, visibleSections]);
    const cleanLatestSyncLabel = latestSyncLabel
        .replace(/\s·\s(?:SUCCESS|RUNNING|FAILED|PARTIAL_SUCCESS|UNKNOWN)(?=\s·|$)/g, '')
        .replace(/\s·\sSKIPPED[^·]*(?=\s·|$)/g, '');
    const canShowIndicatorDetails = !isLoading && !errorMessage;
    const shouldShowSidePanel = canShowIndicatorDetails && isDesktopSidePanelLayout;
    const displayedIndicator = React.useMemo(() => {
        if (!shouldShowSidePanel || visibleIndicators.length === 0 || isIndicatorPanelDismissed) {
            return selectedIndicator;
        }

        if (selectedIndicator && visibleIndicators.some((indicator) => indicator.code === selectedIndicator.code)) {
            return selectedIndicator;
        }

        return visibleIndicators[0];
    }, [isIndicatorPanelDismissed, selectedIndicator, shouldShowSidePanel, visibleIndicators]);
    const scrollSectionTabs = (direction: -1 | 1) => {
        sectionTabNavRef.current?.scrollBy({
            behavior: 'smooth',
            left: direction * 180
        });
    };
    const openIndicatorPanel = React.useCallback((indicator: DomesticIndicator) => {
        setIsIndicatorPanelDismissed(false);
        setSelectedIndicator(indicator);
    }, []);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1280px)');
        const updateLayoutMode = () => setIsDesktopSidePanelLayout(mediaQuery.matches);

        updateLayoutMode();
        mediaQuery.addEventListener('change', updateLayoutMode);
        return () => mediaQuery.removeEventListener('change', updateLayoutMode);
    }, []);

    React.useEffect(() => {
        if (!canShowIndicatorDetails || visibleIndicators.length === 0) {
            setSelectedIndicator(null);
            return;
        }

        if (!shouldShowSidePanel) {
            if (selectedIndicator && !visibleIndicators.some((indicator) => indicator.code === selectedIndicator.code)) {
                setSelectedIndicator(null);
            }
            return;
        }

        if (!selectedIndicator && isIndicatorPanelDismissed) {
            return;
        }

        if (!selectedIndicator || !visibleIndicators.some((indicator) => indicator.code === selectedIndicator.code)) {
            setSelectedIndicator(visibleIndicators[0]);
        }
    }, [canShowIndicatorDetails, isIndicatorPanelDismissed, selectedIndicator, shouldShowSidePanel, visibleIndicators]);

    React.useEffect(() => {
        setIsIndicatorPanelDismissed(false);
    }, [activeSectionKey]);

    React.useEffect(() => {
        if (!isLoading && !errorMessage && visibleIndicators.length > 0 && !hasAnimatedContent) {
            const animationTimer = window.setTimeout(() => {
                setHasAnimatedContent(true);
            }, 1100);
            return () => window.clearTimeout(animationTimer);
        }
        return undefined;
    }, [errorMessage, hasAnimatedContent, isLoading, visibleIndicators.length]);

    React.useLayoutEffect(() => {
        if (!shouldShowSidePanel) {
            setOpenLayoutHeight(null);
            return;
        }

        const updateOpenLayoutHeight = () => {
            const layout = layoutRef.current;

            if (!layout) {
                return;
            }

            const layoutTop = layout.getBoundingClientRect().top;
            const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
            setOpenLayoutHeight(Math.max(420, Math.floor(viewportHeight - layoutTop - 12)));
        };

        updateOpenLayoutHeight();
        const animationFrame = window.requestAnimationFrame(updateOpenLayoutHeight);
        window.addEventListener('resize', updateOpenLayoutHeight);
        window.visualViewport?.addEventListener('resize', updateOpenLayoutHeight);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', updateOpenLayoutHeight);
            window.visualViewport?.removeEventListener('resize', updateOpenLayoutHeight);
        };
    }, [shouldShowSidePanel]);

    return (
        <section className="standard-tab-shell economic-indicator-page grid min-w-0 gap-4">
            {/* 1. 헤더: 0초 등장 */}
            <FadeIn as="header" delay={0} className="page-tab-header page-tab-header-after-news">
                <div className="min-w-0">
                    <p className="page-tab-eyebrow">KOREA INDICATORS</p>
                    <h2 className="page-tab-title">경제지표</h2>
                    <p className="page-tab-description">금리, 물가, 무역수지, 외환보유액처럼 원화 흐름을 해석할 때 함께 보는 지표를 정리합니다.</p>
                </div>
                <div className="grid min-w-0 justify-items-start gap-1 md:justify-items-end">
                    <div className="page-tab-meta">
                        <ChartHelpTooltip ariaLabel="경제지표 수집 정보" title="경제지표 수집 정보" widthClassName="w-80">
                            <p className="mt-1">수집 지표 {collectedIndicators.length}개</p>
                            <p className="mt-1">{cleanLatestSyncLabel}</p>
                        </ChartHelpTooltip>
                    </div>
                </div>
            </FadeIn>

            <div
                className={`grid min-w-0 gap-4 ${shouldShowSidePanel ? 'economic-indicator-layout-open' : ''}`}
                ref={layoutRef}
                style={openLayoutHeight ? { height: `${openLayoutHeight}px` } : undefined}
            >
                {/* 2. 네비게이션 탭 */}
                <FadeIn as="nav" delay={0.08} className="economic-indicator-tabs-row grid min-w-0 grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1 sm:block" aria-label="국내 현황 범주">
                    <SectionTabScrollButton direction="left" onClick={() => scrollSectionTabs(-1)} />
                    <div className="glass-card flex min-w-0 items-stretch rounded-full p-0.5 shadow-sm sm:items-center sm:justify-between">
                        <div className="scrollbar-none relative flex max-w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden" ref={sectionTabNavRef}>
                            <MovingTabIndicator contained indicator={sectionTabIndicator} isMoving={isSectionTabIndicatorMoving} />
                            {sectionTabs.map((tab) => (
                                <button
                                    className={`relative z-10 h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 sm:px-3 ${
                                        activeSectionLabelKey === tab.key ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
                                    }`}
                                    key={tab.key}
                                    onClick={() => {
                                        if (activeSectionKey !== tab.key) {
                                            startSectionTabIndicatorMoving();
                                        }
                                        setActiveSectionKey(tab.key);
                                    }}
                                    ref={(node) => {
                                        sectionTabButtonRefs.current[tab.key] = node;
                                    }}
                                    style={sectionTabButtonWidth > 0 ? { width: sectionTabButtonWidth } : undefined}
                                    type="button"
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <SectionTabScrollButton direction="right" onClick={() => scrollSectionTabs(1)} />
                </FadeIn>

                <div className={`grid min-w-0 gap-4 ${shouldShowSidePanel ? 'economic-indicator-list-scroll' : ''}`}>
                    {isLoading ? (
                        <FadeIn delay={0.24} className="glass-card min-w-0 rounded-2xl p-6 text-sm text-white/60 shadow-sm">국내 정책 지표를 확인 중입니다.</FadeIn>
                    ) : errorMessage ? (
                        <FadeIn delay={0.24} className="glass-card grid min-h-32 place-items-center rounded-2xl px-4 text-center text-sm font-medium text-zinc-700 shadow-sm">{errorMessage}</FadeIn>
                    ) : (
                        <div className={`${hasAnimatedContent ? 'content-smooth-refresh' : ''} grid min-w-0 gap-4`} key={activeSectionKey}>
                            {visibleSections.map((section, index) => {
                                const sectionIndicators = section.codes
                                    .map((code) => indicatorMap.get(code))
                                    .filter((indicator): indicator is DomesticIndicator => Boolean(indicator));

                                if (sectionIndicators.length === 0) {
                                    return null;
                                }

                                const sectionContent = (
                                    <>
                                        <div className="mb-3 border-b border-white/10 pb-3">
                                            <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                                            <p className="mt-1 text-xs text-white/60">{section.description}</p>
                                        </div>
                                        <PolicyIndicatorTable indicators={sectionIndicators} onInfoOpen={openIndicatorPanel} selectedCode={displayedIndicator?.code ?? null} />
                                    </>
                                );

                                return hasAnimatedContent ? (
                                    <section className="economic-indicator-list-section glass-card min-w-0 rounded-2xl p-4 shadow-sm" key={section.title}>
                                        {sectionContent}
                                    </section>
                                ) : (
                                    <FadeIn as="section" delay={0.18 + index * 0.06} className="economic-indicator-list-section glass-card min-w-0 rounded-2xl p-4 shadow-sm" key={section.title}>
                                        {sectionContent}
                                    </FadeIn>
                                );
                            })}
                        </div>
                    )}
                </div>
                {shouldShowSidePanel ? (
                    <aside className={`economic-indicator-side-panel-shell min-w-0 ${hasAnimatedContent ? '' : 'economic-indicator-side-panel-enter'}`}>
                        {displayedIndicator ? (
                            <IndicatorInfoPanel
                                indicator={displayedIndicator}
                                onClose={() => {
                                    setIsIndicatorPanelDismissed(true);
                                    setSelectedIndicator(null);
                                }}
                            />
                        ) : (
                            <IndicatorEmptyPanel />
                        )}
                    </aside>
                ) : null}
            </div>
            {!shouldShowSidePanel && canShowIndicatorDetails ? (
                <IndicatorInfoModal
                    indicator={selectedIndicator}
                    onClose={() => setSelectedIndicator(null)}
                />
            ) : null}
        </section>
    );
}

function SectionTabScrollButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
    return (
        <button
            aria-label={direction === 'left' ? '이전 지표 범주 보기' : '다음 지표 범주 보기'}
            className="grid h-7 w-7 place-items-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-950 sm:hidden"
            onClick={onClick}
            type="button"
        >
            {direction === 'left' ? '‹' : '›'}
        </button>
    );
}

function PolicyIndicatorTable({
                                  indicators,
                                  onInfoOpen,
                                  selectedCode
                              }: {
    indicators: DomesticIndicator[];
    onInfoOpen: (indicator: DomesticIndicator, anchor?: HTMLElement | null) => void;
    selectedCode?: string | null;
}) {
    return (
        <div className="economic-indicator-compact-list grid min-w-0 gap-2">
            {indicators.map((indicator) => {
                const isPending = indicator.status === '연동 필요';
                const isSelected = selectedCode === indicator.code;
                return (
                    <article
                        aria-label={`${indicator.title} 상세 보기`}
                        className={`economic-indicator-compact-row group/row min-w-0 cursor-pointer border transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-100/45 motion-reduce:transition-none ${
                            isSelected ? 'border-teal-300/65 bg-teal-400/12 shadow-[0_0_0_1px_rgba(82,214,199,0.22)]' : isPending ? 'border-amber-300/40 bg-amber-400/10' : 'border-white/10 bg-white/5'
                        }`}
                        key={indicator.code}
                        onClick={(event) => onInfoOpen(indicator, event.currentTarget)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onInfoOpen(indicator, event.currentTarget);
                            }
                        }}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <h4 className="min-w-0 truncate text-xs font-extrabold text-white">{indicator.title}</h4>
                                <span className="shrink-0 border border-white/10 bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-white/55">{indicator.category}</span>
                            </div>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-white/45">
                                <span className="truncate">{formatIndicatorSource(indicator.source)}</span>
                                <span>{formatCollectedAt(indicator)}</span>
                            </div>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-3 md:justify-end">
                            <div className="min-w-0 whitespace-nowrap text-xs font-extrabold leading-none text-white md:text-right">
                                {formatIndicatorValue(indicator)}
                                <span className="ml-1 text-[11px] font-semibold text-white/45">{formatMetricUnit(indicator.unit)}</span>
                            </div>
                            <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-white/50 md:justify-end">
                                <span>기준 {indicator.baseDate ?? '-'}</span>
                                <span className={`border px-1.5 py-0.5 ${isPending ? 'border-amber-300/35 text-amber-100' : 'border-teal-300/25 text-teal-100'}`}>
                                    {collectionStatusLabel(indicator)}
                                </span>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

function IndicatorInfoModal({
                                indicator,
                                onClose
                            }: {
    indicator: DomesticIndicator | null;
    onClose: () => void;
}) {
    React.useEffect(() => {
        if (!indicator) {
            return;
        }

        return lockBodyScroll();
    }, [indicator]);

    React.useEffect(() => {
        if (!indicator) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [indicator, onClose]);

    if (!indicator) {
        return null;
    }

    return createPortal(
        <div className="modal-overlay responsive-modal-overlay fixed inset-0 z-[100] flex bg-zinc-950/35" onClick={onClose}>
            <div
                className="modal-panel responsive-modal-panel economic-indicator-responsive-modal overflow-hidden"
                onClick={(event) => event.stopPropagation()}
            >
                <IndicatorInfoPanel indicator={indicator} onClose={onClose} />
            </div>
        </div>,
        document.body
    );
}

function IndicatorInfoPanel({
                                indicator,
                                onClose
                            }: {
    indicator: DomesticIndicator | null;
    onClose: () => void;
}) {
    const [historyRange, setHistoryRange] = React.useState<HistoryRangeKey>('3Y');
    const [history, setHistory] = React.useState<DomesticIndicatorHistoryResponse | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
    const [historyError, setHistoryError] = React.useState<string | null>(null);
    const previousHistoryIndicatorCodeRef = React.useRef<string | null>(null);
    const hasChart = indicator !== null && shouldShowHistoryChart(indicator);
    const indicatorCode = indicator?.code ?? null;
    const indicatorUnit = indicator?.unit ?? null;

    React.useEffect(() => {
        if (!indicator) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [indicator, onClose]);

    React.useEffect(() => {
        if (!indicatorCode || indicatorUnit === 'DOCUMENT') {
            previousHistoryIndicatorCodeRef.current = null;
            setHistory(null);
            setHistoryError(null);
            setIsHistoryLoading(false);
            return;
        }

        let ignore = false;
        if (previousHistoryIndicatorCodeRef.current !== indicatorCode) {
            previousHistoryIndicatorCodeRef.current = indicatorCode;
            setHistory(null);
        }
        setIsHistoryLoading(true);
        setHistoryError(null);

        axios.get<DomesticIndicatorHistoryResponse>(`/api/v1/dashboard/domestic-indicators/${encodeURIComponent(indicatorCode)}/history`, {
            params: { range: historyRange }
        })
            .then((response) => {
                if (!ignore) {
                    setHistory(response.data);
                    if (response.data.range !== historyRange) {
                        setHistoryRange(response.data.range);
                    }
                }
            })
            .catch(() => {
                if (!ignore) {
                    setHistory(null);
                    setHistoryError('지표 흐름을 불러오지 못했습니다.');
                }
            })
            .finally(() => {
                if (!ignore) {
                    setIsHistoryLoading(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, [historyRange, indicatorCode, indicatorUnit]);

    if (!indicator) {
        return null;
    }

    return (
        <section className="economic-indicator-side-panel glass-modal min-w-0 overflow-hidden text-sm shadow-xl">
            <div className="economic-indicator-side-panel-scroll modal-scroll-area overflow-y-auto p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-teal-100">{indicator.category}</p>
                        <h3 className="mt-1 text-base font-semibold text-white">{indicator.title}</h3>
                    </div>
                    <button
                        aria-label="경제지표 닫기"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-none border border-white/10 bg-white/8 text-lg font-semibold leading-none text-white/70 transition-colors hover:border-teal-300/45 hover:bg-teal-400/12 hover:text-teal-100"
                        onClick={onClose}
                        type="button"
                    >
                        ×
                    </button>
                </div>
                {hasChart ? (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-zinc-800">지표 흐름</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">
                                    {history ? `${history.startDate} - ${history.endDate} · ${history.points.length}개 관측치` : '저장된 흐름을 불러오는 중입니다.'}
                                </p>
                            </div>
                            <HistoryRangeSelector history={history} value={historyRange} onChange={setHistoryRange} />
                        </div>
                        <div>
                            <DomesticIndicatorHistoryChart
                                history={history}
                                indicator={indicator}
                                isLoading={isHistoryLoading}
                                error={historyError}
                            />
                        </div>
                    </div>
                ) : null}
                <dl className="mt-3 grid gap-2 border border-zinc-200 bg-white p-3 text-[11px] shadow-sm md:grid-cols-2">
                    <InfoPanelRow label="현재 수치" value={`${formatIndicatorValue(indicator)} ${formatMetricUnit(indicator.unit)}`} />
                    <InfoPanelRow label="기준일" value={indicator.baseDate ?? '-'} />
                    <InfoPanelRow label="이전 기준" value={indicator.previousBaseDate ?? '-'} />
                    <InfoPanelRow label="출처" value={formatIndicatorSource(indicator.source)} />
                    <InfoPanelRow label="수집일" value={formatCollectedAt(indicator)} />
                    <InfoPanelRow label="최신성" value={indicator.freshnessReason ?? collectionStatusLabel(indicator)} />
                </dl>
                {(indicator.componentFreshnesses ?? []).length > 0 ? (
                    <div className="mt-3 border border-zinc-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-semibold text-zinc-700">계산에 사용한 데이터</p>
                        <div className="mt-2 grid gap-1.5">
                            {(indicator.componentFreshnesses ?? []).map((component) => (
                                <div className="grid gap-x-3 gap-y-1 bg-zinc-50 p-2 text-[10px] text-zinc-500 2xl:grid-cols-[minmax(0,1fr)_86px_86px_56px]" key={component.code}>
                                    <span className="min-w-0 font-semibold text-zinc-800">{component.title}</span>
                                    <span>기준 {component.baseDate ?? '-'}</span>
                                    <span>수집 {component.fetchedAt ? component.fetchedAt.slice(0, 10) : '-'}</span>
                                    <span>{component.freshnessReason ?? component.freshnessStatus}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-xs leading-5 text-zinc-700 shadow-sm">
                    {indicator.krwImpact}
                </div>
                <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-xs leading-5 text-zinc-600 shadow-sm">
                    <p className="font-semibold text-zinc-800">수집 기준</p>
                    <p className="mt-1">{indicator.note}</p>
                </div>
                {indicator.sourceUrl ? (
                    <div className="mt-4 flex justify-end">
                        <a
                            className="inline-flex h-8 items-center text-[11px] font-semibold text-zinc-950 underline-offset-4 hover:underline"
                            href={indicator.sourceUrl}
                            rel="noreferrer"
                            target="_blank"
                        >
                            출처에서 보기
                        </a>
                    </div>
                ) : null}
            </div>
        </section>
    );
}

function IndicatorEmptyPanel() {
    return (
        <section className="economic-indicator-side-panel glass-modal grid min-w-0 place-items-center overflow-hidden text-sm shadow-xl">
            <div className="max-w-sm px-6 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center border border-teal-300/35 bg-teal-400/10 text-xl font-black text-teal-100">‹</div>
                <h3 className="mt-4 text-base font-extrabold text-white">원하시는 항목을 선택하세요</h3>
                <p className="mt-2 text-xs leading-5 text-white/55">좌측 경제지표 리스트에서 항목을 선택하면 상세 수치, 지표 흐름, 수집 기준을 이 영역에서 볼 수 있습니다.</p>
            </div>
        </section>
    );
}

function HistoryRangeSelector({
                                  history,
                                  onChange,
                                  value
                              }: {
    history: DomesticIndicatorHistoryResponse | null;
    onChange: (value: HistoryRangeKey) => void;
    value: HistoryRangeKey;
}) {
    const options = React.useMemo(
        () => (history ? historyRangeOptions.filter((option) => history.availableRanges.includes(option.key)) : historyRangeOptions),
        [history]
    );
    const optionKeys = React.useMemo(() => options.map((option) => option.key), [options]);
    const { buttonRefs, containerRef, indicator, isMoving, labelActiveKey, startMoving } = useMovingTabIndicator({
        activeKey: value,
        keys: optionKeys
    });

    if (options.length === 0) {
        return (
            <div className="rounded border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/55">
                기간 없음
            </div>
        );
    }

    return (
        <div className="relative inline-flex h-8 shrink-0 rounded-full border border-zinc-200 bg-white p-0.5 shadow-sm" ref={containerRef}>
            <MovingTabIndicator contained indicator={indicator} isMoving={isMoving} />
            {options.map((option) => (
                <button
                    className={`relative z-10 inline-flex h-full min-w-14 items-center justify-center rounded-full px-3 text-center text-[13px] font-semibold leading-none transition-colors duration-150 ${
                        labelActiveKey === option.key ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'
                    }`}
                    key={option.key}
                    onClick={() => {
                        if (value !== option.key) {
                            startMoving();
                        }
                        onChange(option.key);
                    }}
                    ref={(node) => {
                        buttonRefs.current[option.key] = node;
                    }}
                    type="button"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function shouldShowHistoryChart(indicator: DomesticIndicator) {
    return indicator.unit !== 'DOCUMENT';
}

function DomesticIndicatorHistoryChart({
                                           error,
                                           history,
                                           indicator,
                                           isLoading
                                       }: {
    error: string | null;
    history: DomesticIndicatorHistoryResponse | null;
    indicator: DomesticIndicator;
    isLoading: boolean;
}) {
    if (isLoading && !history) {
        return (
            <div className="mt-4">
                <div className="chart-grid-surface h-72 px-3 py-4" aria-busy="true" aria-label="지표 흐름 로딩 중" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-4 h-72">
                <ChartEmptyState>{error}</ChartEmptyState>
            </div>
        );
    }

    if (!history || history.points.length === 0) {
        return (
            <div className="mt-4 h-72">
                <ChartEmptyState>선택한 기간에 표시할 흐름 데이터가 없습니다.</ChartEmptyState>
            </div>
        );
    }

    const yDomain = getHistoryValueDomain(history.points);

    return (
        <div className="mt-4">
            <div className="chart-grid-surface h-72 rounded-2xl px-3 py-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history.points} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
                        <XAxis
                            dataKey="baseDate"
                            tick={{ fontSize: 10, fill: 'rgba(75,85,99,0.82)' }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={28}
                            tickFormatter={formatHistoryTick}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: 'rgba(75,85,99,0.82)' }}
                            tickLine={false}
                            axisLine={false}
                            width={52}
                            domain={yDomain}
                            tickFormatter={(value) => formatHistoryAxisValue(Number(value), history.unit)}
                        />
                        <Tooltip content={<HistoryTooltip title={history.title} unit={history.unit} />} />
                        {history.averageValue !== null ? (
                            <ReferenceLine
                                y={history.averageValue}
                                stroke="rgba(203,213,225,0.7)"
                                strokeDasharray="4 4"
                                ifOverflow="extendDomain"
                            />
                        ) : null}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#00C9A7"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: '#00C9A7', stroke: '#ffffff', strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span>현재 {formatIndicatorValue(indicator)} {formatMetricUnit(indicator.unit)}</span>
                {history.averageValue !== null ? <span>기간 평균 {formatHistoryValue(history.averageValue, history.unit)}</span> : null}
            </div>
        </div>
    );
}

function getHistoryValueDomain(points: TimeSeriesPoint[]): [number, number] {
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = Math.abs(maxValue - minValue);
    const padding = Math.max(valueRange * 0.12, Math.abs(maxValue) * 0.02, 1);
    const lowerBound = Math.floor(minValue - padding);
    const upperBound = Math.ceil(maxValue + padding);

    if (upperBound <= lowerBound) {
        return [lowerBound, lowerBound + 1];
    }

    return [lowerBound, upperBound];
}

function HistoryTooltip({
                            active,
                            payload,
                            title,
                            unit
                        }: {
    active?: boolean;
    payload?: Array<{ payload?: TimeSeriesPoint; value?: number }>;
    title: string;
    unit: string;
}) {
    const point = payload?.[0]?.payload;
    if (!active || !point) {
        return null;
    }

    return (
        <div className="chart-hover-tooltip w-48 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 shadow-lg shadow-zinc-950/10">
            <p className="font-semibold text-zinc-950">{title}</p>
            <dl className="mt-2 grid gap-1.5">
                <TooltipRow label="날짜" value={point.baseDate} />
                <TooltipRow label="값" value={formatHistoryValue(point.value, unit)} />
            </dl>
        </div>
    );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-400">{label}</dt>
            <dd className="font-semibold text-zinc-800">{value}</dd>
        </div>
    );
}

function InfoPanelRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="min-w-0 break-words font-medium text-zinc-800">{value}</dd>
        </div>
    );
}

function formatIndicatorValue(indicator: DomesticIndicator) {
    if (indicator.value === null) {
        return '-';
    }

    return formatHistoryValue(indicator.value, indicator.unit);
}

function formatHistoryValue(value: number, unit: string) {
    if (unit === 'PERCENT' || unit === 'PERCENT_POINT') {
        return formatValue(value, 2);
    }

    if (unit === 'USD_MILLION' || unit === 'USD_1000' || unit === 'KRW_100M' || unit === 'RANK') {
        return formatValue(value, 0);
    }

    if (unit === 'KRW_TRILLION') {
        return formatValue(value, 1);
    }

    if (unit === 'BASIS_POINT' || unit === 'DOCUMENT') {
        return formatValue(value, 0);
    }

    return formatValue(value, 2);
}

function formatHistoryAxisValue(value: number, unit: string) {
    if (unit === 'USD_MILLION' || unit === 'USD_1000' || unit === 'KRW_100M') {
        return formatValue(value, 0);
    }

    if (unit === 'KRW_TRILLION' || unit === 'PERCENT' || unit === 'PERCENT_POINT' || unit === 'INDEX' || unit === 'USD') {
        return formatValue(value, 1);
    }

    return formatValue(value, 0);
}

function formatHistoryTick(baseDate: string) {
    return baseDate.slice(2, 7).replace('-', '.');
}

function formatIndicatorSource(source: string | null): string {
    if (!source) {
        return '-';
    }

    const cleanSource = source.split('|', 1)[0];

    if (cleanSource.startsWith('Twelve Data')) {
        return 'Twelve Data 실시간 환율';
    }

    if (cleanSource.startsWith('FRED:')) {
        return '미국 연방준비은행 경제데이터';
    }

    if (cleanSource === 'FRED') {
        return '미국 연방준비은행 경제데이터';
    }

    if (cleanSource.startsWith('ECOS:')) {
        return '한국은행 경제통계시스템';
    }

    if (cleanSource === 'ECOS') {
        return '한국은행 경제통계시스템';
    }

    if (cleanSource.startsWith('OPENFISCAL:')) {
        return '열린재정 재정정보';
    }

    if (cleanSource.startsWith('KOREAEXIM') || cleanSource.startsWith('Koreaexim')) {
        return '한국수출입은행 환율정보';
    }

    if (cleanSource.includes('/')) {
        return cleanSource
            .split('/')
            .map((part) => formatIndicatorSource(part))
            .join(' / ');
    }

    return cleanSource
        .replace(/_/g, ' ')
        .replace(/:/g, ' ');
}

function formatCollectedAt(indicator: DomesticIndicator) {
    return indicator.fetchedAt ? indicator.fetchedAt.slice(0, 10) : '-';
}

function collectionStatusLabel(indicator: DomesticIndicator) {
    if (indicator.status === '연동 필요') {
        return '대기';
    }

    if (indicator.freshnessStatus === 'STALE') {
        return '지연';
    }

    if (indicator.value === null || indicator.status === '데이터 없음') {
        return '대기';
    }

    return '정상';
}
