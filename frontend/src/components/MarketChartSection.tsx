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

type AxisTickProps = {
  x?: number;
  y?: number;
  index?: number;
  payload?: {
    value?: number | string;
  };
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
  headerAction?: ReactNode;
  showLatestValueDot?: boolean;
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
  headerAction,
  showLatestValueDot = false,
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
  const axisWidth = 58;
  const plotInsetLeft = 18;

  return (
    <div className={`relative ${headerAction ? 'pt-7' : ''}`}>
      {headerAction ? <div className="absolute right-1 top-0">{headerAction}</div> : null}
      <article className="glass-card min-w-0 rounded-2xl shadow-sm">
        <div className="grid gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <ChartHelpTooltip ariaLabel={helpAriaLabel} title={helpTitle} widthClassName={helpWidthClassName}>
                {helpContent}
              </ChartHelpTooltip>
              {statusText ? <span className={`whitespace-nowrap text-xs ${statusClassName}`}>{statusText}</span> : null}
            </div>
            <p className="shrink-0 whitespace-nowrap text-left text-xs text-white/70 sm:text-right">{subtitle}</p>
          </div>

          <div className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="chart-grid-surface relative h-72 min-w-0 overflow-hidden rounded-2xl sm:h-80 lg:h-full lg:min-h-96">
              <div className="chart-range-enter absolute inset-0" key={range}>
                <ChartPlotGrid bottom={chartBottom} left={plotInsetLeft} right={axisWidth} top={chartTopMarginPx} />
                {series.length === 0 ? (
                  <ChartEmptyState>{emptyText}</ChartEmptyState>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={series}
                      margin={{ top: chartTopMarginPx, right: 0, bottom: 0, left: plotInsetLeft }}
                      onMouseLeave={() => onHoverChange(null)}
                      onMouseMove={(state) => onHoverChange(getActiveChartHover(state, series, {
                        plotBottom,
                        plotLeft: plotInsetLeft,
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
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.62)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis
                        orientation="right"
                        domain={yDomain}
                        tick={<YAxisTick />}
                        tickLine={false}
                        axisLine={false}
                        tickCount={8}
                        width={axisWidth}
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
                      {showLatestValueDot ? (
                        <Line
                          type="monotone"
                          dataKey="latestValue"
                          stroke="transparent"
                          dot={<LatestValueDot />}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <ChartCrosshairOverlay
                  bottom={chartBottom}
                  hover={hover}
                  left={plotInsetLeft}
                  range={range}
                  right={axisWidth}
                  top={chartTopMarginPx}
                  yDomain={yDomain}
                />
              </div>
            </div>

            <aside className="glass-subcard flex min-w-0 flex-col justify-between rounded-2xl p-3 lg:min-h-96">
              <div className="grid gap-3">
                <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
                {statusNode ? (
                  <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
                    {statusNode}
                  </div>
                ) : null}
                <div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="min-w-0 break-words text-2xl font-semibold tracking-normal text-white sm:text-3xl">{metric ? formatMetricValue(metric) : '-'}</p>
                    <span className="shrink-0 text-xs font-medium text-white/60">{metric ? formatMetricUnit(metric.unit) : ''}</span>
                  </div>
                </div>
              </div>
              <dl className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs">
                {panelDetails.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-white/55">{item.label}</dt>
                    <dd className="min-w-0 text-right font-medium leading-5 text-white/85">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {panelFooterText ? <p className="mt-4 text-xs text-white/55">{panelFooterText}</p> : null}
            </aside>
          </div>
        </div>
      </article>
    </div>
  );
}

function YAxisTick({ index = 0, payload, x = 0, y = 0 }: AxisTickProps) {
  return (
    <text
      dy={4}
      fill="rgba(255,255,255,0.62)"
      fontSize={10}
      textAnchor="start"
      x={x}
      y={index === 0 ? y - 14 : y}
    >
      {formatValue(Number(payload?.value))}
    </text>
  );
}
