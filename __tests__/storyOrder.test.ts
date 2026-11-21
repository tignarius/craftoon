import { compareStoryCreation, compareStoryOrder, libraryDropTarget } from '../src/utils/storyOrder';

const story = (id: string, updatedAt: string, createdAt?: string) => ({
  id, title: id, pageCount: 1, updatedAt, createdAt,
});

test('legacy comics stay newest-created first by their original ID timestamp after repeated edits', () => {
  const older = story('story-1000000000000', '2026-11-07T00:00:00Z');
  const newer = story('story-1100000000000', '2020-01-01T00:00:00Z');
  expect([newer, older].sort(compareStoryCreation)).toEqual([newer, older]);
  older.updatedAt = '2030-01-01T00:00:00Z';
  expect([newer, older].sort(compareStoryCreation)).toEqual([newer, older]);
});

test('equal creation timestamps use a stable ID tie break, independent of updatedAt', () => {
  const date = '2026-11-01T00:00:00Z';
  const a = story('a', '2026-11-07T00:00:00Z', date);
  const b = story('b', '2026-11-02T00:00:00Z', date);
  expect([b, a].sort(compareStoryCreation)).toEqual([a, b]);
});

test('manual order overrides creation dates while newly saved comics remain first', () => {
  const a = { ...story('a', '2026-11-10'), libraryOrder: 1 };
  const b = { ...story('b', '2026-11-01'), libraryOrder: 0 };
  const fresh = story('fresh', '2026-11-20');
  expect([a, fresh, b].sort(compareStoryOrder).map(item => item.id)).toEqual(['fresh', 'b', 'a']);
});

test('drop target follows current grid positions across rows, with no target outside the grid', () => {
  const frames = new Map([
    ['a', { x: 16, y: 16, width: 200, height: 260 }],
    ['b', { x: 232, y: 16, width: 200, height: 260 }],
    ['c', { x: 16, y: 296, width: 200, height: 260 }],
  ]);
  expect(libraryDropTarget(['a', 'b', 'c'], frames, 300, 50)).toBe(1);
  expect(libraryDropTarget(['a', 'b', 'c'], frames, 40, 320)).toBe(2);
  expect(libraryDropTarget(['a', 'b', 'c'], frames, 500, 800)).toBe(-1);
});
