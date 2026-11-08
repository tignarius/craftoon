import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';
import { Alert, AppState, TextInput, TouchableOpacity } from 'react-native';

jest.mock('lucide-react-native', () => ({ ChevronLeft: () => null, ChevronRight: () => null, Plus: () => null, X: () => null, SquarePen: () => null, LibraryBig: () => null, Glasses: () => null, Sparkles: () => null, Check: () => null }));
jest.mock('../src/services/canvasOrientation', () => ({ lockCanvasOrientation: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/components/CanvasOrientationPicker', () => ({ CanvasOrientationPicker: jest.fn(() => null) }));
import SplashScreen from '../src/SplashScreen';
import LibraryScreen from '../src/LibraryScreen';
import { CanvasOrientationPicker } from '../src/components/CanvasOrientationPicker';
import { lockCanvasOrientation } from '../src/services/canvasOrientation';
import { SaveComicDialog } from '../src/components/SaveComicDialog';
import { Header } from '../src/components/Header';
import { Workspace } from '../src/components/Workspace';
import { ComicReader } from '../src/components/ComicReader';
import { storyLibrary } from '../src/services/storyLibrary';
import { proAccess } from '../src/services/proAccess';

jest.mock('../src/services/proAccess', () => ({ proAccess: {
  getStatus: jest.fn(), purchase: jest.fn(), restore: jest.fn(), subscribe: jest.fn(() => () => {}),
} }));
const proStatus = { isPro: true, canPurchase: true, displayPrice: '$4.99', productId: 'test.pro', appVersion: '1.0', developerName: 'Test Studio' };
jest.mock('../src/SplashScreen', () => jest.fn(() => null));
jest.mock('../src/LibraryScreen', () => jest.fn(() => null));
jest.mock('../src/components/Header', () => ({ Header: jest.fn(() => null) }));
jest.mock('../src/components/Workspace', () => ({ Workspace: jest.fn(() => null) }));
jest.mock('../src/components/ComicReader', () => ({ ComicReader: jest.fn(() => null) }));
jest.mock('../src/services/storyLibrary', () => ({ storyLibrary: {
  saveDraft: jest.fn(), loadDraft: jest.fn(),
  capturePages: jest.fn(), restorePages: jest.fn(), loadStory: jest.fn(), saveStory: jest.fn(), printStory: jest.fn(), emailStory: jest.fn(),
} }));

const pages = [0, 1].map(index => ({ id: `page-${index}`, panels: [], bubbles: [] }));
let renderer: ReactTestRenderer.ReactTestRenderer;
const chooseFormat = async (orientation = 'portrait') => {
  const picker = renderer.root.findByType(CanvasOrientationPicker);
  if (picker.props.visible) { await act(async () => picker.props.onSelect(orientation)); }
};
beforeEach(async () => {
  AppState.currentState = 'active';
  jest.clearAllMocks();
  (proAccess.getStatus as jest.Mock).mockReset().mockResolvedValue(proStatus);
  (proAccess.purchase as jest.Mock).mockReset().mockResolvedValue({ ...proStatus, outcome: 'purchased' });
  (proAccess.restore as jest.Mock).mockReset().mockResolvedValue({ ...proStatus, outcome: 'restored' });
  Object.values(storyLibrary).forEach(method => (method as jest.Mock).mockReset());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValue(null);
  (storyLibrary.saveDraft as jest.Mock).mockResolvedValue(undefined);
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items);
  (storyLibrary.restorePages as jest.Mock).mockResolvedValue(undefined);
  (storyLibrary.saveStory as jest.Mock).mockResolvedValue({});
  (storyLibrary.loadStory as jest.Mock).mockResolvedValue({ id: 'book', title: 'Book', pages });
  (storyLibrary.printStory as jest.Mock).mockResolvedValue(false);
  (storyLibrary.emailStory as jest.Mock).mockResolvedValue(false);
  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await act(async () => renderer.root.findByType(SplashScreen).props.onLoadStory());
});
afterEach(async () => { await act(async () => renderer.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

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


test('canvas sides show triangles for existing pages and plus at the ends, preserving artwork', async () => {
  const arrow = (label: string) => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === label)!;
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  expect(arrow('Previous canvas page')).toBeUndefined();
  expect(arrow('Add previous canvas page')).toBeUndefined();
  expect(arrow('Next canvas page')).toBeDefined();
  expect(arrow('Add next canvas page')).toBeUndefined();
  await act(async () => arrow('Next canvas page').props.onPress());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(2);
  expect(arrow('Previous canvas page')).toBeDefined();
  expect(arrow('Next canvas page')).toBeUndefined();
  await act(async () => arrow('Add next canvas page').props.onPress());
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(3);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  await act(async () => arrow('Previous canvas page').props.onPress());
  await act(async () => arrow('Previous canvas page').props.onPress());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  expect(arrow('Previous canvas page')).toBeUndefined();
  expect(arrow('Add previous canvas page')).toBeUndefined();
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(arrow('Previous canvas page')).toBeUndefined();
  expect(arrow('Add previous canvas page')).toBeUndefined();
  expect(arrow('Add next canvas page')).toBeUndefined();
});

const savedOther = { id: 'other', title: 'Other comic', pages: [{ id: 'other-page', panels: [], bubbles: [] }] };
const startEditedDraft = async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  (storyLibrary.loadStory as jest.Mock).mockClear();
};
const startUnsavedDraft = async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
};
const switchDialog = () => (Alert.alert as jest.Mock).mock.calls
  .find(call => call[0] === 'Save current comic?')!;

// Library was opened from the splash screen in beforeEach.
test('returning from the initial Library opens one new blank canvas', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
});

test('Library saves latest native ink to the existing name and returns to the same draft page', async () => {
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'latest-native-ink' })),
  })));
  await startEditedDraft();
  expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({
    id: 'book', title: 'Book', pages: expect.arrayContaining([
      expect.objectContaining({ panels: [expect.objectContaining({ drawingData: 'latest-native-ink' })] }),
    ]),
  }));
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
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
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
});

