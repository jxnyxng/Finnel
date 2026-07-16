export type RangeKey = '1D' | '3M' | '1Y' | '5Y';
export type HistoryRangeKey = '1Y' | '3Y' | '5Y';
export type MainTabKey = 'dashboard' | 'exchangeGuide' | 'koreaStatus' | 'ranking' | 'newsroom' | 'governmentBriefings';
export type PageKey = MainTabKey | 'home' | 'serviceGuide';
export type ServiceStatusTone = 'healthy' | 'idle' | 'error';

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

export type ForeignExchangeRate = {
  baseDate: string;
  currencyCode: string;
  displayCode: string;
  currencyName: string;
  dealBasRate: number;
  unitSize: number;
  source: string;
  fetchedAt: string;
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
  status: string;
  detailUrl: string | null;
};

export type DomesticIndicatorHistoryResponse = {
  code: string;
  title: string;
  unit: string;
  range: HistoryRangeKey;
  startDate: string;
  endDate: string;
  averageValue: number | null;
  availableRanges: HistoryRangeKey[];
  points: TimeSeriesPoint[];
};

export type DailyDashboardResponse = {
  baseDate: string;
  metrics: MetricSnapshot[];
  usdKrwSeries: TimeSeriesPoint[];
  usdKrwIntradaySeries: IntradayTimeSeriesPoint[];
  dxyIndexSeries: TimeSeriesPoint[];
  dollarIndexSeries: TimeSeriesPoint[];
  currencyStrengthRanks: CurrencyStrengthRank[];
  foreignExchangeRates: ForeignExchangeRate[];
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

export type GovernmentBriefingArticle = {
  title: string;
  subtitle: string | null;
  body: string | null;
  ministry: string | null;
  category: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  originalUrl: string | null;
  fetchedAt: string;
};

export type GovernmentBriefingCategory = {
  code: string;
  name: string;
  articleCount: number;
};

export type GovernmentBriefingFilters = {
  fromDate: string;
  toDate: string;
  keyword: string;
};

export type GovernmentBriefingResponse = {
  configured: boolean;
  categories: GovernmentBriefingCategory[];
  articles: GovernmentBriefingArticle[];
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
