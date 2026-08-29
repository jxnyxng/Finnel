import type { ChartCandlestickPoint, RangeKey } from '../types';
import { formatCrosshairDate } from './chart';
import { formatValue } from './format';

export function getMarketChartSectionLabel(title: string) {
  if (title.includes('원달러')) {
    return '원달러환율';
  }
  return title.replace(/^실시간\s+/, '');
}

export function getMarketChartCollectionStatusSummary({
  panelDetails,
  range,
  sectionLabel,
  showCandlesticks
}: {
  panelDetails: Array<{ label: string; value: string }>;
  range: RangeKey;
  sectionLabel: string;
  showCandlesticks: boolean;
}) {
  const source = panelDetails.find((item) => item.label === '출처')?.value;
  const period = panelDetails.find((item) => item.label === '기간')?.value;

  if (sectionLabel === '원달러환율' && range === '1D') {
    return [
      { label: '수집', value: '1분봉' },
      { label: '표시', value: `5분봉 ${showCandlesticks ? '캔들' : '라인'}` },
      { label: '점검', value: '5분마다 확인' },
      { label: '출처', value: source ?? 'Twelve Data' }
    ];
  }

  if (sectionLabel === '원달러환율') {
    return [
      { label: '수집', value: '일별 기준' },
      { label: '표시', value: '일별 환율' },
      { label: '출처', value: source ?? '저장 데이터' }
    ];
  }

  return [
    { label: '수집', value: '일별 기준' },
    { label: '표시', value: period ?? '선택 기간' },
    { label: '출처', value: source ?? 'FRED' }
  ];
}

export function getCompactMarketChartPanelDetails(panelDetails: Array<{ label: string; value: string }>) {
  const duplicatedLabels = new Set(['범위', '기간', '관측값', '최신 기준일', '세션', '출처', '구성', '해석']);
  return panelDetails.filter((item) => !duplicatedLabels.has(item.label));
}

export function getOhlcSummaryItems(point: ChartCandlestickPoint, range: RangeKey) {
  return [
    { key: 'time', label: '시간', value: formatOhlcTimeRange(point.dateValue, range) },
    { key: 'open', label: '시가', value: formatOhlcValue(point.open) },
    { key: 'high', label: '고가', value: formatOhlcValue(point.high) },
    { key: 'low', label: '저가', value: formatOhlcValue(point.low) },
    { key: 'close', label: '종가', value: formatOhlcValue(point.close) }
  ] as const;
}

function formatOhlcValue(value: number) {
  return `${formatValue(value)}원`;
}

function formatOhlcTimeRange(dateValue: string, range: RangeKey) {
  if (range !== '1D') {
    return formatCrosshairDate(dateValue, range);
  }

  const hour = Number(dateValue.slice(11, 13));
  const minute = Number(dateValue.slice(14, 16));
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return formatCrosshairDate(dateValue, range);
  }

  const endMinuteOfDay = hour * 60 + minute;
  const startMinuteOfDay = (endMinuteOfDay - 5 + 24 * 60) % (24 * 60);
  return `${formatMinuteOfDay(startMinuteOfDay)} ~ ${formatMinuteOfDay(endMinuteOfDay)}`;
}

function formatMinuteOfDay(minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}