test.each(['Cancel', "Don't Save", 'Save'])('%s controls switching to another comic', async choice => {
  await startUnsavedDraft();
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
  await chooseFormat();
    expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  } else {
    expect(storyLibrary.loadStory).toHaveBeenCalledWith('other');
    expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
    expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
    if (choice === 'Save') {
      expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ title: 'Untitled comic', pages: expect.any(Array) }));
      expect((storyLibrary.saveStory as jest.Mock).mock.invocationCallOrder[0])
        .toBeLessThan((storyLibrary.loadStory as jest.Mock).mock.invocationCallOrder[0]);
    } else { expect(storyLibrary.saveStory).not.toHaveBeenCalled(); }
  }
});

test('a failed save keeps the existing draft and prevents switching', async () => {
  await startUnsavedDraft();
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(LibraryScreen).props.onOpen('other', 'editor'); });
  await act(async () => {
    switchDialog()[2].find((button: any) => button.text === 'Save').onPress();
    await pending;
  });
  expect(storyLibrary.loadStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
});

test('a failed load after choosing not to save still preserves the draft', async () => {
  await startUnsavedDraft();
  (storyLibrary.loadStory as jest.Mock).mockRejectedValueOnce(new Error('invalid file'));
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(LibraryScreen).props.onOpen('other', 'editor'); });
  await act(async () => {
    switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress();
    await pending;
  });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(2);
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
});


test('saved comics update silently under the same id and title', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(Alert.prompt).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'book', title: 'Book' }));
});

test('saved comic edits autosave after a brief pause', async () => {
  jest.useFakeTimers();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'book', title: 'Book' }));
  expect(Alert.prompt).not.toHaveBeenCalled();
});

test('blank canvas edits can undo and redo, including New comic and its captured ink', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  expect(renderer.root.findByType(Header).props.showHistory).toBe(false);
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  expect(renderer.root.findByType(Header).props.canUndo).toBe(true);
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(renderer.root.findByType(Header).props.canRedo).toBe(true);
  await act(async () => renderer.root.findByType(Header).props.onRedo());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'final-ink' })),
  })));
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  await act(async () => switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress());
  await chooseFormat();
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('final-ink');
  await act(async () => renderer.root.findByType(Header).props.onRedo());
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
});

test('undo across pages restores the correct page and branching discards redo', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 40, y: 40, width: 200, height: 200 }));
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  await act(async () => renderer.root.findByType(Workspace).props.onAddBubble());
  expect(renderer.root.findByType(Header).props.canRedo).toBe(false);
});


