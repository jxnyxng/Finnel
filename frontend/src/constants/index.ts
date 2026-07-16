import type { MainTabKey, RangeKey } from '../types';

export const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: '1D', label: '1일' },
  { key: '3M', label: '3개월' },
  { key: '1Y', label: '1년' },
  { key: '5Y', label: '5년' }
];

export const longRangeOptions: Array<{ key: Exclude<RangeKey, '1D'>; label: string }> = [
  { key: '3M', label: '3개월' },
  { key: '1Y', label: '1년' },
  { key: '5Y', label: '5년' }
];

export const intradaySessionStartMinutes = 9 * 60;
export const intradaySessionEndMinutes = 26 * 60;
export const chartHeightPx = 384;
export const chartTopMarginPx = 18;
export const chartBottomMarginPx = 0;
export const intradayXAxisHeightPx = 28;
export const dailyXAxisHeightPx = 30;

export const koreanRegionNames = new Intl.DisplayNames(['ko'], { type: 'region' });

export const specialAreaDisplays: Record<string, { name: string; flag: string }> = {
  XM: { name: '유로지역', flag: '🇪🇺' }
};

export const mainTabs: Array<{ key: MainTabKey; label: string }> = [
  { key: 'dashboard', label: '환율 현황' },
  { key: 'koreaStatus', label: '관련 지표' },
  { key: 'governmentBriefings', label: '정부 정책' },
  { key: 'newsroom', label: '뉴스 검색' },
  { key: 'ranking', label: '화폐 랭킹' }
];
