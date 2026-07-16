import type { MetricSnapshot } from '../types';
import { formatMetricUnit, formatMetricValue } from '../utils/format';

type MacroSummaryCardProps = {
  metrics: MetricSnapshot[];
  isLoading: boolean;
  latestSyncLabel: string;
};

export function MacroSummaryCard({ metrics, isLoading, latestSyncLabel }: MacroSummaryCardProps) {
  return (
    <aside className="w-full rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-zinc-900">금리·외환 여건</h2>
        <span className="text-[10px] font-medium text-zinc-500">저장 데이터 기준</span>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {isLoading ? (
          <div className="col-span-2 text-xs text-zinc-500">요약 데이터 확인 중</div>
        ) : metrics.map((metric) => (
          <div key={metric.code} className="min-w-0 rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5">
            <dt className="truncate text-[10px] font-medium text-zinc-500">{metric.label}</dt>
            <dd className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1">
              <span className="min-w-0 truncate text-xs font-semibold text-zinc-950">{formatMetricValue(metric)}</span>
              <span className="shrink-0 text-[10px] font-medium text-zinc-500">{formatMetricUnit(metric.unit)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-zinc-100 pt-2 text-[10px] leading-4 text-zinc-500">{latestSyncLabel}</p>
    </aside>
  );
}