test('first save asks for a name once and later saves reuse it, including after undo', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(true);
  await act(async () => renderer.root.findByType(TextInput).props.onChangeText('My comic'));
  await act(async () => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === 'Confirm save comic')!.props.onPress());
  const id = (storyLibrary.saveStory as jest.Mock).mock.calls[0][0].id;
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(false);
  expect(Alert.prompt).not.toHaveBeenCalled();
  expect(storyLibrary.saveStory).toHaveBeenLastCalledWith(expect.objectContaining({ id, title: 'My comic' }));
});

test('failed autosave on library entry leaves the saved comic open with its edits', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  expect(renderer.root.findAllByType(LibraryScreen)).toHaveLength(0);
});


test('reader emails the displayed preview without exporting the background draft', async () => {
  await startEditedDraft();
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(savedOther);
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('other', 'reader'));
  await act(async () => renderer.root.findByType(Header).props.onEmail());
  expect(storyLibrary.emailStory).toHaveBeenCalledWith(savedOther);
});

test('reader emails fresh native ink from the current canvas and canvas cannot export', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onEmail());
  await act(async () => renderer.root.findByType(Header).props.onPrint());
  expect(storyLibrary.emailStory).not.toHaveBeenCalled();
  expect(storyLibrary.printStory).not.toHaveBeenCalled();
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'latest-ink' })),
  })));
  await act(async () => renderer.root.findByType(Header).props.onRead());
  await act(async () => renderer.root.findByType(Header).props.onEmail());
  expect(storyLibrary.emailStory).toHaveBeenCalledWith(expect.objectContaining({
    pages: expect.arrayContaining([expect.objectContaining({ panels: [expect.objectContaining({ drawingData: 'latest-ink' })] })]),
  }));
});


test('name dialog keeps the entered name after a failed save and supports immediate retry', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  await act(async () => renderer.root.findByType(TextInput).props.onChangeText('My iPad comic'));
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('storage busy'));
  await act(async () => renderer.root.findByType(SaveComicDialog).props.onSave());
  let dialog = renderer.root.findByType(SaveComicDialog);
  expect(dialog.props.visible).toBe(true);
  expect(dialog.props.name).toBe('My iPad comic');
  expect(dialog.props.error).toContain('Could not save');
  expect(dialog.props.saving).toBe(false);
  await act(async () => renderer.root.findByType(SaveComicDialog).props.onSave());
  dialog = renderer.root.findByType(SaveComicDialog);
  expect(dialog.props.visible).toBe(false);
  expect(storyLibrary.saveStory).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'My iPad comic' }));
});

test('canceling the name dialog releases the save lock without changing the canvas', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  await act(async () => renderer.root.findByType(SaveComicDialog).props.onCancel());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  expect(renderer.root.findByType(LibraryScreen)).toBeDefined();
});

test('rapid confirmation saves once and shows progress until the write finishes', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  let finish!: (value: object) => void;
  (storyLibrary.saveStory as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const confirm = renderer.root.findByType(SaveComicDialog).props.onSave;
  let pending!: Promise<void>;
  await act(async () => { pending = confirm(); await confirm(); });
  expect(storyLibrary.saveStory).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(SaveComicDialog).props.saving).toBe(true);
  await act(async () => { finish({}); await pending; });
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(false);
});


test('new canvas asks for orientation and cancel leaves the library untouched', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
  expect(renderer.root.findAllByType(Workspace)).toHaveLength(0);
  await act(async () => renderer.root.findByType(CanvasOrientationPicker).props.onCancel());
  expect(renderer.root.findByType(LibraryScreen)).toBeDefined();
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
});

test('added pages inherit the original canvas format without showing a chooser', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  const panel = { x: 40, y: 50, width: 400, height: 200 };
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel(panel));
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels[0]).toEqual(expect.objectContaining(panel));
  await act(async () => renderer.root.findByType(Workspace).props.onSheetBoundsChange({ width: 300, height: 700 }));
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  await act(async () => renderer.root.findByType(Header).props.onRead());
  const document = renderer.root.findByType(ComicReader).props.pages;
  expect(document).toHaveLength(2);
  document.forEach((page: any) => expect(page).toEqual(expect.objectContaining({ orientation: 'landscape', canvasSize: { width: 1200, height: 900 } })));
});

