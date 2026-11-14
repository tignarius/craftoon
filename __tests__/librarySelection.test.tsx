import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert, Dimensions, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import LibraryScreen from '../src/LibraryScreen';
import { storyLibrary } from '../src/services/storyLibrary';

jest.mock('lucide-react-native', () => ({ BookOpen: () => null, SquarePen: () => null, LibraryBig: () => null, Printer: () => null, Mail: () => null, Trash2: () => null, Glasses: () => null, Pencil: () => null }));
const mockRequirePro = jest.fn(() => true);
jest.mock('../src/access/ProProvider', () => ({
  ...jest.requireActual('../src/access/ProProvider'),
  usePro: () => ({ requirePro: mockRequirePro, openInfo: jest.fn() }),
}));
jest.mock('../src/services/storyLibrary', () => ({ storyLibrary: {
  loadStory: jest.fn(), printStory: jest.fn(), emailStory: jest.fn(), listStories: jest.fn(), deleteStory: jest.fn(), restoreStory: jest.fn(),
} }));

const initialWindow = Dimensions.get('window');
const initialScreen = Dimensions.get('screen');

const comic = { id: 'alpha', title: 'Alpha', updatedAt: '2026-11-04T12:00:00Z', pageCount: 2 };
let renderer: ReactTestRenderer.ReactTestRenderer;
const onOpen = jest.fn(async () => {});
const onDeleted = jest.fn();
const onHome = jest.fn();
const button = (label: string) => renderer.root.findAllByType(TouchableOpacity)
  .find(item => item.props.accessibilityLabel === label)!;

beforeEach(async () => {
  jest.clearAllMocks();
  mockRequirePro.mockReturnValue(true);
  (storyLibrary.listStories as jest.Mock).mockResolvedValue([comic]);
  (storyLibrary.emailStory as jest.Mock).mockReset().mockResolvedValue(false);
  (storyLibrary.deleteStory as jest.Mock).mockResolvedValue({ token: 'receipt' });
  (storyLibrary.restoreStory as jest.Mock).mockResolvedValue(comic);
  await act(async () => {
    renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />);
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
  Dimensions.set({ window: initialWindow, screen: initialScreen });
});

test('double-click opens the comic directly in Canvas', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  const actions = renderer.root.findAllByType(TouchableOpacity)
    .map(item => item.props.accessibilityLabel).filter(label => ['Edit Alpha', 'Read Alpha', 'Delete Alpha'].includes(label));
  expect(actions).toEqual(['Edit Alpha', 'Read Alpha', 'Delete Alpha']);
  clock.mockReturnValue(1200);
  await act(async () => button('Alpha').props.onPress());
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledWith('alpha', 'editor');
});

test('clicking the selected comic after a pause deselects without opening it', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  await act(async () => button('Alpha').props.onPress());
  clock.mockReturnValue(1500);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(false);
  expect(button('Read Alpha')).toBeUndefined();
  expect(button('Edit Alpha')).toBeUndefined();
  expect(button('Delete Alpha')).toBeUndefined();
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
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Open Canvas').props.onPress());
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
});


test('email attaches the selected saved comic without opening the canvas', async () => {
  const story = { ...comic, pages: [{ id: 'one', panels: [], bubbles: [] }, { id: 'two', panels: [], bubbles: [] }] };
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce(story);
  expect(button('Email selected comic').props.disabled).toBe(false);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Email selected comic').props.disabled).toBe(false);
  await act(async () => button('Email selected comic').props.onPress());
  expect(storyLibrary.emailStory).toHaveBeenCalledWith(story);
  expect(onOpen).not.toHaveBeenCalled();
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});

test('an open email blocks duplicate actions and cancellation restores selection', async () => {
  let finish!: (sent: boolean) => void;
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ ...comic, pages: [] });
  (storyLibrary.emailStory as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => button('Alpha').props.onPress());
  let pending!: Promise<void>;
  await act(async () => { pending = button('Email selected comic').props.onPress(); });
  expect(button('Email selected comic').props.accessibilityState.busy).toBe(true);
  expect(button('Print selected comic').props.disabled).toBe(true);
  expect(button('Open Canvas').props.disabled).toBe(true);
  await act(async () => button('Email selected comic').props.onPress());
  expect(storyLibrary.emailStory).toHaveBeenCalledTimes(1);
  await act(async () => { finish(false); await pending; });
  expect(button('Email selected comic').props.disabled).toBe(false);
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});

test('email preparation failure leaves the selected comic available to retry', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (storyLibrary.loadStory as jest.Mock).mockResolvedValueOnce({ ...comic, pages: [] });
  (storyLibrary.emailStory as jest.Mock).mockRejectedValueOnce(new Error('PDF error'));
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Email selected comic').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Could not prepare email', expect.any(String));
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  expect(button('Email selected comic').props.disabled).toBe(false);
});


