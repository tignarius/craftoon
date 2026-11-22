import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert, Dimensions, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { AppTextInput } from '../src/components/AppText';
import LibraryScreen from '../src/LibraryScreen';
import { storyLibrary } from '../src/services/storyLibrary';

jest.mock('lucide-react-native', () => ({ BookOpen: () => null, SquarePen: () => null, LibraryBig: () => null, Printer: () => null, Mail: () => null, Trash2: () => null, Glasses: () => null, Pencil: () => null }));
const mockRequirePro = jest.fn(() => true);
jest.mock('../src/access/ProProvider', () => ({
  ...jest.requireActual('../src/access/ProProvider'),
  usePro: () => ({ requirePro: mockRequirePro, openInfo: jest.fn() }),
}));
jest.mock('../src/services/storyLibrary', () => ({ storyLibrary: {
  renameStory: jest.fn(), reorderStories: jest.fn(), loadStory: jest.fn(), printStory: jest.fn(), emailStory: jest.fn(), listStories: jest.fn(), deleteStory: jest.fn(), restoreStory: jest.fn(),
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
  (storyLibrary.reorderStories as jest.Mock).mockReset().mockResolvedValue(undefined);
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


test('Canvas returns to the prior draft with its measured picker anchor after deselecting a comic', async () => {
  for (const node of renderer.root.findAll(item => item.props.accessibilityLabel === 'Open Canvas' &&
    typeof item.instance?.measureInWindow === 'function')) {
    jest.spyOn(node.instance, 'measureInWindow').mockImplementation((callback: any) => callback(100, 24, 44, 44));
  }
  jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1500);
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Alpha').props.onPress());
  await act(async () => button('Open Canvas').props.onPress());
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(onHome).toHaveBeenCalledWith(expect.objectContaining({ x: 100, y: 24, width: 44, height: 44, measure: expect.any(Function) }));
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
  await act(async () => {
    background.props.onStartShouldSetResponderCapture({ nativeEvent: { pageX: 300, pageY: 400 } });
    background.props.onTouchEnd();
  });
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

test('manual order survives loading and accessible reordering saves IDs without editing a comic', async () => {
  const other = { ...comic, id: 'beta', title: 'Beta', libraryOrder: 0 };
  (storyLibrary.listStories as jest.Mock).mockResolvedValue([other, { ...comic, libraryOrder: 1 }]);
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />); });
  expect(renderer.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['beta', 'alpha']);
  await act(async () => button('Alpha').props.onAccessibilityAction({ nativeEvent: { actionName: 'moveEarlier' } }));
  expect(storyLibrary.reorderStories).toHaveBeenCalledWith(['alpha', 'beta']);
  expect(renderer.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['alpha', 'beta']);
  expect(onOpen).not.toHaveBeenCalled();
});

test('failed order save restores the previous order', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (storyLibrary.listStories as jest.Mock).mockResolvedValue([comic, { ...comic, id: 'beta', title: 'Beta' }]);
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(<LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />); });
  const before = renderer.root.findByType(FlatList).props.data.map((item: any) => item.id);
  (storyLibrary.reorderStories as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => button('Alpha').props.onAccessibilityAction({ nativeEvent: { actionName: 'moveLater' } }));
  expect(renderer.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(before);
  expect(Alert.alert).toHaveBeenCalledWith('Could not save order', expect.any(String));
});

test('holding a cover and dragging to the next slot saves one reorder without opening it', async () => {
  let deferMeasurement = false;
  let pendingMeasurement: (() => void) | undefined;
  let now = 2000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const beta = { ...comic, id: 'beta', title: 'Beta' };
  (storyLibrary.listStories as jest.Mock).mockResolvedValue([comic, beta]);
  const nativeNode = (element: any) => ({
    measureInWindow: (callback: Function) => {
      if (element.props.testID === 'library-drag-surface') callback(0, 40, 400, 600);
      else if (element.props.accessibilityLabel === 'Alpha') callback(16, 56, 150, 240);
      else if (element.props.accessibilityLabel === 'Beta') callback(182, 56, 150, 240);
      else callback(0, 0, 0, 0);
    },
  });
  await act(async () => { renderer.unmount(); renderer = ReactTestRenderer.create(
    <LibraryScreen onHome={onHome} onOpen={onOpen} onDeleted={onDeleted} />, { createNodeMock: nativeNode }); });
  for (const node of renderer.root.findAll(item => typeof item.instance?.measureInWindow === 'function')) {
    jest.spyOn(node.instance, 'measureInWindow').mockImplementation(function (this: any, callback: any) {
      if (this.props.testID === 'library-drag-surface') {
        if (deferMeasurement) pendingMeasurement = () => callback(0, 40, 400, 600);
        else callback(0, 40, 400, 600);
      }
      else {
        const index = renderer.root.findByType(FlatList).props.data.findIndex((item: any) => item.title === this.props.accessibilityLabel);
        callback(16 + index * 166, 56, 150, 240);
      }
    });
  }
  await act(async () => button('Alpha').props.onLongPress({ nativeEvent: { pageX: 60, pageY: 100 } }));
  expect(renderer.root.findByType(FlatList).props.scrollEnabled).toBe(false);
  const body = renderer.root.findAll(item => item.props.testID === 'library-drag-surface' && item.props.onResponderMove)[0];
  await act(async () => body.props.onResponderMove({ nativeEvent: { pageX: 240, pageY: 100 } }));
  now += 100;
  await act(async () => body.props.onResponderMove({ nativeEvent: { pageX: 240, pageY: 100 } }));
  await act(async () => body.props.onResponderRelease());
  expect(storyLibrary.reorderStories).toHaveBeenCalledTimes(1);
  expect(storyLibrary.reorderStories).toHaveBeenCalledWith(['beta', 'alpha']);
  expect(renderer.root.findByType(FlatList).props.scrollEnabled).toBe(true);
  expect(onOpen).not.toHaveBeenCalled();
  deferMeasurement = true;
  await act(async () => button('Alpha').props.onLongPress({ nativeEvent: { pageX: 240, pageY: 100 } }));
  await act(async () => body.props.onTouchEnd());
  await act(async () => pendingMeasurement?.());
  expect(renderer.root.findAll(item => item.props.testID === 'library-drag-preview')).toHaveLength(0);
  expect(button('Alpha').props.disabled).toBe(false);
  expect(storyLibrary.reorderStories).toHaveBeenCalledTimes(1);
});