test('Library unlocks rotation and returning to Canvas restores the saved page lock', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('automatic');
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('automatic');
});

test('loading an older landscape canvas restores its dimensions and orientation', async () => {
  const legacy = { id: 'wide', title: 'Wide', pages: [{ id: 'wide-page', panels: [], bubbles: [], canvasSize: { width: 1100, height: 700 } }] };
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(legacy);
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('wide', 'editor'));
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1100, height: 700 });
});


test('legacy mixed pages stay intact, but new pages inherit the first page format', async () => {
  const legacyPages = [
    { id: 'wide-page', orientation: 'landscape', canvasSize: { width: 1100, height: 700 }, panels: [], bubbles: [] },
    { id: 'tall-page', orientation: 'portrait', canvasSize: { width: 900, height: 1200 }, panels: [], bubbles: [] },
  ];
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ id: 'mixed', title: 'Mixed', pages: legacyPages });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('mixed', 'editor'));
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('portrait');
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1100, height: 700 });
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
  await act(async () => renderer.root.findByType(Header).props.onRead());
  const result = renderer.root.findByType(ComicReader).props.pages;
  expect(result.slice(0, 2)).toEqual(legacyPages);
  expect(result[2]).toEqual(expect.objectContaining({ orientation: 'landscape', canvasSize: { width: 1100, height: 700 } }));
});


test.each(['Cancel', "Don't Save", 'Save'])('new comic offers %s before the format picker', async choice => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  await act(async () => switchDialog()[2].find((button: any) => button.text === choice).onPress?.());
  if (choice === 'Cancel') {
    expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
    expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  } else {
    if (choice === 'Save') {
      expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(true);
      expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
      await act(async () => renderer.root.findByType(SaveComicDialog).props.onChangeName('Before new'));
      await act(async () => renderer.root.findByType(SaveComicDialog).props.onSave());
      expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ title: 'Before new' }));
    }
    expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
    await chooseFormat();
    expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  }
});

test('failed save or canceled naming during New preserves the draft', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  await act(async () => switchDialog()[2].find((button: any) => button.text === 'Save').onPress());
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('full'));
  await act(async () => renderer.root.findByType(SaveComicDialog).props.onSave());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  await act(async () => renderer.root.findByType(SaveComicDialog).props.onCancel());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
});

test('reading captures the last native stroke before the canvas unmounts', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'fresh-native-stroke' })),
  })));
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(renderer.root.findByType(ComicReader).props.pages[0].panels[0].drawingData).toBe('fresh-native-stroke');
});


test('the page menu inserts after the current page, deletes it, and undo restores captured ink', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Header).props.onDeletePage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'captured-ink' })),
  })));
  await act(async () => renderer.root.findByType(Header).props.onDeletePage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('captured-ink');
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(3);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('captured-ink');
});

test('failed page deletion keeps every page open', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  (storyLibrary.capturePages as jest.Mock).mockRejectedValueOnce(new Error('capture failed'));
  await act(async () => renderer.root.findByType(Header).props.onDeletePage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(2);
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
});


test('deleting the only page keeps a blank page of the same format and undo restores ink', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  (storyLibrary.capturePages as jest.Mock).mockImplementation(async items => items.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'last-page-ink' })),
  })));
  await act(async () => renderer.root.findByType(Header).props.onDeletePage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('last-page-ink');
});

test('deleting the first of multiple pages retains the following pages in order', async () => {
  const document = [0, 1, 2].map(index => ({ id: `p${index}`, panels: [], bubbles: [] }));
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ id: 'three', title: 'Three', pages: document });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('three', 'editor'));
  await act(async () => renderer.root.findByType(Header).props.onDeletePage());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  await act(async () => renderer.root.findByType(Header).props.onRead());
  expect(renderer.root.findByType(ComicReader).props.pages.map((page: any) => page.id)).toEqual(['p1', 'p2']);
});

test('new canvas orientation menu retains the pressed button anchor', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  const anchor = { x: 70, y: 40, width: 44, height: 44 };
  await act(async () => renderer.root.findByType(Header).props.onNewStory(anchor));
  expect(renderer.root.findByType(CanvasOrientationPicker).props.anchor).toEqual(anchor);
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
});


