import { describe, expect, it } from 'vitest';

import type { TaskDto } from '@spanwork/shared-types';

import { canStartTimer, filterTasksByStatuses, filterTasksForTree, isManualTimeEntryAllowed } from '@/lib/taskUtils';

describe('canStartTimer', () => {
  it('disallows done tasks', () => {
    expect(
      canStartTimer({
        isMilestone: false,
        parentId: undefined,
        status: 'done',
        timeTrackable: undefined,
        timerStartable: undefined,
      }),
    ).toBe(false);
  });

  it('respects timerStartable override', () => {
    expect(
      canStartTimer({
        isMilestone: false,
        parentId: undefined,
        status: 'todo',
        timeTrackable: undefined,
        timerStartable: false,
      }),
    ).toBe(false);
  });
});

describe('isManualTimeEntryAllowed', () => {
  it('disallows milestone root with children', () => {
    expect(
      isManualTimeEntryAllowed({
        isMilestone: true,
        parentId: undefined,
        childCount: 2,
        timeTrackable: undefined,
      }),
    ).toBe(false);
  });
});

describe('filterTasksForTree', () => {
  const tasks = [
    { id: 'root', parentId: null, status: 'todo' as const, sortOrder: 0 },
    { id: 'child', parentId: 'root', status: 'done' as const, sortOrder: 0 },
  ] as TaskDto[];

  it('returns all when filter is all', () => {
    expect(filterTasksForTree(tasks, 'all')).toHaveLength(2);
  });

  it('keeps ancestors of matching nodes', () => {
    const filtered = filterTasksForTree(tasks, 'done');
    expect(filtered.map((t) => t.id)).toEqual(['root', 'child']);
  });
});

describe('filterTasksByStatuses', () => {
  it('keeps ancestors of matching nodes', () => {
    const tasks = [
      { id: 'a', parentId: undefined, status: 'todo' as const, sortOrder: 0 },
      { id: 'b', parentId: 'a', status: 'done' as const, sortOrder: 0 },
    ] as TaskDto[];
    expect(filterTasksByStatuses(tasks, ['done'])).toHaveLength(2);
  });

  it('filters to selected statuses only', () => {
    const tasks = [
      { id: 'a', parentId: undefined, status: 'todo' as const, sortOrder: 0 },
      { id: 'b', parentId: undefined, status: 'cancelled' as const, sortOrder: 0 },
    ] as TaskDto[];
    expect(filterTasksByStatuses(tasks, ['todo', 'in_progress'])).toHaveLength(1);
  });
});
