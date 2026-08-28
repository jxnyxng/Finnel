import { describe, expect, it } from 'vitest';
import { appendUniqueBy } from './collection';

describe('appendUniqueBy', () => {
  it('appends only items whose keys are not already present', () => {
    const currentItems = [
      { id: 'a', label: 'first' },
      { id: 'b', label: 'second' }
    ];
    const nextItems = [
      { id: 'b', label: 'duplicate' },
      { id: 'c', label: 'third' }
    ];

    expect(appendUniqueBy(currentItems, nextItems, (item) => item.id)).toEqual([
      { id: 'a', label: 'first' },
      { id: 'b', label: 'second' },
      { id: 'c', label: 'third' }
    ]);
  });
});