const titleInput = () => renderer.root.findByType(AppTextInput);

test('title click edits inside the card and Done saves once despite blur', async () => {
  (storyLibrary.renameStory as jest.Mock).mockResolvedValueOnce({ ...comic, title: 'New title' });
  const event = { stopPropagation: jest.fn() };
  await act(async () => button('Rename Alpha').props.onPress(event));
  expect(event.stopPropagation).toHaveBeenCalled();
  expect(titleInput().props.value).toBe('Alpha');
  await act(async () => titleInput().props.onChangeText('  New title  '));
  const input = titleInput();
  await act(async () => { input.props.onSubmitEditing(); input.props.onBlur(); });
  expect(storyLibrary.renameStory).toHaveBeenCalledTimes(1);
  expect(storyLibrary.renameStory).toHaveBeenCalledWith('alpha', 'New title');
  expect(button('Rename New title')).toBeDefined();
  expect(onOpen).not.toHaveBeenCalled();
});

test('empty title or Escape leaves the original title', async () => {
  await act(async () => button('Rename Alpha').props.onPress({ stopPropagation: jest.fn() }));
  await act(async () => titleInput().props.onChangeText('   '));
  await act(async () => titleInput().props.onBlur());
  expect(storyLibrary.renameStory).not.toHaveBeenCalled();
  expect(button('Rename Alpha')).toBeDefined();
  await act(async () => button('Rename Alpha').props.onPress({ stopPropagation: jest.fn() }));
  await act(async () => titleInput().props.onChangeText('Discard me'));
  const input = titleInput();
  await act(async () => { input.props.onKeyPress({ nativeEvent: { key: 'Escape' } }); input.props.onBlur(); });
  expect(storyLibrary.renameStory).not.toHaveBeenCalled();
  expect(button('Alpha').props.disabled).toBe(false);
});

test('failed rename keeps input available to retry', async () => {
  (storyLibrary.renameStory as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => button('Rename Alpha').props.onPress({ stopPropagation: jest.fn() }));
  await act(async () => titleInput().props.onChangeText('New title'));
  await act(async () => titleInput().props.onBlur());
  expect(titleInput().props.value).toBe('New title');
  expect(button('Retry saving title')).toBeDefined();
  expect(titleInput().props.editable).toBe(true);
  (storyLibrary.renameStory as jest.Mock).mockResolvedValueOnce({ ...comic, title: 'New title' });
  await act(async () => button('Retry saving title').props.onPress());
  expect(button('Rename New title')).toBeDefined();
});

test('pressing library background saves the edited title', async () => {
  (storyLibrary.renameStory as jest.Mock).mockResolvedValueOnce({ ...comic, title: 'New title' });
  await act(async () => button('Rename Alpha').props.onPress({ stopPropagation: jest.fn() }));
  await act(async () => titleInput().props.onChangeText('New title'));
  await act(async () => {
    const background = renderer.root.findByProps({ testID: 'library-background' });
    background.props.onStartShouldSetResponderCapture({ nativeEvent: { pageX: 300, pageY: 400 } });
    background.props.onTouchEnd();
  });
  expect(storyLibrary.renameStory).toHaveBeenCalledWith('alpha', 'New title');
});


test('dragging through empty grid space does not clear selection or open a comic', async () => {
  await act(async () => button('Alpha').props.onPress());
  const background = renderer.root.findByProps({ testID: 'library-background' });
  await act(async () => {
    background.props.onStartShouldSetResponderCapture({ nativeEvent: { pageX: 300, pageY: 500 } });
    background.props.onTouchMove({ nativeEvent: { pageX: 300, pageY: 400 } });
    background.props.onTouchMove({ nativeEvent: { pageX: 300, pageY: 500 } });
    background.props.onTouchEnd();
  });
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
  expect(onOpen).not.toHaveBeenCalled();
  await act(async () => {
    background.props.onStartShouldSetResponderCapture({ nativeEvent: { pageX: 300, pageY: 500 } });
    renderer.root.findByType(FlatList).props.onScrollBeginDrag();
    background.props.onTouchEnd();
  });
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});

test('touches starting on a comic are not treated as background taps', async () => {
  await act(async () => button('Alpha').props.onPress());
  const background = renderer.root.findByProps({ testID: 'library-background' });
  await act(async () => {
    background.props.onStartShouldSetResponderCapture({ nativeEvent: { pageX: 30, pageY: 50 } });
    button('Alpha').props.onPressIn();
    background.props.onTouchEnd();
  });
  expect(button('Alpha').props.accessibilityState.selected).toBe(true);
});
