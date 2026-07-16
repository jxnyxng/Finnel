import type { MetricSnapshot } from '../types';
import { formatMetricUnit, formatMetricValue } from '../utils/format';

type MetricSidePanelProps = {
  metric: MetricSnapshot | null;
  footerText: string;
  details: Array<{ label: string; value: string }>;
};

export function MetricSidePanel({ metric, footerText, details }: MetricSidePanelProps) {
  return (
    <aside className="glass-card flex min-h-32 flex-col justify-between rounded-2xl p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-white/55">{metric?.label ?? '지표 확인 중'}</p>
        <div className="mt-4 flex items-end justify-between gap-3 lg:flex-col lg:items-start">
          <p className="text-3xl font-semibold tracking-normal text-white">{metric ? formatMetricValue(metric) : '-'}</p>
          <span className="text-xs font-medium text-white/55">{metric ? formatMetricUnit(metric.unit) : ''}</span>
        </div>
      </div>
      <dl className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs">
        {details.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-white/55">{item.label}</dt>
            <dd className="min-w-0 text-right font-medium leading-5 text-white/85">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-white/55">{footerText}</p>
    </aside>
  );
}