test('Dont Save clears the canvas immediately and canceling format selection keeps it blank', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Workspace).props.onAddBubble());
  await act(async () => renderer.root.findByType(Header).props.onNextPage());
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  (storyLibrary.saveStory as jest.Mock).mockClear();
  await act(async () => switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(1);
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(renderer.root.findByType(Workspace).props.bubbles).toEqual([]);
  expect(renderer.root.findByType(Workspace).props.panelModes).toEqual({});
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
  await act(async () => renderer.root.findByType(CanvasOrientationPicker).props.onCancel());
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
});

test('changing format after Dont Save completes one new-comic action and undo restores the old comic', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  await act(async () => switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress());
  await chooseFormat('landscape');
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  await act(async () => renderer.root.findByType(Header).props.onRedo());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(0);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
});


test('right plus becomes a next arrow after creating the following page', async () => {
  const side = (label: string) => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === label)!;
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  expect(side('Add previous canvas page')).toBeUndefined();
  expect(side('Previous canvas page')).toBeUndefined();
  expect(side('Next canvas page')).toBeUndefined();
  await act(async () => side('Add next canvas page').props.onPress());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  expect(side('Previous canvas page')).toBeDefined();
  expect(side('Add next canvas page')).toBeDefined();
  await act(async () => side('Previous canvas page').props.onPress());
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  expect(side('Previous canvas page')).toBeUndefined();
  expect(side('Add previous canvas page')).toBeUndefined();
  expect(side('Next canvas page')).toBeDefined();
  expect(side('Add next canvas page')).toBeUndefined();
  await act(async () => side('Next canvas page').props.onPress());
  await act(async () => side('Previous canvas page').props.onPress());
  expect(side('Next canvas page')).toBeDefined();
  expect(side('Add next canvas page')).toBeUndefined();
});


test('manual save of an existing comic confirms only after success and clears after one second', async () => {
  jest.useFakeTimers();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  let finish!: (value: object) => void;
  (storyLibrary.saveStory as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = renderer.root.findByType(Header).props.onSaveStory(); });
  expect(renderer.root.findByType(Header).props.saveConfirmed).toBe(false);
  await act(async () => { finish({}); await pending; });
  expect(renderer.root.findByType(Header).props.saveConfirmed).toBe(true);
  await act(async () => { jest.advanceTimersByTime(999); });
  expect(renderer.root.findByType(Header).props.saveConfirmed).toBe(true);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(renderer.root.findByType(Header).props.saveConfirmed).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('failed manual save never shows saved confirmation', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  (storyLibrary.saveStory as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(renderer.root.findByType(Header).props.saveConfirmed).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Could not save', expect.any(String));
});

test('unnamed canvases are checkpointed and resume on the same page after restarting', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  await chooseFormat('landscape');
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  const calls = (storyLibrary.saveDraft as jest.Mock).mock.calls;
  const checkpoint = calls[calls.length - 1][0];
  expect(checkpoint.isSaved).toBe(false);
  expect(checkpoint.pageIndex).toBe(1);
  expect(checkpoint.pages[0].panels).toHaveLength(1);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  const recovered = { ...checkpoint, pages: checkpoint.pages.map((page: any) => ({
    ...page, panels: page.panels.map((panel: any) => ({ ...panel, drawingData: 'native-checkpoint-ink' })),
  })) };
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce(recovered);
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Header).props.totalPages).toBe(2);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
  expect(storyLibrary.restorePages).toHaveBeenCalledWith(recovered.pages);
  await act(async () => renderer.root.findByType(Header).props.onPrevPage());
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('native-checkpoint-ink');
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(true);
});

test('a recovered named comic saves to its original Library id and title', async () => {
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce({
    id: 'named', title: 'My saved comic', isSaved: true, pageIndex: 50,
    pages: [{ id: 'restored-page', panels: [], bubbles: [] }], updatedAt: new Date().toISOString(),
  });
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(0);
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(storyLibrary.saveStory).toHaveBeenCalledWith(expect.objectContaining({ id: 'named', title: 'My saved comic' }));
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(false);
});

