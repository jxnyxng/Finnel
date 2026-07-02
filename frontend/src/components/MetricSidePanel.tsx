import type { MetricSnapshot } from '../types';
import { formatMetricUnit, formatMetricValue } from '../utils/format';

type MetricSidePanelProps = {
  metric: MetricSnapshot | null;
  footerText: string;
  details: Array<{ label: string; value: string }>;
};

export function MetricSidePanel({ metric, footerText, details }: MetricSidePanelProps) {
  return (
    <aside className="flex min-h-32 flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-zinc-500">{metric?.label ?? '지표 확인 중'}</p>
        <div className="mt-4 flex items-end justify-between gap-3 lg:flex-col lg:items-start">
          <p className="text-3xl font-semibold tracking-normal">{metric ? formatMetricValue(metric) : '-'}</p>
          <span className="text-xs font-medium text-zinc-500">{metric ? formatMetricUnit(metric.unit) : ''}</span>
        </div>
      </div>
      <dl className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs">
        {details.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-zinc-500">{item.label}</dt>
            <dd className="min-w-0 text-right font-medium leading-5 text-zinc-800">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-zinc-500">{footerText}</p>
    </aside>
  );
}
