import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartEmptyState } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import type { DomesticIndicator, DomesticIndicatorHistoryResponse, HistoryRangeKey, TimeSeriesPoint } from '../types';
import { formatMetricUnit, formatValue } from '../utils/format';
import { lockBodyScroll } from '../utils/scrollLock';

type KoreaStatusPageProps = {
  errorMessage?: string | null;
  indicators: DomesticIndicator[];
  isLoading: boolean;
  latestSyncLabel: string;
  statusNode?: React.ReactNode;
};

const sections = [
  {
    key: 'policy',
    label: '정책',
    title: '통화정책 압력',
    description: '기준금리, 금리차, 통화량은 원화 보유 유인과 원화 공급을 바꿉니다.',
    codes: ['KR_POLICY_RATE', 'US_POLICY_RATE', 'KR_US_RATE_GAP', 'M2']
  },
  {
    key: 'policy',
    label: '정책',
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
    codes: ['FOREIGN_STOCK_FLOW', 'FOREIGN_BOND_FLOW', 'US_10Y_TREASURY', 'VIX', 'KOREA_CDS']
  }
];

const sectionTabs = [
  { key: 'all', label: '전체' },
  { key: 'external', label: '대외수급' },
  { key: 'policy', label: '정책' },
  { key: 'inflation', label: '물가·원자재' },
  { key: 'risk', label: '자본·리스크' }
];

const sectionTabMinButtonWidth = 96;

const historyRangeOptions: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: '1Y', label: '1년' },
  { key: '3Y', label: '3년' },
  { key: '5Y', label: '5년' }
];

