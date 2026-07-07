import React from 'react';
import type { DataSourceInfo, DomesticIndicator } from '../types';
import { formatMetricUnit, formatValue } from '../utils/format';

type KoreaStatusPageProps = {
  indicators: DomesticIndicator[];
  dataSources: DataSourceInfo[];
  isLoading: boolean;
  latestSyncLabel: string;
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
    description: '외환보유액과 원화 실효가치는 시장 충격을 버틸 여력을 보여줍니다.',
    codes: ['FOREIGN_RESERVES', 'KR_NEER_RANK']
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
  { key: 'policy', label: '정책' },
  { key: 'external', label: '대외수급' },
  { key: 'inflation', label: '물가·원자재' },
  { key: 'risk', label: '자본·리스크' },
  { key: 'sources', label: '데이터' }
];

export function KoreaStatusPage({ indicators, dataSources, isLoading, latestSyncLabel }: KoreaStatusPageProps) {
  const [activeSectionKey, setActiveSectionKey] = React.useState(sectionTabs[0].key);
  const indicatorMap = new Map(indicators.map((indicator) => [indicator.code, indicator]));
  const collectedIndicators = indicators.filter((indicator) => indicator.value !== null);
  const visibleSections = sections.filter((section) => section.key === activeSectionKey);

  return (
    <section className="grid gap-4">
      <header className="rounded-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold text-teal-700">국내 상황</p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-950">원화 영향 정책·거시 지표</h2>
            <p className="mt-1 truncate text-[11px] text-zinc-500">{latestSyncLabel}</p>
          </div>
          <div className="shrink-0">
            <SummaryBox label="수집 지표" value={`${collectedIndicators.length}개`} />
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1.5 rounded-md border border-zinc-200 bg-white p-2 shadow-sm" aria-label="국내 현황 범주">
        {sectionTabs.map((tab) => (
          <button
            className={`h-8 rounded-md px-3 text-xs font-semibold ${
              activeSectionKey === tab.key ? 'bg-teal-700 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
            key={tab.key}
            onClick={() => setActiveSectionKey(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="rounded-md border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">국내 정책 지표를 확인 중입니다.</div>
      ) : activeSectionKey !== 'sources' ? (
        visibleSections.map((section) => {
          const sectionIndicators = section.codes
            .map((code) => indicatorMap.get(code))
            .filter((indicator): indicator is DomesticIndicator => Boolean(indicator));

          if (sectionIndicators.length === 0) {
            return null;
          }

          return (
            <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm" key={section.title}>
              <div className="mb-3 border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-semibold text-zinc-950">{section.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{section.description}</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {sectionIndicators.map((indicator) => (
                  <PolicyIndicatorCard indicator={indicator} key={indicator.code} />
                ))}
              </div>
            </section>
          );
        })
      ) : null}

      {activeSectionKey === 'sources' ? <DataSourceSection dataSources={dataSources} /> : null}
    </section>
  );
}

function DataSourceSection({ dataSources }: { dataSources: DataSourceInfo[] }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="border-b border-zinc-100 pb-3">
        <h3 className="text-sm font-semibold text-zinc-950">데이터 확보 경로</h3>
        <p className="mt-1 text-xs text-zinc-500">실제 수집 중인 API와 추가 연동이 필요한 API를 구분합니다.</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {dataSources
          .filter((source) => ['USD_KRW', 'MACRO', 'FISCAL_POLICY', 'CURRENCY_STRENGTH', 'CAPITAL_FLOW'].includes(source.code))
          .map((source) => (
            <article className="rounded border border-zinc-100 bg-zinc-50 p-3" key={source.code}>
              <h4 className="text-xs font-semibold text-zinc-900">{source.title}</h4>
              <p className="mt-2 text-[11px] leading-5 text-zinc-500">{source.api}</p>
              <p className="mt-2 border-t border-zinc-200 pt-2 text-[11px] leading-5 text-zinc-600">{source.updatePolicy}</p>
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
    <div className="inline-block rounded border border-zinc-100 bg-zinc-50 px-3 py-1.5 text-right">
      <div className="text-[10px] font-medium text-zinc-500">{label}</div>
      <div className="text-sm font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function PolicyIndicatorCard({ indicator }: { indicator: DomesticIndicator }) {
  const delta = getDelta(indicator);
  const isPending = indicator.status === '연동 필요';

  return (
    <article className={`rounded-md border p-3 ${isPending ? 'border-amber-200 bg-amber-50' : 'border-zinc-100 bg-white shadow-sm'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-zinc-400">{indicator.category}</div>
          <h4 className="mt-0.5 truncate text-sm font-semibold text-zinc-950">{indicator.title}</h4>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-teal-50 text-teal-700'}`}>
          {indicator.status}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold text-zinc-950">{formatIndicatorValue(indicator)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{formatMetricUnit(indicator.unit)}</div>
          <div className="mt-2 text-[11px] leading-5 text-zinc-500">기준 {indicator.baseDate ?? '-'}</div>
          <div className={`mt-1 text-xs font-semibold ${delta.tone}`}>{delta.label}</div>
        </div>
        <div className="min-w-0 rounded bg-zinc-50 p-2 text-xs leading-5 text-zinc-600">
          {indicator.krwImpact}
        </div>
      </div>

      <div className="mt-3 grid gap-1 border-t border-zinc-100 pt-3 text-[11px] leading-5 text-zinc-500">
        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-zinc-400">출처</span>
          <span className="min-w-0 truncate text-right font-medium text-zinc-700">{indicator.source}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-zinc-400">수집 기준</span>
          <span className="min-w-0 text-right text-zinc-600">{indicator.note}</span>
        </div>
      </div>
    </article>
  );
}

function formatIndicatorValue(indicator: DomesticIndicator) {
  if (indicator.value === null) {
    return '-';
  }

  if (indicator.unit === 'PERCENT' || indicator.unit === 'PERCENT_POINT') {
    return formatValue(indicator.value, 2);
  }

  if (indicator.unit === 'USD_MILLION' || indicator.unit === 'USD_1000' || indicator.unit === 'KRW_100M' || indicator.unit === 'RANK') {
    return formatValue(indicator.value, 0);
  }

  if (indicator.unit === 'KRW_TRILLION') {
    return formatValue(indicator.value, 1);
  }

  if (indicator.unit === 'BASIS_POINT' || indicator.unit === 'DOCUMENT') {
    return formatValue(indicator.value, 0);
  }

  return formatValue(indicator.value, 2);
}

function getDelta(indicator: DomesticIndicator) {
  if (indicator.value === null || indicator.previousValue === null) {
    return { label: '비교값 없음', tone: 'text-zinc-400' };
  }

  const delta = indicator.value - indicator.previousValue;
  if (Math.abs(delta) < 0.0001) {
    return { label: '전 기준 대비 변동 없음', tone: 'text-zinc-500' };
  }

  const sign = delta > 0 ? '+' : '';
  const digits = indicator.unit === 'PERCENT' || indicator.unit === 'PERCENT_POINT' || indicator.unit === 'INDEX'
    ? 2
    : indicator.unit === 'KRW_TRILLION' ? 1 : 0;
  return {
    label: `전 기준 대비 ${sign}${formatValue(delta, digits)}`,
    tone: delta > 0 ? 'text-red-600' : 'text-blue-600'
  };
}
