export type RangeKey = '1D' | '3M' | '1Y' | '5Y';
export type MainTabKey = 'dashboard' | 'koreaStatus' | 'ranking' | 'newsroom';
export type PageKey = MainTabKey | 'serviceGuide';
export type ServiceStatusTone = 'healthy' | 'idle' | 'error';
export type IndicatorStatus = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CAUTION' | 'NO_DATA';

export type MetricSnapshot = {
  code: string;
  label: string;
  value: number | null;
  unit: string;
  changeRate: number | null;
};

export type TimeSeriesPoint = {
  baseDate: string;
  value: number;
};

export type IntradayTimeSeriesPoint = {
  observedAt: string;
  value: number;
};

export type CurrencyStrengthRank = {
  baseDate: string;
  areaCode: string;
  areaName: string;
  neerValue: number;
  neerRank: number;
  totalCount: number;
  reerBaseDate: string | null;
  reerValue: number | null;
};

export type DataSourceInfo = {
  code: string;
  title: string;
  api: string;
  updatePolicy: string;
  note: string;
};

export type DomesticIndicator = {
  code: string;
  title: string;
  category: string;
  value: number | null;
  unit: string;
  baseDate: string | null;
  previousValue: number | null;
  previousBaseDate: string | null;
  source: string;
  fetchedAt: string | null;
  krwImpact: string;
  note: string;
  status: IndicatorStatus;
  statusReason: string;
};

export type DailyDashboardResponse = {
  baseDate: string;
  metrics: MetricSnapshot[];
  usdKrwSeries: TimeSeriesPoint[];
  usdKrwIntradaySeries: IntradayTimeSeriesPoint[];
  dxyIndexSeries: TimeSeriesPoint[];
  dollarIndexSeries: TimeSeriesPoint[];
  currencyStrengthRanks: CurrencyStrengthRank[];
  domesticIndicators: DomesticIndicator[];
  dataSources: DataSourceInfo[];
};

export type SyncResult = {
  exchangeRateRows: number;
  intradayExchangeRateRows: number;
  dollarIndexRows: number;
  currencyStrengthRows: number;
  usPolicyRateRows: number;
  krPolicyRateRows: number;
  foreignReserveRows: number;
  domesticPolicyRows: number;
  status: string;
  message: string;
  trigger: string;
  startedAt: string | null;
  nextAllowedAt: string | null;
  remainingCooldownSeconds: number;
};

export type SyncStatus = {
  latestStatus: string | null;
  latestStartedAt: string | null;
  latestEndedAt: string | null;
  latestMessage: string | null;
  nextAllowedAt: string | null;
  remainingCooldownSeconds: number;
  canSync: boolean;
};

export type NewsCategory = {
  code: string;
  name: string;
  query: string;
};

export type NewsArticle = {
  categoryCode: string;
  categoryName: string;
  queryText: string;
  title: string;
  description: string | null;
  originLink: string | null;
  link: string;
  publisher: string | null;
  publishedAt: string | null;
  aiSummary: string | null;
  marketSentiment: string | null;
  fetchedAt: string;
  imageUrl: string | null;
};

export type NewsFilters = {
  fromDate: string;
  toDate: string;
  keyword: string;
};

export type NewsResponse = {
  configured: boolean;
  categories: NewsCategory[];
  articles: NewsArticle[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type ChartPoint = {
  label: string;
  dateValue: string;
  x: number;
  value: number;
  latestValue?: number | null;
};

export type ChartHoverState = {
  point: ChartPoint;
  x: number;
  y: number;
};