export function KoreaStatusPage({ errorMessage, indicators, isLoading, latestSyncLabel, statusNode }: KoreaStatusPageProps) {
  const [activeSectionKey, setActiveSectionKey] = React.useState(sectionTabs[0].key);
  const [viewMode, setViewMode] = React.useState<'card' | 'list'>('list');
  const [selectedIndicator, setSelectedIndicator] = React.useState<DomesticIndicator | null>(null);
  const sectionTabKeys = React.useMemo(() => sectionTabs.map((tab) => tab.key), []);
  const {
    buttonRefs: sectionTabButtonRefs,
    buttonWidth: sectionTabButtonWidth,
    containerRef: sectionTabNavRef,
    indicator: sectionTabIndicator,
    isMoving: isSectionTabIndicatorMoving,
    startMoving: startSectionTabIndicatorMoving
  } = useMovingTabIndicator({
    activeKey: activeSectionKey,
    equalizeButtonWidths: true,
    keys: sectionTabKeys,
    minButtonWidth: sectionTabMinButtonWidth
  });
  const indicatorMap = new Map(indicators.map((indicator) => [indicator.code, indicator]));
  const collectedIndicators = indicators.filter((indicator) => indicator.value !== null);
  const visibleSections = activeSectionKey === 'all' ? sections : sections.filter((section) => section.key === activeSectionKey);

  return (
    <section className="grid min-w-0 gap-4">
      <header className="glass-card min-w-0 rounded-2xl px-4 py-3 shadow-sm">
        <div className="grid gap-2">
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold text-teal-100">관련 지표</p>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-white">원화 관련 정책·거시 지표</h2>
              <SummaryBox label="수집 지표" value={`${collectedIndicators.length}개`} />
            </div>
            <p className="mt-1 truncate text-[11px] text-white/60">{latestSyncLabel}</p>
          </div>
          <div className="flex min-w-0 justify-start md:justify-end">
            {statusNode}
          </div>
        </div>
      </header>

      <nav className="glass-card flex min-w-0 flex-col items-stretch gap-2 rounded-2xl p-1 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:rounded-full" aria-label="국내 현황 범주">
        <div className="scrollbar-none relative flex max-w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden lg:overflow-visible" ref={sectionTabNavRef}>
          <MovingTabIndicator contained indicator={sectionTabIndicator} isMoving={isSectionTabIndicatorMoving} />
          {sectionTabs.map((tab) => (
            <button
              className={`relative z-10 h-10 rounded-full px-3 text-xs font-semibold transition-colors duration-150 sm:px-4 ${
                activeSectionKey === tab.key ? 'text-white' : 'text-white/60 hover:text-white'
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
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </nav>

      {isLoading ? (
        <div className="glass-card min-w-0 rounded-2xl p-6 text-sm text-white/60 shadow-sm">국내 정책 지표를 확인 중입니다.</div>
      ) : errorMessage ? (
        <div className="glass-card min-w-0 rounded-2xl p-6 text-sm text-rose-100 shadow-sm">{errorMessage}</div>
      ) : (
        <div className="page-content-enter grid min-w-0 gap-4" key={activeSectionKey}>
          {visibleSections.map((section) => {
            const sectionIndicators = section.codes
              .map((code) => indicatorMap.get(code))
              .filter((indicator): indicator is DomesticIndicator => Boolean(indicator));

            if (sectionIndicators.length === 0) {
              return null;
            }

            return (
              <section className="glass-card min-w-0 rounded-2xl p-4 shadow-sm" key={section.title}>
                <div className="mb-3 border-b border-white/10 pb-3">
                  <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                  <p className="mt-1 text-xs text-white/60">{section.description}</p>
                </div>
                {viewMode === 'card' ? (
                  <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {sectionIndicators.map((indicator) => (
                      <PolicyIndicatorCard indicator={indicator} key={indicator.code} onInfoOpen={setSelectedIndicator} />
                    ))}
                  </div>
                ) : (
                  <PolicyIndicatorTable indicators={sectionIndicators} onInfoOpen={setSelectedIndicator} />
                )}
                <IndicatorSourceSummary indicators={sectionIndicators} />
              </section>
            );
          })}
        </div>
      )}

      <IndicatorInfoPanel indicator={selectedIndicator} onClose={() => setSelectedIndicator(null)} />
    </section>
  );
}

function ViewModeToggle({
  onChange,
  value
}: {
  onChange: (value: 'card' | 'list') => void;
  value: 'card' | 'list';
}) {
  const viewModeKeys = React.useMemo(() => ['card', 'list'] as const, []);
  const { buttonRefs, containerRef, indicator, isMoving, startMoving } = useMovingTabIndicator({
    activeKey: value,
    keys: viewModeKeys
  });

  return (
    <div className="relative grid h-8 shrink-0 grid-cols-2 overflow-hidden rounded-full border border-white/15 bg-white/10 p-0.5" ref={containerRef}>
      <MovingTabIndicator compact contained indicator={indicator} isMoving={isMoving} />
      <button
        className={`relative z-10 h-7 min-w-12 rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 ${value === 'card' ? 'text-white' : 'text-white/60 hover:text-white'}`}
        onClick={() => {
          if (value !== 'card') {
            startMoving();
          }
          onChange('card');
        }}
        ref={(node) => {
          buttonRefs.current.card = node;
        }}
        type="button"
      >
        카드
      </button>
      <button
        className={`relative z-10 h-7 min-w-12 rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 ${value === 'list' ? 'text-white' : 'text-white/60 hover:text-white'}`}
        onClick={() => {
          if (value !== 'list') {
            startMoving();
          }
          onChange('list');
        }}
        ref={(node) => {
          buttonRefs.current.list = node;
        }}
        type="button"
      >
        리스트
      </button>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/55">
      <span>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </span>
  );
}

function PolicyIndicatorCard({
  indicator,
  onInfoOpen
}: {
  indicator: DomesticIndicator;
  onInfoOpen: (indicator: DomesticIndicator) => void;
}) {
  const isPending = indicator.status === '연동 필요';

  return (
    <article
      aria-label={`${indicator.title} 상세 보기`}
      className={`group/card min-w-0 cursor-pointer rounded-2xl border p-3 transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/12 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100 motion-reduce:transform-none motion-reduce:transition-none ${isPending ? 'border-amber-300/40 bg-amber-400/15' : 'border-white/10 bg-white/8 shadow-sm'}`}
      onClick={() => onInfoOpen(indicator)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onInfoOpen(indicator);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0 transition-transform duration-150 ease-out group-hover/card:scale-[1.01] motion-reduce:transform-none motion-reduce:transition-none">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-white/45">{indicator.category}</div>
            <h4 className="mt-0.5 truncate text-sm font-semibold text-white">{indicator.title}</h4>
          </div>
          <CollectionStatusDot indicator={indicator} />
        </div>

        <div className="mt-3 min-w-0">
          <div className="break-words text-lg font-semibold text-white sm:text-xl">{formatIndicatorValue(indicator)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/55">
            <span>{formatMetricUnit(indicator.unit)}</span>
            <span>기준 {indicator.baseDate ?? '-'}</span>
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-4 text-white/45">
          수집 {formatCollectedAt(indicator)}
        </div>
      </div>
    </article>
  );
}

function PolicyIndicatorTable({
  indicators,
  onInfoOpen
}: {
  indicators: DomesticIndicator[];
  onInfoOpen: (indicator: DomesticIndicator) => void;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-full table-fixed border-separate border-spacing-0 text-left md:min-w-[620px]">
        <thead>
          <tr className="text-[11px] font-semibold text-white/45">
            <th className="w-[28%] border-b border-white/10 px-2 py-2 md:w-[40%]">지표</th>
            <th className="w-[34%] border-b border-white/10 px-2 py-2 text-right md:w-[26%] md:text-left">현재 수치</th>
            <th className="w-[26%] border-b border-white/10 px-2 py-2 text-right md:w-[24%]">기준일</th>
            <th className="w-[12%] border-b border-white/10 px-2 py-2 text-right md:w-[10%]">수집</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((indicator) => {
            const isPending = indicator.status === '연동 필요';
            return (
              <tr
                aria-label={`${indicator.title} 상세 보기`}
                className={`group/row cursor-pointer transition-colors duration-150 ease-out hover:bg-white/10 focus:bg-white/10 focus:outline-none motion-reduce:transition-none ${isPending ? 'bg-amber-400/10' : 'bg-white/5'}`}
                key={indicator.code}
                onClick={() => onInfoOpen(indicator)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onInfoOpen(indicator);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <td className="border-b border-white/10 px-2 py-2">
                  <div className="min-w-0 transition-transform duration-150 ease-out group-hover/row:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
                    <div className="break-words text-xs font-semibold text-white sm:truncate">{indicator.title}</div>
                    <div className="break-words text-[10px] font-medium text-white/45 sm:truncate">{indicator.category}</div>
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right md:text-left">
                  <div className="transition-transform duration-150 ease-out group-hover/row:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
                    <div className="whitespace-nowrap text-xs font-semibold text-white sm:truncate sm:text-sm">
                      {formatIndicatorValue(indicator)} <span className="text-[11px] font-medium text-white/45">{formatMetricUnit(indicator.unit)}</span>
                    </div>
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right">
                  <div className="whitespace-nowrap text-xs text-white/65 transition-transform duration-150 ease-out group-hover/row:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
                    {indicator.baseDate ?? '-'}
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right">
                  <CollectionStatusDot indicator={indicator} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
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
  const hasChart = indicator !== null && shouldShowHistoryChart(indicator);

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

  React.useEffect(() => {
    if (!indicator || !shouldShowHistoryChart(indicator)) {
      setHistory(null);
      setHistoryError(null);
      setIsHistoryLoading(false);
      return;
    }

    let ignore = false;
    setIsHistoryLoading(true);
    setHistoryError(null);

    axios.get<DomesticIndicatorHistoryResponse>(`/api/v1/dashboard/domestic-indicators/${encodeURIComponent(indicator.code)}/history`, {
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
          setHistoryError('과거 데이터를 불러오지 못했습니다.');
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
  }, [historyRange, indicator]);

  if (!indicator) {
    return null;
  }

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/35 px-4 py-6" onClick={onClose}>
      <section
        className="modal-panel modal-scroll-area glass-modal max-h-[min(760px,calc(100vh-3rem))] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 text-sm shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-100">{indicator.category}</p>
            <h3 className="mt-1 text-base font-semibold text-white">{indicator.title}</h3>
          </div>
          <button
            className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-xs font-semibold text-white/60 hover:text-white"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-white/8 p-4 text-xs md:grid-cols-2">
          <InfoPanelRow label="현재 수치" value={`${formatIndicatorValue(indicator)} ${formatMetricUnit(indicator.unit)}`} />
          <InfoPanelRow label="기준일" value={indicator.baseDate ?? '-'} />
          <InfoPanelRow label="관측 시각" value={formatObservedAt(indicator)} />
          <InfoPanelRow label="이전 기준" value={indicator.previousBaseDate ?? '-'} />
          <InfoPanelRow label="출처" value={indicator.source} />
          <InfoPanelRow label="수집일" value={formatCollectedAt(indicator)} />
          <InfoPanelRow label="최신성" value={indicator.freshnessReason ?? collectionStatusLabel(indicator)} />
        </dl>
        {(indicator.componentFreshnesses ?? []).length > 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4">
            <p className="text-xs font-semibold text-white/70">계산 구성 원천</p>
            <div className="mt-3 grid gap-2">
              {(indicator.componentFreshnesses ?? []).map((component) => (
                <div className="grid gap-x-3 gap-y-1 rounded-lg bg-white/5 p-3 text-[11px] text-white/55 md:grid-cols-[minmax(0,1fr)_96px_96px_64px]" key={component.code}>
                  <span className="min-w-0 font-semibold text-white/80">{component.title}</span>
                  <span>기준 {component.baseDate ?? '-'}</span>
                  <span>수집 {component.fetchedAt ? component.fetchedAt.slice(0, 10) : '-'}</span>
                  <span>{component.freshnessReason ?? component.freshnessStatus}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {indicator.sourceUrl ? (
          <div className="mt-5 rounded-2xl border border-teal-300/20 bg-teal-400/10 p-4">
            <p className="text-xs font-semibold text-teal-100">원천 링크</p>
            <p className="mt-1 text-xs leading-5 text-teal-50/75">{indicator.title}</p>
            <a
              className="mt-3 inline-flex h-8 items-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
              href={indicator.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              원천에서 보기
            </a>
          </div>
        ) : null}
        {hasChart ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">과거 흐름</p>
                <p className="mt-0.5 text-[11px] text-white/55">
                  {history ? `${history.startDate} - ${history.endDate} · ${history.points.length}개 관측치` : '기간별 저장 데이터를 조회합니다.'}
                </p>
              </div>
              <HistoryRangeSelector history={history} value={historyRange} onChange={setHistoryRange} />
            </div>
            <div className="chart-range-enter" key={`${indicator.code}-${history?.range ?? historyRange}-${history?.endDate ?? ''}`}>
              <DomesticIndicatorHistoryChart
                history={history}
                indicator={indicator}
                isLoading={isHistoryLoading}
                error={historyError}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-5 rounded-2xl bg-white/8 p-4 text-xs leading-5 text-white/75">
          {indicator.krwImpact}
        </div>
        <div className="mt-3 rounded-2xl bg-white/8 p-4 text-xs leading-5 text-white/65">
          <p className="font-semibold text-white/80">수집 기준</p>
          <p className="mt-1">{indicator.note}</p>
        </div>
      </section>
    </div>,
    document.body
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
  const { buttonRefs, containerRef, indicator, isMoving, startMoving } = useMovingTabIndicator({
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
    <div className="relative inline-flex h-10 shrink-0 rounded-full border border-white/15 bg-white/10 p-0.5" ref={containerRef}>
      <MovingTabIndicator indicator={indicator} isMoving={isMoving} />
      {options.map((option) => (
        <button
          className={`relative z-10 inline-flex h-full min-w-14 items-center justify-center rounded-full px-3 text-center text-xs font-semibold leading-none transition-colors duration-150 ${
            value === option.key ? 'text-white' : 'text-white/60 hover:text-white'
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
      <div className="mt-4 h-72">
        <ChartEmptyState>과거 데이터를 불러오는 중입니다.</ChartEmptyState>
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
        <ChartEmptyState>선택한 기간에 표시할 과거 데이터가 없습니다.</ChartEmptyState>
      </div>
    );
  }

  const chartData = history.points.map((point) => ({
    ...point,
    label: formatHistoryTick(point.baseDate)
  }));

  return (
    <div className="mt-4">
      <div className="chart-grid-surface h-72 rounded-2xl px-3 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.62)' }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.62)' }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={['auto', 'auto']}
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
              stroke="#5eead4"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#5eead4', stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
        <span>현재 {formatIndicatorValue(indicator)} {formatMetricUnit(indicator.unit)}</span>
        {history.averageValue !== null ? <span>기간 평균 {formatHistoryValue(history.averageValue, history.unit)}</span> : null}
      </div>
    </div>
  );
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
    <div className="chart-hover-tooltip w-48 rounded-md border border-white/15 bg-zinc-950/85 px-3 py-2 text-xs text-white shadow-sm backdrop-blur-md">
      <p className="font-semibold text-white">{title}</p>
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
      <dt className="text-white/45">{label}</dt>
      <dd className="font-semibold text-white/85">{value}</dd>
    </div>
  );
}

function InfoPanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-white/85">{value}</dd>
    </div>
  );
}

function IndicatorSourceSummary({ indicators }: { indicators: DomesticIndicator[] }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <h4 className="text-[11px] font-semibold text-white/55">지표별 출처</h4>
      <div className="mt-2 grid gap-x-4 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
        {indicators.map((indicator) => (
          <div className="min-w-0 text-[10px] leading-4 text-white/55" key={indicator.code}>
            <span className="font-semibold text-white/75">{indicator.title}</span>
            <span> · </span>
            <span>{indicator.source}</span>
            <span> · 수집 {formatCollectedAt(indicator)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionStatusDot({ indicator }: { indicator: DomesticIndicator }) {
  return (
    <span
      aria-label={`수집 상태 ${collectionStatusLabel(indicator)}`}
      className={`inline-flex h-3 w-3 shrink-0 rounded-full ${collectionStatusDotClassName(indicator)}`}
      title={`수집 상태 ${collectionStatusLabel(indicator)}`}
    />
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

function formatCollectedAt(indicator: DomesticIndicator) {
  return indicator.fetchedAt ? indicator.fetchedAt.slice(0, 10) : '-';
}

function formatObservedAt(indicator: DomesticIndicator) {
  return indicator.observedAt ? indicator.observedAt.replace('T', ' ').slice(0, 16) : '-';
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

function collectionStatusDotClassName(indicator: DomesticIndicator) {
  const label = collectionStatusLabel(indicator);
  if (label === '대기') {
    return 'bg-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]';
  }

  if (label === '지연') {
    return 'bg-rose-300 shadow-[0_0_0_3px_rgba(251,113,133,0.15)]';
  }

  return 'bg-teal-300 shadow-[0_0_0_3px_rgba(94,234,212,0.15)]';
}
