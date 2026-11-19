import { canAddPage, canSaveStory } from '../src/access/accessPolicy';

test('Free allows four pages and Pro can add beyond that', () => {
  expect(canAddPage(false, 3)).toBe(true);
  expect(canAddPage(false, 4)).toBe(false);
  expect(canAddPage(true, 100)).toBe(true);
});

test('Free has one new-file slot while an existing comic remains editable', () => {
  expect(canSaveStory(false, 0, false)).toBe(true);
  expect(canSaveStory(false, 1, false)).toBe(false);
  expect(canSaveStory(false, 1, true)).toBe(true);
  expect(canSaveStory(false, 3, true)).toBe(true);
  expect(canSaveStory(true, 100, false)).toBe(true);
});
