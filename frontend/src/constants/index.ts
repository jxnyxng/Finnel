import type { MainTabKey, PageKey, RangeKey } from '../types';

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

export const chartHeightPx = 384;
export const chartTopMarginPx = 18;
export const chartBottomMarginPx = 0;
export const intradayXAxisHeightPx = 28;
export const dailyXAxisHeightPx = 30;

export const koreanRegionNames = new Intl.DisplayNames(['ko'], { type: 'region' });

export const specialAreaDisplays: Record<string, { name: string; flag: string }> = {
  CNH: { name: '역외 위안', flag: '🇨🇳' },
  XM: { name: '유로지역', flag: '🇪🇺' }
};

export const mainTabs: Array<{ key: MainTabKey; label: string }> = [
  { key: 'todayFlow', label: '대시보드' },
  { key: 'koreaStatus', label: '경제지표' },
  { key: 'governmentBriefings', label: '정책뉴스' },
  { key: 'newsroom', label: '뉴스검색' },
  { key: 'ranking', label: '화폐랭킹' },
  { key: 'calculator', label: '환전계산' }
];

export const pageRoutes: Record<PageKey, string> = {
  home: '/',
  todayFlow: '/dashboard',
  dashboard: '/exchange-rate',
  koreaStatus: '/indicators',
  governmentBriefings: '/policy-briefings',
  newsroom: '/news',
  ranking: '/currency-ranking',
  calculator: '/calculator',
  dataSources: '/data-sources',
  serviceGuide: '/service-guide'
};
