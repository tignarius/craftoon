import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import * as RN from 'react-native';
import { CanvasOrientationPicker, CanvasPickerAnchor, measureCanvasPickerAnchor } from '../src/components/CanvasOrientationPicker';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const element = (props: any) => React.createElement('svg', props, props.children);
  return { __esModule: true, default: element, Defs: element, LinearGradient: element, Path: element, Rect: element, Stop: element };
});
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let viewport = { width: 768, height: 1024, scale: 1, fontScale: 1 };
let frames: Map<number, (timestamp: number) => void>;
let nextFrame: number;
const props = { onSelect: jest.fn(), onCancel: jest.fn() };
const portrait = { x: 200, y: 600, width: 96, height: 96 };
const landscape = { x: 480, y: 420, width: 84, height: 84 };
beforeEach(() => {
  viewport = { width: 768, height: 1024, scale: 1, fontScale: 1 };
  frames = new Map(); nextFrame = 0;
  jest.spyOn(jest.requireActual<typeof import('react-native')>('react-native'), 'useWindowDimensions').mockImplementation(() => viewport);
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
});
afterEach(async () => {
  if (renderer) { await act(async () => renderer!.unmount()); renderer = undefined; }
  jest.restoreAllMocks();
});
const flushFrames = async () => {
  const callbacks = [...frames.values()]; frames.clear();
  await act(async () => callbacks.forEach(callback => callback(0)));
};
const card = () => RN.StyleSheet.flatten(renderer!.root.findByProps({ testID: 'canvas-orientation-card' }).props.style);

test('an open orientation picker follows the live Canvas button after rotation and native relayout', async () => {
  let position = portrait;
  const anchor = { ...portrait, measure: (done: (rect: CanvasPickerAnchor) => void) => done(position) };
  await act(async () => { renderer = ReactTestRenderer.create(<CanvasOrientationPicker {...props} visible anchor={anchor} />); });
  await flushFrames();
  expect(card()).toMatchObject({ left: 164, top: 704, opacity: 1 });
  viewport = { ...viewport, width: 1024, height: 768 };
  position = landscape;
  await act(async () => renderer!.update(<CanvasOrientationPicker {...props} visible anchor={anchor} />));
  // Do not show the old coordinates while the new native layout is measured.
  expect(card().opacity).toBe(0);
  await flushFrames();
  expect(card()).toMatchObject({ left: 304, top: 419, opacity: 1 });
  // A later safe-area/parent layout can move the button without changing dimensions.
  position = { ...landscape, y: 400 };
  const overlay = renderer!.root.findAllByType(RN.View).find(view => view.props.accessibilityViewIsModal)!;
  await act(async () => overlay.props.onLayout());
  await flushFrames();
  expect(card().top).toBe(399);
});

test('late pre-rotation measurements cannot move the picker back or update a closed picker', async () => {
  const callbacks: Array<(rect: CanvasPickerAnchor) => void> = [];
  const anchor = { ...portrait, measure: (done: (rect: CanvasPickerAnchor) => void) => { callbacks.push(done); } };
  await act(async () => { renderer = ReactTestRenderer.create(<CanvasOrientationPicker {...props} visible anchor={anchor} />); });
  await flushFrames();
  viewport = { ...viewport, width: 1024, height: 768 };
  await act(async () => renderer!.update(<CanvasOrientationPicker {...props} visible anchor={anchor} />));
  await flushFrames();
  await act(async () => callbacks[1](landscape));
  await act(async () => callbacks[0](portrait));
  expect(card()).toMatchObject({ left: 304, top: 419, opacity: 1 });
  await act(async () => renderer!.update(<CanvasOrientationPicker {...props} visible={false} anchor={anchor} />));
  await act(async () => callbacks[1](portrait));
  expect(renderer!.root.findAllByProps({ testID: 'canvas-orientation-card' })).toHaveLength(0);
  expect(frames.size).toBe(0);
});

test('the live anchor uses the current native ref instead of retaining the original view', () => {
  const first = { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => done(200, 600, 96, 96) };
  const second = { measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => done(480, 420, 84, 84) };
  const ref = { current: first as unknown as RN.View | null };
  let anchor: CanvasPickerAnchor | undefined;
  measureCanvasPickerAnchor(ref, value => { anchor = value; });
  expect(anchor).toMatchObject(portrait);
  ref.current = second as unknown as RN.View;
  const measured = jest.fn();
  anchor!.measure!(measured);
  expect(measured).toHaveBeenCalledWith(landscape);
  ref.current = null;
  measured.mockClear();
  anchor!.measure!(measured);
  expect(measured).not.toHaveBeenCalled();
});


test('landscape places choices to the left with aligned centers and no arrow', async () => {
  viewport = { ...viewport, width: 1024, height: 768 };
  const anchor = { x: 480, y: 600, width: 84, height: 84 };
  await act(async () => { renderer = ReactTestRenderer.create(<CanvasOrientationPicker {...props} visible anchor={anchor} />); });
  expect(card()).toMatchObject({ left: 304, top: 599, opacity: 1 });
  expect(card().left + 168 + 8).toBe(anchor.x);
  expect(renderer!.root.findAllByProps({ testID: 'canvas-orientation-caret' })).toHaveLength(0);
  const popup = renderer!.root.findByProps({ testID: 'canvas-orientation-card' });
  await act(async () => popup.props.onLayout({ nativeEvent: { layout: { height: 90 } } }));
  expect(card().top + 45).toBe(anchor.y + anchor.height / 2);
});
