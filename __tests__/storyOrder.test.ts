import { compareStoryCreation } from '../src/utils/storyOrder';

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
