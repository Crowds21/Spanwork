import { describe, expect, it } from 'vitest';

import { buildTaskTree } from '@/lib/taskTree';

describe('buildTaskTree', () => {
  it('groups and sorts by sortOrder', () => {
    const tree = buildTaskTree([
      { id: 'b', parentId: null, sortOrder: 2 } as never,
      { id: 'a', parentId: null, sortOrder: 1 } as never,
      { id: 'c', parentId: 'a', sortOrder: 1 } as never,
    ]);
    expect(tree.get(null)?.map((t) => t.id)).toEqual(['a', 'b']);
    expect(tree.get('a')?.map((t) => t.id)).toEqual(['c']);
  });

  it('uses null key for root tasks', () => {
    const tree = buildTaskTree([{ id: 'root', parentId: null, sortOrder: 0 } as never]);
    expect(tree.has(null)).toBe(true);
    expect(tree.get('root')).toBeUndefined();
  });
});
