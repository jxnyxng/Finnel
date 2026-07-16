import React from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartEmptyState } from '../components/ChartElements';
import type { DataSourceInfo, DomesticIndicator, DomesticIndicatorHistoryResponse, HistoryRangeKey, TimeSeriesPoint } from '../types';
import { formatMetricUnit, formatValue } from '../utils/format';
import { lockBodyScroll } from '../utils/scrollLock';

type KoreaStatusPageProps = {
  indicators: DomesticIndicator[];
  dataSources: DataSourceInfo[];
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
    codes: ['KR_POLICY_RATE', 'US_POLICY_RATE', 'KR_US_RATE_GAP', 'M2', 'MPC_MINUTES']
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
  { key: 'risk', label: '자본·리스크' },
  { key: 'sources', label: '데이터 출처' }
];

const historyRangeOptions: Array<{ key: HistoryRangeKey; label: string }> = [
  { key: '1Y', label: '1년' },
  { key: '3Y', label: '3년' },
  { key: '5Y', label: '5년' }
];

export function KoreaStatusPage({ indicators, dataSources, isLoading, latestSyncLabel, statusNode }: KoreaStatusPageProps) {
  const [activeSectionKey, setActiveSectionKey] = React.useState(sectionTabs[0].key);
  const [viewMode, setViewMode] = React.useState<'card' | 'list'>('list');
  const [selectedIndicator, setSelectedIndicator] = React.useState<DomesticIndicator | null>(null);
  const sectionTabNavRef = React.useRef<HTMLDivElement | null>(null);
  const sectionTabButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [sectionTabIndicator, setSectionTabIndicator] = React.useState({ height: 0, left: 0, top: 0, width: 0 });
  const indicatorMap = new Map(indicators.map((indicator) => [indicator.code, indicator]));
  const collectedIndicators = indicators.filter((indicator) => indicator.value !== null);
  const visibleSections = activeSectionKey === 'all' ? sections : sections.filter((section) => section.key === activeSectionKey);

  React.useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = sectionTabNavRef.current;
      const button = sectionTabButtonRefs.current[activeSectionKey];
      if (!nav || !button) {
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const nextIndicator = {
        height: buttonRect.height,
        left: buttonRect.left - navRect.left,
        top: buttonRect.top - navRect.top,
        width: buttonRect.width
      };
      setSectionTabIndicator((current) => {
        if (
          current.height === nextIndicator.height &&
          current.left === nextIndicator.left &&
          current.top === nextIndicator.top &&
          current.width === nextIndicator.width
        ) {
          return current;
        }
        return nextIndicator;
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeSectionKey]);

  return (
    <section className="grid gap-4">
      <header className="glass-card rounded-2xl px-4 py-3 shadow-sm">
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

      <nav className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-full p-1 shadow-sm" aria-label="국내 현황 범주">
        <div className="relative flex flex-wrap gap-1" ref={sectionTabNavRef}>
          {sectionTabIndicator.width > 0 ? (
            <span
              className="moving-tab-indicator pointer-events-none absolute left-0 top-0 rounded-full bg-teal-600 transition-[transform,width,height] duration-200 ease-out"
              style={{
                height: sectionTabIndicator.height,
                transform: `translate(${sectionTabIndicator.left + 1}px, ${sectionTabIndicator.top - 1}px)`,
                width: Math.max(0, sectionTabIndicator.width - 2)
              }}
            />
          ) : null}
          {sectionTabs.map((tab) => (
            <button
              className={`relative z-10 h-10 rounded-full px-4 text-xs font-semibold transition-colors duration-150 ${
                activeSectionKey === tab.key ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              key={tab.key}
              onClick={() => setActiveSectionKey(tab.key)}
              ref={(node) => {
                sectionTabButtonRefs.current[tab.key] = node;
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeSectionKey !== 'sources' ? <ViewModeToggle value={viewMode} onChange={setViewMode} /> : null}
      </nav>

      {isLoading ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-white/60 shadow-sm">국내 정책 지표를 확인 중입니다.</div>
      ) : activeSectionKey !== 'sources' ? (
        <div className="page-content-enter grid gap-4" key={activeSectionKey}>
          {visibleSections.map((section) => {
            const sectionIndicators = section.codes
              .map((code) => indicatorMap.get(code))
              .filter((indicator): indicator is DomesticIndicator => Boolean(indicator));

            if (sectionIndicators.length === 0) {
              return null;
            }

            return (
              <section className="glass-card rounded-2xl p-4 shadow-sm" key={section.title}>
                <div className="mb-3 border-b border-white/10 pb-3">
                  <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                  <p className="mt-1 text-xs text-white/60">{section.description}</p>
                </div>
                {viewMode === 'card' ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
      ) : null}

      {activeSectionKey === 'sources' ? <div className="page-content-enter"><DataSourceSection dataSources={dataSources} /></div> : null}
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
  return (
    <div className="relative grid h-8 shrink-0 grid-cols-2 rounded-full border border-white/15 bg-white/10 p-0.5">
      <span
        className="pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 rounded-full bg-teal-600 transition-transform duration-200 ease-out"
        style={{
          transform: value === 'list' ? 'translateX(100%) scale(1)' : 'translateX(0) scale(1)',
          transformOrigin: 'center',
          width: 'calc(50% - 2px)'
        }}
      />
      <button
        className={`relative z-10 h-7 min-w-12 rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 ${value === 'card' ? 'text-white' : 'text-white/60 hover:text-white'}`}
        onClick={() => onChange('card')}
        type="button"
      >
        카드
      </button>
      <button
        className={`relative z-10 h-7 min-w-12 rounded-full px-2 text-[11px] font-semibold transition-colors duration-150 ${value === 'list' ? 'text-white' : 'text-white/60 hover:text-white'}`}
        onClick={() => onChange('list')}
        type="button"
      >
        리스트
      </button>
    </div>
  );
}

function DataSourceSection({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="glass-card rounded-2xl p-4 shadow-sm">
      <div className="border-b border-white/10 pb-3">
        <h3 className="text-sm font-semibold text-white">데이터 확보 경로</h3>
        <p className="mt-1 text-xs text-white/60">실제 수집 중인 API와 추가 연동이 필요한 API를 구분합니다.</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {dataSources
          .filter((source) => ['USD_KRW', 'MACRO', 'FISCAL_POLICY', 'CURRENCY_STRENGTH', 'CAPITAL_FLOW'].includes(source.code))
          .map((source) => (
            <article className="glass-subcard rounded-2xl p-3" key={source.code}>
              <h4 className="text-xs font-semibold text-white">{source.title}</h4>
              <p className="mt-2 text-[11px] leading-5 text-white/55">{source.api}</p>
              <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-5 text-white/65">{source.updatePolicy}</p>
            </article>
          ))}
        <article className="rounded border border-teal-100 bg-teal-50 p-3">
          <h4 className="text-xs font-semibold text-teal-900">무료 공개 소스 사용</h4>
          <p className="mt-2 text-[11px] leading-5 text-teal-800">남은 지표는 ECOS, FRED, 한국은행 공식 페이지 기반으로 수집합니다. 한국 CDS는 무료 공식 API가 없어 신용스프레드 프록시로 표시합니다.</p>
        </article>
      </div>
    </section>
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
      className={`group/card cursor-pointer rounded-2xl border p-3 transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/12 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-100 motion-reduce:transform-none motion-reduce:transition-none ${isPending ? 'border-amber-300/40 bg-amber-400/15' : 'border-white/10 bg-white/8 shadow-sm'}`}
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
      <div className="transition-transform duration-150 ease-out group-hover/card:scale-[1.01] motion-reduce:transform-none motion-reduce:transition-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-white/45">{indicator.category}</div>
            <h4 className="mt-0.5 truncate text-sm font-semibold text-white">{indicator.title}</h4>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${collectionStatusClassName(indicator)}`}>
            {collectionStatusLabel(indicator)}
          </span>
        </div>

        <div className="mt-3 min-w-0">
          <div className="truncate text-xl font-semibold text-white">{formatIndicatorValue(indicator)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/55">
            <span>{formatMetricUnit(indicator.unit)}</span>
            <span>기준 {indicator.baseDate ?? '-'}</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-white/70">상태 {indicator.status}</div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-4 text-white/45">
          클릭해서 자세히 보기 · 수집 {formatCollectedAt(indicator)}
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
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-left">
        <thead>
          <tr className="text-[11px] font-semibold text-white/45">
            <th className="w-[36%] border-b border-white/10 px-2 py-2">지표</th>
            <th className="w-[22%] border-b border-white/10 px-2 py-2 text-right">현재 수치</th>
            <th className="w-[18%] border-b border-white/10 px-2 py-2 text-right">기준일</th>
            <th className="w-[24%] border-b border-white/10 px-2 py-2 text-right">수집상태</th>
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
                    <div className="truncate text-xs font-semibold text-white">{indicator.title}</div>
                    <div className="truncate text-[10px] font-medium text-white/45">{indicator.category} · {indicator.status} · 클릭해서 자세히 보기</div>
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right">
                  <div className="transition-transform duration-150 ease-out group-hover/row:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
                    <div className="truncate text-sm font-semibold text-white">
                      {formatIndicatorValue(indicator)} <span className="text-[11px] font-medium text-white/45">{formatMetricUnit(indicator.unit)}</span>
                    </div>
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right">
                  <div className="transition-transform duration-150 ease-out group-hover/row:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none text-xs text-white/65">
                    {indicator.baseDate ?? '-'}
                  </div>
                </td>
                <td className="border-b border-white/10 px-2 py-2 text-right">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${collectionStatusClassName(indicator)}`}>
                    {collectionStatusLabel(indicator)}
                  </span>
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

  const delta = getDelta(indicator);

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
          <InfoPanelRow label="이전 기준" value={indicator.previousBaseDate ?? '-'} />
          <InfoPanelRow label="직전 관측치 대비" value={delta.label} />
          <InfoPanelRow label="출처" value={indicator.source} />
          <InfoPanelRow label="수집일" value={formatCollectedAt(indicator)} />
        </dl>
        {indicator.detailUrl ? (
          <div className="mt-5 rounded-2xl border border-teal-300/20 bg-teal-400/10 p-4">
            <p className="text-xs font-semibold text-teal-100">공식 문서</p>
            <p className="mt-1 text-xs leading-5 text-teal-50/75">{indicator.title}</p>
            <a
              className="mt-3 inline-flex h-8 items-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
              href={indicator.detailUrl}
              rel="noreferrer"
              target="_blank"
            >
              한국은행에서 보기
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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRefs = React.useRef<Partial<Record<HistoryRangeKey, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = React.useState({ height: 0, left: 0, top: 0, width: 0 });
  const options = React.useMemo(
    () => (history ? historyRangeOptions.filter((option) => history.availableRanges.includes(option.key)) : historyRangeOptions),
    [history]
  );

  React.useLayoutEffect(() => {
    const updateIndicator = () => {
      const container = containerRef.current;
      const button = buttonRefs.current[value];
      if (!container || !button) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const nextIndicator = {
        height: buttonRect.height,
        left: buttonRect.left - containerRect.left,
        top: buttonRect.top - containerRect.top,
        width: buttonRect.width
      };
      setIndicator((current) => {
        if (
          current.height === nextIndicator.height &&
          current.left === nextIndicator.left &&
          current.top === nextIndicator.top &&
          current.width === nextIndicator.width
        ) {
          return current;
        }
        return nextIndicator;
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [options, value]);

  if (options.length === 0) {
    return (
      <div className="rounded border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/55">
        기간 없음
      </div>
    );
  }

  return (
    <div className="relative inline-flex h-10 shrink-0 rounded-full border border-white/15 bg-white/10 p-0.5" ref={containerRef}>
      {indicator.width > 0 ? (
        <span
          className="moving-tab-indicator pointer-events-none absolute left-0 top-0 rounded-full bg-teal-600 transition-[transform,width,height] duration-200 ease-out"
          style={{
            height: indicator.height,
            transform: `translate(${indicator.left + 1}px, ${indicator.top - 1}px)`,
            width: Math.max(0, indicator.width - 2)
          }}
        />
      ) : null}
      {options.map((option) => (
        <button
          className={`relative z-10 inline-flex h-full min-w-14 items-center justify-center rounded-full px-3 text-center text-xs font-semibold leading-none transition-colors duration-150 ${
            value === option.key ? 'text-white' : 'text-white/60 hover:text-white'
          }`}
          key={option.key}
          onClick={() => onChange(option.key)}
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
  return indicator.code !== 'MPC_MINUTES' && indicator.unit !== 'DOCUMENT';
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

function collectionStatusLabel(indicator: DomesticIndicator) {
  if (indicator.status === '연동 필요') {
    return '대기';
  }

  if (indicator.value === null || indicator.status === '데이터 없음') {
    return '오류';
  }

  return '정상';
}

function collectionStatusClassName(indicator: DomesticIndicator) {
  const label = collectionStatusLabel(indicator);
  if (label === '대기') {
    return 'border border-amber-300/30 bg-amber-400/15 text-amber-100';
  }

  if (label === '오류') {
    return 'border border-rose-300/30 bg-rose-400/15 text-rose-100';
  }

  return 'border border-teal-300/30 bg-teal-400/15 text-teal-100';
}

function getDelta(indicator: DomesticIndicator) {
  if (indicator.value === null || indicator.previousValue === null) {
    return { label: '비교값 없음', tone: 'text-zinc-400' };
  }

  const delta = indicator.value - indicator.previousValue;
  if (Math.abs(delta) < 0.0001) {
    return { label: '직전 관측치 대비 변동 없음', tone: 'text-zinc-500' };
  }

  const sign = delta > 0 ? '+' : '';
  const digits = indicator.unit === 'PERCENT' || indicator.unit === 'PERCENT_POINT' || indicator.unit === 'INDEX'
    ? 2
    : indicator.unit === 'KRW_TRILLION' ? 1 : 0;
  return {
    label: `직전 관측치 대비 ${sign}${formatValue(delta, digits)}`,
    tone: delta > 0 ? 'text-red-600' : 'text-blue-600'
  };
}
