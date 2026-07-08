import type { ReactElement, ReactNode } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  chartBottomMarginPx,
  chartHeightPx,
  chartTopMarginPx
} from '../constants';
import type { ChartHoverState, ChartPoint, RangeKey } from '../types';
import { formatValue } from '../utils/format';
import {
  ChartCrosshairOverlay,
  ChartEmptyState,
  ChartHelpTooltip,
  ChartPlotGrid,
  LatestValueDot,
  LatestValueFloatingLabel,
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
  latestValue: number | null;
  latestLabelTop: number | null;
  hover: ChartHoverState | null;
  onHoverChange: (hover: ChartHoverState | null) => void;
  plotLeft: number;
  plotRight: number;
  referenceStroke: string;
  lineStroke: string;
};

export function MarketChartSection<T extends RangeKey>({
  emptyText,
  helpAriaLabel,
  helpContent,
  helpTitle,
  helpWidthClassName,
  hover,
  latestLabelTop,
  latestValue,
  lineStroke,
  onHoverChange,
  onRangeChange,
  plotLeft,
  plotRight,
  range,
  rangeColumns,
  rangeOptions,
  referenceStroke,
  series,
  statusClassName = 'text-zinc-500',
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
    <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              <ChartHelpTooltip ariaLabel={helpAriaLabel} title={helpTitle} widthClassName={helpWidthClassName}>
                {helpContent}
              </ChartHelpTooltip>
            </div>
            <div className="mt-1 flex h-8 flex-col justify-start gap-1">
              <p className="text-xs text-zinc-500">{subtitle}</p>
              <p className={`text-xs ${statusClassName}`}>{statusText}</p>
            </div>
          </div>
          <RangeSelector columns={rangeColumns} onChange={onRangeChange} options={rangeOptions} value={range} />
        </div>
      </div>

      <div className="chart-grid-surface relative h-80 overflow-hidden rounded-md">
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
        <LatestValueFloatingLabel topPercent={latestLabelTop} value={latestValue} />
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
    </article>
  );
}
