export type RangeKey = '1D' | '3M' | '1Y' | '5Y';
export type HistoryRangeKey = '1Y' | '3Y' | '5Y';
export type MainTabKey = 'todayFlow' | 'dashboard' | 'exchangeGuide' | 'koreaStatus' | 'ranking' | 'newsroom' | 'governmentBriefings' | 'dataSources' | 'calculator';
export type PageKey = MainTabKey | 'home' | 'serviceGuide';
export type ServiceStatusTone = 'healthy' | 'idle' | 'error';
export type FreshnessStatus = 'FRESH' | 'STALE' | 'MISSING';

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

export type ChartCandlestickPoint = {
  label: string;
  dateValue: string;
  x: number;
  value: number;
  latestValue: number | null;
  open: number;
  high: number;
  low: number;
  close: number;
  complete: boolean;
  sourcePointCount: number;
};

export type DollarIndexStatus = {
  latestBaseDate: string | null;
  fetchedAt: string | null;
};

export type IntradayTimeSeriesPoint = {
  observedAt: string;
  open: number;
  high: number;
  low: number;
  value: number;
};

export type IntradayCandlestickPoint = {
  observedAt: string;
  open: number;
  high: number;
  low: number;
  close: number;
  sourcePointCount: number;
  complete: boolean;
  fetchedAt: string;
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
  previousNeerRank: number | null;
  previousNeerValue: number | null;
  neerValueChange: number | null;
  fetchedAt: string;
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
  historyStartDate: string;
  historyEndDate: string;
};

export type ExchangeRateCalculatorMeta = {
  earliestAllowedDate: string;
  latestAllowedDate: string;
};

export type ExchangeRateSnapshotResponse = {
  currencyCode: string;
  requestedDate: string;
  historicalRate: ForeignExchangeRate | null;
  currentRate: ForeignExchangeRate | null;
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
  observedAt: string | null;
  previousValue: number | null;
  previousBaseDate: string | null;
  source: string;
  sourceUrl: string | null;
  fetchedAt: string | null;
  krwImpact: string;
  note: string;
  status: string;
  detailUrl: string | null;
  freshnessStatus: FreshnessStatus;
  staleReason: string | null;
  freshnessReason: string | null;
  expectedNextUpdateAt: string | null;
  lastSuccessfulFetchedAt: string | null;
  componentFreshnesses: IndicatorComponentFreshness[];
};

export type IndicatorComponentFreshness = {
  code: string;
  title: string;
  baseDate: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  source: string;
  sourceUrl: string | null;
  freshnessStatus: FreshnessStatus;
  freshnessReason: string | null;
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
  usdKrwIntradayCandles: IntradayCandlestickPoint[];
  dxyIndexSeries: TimeSeriesPoint[];
  dollarIndexSeries: TimeSeriesPoint[];
  advancedDollarIndexStatus: DollarIndexStatus;
  dollarIndexStatus: DollarIndexStatus;
  currencyStrengthRanks: CurrencyStrengthRank[];
  foreignExchangeRates: ForeignExchangeRate[];
  exchangeRateCalculator: ExchangeRateCalculatorMeta;
  domesticIndicators: DomesticIndicator[];
  dataSources: DataSourceInfo[];
  freshnessStatus: FreshnessStatus;
  staleReason: string | null;
  expectedNextUpdateAt: string | null;
  lastSuccessfulFetchedAt: string | null;
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
  sourceRuns?: SourceRunStatus[];
  backfillSession?: BackfillSessionStatus | null;
  holidayCalendars?: HolidayCalendarStatus[];
};

export type SourceRunStatus = {
  sourceName: string;
  status: string;
  rows: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type BackfillSessionStatus = {
  sessionKey: string;
  sessionStartDate: string;
  status: string;
  rows: number;
  previousLatestObservedAt: string | null;
  latestObservedAt: string | null;
  noChangeCount: number;
  attemptedAt: string;
  nextAllowedAt: string | null;
  message: string | null;
};

export type HolidayCalendarStatus = {
  year: number;
  status: string;
  lastSyncedAt: string | null;
  message: string | null;
};

export type NewsCategory = {
  code: string;
  name: string;
  query: string;
  articleCount: number;
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
  freshnessStatus?: FreshnessStatus;
  staleReason?: string | null;
  expectedNextUpdateAt?: string | null;
  lastSuccessfulFetchedAt?: string | null;
  latestSyncStatus?: string | null;
  latestSyncStartedAt?: string | null;
  latestSyncEndedAt?: string | null;
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
  koglType: string | null;
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
  freshnessStatus?: FreshnessStatus;
  staleReason?: string | null;
  expectedNextUpdateAt?: string | null;
  lastSuccessfulFetchedAt?: string | null;
  latestSyncStatus?: string | null;
  latestSyncStartedAt?: string | null;
  latestSyncEndedAt?: string | null;
};

export type ContentSyncStatus = {
  freshnessStatus?: FreshnessStatus | null;
  lastSuccessfulFetchedAt?: string | null;
  latestSyncStatus?: string | null;
  latestSyncStartedAt?: string | null;
  latestSyncEndedAt?: string | null;
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
  value: number | null;
  x: number;
  y: number;
};
