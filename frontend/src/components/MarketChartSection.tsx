import type { ReactElement, ReactNode } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx
} from '../constants';
import type { ChartHoverState, ChartPoint, MetricSnapshot, RangeKey } from '../types';
import { formatMetricUnit, formatMetricValue, formatValue } from '../utils/format';
import {
  ChartCrosshairOverlay,
  ChartEmptyState,
  ChartHelpTooltip,
  ChartPlotGrid,
  LatestValueDot,
  RangeSelector,
  getActiveChartHover
} from './ChartElements';

type RangeSelectorOption<T extends RangeKey> = {
  key: T;
  label: string;
};

type MarketChartSectionProps<T extends RangeKey> = {
  title: string;
  helpAriaLabel: string;
  helpTitle: string;
  helpWidthClassName?: string;
  helpContent: ReactNode;
  range: T;
  rangeColumns: 3 | 4;
  rangeOptions: Array<RangeSelectorOption<T>>;
  onRangeChange: (range: T) => void;
  subtitle: ReactNode;
  statusText: ReactNode;
  statusClassName?: string;
  series: ChartPoint[];
  emptyText: ReactNode;
  xDomain: [number, number] | ['dataMin', 'dataMax'];
  xAxisHeight: number;
  xAxisPadding: { left: number; right: number };
  xTicks?: number[];
  xTickFormatter: (value: number) => string;
  yDomain: [number, number] | ['auto', 'auto'];
  tooltipContent: ReactElement;
  hover: ChartHoverState | null;
  onHoverChange: (hover: ChartHoverState | null) => void;
  plotLeft: number;
  plotRight: number;
  referenceStroke: string;
  lineStroke: string;
  metric?: MetricSnapshot | null;
  panelDetails?: Array<{ label: string; value: string }>;
  panelFooterText?: string;
  statusNode?: ReactNode;
};

export function MarketChartSection<T extends RangeKey>({
  emptyText,
  helpAriaLabel,
  helpContent,
  helpTitle,
  helpWidthClassName,
  hover,
  lineStroke,
  metric,
  onHoverChange,
  onRangeChange,
  panelDetails = [],
  panelFooterText,
  plotLeft,
  plotRight,
  range,
  rangeColumns,
  rangeOptions,
  referenceStroke,
  series,
  statusClassName = 'text-zinc-500',
  statusNode,
  statusText,
  subtitle,
  title,
  tooltipContent,
  xAxisHeight,
  xAxisPadding,
  xDomain,
  xTickFormatter,
  xTicks,
  yDomain
}: MarketChartSectionProps<T>) {
  const latestPoint = series[series.length - 1] ?? null;
  const chartBottom = chartBottomMarginPx + xAxisHeight;
  const plotBottom = chartHeightPx - chartBottom;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_248px]">
        <div className="min-w-0">
          <div className="mb-3 grid gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              <ChartHelpTooltip ariaLabel={helpAriaLabel} title={helpTitle} widthClassName={helpWidthClassName}>
                {helpContent}
              </ChartHelpTooltip>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-start md:justify-between">
              <div className="flex min-h-8 min-w-0 flex-col justify-start gap-1">
                <p className="text-xs text-zinc-500">{subtitle}</p>
                <p className={`text-xs ${statusClassName}`}>{statusText}</p>
              </div>
              {statusNode}
            </div>
          </div>

          <div className="chart-grid-surface relative h-80 overflow-hidden rounded-xl">
            <div className="chart-range-enter absolute inset-0" key={range}>
            <ChartPlotGrid bottom={chartBottom} left={plotLeft} right={plotRight} top={chartTopMarginPx} />
            {series.length === 0 ? (
              <ChartEmptyState>{emptyText}</ChartEmptyState>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={series}
                  margin={{ top: 8, right: 8, bottom: 18, left: plotLeft }}
                  onMouseLeave={() => onHoverChange(null)}
                  onMouseMove={(state) => onHoverChange(getActiveChartHover(state, series, {
                    plotBottom,
                    plotLeft,
                    plotTop: chartTopMarginPx
                  }))}
                >
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={xDomain}
                    height={xAxisHeight}
                    padding={xAxisPadding}
                    ticks={xTicks}
                    tickFormatter={(value) => xTickFormatter(value)}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    orientation="right"
                    domain={yDomain}
                    tickFormatter={(value) => formatValue(Number(value))}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={false}
                    tickCount={8}
                    width={58}
                  />
                  <Tooltip
                    animationDuration={120}
                    content={tooltipContent}
                    cursor={false}
                    wrapperStyle={{ outline: 'none', transition: 'opacity 120ms ease-out' }}
                  />
                  {latestPoint ? (
                    <ReferenceLine
                      y={latestPoint.value}
                      stroke={referenceStroke}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={lineStroke}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="latestValue"
                    stroke="transparent"
                    dot={<LatestValueDot />}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <ChartCrosshairOverlay
              bottom={chartBottom}
              hover={hover}
              left={plotLeft}
              range={range}
              right={plotRight}
              top={chartTopMarginPx}
              yDomain={yDomain}
            />
            </div>
          </div>
        </div>

        <aside className="flex min-h-32 flex-col justify-between border-t border-zinc-100 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <div className="grid gap-3">
            <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
            <div>
              <p className="text-sm font-medium text-zinc-500">{metric?.label ?? '지표 확인 중'}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tracking-normal">{metric ? formatMetricValue(metric) : '-'}</p>
                <span className="shrink-0 text-xs font-medium text-zinc-500">{metric ? formatMetricUnit(metric.unit) : ''}</span>
              </div>
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-xs">
            {panelDetails.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-zinc-500">{item.label}</dt>
                <dd className="min-w-0 text-right font-medium leading-5 text-zinc-800">{item.value}</dd>
              </div>
            ))}
          </dl>
          {panelFooterText ? <p className="mt-4 text-xs text-zinc-500">{panelFooterText}</p> : null}
        </aside>
      </div>
    </article>
  );
}