test('startup does not overwrite a checkpoint while recovery is still loading', async () => {
  let finish!: (value: null) => void;
  (storyLibrary.loadDraft as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  (storyLibrary.saveDraft as jest.Mock).mockClear();
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findAllByType(SplashScreen)).toHaveLength(0);
  expect(renderer.root.findAllByType(Workspace)).toHaveLength(0);
  expect(storyLibrary.saveDraft).not.toHaveBeenCalled();
  await act(async () => { finish(null); });
  expect(renderer.root.findByType(SplashScreen)).toBeDefined();
});

test('discarding a recovered draft replaces its checkpoint with a new blank canvas', async () => {
  const draft = { id: 'recovered', title: 'Untitled comic', isSaved: false, pageIndex: 0,
    pages: [{ id: 'recovered-page', panels: [{ id: 'p', x: 12, y: 12, width: 120, height: 120 }], bubbles: [] }],
    updatedAt: new Date().toISOString() };
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce(draft);
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  await act(async () => switchDialog()[2].find((button: any) => button.text === "Don't Save").onPress());
  const calls = (storyLibrary.saveDraft as jest.Mock).mock.calls;
  const latest = calls[calls.length - 1][0];
  expect(latest.id).not.toBe(draft.id);
  expect(latest.pages).toHaveLength(1);
  expect(latest.pages[0].panels).toEqual([]);
});


test('restoring waits for the draft before requesting its orientation', async () => {
  let finish!: (value: object) => void;
  (storyLibrary.loadDraft as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => renderer.unmount());
  (lockCanvasOrientation as jest.Mock).mockClear();
  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  expect(lockCanvasOrientation).not.toHaveBeenCalled();
  await act(async () => finish({ id: 'restored-wide', title: 'Draft', isSaved: false, pageIndex: 0,
    pages: [{ id: 'wide', orientation: 'landscape', canvasSize: { width: 1200, height: 900 }, panels: [], bubbles: [] }],
    updatedAt: new Date().toISOString(),
  }));
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
});


test('backgrounding skips rotation requests and returning active reapplies the restored page orientation', async () => {
  await act(async () => renderer.unmount());
  const stateListeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener: any) => {
    stateListeners.push(listener);
    return { remove: jest.fn() };
  });
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce({ id: 'wide-draft', title: 'Draft',
    isSaved: false, pageIndex: 0, pages: [{ id: 'wide', orientation: 'landscape',
      canvasSize: { width: 1200, height: 900 }, panels: [], bubbles: [] }], updatedAt: new Date().toISOString() });
  await act(async () => { renderer = ReactTestRenderer.create(<App />); });
  (lockCanvasOrientation as jest.Mock).mockClear();
  await act(async () => stateListeners.forEach(listener => listener('background')));
  expect(lockCanvasOrientation).not.toHaveBeenCalled();
  await act(async () => stateListeners.forEach(listener => listener('active')));
  expect(lockCanvasOrientation).toHaveBeenCalledTimes(1);
  expect(lockCanvasOrientation).toHaveBeenLastCalledWith('landscape');
});

async function startFreeCanvas() {
  (proAccess.getStatus as jest.Mock).mockResolvedValue({ ...proStatus, isPro: false });
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  await act(async () => renderer.root.findByType(SplashScreen).props.onNewStory());
  await chooseFormat();
}

test('Free stops at four pages through page buttons and layout templates while keeping recovery', async () => {
  await startFreeCanvas();
  for (let index = 0; index < 3; index++) {
    await act(async () => renderer.root.findByType(Header).props.onAddPage());
  }
  expect(renderer.root.findByType(Header).props.totalPages).toBe(4);
  (storyLibrary.capturePages as jest.Mock).mockClear();
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(4);
  expect(storyLibrary.capturePages).not.toHaveBeenCalled();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onCreateLayout(2, 2));
  expect(renderer.root.findByType(Header).props.totalPages).toBe(4);
  const calls = (storyLibrary.saveDraft as jest.Mock).mock.calls;
  expect(calls[calls.length - 1][0].pages).toHaveLength(4);
});

