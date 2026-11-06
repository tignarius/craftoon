import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert, TouchableOpacity } from 'react-native';
import LibraryScreen from '../src/LibraryScreen';
import { storyLibrary } from '../src/services/storyLibrary';

jest.mock('lucide-react-native', () => ({ BookOpen: () => null, SquarePen: () => null, LibraryBig: () => null, Printer: () => null, Trash2: () => null, Glasses: () => null, Pencil: () => null }));
jest.mock('../src/services/storyLibrary', () => ({ storyLibrary: {
  loadStory: jest.fn(), printStory: jest.fn(), listStories: jest.fn(), deleteStory: jest.fn(), restoreStory: jest.fn(),
} }));

const comic = { id: 'alpha', title: 'Alpha', updatedAt: '2026-11-04T12:00:00Z', pageCount: 2 };
let renderer: ReactTestRenderer.ReactTestRenderer;
const onOpen = jest.fn(async () => {});
const onDeleted = jest.fn();
const onHome = jest.fn();
const button = (label: string) => renderer.root.findAllByType(TouchableOpacity)
  .find(item => item.props.accessibilityLabel === label)!;

beforeEach(async () => {
  jest.clearAllMocks();
  (storyLibrary.listStories as jest.Mock).mockResolvedValue([comic]);
  (storyLibrary.deleteStory as jest.Mock).mockResolvedValue({ token: 'receipt' });
  (storyLibrary.restoreStory as jest.Mock).mockResolvedValue(comic);
  await act(async () => {
    renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />);
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

test('click selects and shows actions; the next click deselects even when rapid', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  expect(button('Read Alpha')).toBeDefined();
  expect(button('Edit Alpha')).toBeDefined();
  expect(button('Delete Alpha')).toBeDefined();
  clock.mockReturnValue(1100);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(false);
  expect(button('Read Alpha')).toBeUndefined();
  expect(button('Edit Alpha')).toBeUndefined();
  expect(button('Delete Alpha')).toBeUndefined();
  expect(button('Print selected comic').props.disabled).toBe(true);
  expect(onOpen).not.toHaveBeenCalled();
});

test('Canvas opens a selected comic in edit mode', async () => {
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Open Canvas').props.onPress());
  expect(onOpen).toHaveBeenCalledWith('alpha', 'editor');
});

test('delete removes the card without opening it, and Undo restores it', async () => {
  await act(async () => button('Alpha').props.onPress());
  const event = { stopPropagation: jest.fn() };
  await act(async () => button('Delete Alpha').props.onPress(event));
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(storyLibrary.deleteStory).toHaveBeenCalledWith('alpha');
  expect(onOpen).not.toHaveBeenCalled();
  expect(onDeleted).toHaveBeenCalledWith('alpha');
  expect(button('Alpha')).toBeUndefined();
  await act(async () => button('Restore Alpha').props.onPress());
  expect(storyLibrary.restoreStory).toHaveBeenCalledWith('receipt');
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});

test('a failed delete keeps the comic and does not report it deleted', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (storyLibrary.deleteStory as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Delete Alpha').props.onPress({ stopPropagation: jest.fn() }));
  expect(button('Alpha')).toBeDefined();
  expect(onDeleted).not.toHaveBeenCalled();
});


test.each(['Read', 'Edit'])('%s action opens the chosen mode without a second card click', async action => {
  await act(async () => button('Alpha').props.onPress());
  const event = { stopPropagation: jest.fn() };
  await act(async () => button(`${action} Alpha`).props.onPress(event));
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledWith('alpha', action === 'Read' ? 'reader' : 'editor');
});


test('library prints the selected comic without opening an editor or reader', async () => {
  const story = { ...comic, pages: [{ id: 'one', panels: [], bubbles: [] }] };
  (storyLibrary.loadStory as jest.Mock).mockResolvedValue(story);
  (storyLibrary.printStory as jest.Mock).mockResolvedValue(false);
  expect(button('Print selected comic').props.disabled).toBe(true);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Print selected comic').props.disabled).toBe(false);
  await act(async () => button('Print selected comic').props.onPress());
  expect(storyLibrary.loadStory).toHaveBeenCalledWith('alpha');
  expect(storyLibrary.printStory).toHaveBeenCalledWith(story);
  expect(onOpen).not.toHaveBeenCalled();
});


test('Canvas returns to the prior draft after deselecting a comic', async () => {
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Open Canvas').props.onPress());
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
});
