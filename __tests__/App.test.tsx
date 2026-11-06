import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { Alert, TouchableOpacity } from 'react-native';

jest.mock('lucide-react-native', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
import SplashScreen from '../src/SplashScreen';
import LibraryScreen from '../src/LibraryScreen';
import { Header } from '../src/components/Header';
import { Workspace } from '../src/components/Workspace';
import { ComicReader } from '../src/components/ComicReader';
import { storyLibrary } from '../src/services/storyLibrary';

jest.mock('../src/SplashScreen', () => jest.fn(() => null));
jest.mock('../src/LibraryScreen', () => jest.fn(() => null));
jest.mock('../src/components/Header', () => ({ Header: jest.fn(() => null) }));
jest.mock('../src/components/Workspace', () => ({ Workspace: jest.fn(() => null) }));
jest.mock('../src/components/ComicReader', () => ({ ComicReader: jest.fn(() => null) }));
jest.mock('../src/services/storyLibrary', () => ({ storyLibrary: {
  capturePages: jest.fn(), restorePages: jest.fn(), loadStory: jest.fn(), saveStory: jest.fn(), printStory: jest.fn(),
} }));

const pages = [0, 1].map(index => ({ id: `page-${index}`, panels: [], bubbles: [] }));
let renderer: ReactTestRenderer.ReactTestRenderer;
beforeEach(async () => {
  jest.clearAllMocks();
  Object.values(storyLibrary).forEach(method => (method as jest.Mock).mockReset());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items);
  (storyLibrary.restorePages as jest.Mock).mockResolvedValue(undefined);
  (storyLibrary.saveStory as jest.Mock).mockResolvedValue({});
  (storyLibrary.loadStory as jest.Mock).mockResolvedValue({ id: 'book', title: 'Book', pages });
  (storyLibrary.printStory as jest.Mock).mockResolvedValue(false);
  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await act(async () => renderer.root.findByType(SplashScreen).props.onLoadStory());
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.restoreAllMocks(); });

test('read mode has no editable workspace; edit resumes on the same page', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'reader'));
  expect(renderer.root.findAllByType(Workspace)).toHaveLength(0);
  expect(renderer.root.findByType(Header).props.reading).toBe(true);
  await act(async () => renderer.root.findByType(ComicReader).props.onPageChange(1));
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  await act(async () => renderer.root.findByType(Header).props.onPrint());
  expect(storyLibrary.printStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'book', pages }));
  await act(async () => renderer.root.findByType(Header).props.onEdit());
  expect(renderer.root.findAllByType(ComicReader)).toHaveLength(0);
  expect(renderer.root.findByType(Workspace)).toBeDefined();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
});

test('canvas opens read mode directly and preserves the current page without saving', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  expect(renderer.root.findByType(Workspace)).toBeDefined();
  expect(renderer.root.findAllByType(ComicReader)).toHaveLength(0);
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(renderer.root.findByType(ComicReader).props.pageIndex).toBe(1);
  expect(renderer.root.findAllByType(Workspace)).toHaveLength(0);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(Header).props.onEdit());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
});


test('canvas side arrows move through existing pages and append only at the end, preserving artwork', async () => {
  const arrow = (label: string) => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === label)!;
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  expect(arrow('Previous canvas page')).toBeUndefined();
  await act(async () => arrow('Next canvas page').props.onPress());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(2);
  expect(arrow('Previous canvas page')).toBeDefined();
  await act(async () => arrow('Add next canvas page').props.onPress());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(3);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  await act(async () => arrow('Previous canvas page').props.onPress());
  await act(async () => arrow('Previous canvas page').props.onPress());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  expect(arrow('Previous canvas page')).toBeUndefined();
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(arrow('Previous canvas page')).toBeUndefined();
  expect(arrow('Add next canvas page')).toBeUndefined();
});

const savedOther = { id: 'other', title: 'Other comic', pages: [{ id: 'other-page', panels: [], bubbles: [] }] };
const startEditedDraft = async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  (storyLibrary.loadStory as jest.Mock).mockClear();
};
const switchDialog = () => (Alert.alert as jest.Mock).mock.calls
  .find(call => call[0] === 'Save current comic?')!;

// Library was opened from the splash screen in beforeEach.
test('returning from the initial Library opens one new blank canvas', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
});

test('Library captures latest native ink without saving and returns to the same draft page', async () => {
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'latest-native-ink' })),
  })));
  await startEditedDraft();
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  expect(storyLibrary.restorePages).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ panels: [expect.objectContaining({ drawingData: 'latest-native-ink' })] }),
  ]));
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('latest-native-ink');
});

test('opening the current comic resumes its unsaved draft instead of its older file', async () => {
  await startEditedDraft();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  expect(storyLibrary.loadStory).not.toHaveBeenCalled();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  expect(switchDialog()).toBeUndefined();
});

test('reading a different comic preserves the current canvas draft and page', async () => {
  await startEditedDraft();
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(savedOther);
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('other', 'reader'));
  expect(renderer.root.findByType(ComicReader).props.pages).toEqual(savedOther.pages);
  expect(switchDialog()).toBeUndefined();
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
});

test.each(['Cancel', "Don't Save", 'Save'])('%s controls switching to another comic', async choice => {
  await startEditedDraft();
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(savedOther);
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(LibraryScreen).props.onOpen('other', 'editor'); });
  expect(switchDialog()).toBeDefined();
  expect(storyLibrary.loadStory).not.toHaveBeenCalled();
  await act(async () => {
    switchDialog()[2].find((button: any) => button.text === choice).onPress();
    await pending;
  });
  if (choice === 'Cancel') {
    expect(renderer.root.findByType(LibraryScreen)).toBeDefined();
    expect(storyLibrary.loadStory).not.toHaveBeenCalled();
    expect(storyLibrary.saveStory).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
    expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  } else {
    expect(storyLibrary.loadStory).toHaveBeenCalledWith('other');
    expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
    expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
    if (choice === 'Save') {
      expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'book', pages: expect.any(Array) }));
      expect((storyLibrary.saveStory as jest.Mock).mock.invocationCallOrder[0])
        .toBeLessThan((storyLibrary.loadStory as jest.Mock).mock.invocationCallOrder[0]);
    } else { expect(storyLibrary.saveStory).not.toHaveBeenCalled(); }
  }
});

test('a failed save keeps the existing draft and prevents switching', async () => {
  await startEditedDraft();
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(LibraryScreen).props.onOpen('other', 'editor'); });
  await act(async () => {
    switchDialog()[2].find((button: any) => button.text === 'Save').onPress();
    await pending;
  });
  expect(storyLibrary.loadStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
});

test('a failed load after choosing not to save still preserves the draft', async () => {
  await startEditedDraft();
  (storyLibrary.loadStory as jest.Mock).mockRejectedValueOnce(new Error('invalid file'));
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(LibraryScreen).props.onOpen('other', 'editor'); });
  await act(async () => {
    switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress();
    await pending;
  });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
});
