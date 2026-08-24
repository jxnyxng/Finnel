import type { MetricSnapshot } from '../types';
import { formatMetricUnit, formatMetricValue } from '../utils/format';

type MacroSummaryCardProps = {
  metrics: MetricSnapshot[];
  isLoading: boolean;
  latestSyncLabel: string;
};

export function MacroSummaryCard({ metrics, isLoading, latestSyncLabel }: MacroSummaryCardProps) {
  return (
    <aside className="glass-card w-full rounded-2xl p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-white">금리·외환 여건</h2>
        <span className="text-[10px] font-medium text-white/55">저장 데이터 기준</span>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {isLoading ? (
          <div className="col-span-2 text-xs text-white/55">요약 데이터 확인 중</div>
        ) : metrics.map((metric) => (
          <div key={metric.code} className="glass-subcard min-w-0 rounded px-2 py-1.5">
            <dt className="truncate text-[10px] font-medium text-white/55">{metric.label}</dt>
            <dd className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1">
              <span className="current-market-value min-w-0 truncate text-xs font-semibold">{formatMetricValue(metric)}</span>
              <span className="shrink-0 text-[10px] font-medium text-white/55">{formatMetricUnit(metric.unit)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-4 text-white/55">{latestSyncLabel}</p>
    </aside>
  );
}