test('Free gates Library save and reader export without discarding the drawing', async () => {
  await startFreeCanvas();
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  expect(renderer.root.findByType(SaveComicDialog).props.visible).toBe(false);
  expect(renderer.root.findByType(Workspace).props.panels).toHaveLength(1);
  await act(async () => renderer.root.findByType(Header).props.onRead());
  await act(async () => renderer.root.findByType(Header).props.onEmail());
  await act(async () => renderer.root.findByType(Header).props.onPrint());
  expect(storyLibrary.emailStory).not.toHaveBeenCalled();
  expect(storyLibrary.printStory).not.toHaveBeenCalled();
});

test('buying Pro immediately removes the page limit', async () => {
  await startFreeCanvas();
  for (let index = 0; index < 4; index++) {
    await act(async () => renderer.root.findByType(Header).props.onAddPage());
  }
  expect(renderer.root.findByType(Header).props.totalPages).toBe(4);
  const buy = renderer.root.findAllByType(TouchableOpacity).find(button => button.props.accessibilityLabel === 'Buy Craftoon Pro')!;
  await act(async () => buy.props.onPress());
  expect(proAccess.purchase).toHaveBeenCalledTimes(1);
  await act(async () => renderer.root.findByType(Header).props.onAddPage());
  expect(renderer.root.findByType(Header).props.totalPages).toBe(5);
});

test('Free can reopen older comics over four pages without truncation or autosaving them', async () => {
  jest.useFakeTimers();
  (proAccess.getStatus as jest.Mock).mockResolvedValue({ ...proStatus, isPro: false });
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce({ id: 'legacy', title: 'Legacy', isSaved: true, pageIndex: 5,
    pages: Array.from({ length: 6 }, (_, i) => ({ id: `legacy-${i}`, panels: [], bubbles: [] })), updatedAt: new Date().toISOString() });
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(renderer.root.findByType(Header).props.totalPages).toBe(6);
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(5);
  expect(storyLibrary.saveStory).not.toHaveBeenCalled();
  expect(storyLibrary.saveDraft).toHaveBeenCalled();
});

test.each([
  ['moving', { x: 50 }],
  ['resizing', { width: 180 }],
  ['drawing in', { drawingData: 'new-ink' }],
])('%s a panel brings it to the front and preserves its order through undo, save and reopen', async (_action, updates) => {
  const overlapping = ['oldest', 'middle', 'newest'].map(id => ({
    id, x: 12, y: 12, width: 120, height: 120,
  }));
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({
    id: 'book', title: 'Book', pages: [{ id: 'overlap-page', panels: overlapping, bubbles: [] }],
  });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  const order = () => renderer.root.findByType(Workspace).props.panels.map((panel: { id: string }) => panel.id);
  await act(async () => renderer.root.findByType(Workspace).props.onUpdatePanel('oldest', updates));
  expect(order()).toEqual(['middle', 'newest', 'oldest']);
  expect(renderer.root.findByType(Workspace).props.panels[2]).toMatchObject(updates);
  // An unchanged callback from a different native canvas must not steal focus.
  await act(async () => renderer.root.findByType(Workspace).props.onUpdatePanel('middle', { x: 12 }));
  expect(order()).toEqual(['middle', 'newest', 'oldest']);
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(order()).toEqual(['oldest', 'middle', 'newest']);
  await act(async () => renderer.root.findByType(Header).props.onRedo());
  expect(order()).toEqual(['middle', 'newest', 'oldest']);
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  const calls = (storyLibrary.saveStory as jest.Mock).mock.calls;
  const saved = calls[calls.length - 1][0];
  expect(saved.pages[0].panels.map((panel: { id: string }) => panel.id)).toEqual(['middle', 'newest', 'oldest']);
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(saved);
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  expect(order()).toEqual(['middle', 'newest', 'oldest']);
});

test('selecting a covered panel or entering its drawing modes brings it forward immediately', async () => {
  const panels = ['back', 'front'].map(id => ({ id, x: 12, y: 12, width: 120, height: 120 }));
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({
    id: 'book', title: 'Book', pages: [{ id: 'overlap', panels, bubbles: [] }],
  });
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  const workspace = () => renderer.root.findByType(Workspace).props;
  const top = () => workspace().panels[workspace().panels.length - 1].id;
  await act(async () => workspace().onPanelSelect('back'));
  expect(top()).toBe('back');
  expect(workspace().panelModes.back).toBe('layout');
  await act(async () => renderer.root.findByType(Header).props.onUndo());
  expect(top()).toBe('front');
  await act(async () => workspace().onPanelDoubleTap('back'));
  expect(top()).toBe('back');
  expect(workspace().panelModes.back).toBe('draw');
  await act(async () => workspace().onModeChange('front', 'edit'));
  expect(top()).toBe('front');
  expect(workspace().panelModes.front).toBe('edit');
});