test('email stays enabled without a selection and explains how to choose a comic', async () => {
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  expect(button('Email selected comic').props.disabled).toBe(false);
  await act(async () => button('Email selected comic').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Select a comic', expect.any(String));
  expect(storyLibrary.emailStory).not.toHaveBeenCalled();
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Alpha').props.onPress());
  expect(button('Email selected comic').props.disabled).toBe(false);
});


test('portrait and landscape covers keep their own proportions as the library reflows', async () => {
  const wide = { ...comic, id: 'wide', title: 'Wide', canvasSize: { width: 1200, height: 900 } };
  (storyLibrary.listStories as jest.Mock).mockResolvedValueOnce([
    { ...comic, canvasSize: { width: 900, height: 1200 } }, wide,
  ]);
  await act(async () => {
    renderer.unmount();
    Dimensions.set({ window: { width: 834, height: 1194, scale: 2, fontScale: 1 } });
    renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />);
  });
  expect(renderer.root.findByType(FlatList).props.numColumns).toBe(3);
  const ratio = (id: string) => StyleSheet.flatten(renderer.root.findAllByProps({ testID: `comic-cover-${id}` })[0].props.style).aspectRatio;
  expect(ratio('alpha')).toBe(0.75);
  expect(ratio('wide')).toBeCloseTo(4 / 3);
  await act(async () => button('Wide').props.onPress());
  await act(async () => Dimensions.set({ window: { width: 1194, height: 834, scale: 2, fontScale: 1 } }));
  expect(renderer.root.findByType(FlatList).props.numColumns).toBe(4);
  expect(button('Wide').props.accessibilityState.selected).toBe(true);
  expect(ratio('wide')).toBeCloseTo(4 / 3);
});


test('rapid clicks on different comics only change selection', async () => {
  (storyLibrary.listStories as jest.Mock).mockResolvedValueOnce([comic, { ...comic, id: 'beta', title: 'Beta' }]);
  await act(async () => {
    renderer.unmount();
    renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />);
  });
  jest.spyOn(Date, 'now').mockReturnValue(1000);
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Beta').props.onPress());
  expect(button('Beta').props.accessibilityState.selected).toBe(true);
  expect(onOpen).not.toHaveBeenCalled();
});


test('library stays newest-created first despite newer edits and restoring a deleted comic', async () => {
  const older = { ...comic, id: 'older', title: 'Older', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-07T00:00:00Z' };
  const newer = { ...comic, id: 'newer', title: 'Newer', createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z' };
  (storyLibrary.listStories as jest.Mock).mockResolvedValueOnce([older, newer]);
  (storyLibrary.restoreStory as jest.Mock).mockResolvedValueOnce(older);
  await act(async () => {
    renderer.unmount();
    renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />);
  });
  const order = () => renderer.root.findByType(FlatList).props.data.map((story: any) => story.id);
  expect(order()).toEqual(['newer', 'older']);
  await act(async () => button('Older').props.onPress());
  await act(async () => button('Delete Older').props.onPress({ stopPropagation: jest.fn() }));
  expect(order()).toEqual(['newer']);
  await act(async () => button('Restore Older').props.onPress());
  expect(order()).toEqual(['newer', 'older']);
});

test('Free can read and edit existing comics but cannot print or email them', async () => {
  mockRequirePro.mockReturnValue(false);
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Print selected comic').props.onPress());
  await act(async () => button('Email selected comic').props.onPress());
  expect(storyLibrary.printStory).not.toHaveBeenCalled();
  expect(storyLibrary.emailStory).not.toHaveBeenCalled();
  expect(mockRequirePro).toHaveBeenCalledWith('export', 'library');
  await act(async () => button('Edit Alpha').props.onPress({ stopPropagation: jest.fn() }));
  expect(onOpen).toHaveBeenCalledWith('alpha', 'editor');
});


test('clicking empty library space clears selection, actions and double-click timing', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  const background = renderer.root.findByProps({ testID: 'library-background' });
  await act(async () => background.props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(false);
  expect(button('Read Alpha')).toBeUndefined();
  expect(button('Edit Alpha')).toBeUndefined();
  expect(button('Delete Alpha')).toBeUndefined();
  expect(button('Print selected comic').props.disabled).toBe(true);
  clock.mockReturnValue(1100);
  await act(async () => button('Alpha').props.onPress());
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  expect(onOpen).not.toHaveBeenCalled();
});

test('comic presses stop before the empty-space deselection handler', async () => {
  const event = { stopPropagation: jest.fn() };
  await act(async () => button('Alpha').props.onPress(event));
  expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});
