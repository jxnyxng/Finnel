// Frontend API gateway for backend dashboard, sync, news, and policy endpoints.
import axios from 'axios';
import type {
  DailyDashboardResponse,
  DashboardFeedResponse,
  GovernmentBriefingFilters,
  GovernmentBriefingResponse,
  NewsFilters,
  NewsResponse,
  SyncStatus
} from '../types';

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export type ContentLoadParams<TFilters> = {
  category: string;
  filters: TFilters;
  page: number;
};

export async function fetchDailyDashboard() {
  const response = await axios.get<DailyDashboardResponse>('/api/v1/dashboard/daily');
  return response.data;
}

export async function fetchMarketDataSyncStatus() {
  const response = await axios.get<SyncStatus>('/api/v1/sync/market-data/status');
  return response.data;
}

export async function fetchIntradayExchangeSyncStatus() {
  const response = await axios.get<SyncStatus>('/api/v1/sync/intraday-exchange/status');
  return response.data;
}

export async function fetchNews({ category, filters, page }: ContentLoadParams<NewsFilters>) {
  const response = await axios.get<NewsResponse>('/api/v1/news', {
    params: {
      category,
      from: filters.fromDate || undefined,
      keyword: filters.keyword || undefined,
      page,
      pageSize: 10,
      to: filters.toDate || undefined
    }
  });
  return response.data;
}

export async function fetchGovernmentBriefings({
  category,
  filters,
  page
}: ContentLoadParams<GovernmentBriefingFilters>) {
  const response = await axios.get<GovernmentBriefingResponse>('/api/v1/government-briefings', {
    params: {
      category,
      from: filters.fromDate || undefined,
      keyword: filters.keyword || undefined,
      page,
      pageSize: 12,
      to: filters.toDate || undefined
    }
  });
  return response.data;
}

export async function fetchDashboardFeed() {
  const response = await axios.get<DashboardFeedResponse>('/api/v1/today-flow');
  return response.data;
}
