// Navigation helpers for mapping browser paths to application pages and tabs.
import { mainTabs, pageRoutes } from '../constants';
import type { MainTabKey, PageKey } from '../types';

const pageRouteEntries = Object.entries(pageRoutes) as Array<[PageKey, string]>;
const mainTabKeys = new Set<MainTabKey>(mainTabs.map((tab) => tab.key));

export function getPageFromPath(pathname: string): PageKey {
  const normalizedPath = normalizePath(pathname);
  return pageRouteEntries.find(([, route]) => route === normalizedPath)?.[0] ?? 'home';
}

export function normalizePath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '');
  return normalizedPath === '' ? '/' : normalizedPath;
}

export function getMainTabKey(page: PageKey): MainTabKey | null {
  return mainTabKeys.has(page as MainTabKey) ? page as MainTabKey : null;
}