test('unsaved work resumes directly and remains available after Library browsing', async () => {
  const draft = { id: 'resume-draft', title: 'In progress', isSaved: false, pageIndex: 1,
    pages: [{ id: 'p1', panels: [], bubbles: [] }, { id: 'p2', panels: [
      { id: 'ink-panel', x: 12, y: 12, width: 120, height: 120, drawingData: 'recovered-ink' },
    ], bubbles: [] }], updatedAt: new Date().toISOString() };
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce(draft);
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findAllByType(SplashScreen)).toHaveLength(0);
  await act(async () => renderer.root.findByType(Header).props.onLoadStory());
  expect(renderer.root.findByType(LibraryScreen)).toBeDefined();
  await act(async () => renderer.root.findByType(LibraryScreen).props.onHome());
  expect(renderer.root.findByType(Header).props.currentPageIndex).toBe(1);
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('recovered-ink');
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
  const checkpoints = (storyLibrary.saveDraft as jest.Mock).mock.calls;
  expect(checkpoints[checkpoints.length - 1][0]).toMatchObject({ id: draft.id, pageIndex: 1, pages: draft.pages });
});

test('a fully saved recovery starts at Splash and Canvas asks for a fresh page orientation', async () => {
  const savedPages = [{ id: 'p', panels: [{ id: 'panel', x: 12, y: 12, width: 120, height: 120, drawingData: 'saved-ink' }], bubbles: [] }];
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce({ id: 'saved-book', title: 'Saved', isSaved: true,
    pages: savedPages, pageIndex: 0, updatedAt: new Date().toISOString() });
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ id: 'saved-book', title: 'Saved',
    pages: [{ bubbles: [], panels: savedPages[0].panels, id: 'p' }] });
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findByType(SplashScreen)).toBeDefined();
  expect(renderer.root.findAllByType(Workspace)).toHaveLength(0);
  await act(async () => renderer.root.findByType(SplashScreen).props.onNewStory());
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
  expect(Alert.alert).not.toHaveBeenCalled();
  await chooseFormat('landscape');
  expect(renderer.root.findByType(Workspace).props.panels).toEqual([]);
  expect(renderer.root.findByType(Workspace).props.canvasSize).toEqual({ width: 1200, height: 900 });
});

test.each([false, true])('a named recovery with unsaved ink resumes even if Library cannot load: %s', async missing => {
  const panel = { id: 'panel', x: 12, y: 12, width: 120, height: 120, drawingData: 'new-ink' };
  const draft = { id: 'saved-book', title: 'Saved', isSaved: true,
    pages: [{ id: 'p', panels: [panel], bubbles: [] }], pageIndex: 0, updatedAt: new Date().toISOString() };
  (storyLibrary.loadDraft as jest.Mock).mockResolvedValueOnce(draft);
  if (missing) { (storyLibrary.loadStory as jest.Mock).mockRejectedValueOnce(new Error('Missing file')); }
  else { (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ id: draft.id, title: draft.title,
    pages: [{ id: 'p', panels: [{ ...panel, drawingData: 'old-ink' }], bubbles: [] }] }); }
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<App />); });
  expect(renderer.root.findAllByType(SplashScreen)).toHaveLength(0);
  expect(renderer.root.findByType(Workspace).props.panels[0].drawingData).toBe('new-ink');
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(false);
});

test('New after a completed save does not ask to save the same work again', async () => {
  await act(async () => renderer.root.findByType(LibraryScreen).props.onOpen('book', 'editor'));
  await act(async () => renderer.root.findByType(Workspace).props.onAddPanel({ x: 12, y: 12, width: 120, height: 120 }));
  await act(async () => renderer.root.findByType(Header).props.onSaveStory());
  (Alert.alert as jest.Mock).mockClear();
  await act(async () => renderer.root.findByType(Header).props.onNewStory());
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(renderer.root.findByType(CanvasOrientationPicker).props.visible).toBe(true);
});
