// Tests for compact pagination page number generation.
import { describe, expect, it } from 'vitest';

import { getPaginationPages } from './pagination';

describe('getPaginationPages', () => {
  it('shows the first five pages near the beginning', () => {
    expect(getPaginationPages(1, 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it('centers the current page when possible', () => {
    expect(getPaginationPages(5, 10)).toEqual([3, 4, 5, 6, 7]);
  });

  it('shows the last five pages near the end', () => {
    expect(getPaginationPages(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it('handles short page ranges', () => {
    expect(getPaginationPages(1, 3)).toEqual([1, 2, 3]);
  });
});
