// Tests for browser path to page and main-tab navigation helpers.
import { describe, expect, it } from 'vitest';
import { getMainTabKey, getPageFromPath, normalizePath } from './navigation';

describe('navigation helpers', () => {
  it('normalizes trailing slashes without changing the root path', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/dashboard/')).toBe('/dashboard');
    expect(normalizePath('/policy-briefings///')).toBe('/policy-briefings');
  });

  it('maps known routes to pages and falls back to home', () => {
    expect(getPageFromPath('/')).toBe('home');
    expect(getPageFromPath('/dashboard')).toBe('dashboard');
    expect(getPageFromPath('/indicators/')).toBe('koreaStatus');
    expect(getPageFromPath('/unknown')).toBe('home');
  });

  it('returns a main tab only for pages that are part of the main tab bar', () => {
    expect(getMainTabKey('dashboard')).toBe('dashboard');
    expect(getMainTabKey('governmentBriefings')).toBe('governmentBriefings');
    expect(getMainTabKey('home')).toBeNull();
    expect(getMainTabKey('serviceGuide')).toBeNull();
  });
});
