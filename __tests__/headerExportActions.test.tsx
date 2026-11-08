import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { PageNavigator } from '../src/components/PageNavigator';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Header } from '../src/components/Header';

jest.mock('lucide-react-native', () => {
  const icon = () => null;
  return { Mail: icon, Printer: icon, File: icon, BookPlus: icon, LibraryBig: icon,
    SquarePen: icon, Glasses: icon, ChevronLeft: icon, ChevronRight: icon,
    Plus: icon, Minus: icon, Check: icon, Undo2: icon, Redo2: icon };
});
jest.mock('../src/components/TemplatePicker', () => ({ TemplatePicker: () => null }));

const noop = () => {};
const props = {
  currentPageIndex: 0, totalPages: 1, onNewStory: noop, onLoadStory: noop,
  onSaveStory: noop, onPrint: jest.fn(), onEmail: jest.fn(), onPrevPage: noop,
  onNextPage: noop, onAddPage: noop, onCreateLayout: noop,
};
let renderer: ReactTestRenderer.ReactTestRenderer;
afterEach(async () => { await act(async () => renderer.unmount()); jest.clearAllMocks(); });
const button = (label: string) => renderer.root.findAllByType(TouchableOpacity)
  .find(item => item.props.accessibilityLabel === label);

test('canvas has no print or email actions even when handlers are provided', async () => {
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} />); });
  expect(button('Print comic')).toBeUndefined();
  expect(button('Email comic')).toBeUndefined();
});

test('reader exposes working print and email actions', async () => {
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} reading />); });
  await act(async () => button('Email comic')!.props.onPress());
  await act(async () => button('Print comic')!.props.onPress());
  expect(props.onEmail).toHaveBeenCalledTimes(1);
  expect(props.onPrint).toHaveBeenCalledTimes(1);
});


test.each([0, 1, 2])('page menu has the correct actions on page index %s', async index => {
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} currentPageIndex={index} totalPages={3} />); });
  expect(renderer.root.findByType(ScreenHeader).props.trailing.type).toBe(PageNavigator);
  expect(renderer.root.findByType(PageNavigator).props.currentPageIndex).toBe(index);
  await act(async () => button(`Page ${index + 1} of 3`)!.props.onPress());
  expect(button('Previous page')!.props.disabled).toBe(index === 0);
  expect(button('Delete current page')!.props.disabled).toBe(false);
  expect(button('Add next canvas page')!.props.disabled).toBe(false);
  expect(button('Next page')!.props.disabled).toBe(index === 2);
});


test('page count toggle shows and hides the page controls without changing pages', async () => {
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} />); });
  expect(button('Add next canvas page')).toBeUndefined();
  expect(button('Page 1 of 1')!.props.accessibilityState.expanded).toBe(false);
  await act(async () => button('Page 1 of 1')!.props.onPress());
  expect(button('Add next canvas page')).toBeDefined();
  expect(button('Page 1 of 1')!.props.accessibilityState.expanded).toBe(true);
  await act(async () => button('Page 1 of 1')!.props.onPress());
  expect(button('Add next canvas page')).toBeUndefined();
});


test('expanded menu arrows navigate from the first page and back', async () => {
  const previous = jest.fn();
  const next = jest.fn();
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} totalPages={2}
    onPrevPage={previous} onNextPage={next} />); });
  await act(async () => button('Page 1 of 2')!.props.onPress());
  expect(button('Next page')!.props.disabled).toBe(false);
  await act(async () => button('Next page')!.props.onPress());
  expect(next).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(<Header {...props} totalPages={2} currentPageIndex={1}
    onPrevPage={previous} onNextPage={next} />));
  await act(async () => button('Previous page')!.props.onPress());
  expect(previous).toHaveBeenCalledTimes(1);
});


test('touches outside the page menu dismiss it; touches inside keep it open', async () => {
  await act(async () => { renderer = ReactTestRenderer.create(<Header {...props} pageMenuDismissSignal={0} />); });
  await act(async () => button('Page 1 of 1')!.props.onPress());
  const stopPropagation = jest.fn();
  const menu = renderer.root.findByType(PageNavigator).findAll(item => typeof item.props.onTouchStart === 'function')[0];
  await act(async () => menu.props.onTouchStart({ stopPropagation }));
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(button('Add next canvas page')).toBeDefined();
  await act(async () => renderer.update(<Header {...props} pageMenuDismissSignal={1} />));
  expect(button('Add next canvas page')).toBeUndefined();
});
