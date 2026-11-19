import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { PanelCorners } from '../src/types/comic';
import { PanelSurface } from '../src/components/PanelSurface';
import { OpacitySlider, TracingImageControls } from '../src/components/TracingImageControls';
import { fitTracingImage, resizeTracingImage, rotateTracingImage, gizmoTransform, migrateTracingPage } from '../src/utils/tracingImage';

jest.mock('lucide-react-native', () => {
  const icon = () => null;
  return { Blend: icon,Check: icon,Move: icon,Eye: icon,EyeOff: icon,Settings2: icon,Trash2: icon,RotateCw: icon,Maximize2: icon };
});
const bounds = { width: 400,height: 300 };
const image = fitTracingImage({ uri: 'data:image/png;base64,source',width: 1600,height: 900 },bounds);
const event = (points: number[][],locationX = 0) => ({ nativeEvent: { locationX,touches: points.map(([pageX,pageY]) => ({ pageX,pageY })) } } as never);

test('zoom, gizmo rotation and scaling preserve the image center and aspect ratio', () => {
  const zoom = resizeTracingImage(image,1.5);
  expect(zoom.width/zoom.height).toBeCloseTo(16/9);
  expect(zoom.x+zoom.width/2).toBeCloseTo(image.x+image.width/2);
  expect(zoom.y+zoom.height/2).toBeCloseTo(image.y+image.height/2);
  expect(rotateTracingImage(image,-15).rotation).toBe(345);
  expect(gizmoTransform(image,'rotate',{ x: 100,y: 0 },{ x: -100,y: 100 }).rotation).toBeCloseTo(90);
  expect(gizmoTransform(image,'scale',{ x: 100,y: 0 },{ x: 100,y: 0 }).width).toBeCloseTo(image.width*2);
});

test('legacy page references migrate to panel-local coordinates without changing panels or ink', () => {
  const panels = [{ id: 'a',x: 10,y: 20,width: 100,height: 100,drawingData: 'ink' },
    { id: 'b',x: 200,y: 20,width: 100,height: 100,drawingData: 'ink2' }];
  const page = migrateTracingPage({ id: 'p',panels,bubbles: [],tracingImage: image });
  expect(page.tracingImage).toBeUndefined();
  expect(page.panels[0]).toMatchObject(panels[0]);
  expect(page.panels[0].tracingImage).toMatchObject({ uri: image.uri,x: image.x-12,y: image.y-22 });
  expect(page.panels[1].tracingImage?.x).toBe(image.x-202);
  expect(migrateTracingPage(page)).toBe(page);
});

test('visibility and tools toggle independently; closed tools do not intercept drawing', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const onCommit = jest.fn();
  const onEditingChange = jest.fn();
  const props = { image,editing: false,bounds,canvasScale: 0.5,onCommit,onPreview: jest.fn(),onEditingChange };
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
  expect(renderer.root.findAllByProps({ testID: 'reference-image-gesture-surface' })).toHaveLength(0);
  const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label)!;
  await act(async () => button('Show image controls').props.onPress());
  expect(onEditingChange).toHaveBeenLastCalledWith(true);
  await act(async () => button('Hide reference image').props.onPress());
  expect(onCommit).toHaveBeenLastCalledWith({ ...image,visible: false });
  await act(async () => renderer.update(<TracingImageControls {...props} image={{ ...image,visible: false }} />));
  await act(async () => button('Show reference image').props.onPress());
  expect(onCommit).toHaveBeenLastCalledWith({ ...image,visible: true });
  await act(async () => renderer.update(<TracingImageControls {...props} editing />));
  expect(renderer.root.findAllByProps({ testID: 'reference-rotate-handle' })).not.toHaveLength(0);
  expect(renderer.root.findAllByProps({ testID: 'reference-scale-handle' })).not.toHaveLength(0);
  await act(async () => button('Delete reference image').props.onPress());
  expect(onCommit).toHaveBeenLastCalledWith(undefined);
  await act(async () => renderer.unmount());
});

test('moving a reference accounts for canvas scale and commits once per gesture', async () => {
  const spy = jest.spyOn(PanResponder,'create');
  const onCommit = jest.fn();
  const onPreview = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls image={image} editing bounds={bounds}
    canvasScale={0.5} onCommit={onCommit} onPreview={onPreview} onEditingChange={jest.fn()} />); });
  const gesture = spy.mock.calls[0][0];
  await act(async () => {
    gesture.onPanResponderGrant!(event([[10,20]]),{} as never);
    gesture.onPanResponderMove!(event([[60,45]]),{} as never);
  });
  expect(onCommit).not.toHaveBeenCalled();
  expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ x: image.x+100,y: image.y+50 }));
  await act(async () => gesture.onPanResponderRelease!(event([]),{} as never));
  expect(onCommit).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
  spy.mockRestore();
});

test('opacity slider previews continuously, clamps at both ends and commits on release', async () => {
  const spy = jest.spyOn(PanResponder,'create');
  const onCommit = jest.fn();
  const onPreview = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<OpacitySlider value={0.35} canvasScale={0.5}
    onCommit={onCommit} onPreview={onPreview} />); });
  await act(async () => renderer.root.findByProps({ testID: 'reference-opacity-slider' }).props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
  const gesture = spy.mock.calls[0][0];
  await act(async () => gesture.onPanResponderGrant!(event([],50),{} as never));
  expect(onPreview).toHaveBeenLastCalledWith(0.25);
  await act(async () => gesture.onPanResponderMove!(event([]),{ dx: 25 } as never));
  expect(onPreview).toHaveBeenLastCalledWith(0.5);
  expect(onCommit).not.toHaveBeenCalled();
  await act(async () => gesture.onPanResponderMove!(event([]),{ dx: 1000 } as never));
  expect(onPreview).toHaveBeenLastCalledWith(1);
  await act(async () => gesture.onPanResponderRelease!(event([]),{} as never));
  expect(onCommit).toHaveBeenLastCalledWith(1);
  await act(async () => renderer.root.findByProps({ testID: 'reference-opacity-slider' }).props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(onCommit.mock.lastCall[0]).toBeCloseTo(0.45);
  await act(async () => renderer.unmount());
  spy.mockRestore();
});

test('controls stay fixed while the reference moves, rotates and resizes; opacity opens only on demand', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const props = { image,editing: true,bounds,canvasScale: 0.5,onCommit: jest.fn(),onPreview: jest.fn(),onEditingChange: jest.fn() };
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
  const fixedStyles = () => ['reference-fixed-toolbar','reference-rotate-handle','reference-scale-handle']
    .map(testID => renderer.root.findByProps({ testID }).props.style);
  const original = fixedStyles();
  expect(renderer.root.findAllByProps({ testID: 'reference-opacity-popover' })).toHaveLength(0);
  await act(async () => renderer.update(<TracingImageControls {...props}
    image={{ ...image,x: -500,y: 300,width: 1500,height: 900,rotation: 120 }} />));
  expect(fixedStyles()).toEqual(original);
  const opacity = () => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Adjust reference opacity')!;
  await act(async () => opacity().props.onPress());
  const popup = renderer.root.findByProps({ testID: 'reference-opacity-popover' });
  expect(popup.props.style[1].width).toBeLessThanOrEqual(180);
  await act(async () => opacity().props.onPress());
  expect(renderer.root.findAllByProps({ testID: 'reference-opacity-popover' })).toHaveLength(0);
  await act(async () => renderer.unmount());
});

test('file-backed reference identity survives fitting, zooming and rotation', () => {
  const source = { uri: 'file:///native/photos/photo.png', imageRef: 'photo.png', width: 1600, height: 900 };
  const fitted = fitTracingImage(source, bounds);
  const changed = rotateTracingImage(resizeTracingImage(fitted, 1.5), 45);
  expect(changed.imageRef).toBe(source.imageRef);
  expect(changed.uri).toBe(source.uri);
});

test('the image controller stays in place while tools unfold to the right and close without blocking input', async () => {
  jest.useFakeTimers();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    const props = { image,editing: false,bounds,canvasScale: 0.7,onCommit: jest.fn(),onPreview: jest.fn(),onEditingChange: jest.fn() };
    await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
    const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label)!;
    const toggle = button('Show image controls');
    const eye = StyleSheet.flatten(button('Hide reference image').props.style);
    const before = StyleSheet.flatten(toggle.props.style);
    const toolbar = StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style);
    expect(before.left + before.width / 2 - (eye.left + eye.width / 2) - 24).toBe(10);
    expect(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.pointerEvents).toBe('box-none');
    await act(async () => toggle.props.onPress());
    expect(props.onEditingChange).toHaveBeenLastCalledWith(true);
    await act(async () => renderer.update(<TracingImageControls {...props} editing />));
    expect(button('Hide image controls')).toBe(toggle);
    expect(StyleSheet.flatten(toggle.props.style)).toEqual(before);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style)).toEqual(toolbar);
    const tool = renderer.root.findByProps({ testID: 'reference-reveal-tool-0' });
    expect(StyleSheet.flatten(tool.props.style).left).toBeGreaterThan(before.left + before.width);
    expect(tool.props.pointerEvents).toBe('none'); // Sliding tools cannot steal a rapid second tap on Done.
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(renderer.root.findByProps({ testID: 'reference-reveal-tool-0' }).props.pointerEvents).toBe('box-none');
    await act(async () => renderer.update(<TracingImageControls {...props} />));
    expect(renderer.root.findByProps({ testID: 'reference-reveal-tool-0' }).props.pointerEvents).toBe('none');
    expect(renderer.root.findAllByProps({ testID: 'reference-image-gesture-surface' })).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(renderer.root.findAllByProps({ testID: 'reference-reveal-tool-0' })).toHaveLength(0);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    jest.useRealTimers();
  }
});

test('reference controls follow the current bottom-left vertex and fit the shortened bottom edge', async () => {
  const corners: PanelCorners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.9, y: 1 }, { x: 0.45, y: 1 }];
  const props = { image,editing: true,bounds,canvasScale: 0.7,onCommit: jest.fn(),onPreview: jest.fn(),onEditingChange: jest.fn(), corners };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
  const toolbar = () => StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style);
  expect(toolbar().left).toBeCloseTo(185);
  expect(toolbar().left + toolbar().maxWidth).toBeLessThanOrEqual(360);
  expect(toolbar().top).toBeLessThan(300);
  const changed: PanelCorners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0.3, y: 1 }];
  await act(async () => renderer.update(<TracingImageControls {...props} corners={changed} />));
  expect(toolbar().left).toBeCloseTo(125);
  expect(toolbar().left + toolbar().maxWidth).toBeLessThanOrEqual(320);
  expect(renderer.root.findByType(PanelSurface).props.polygonPoints).toBe(changed);
  await act(async () => renderer.unmount());
});

test('normal image controls sit close to the bottom border using the visible circle instead of its hit area', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls image={image} editing={false}
    bounds={bounds} canvasScale={0.7} onCommit={jest.fn()} onPreview={jest.fn()} onEditingChange={jest.fn()} />); });
  const toolbar = StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style);
  const eye = renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Hide reference image')!;
  const target = StyleSheet.flatten(eye.props.style);
  const circle = StyleSheet.flatten(eye.findAllByType(View).find(v => v.props.pointerEvents === 'none')!.props.style);
  const circleBottom = toolbar.top + target.top + (target.height + circle.height) / 2;
  expect(bounds.height - circleBottom).toBeCloseTo(8.5);
  await act(async () => renderer.unmount());
});

test('a steep left border shifts every image control right without changing its bottom alignment', async () => {
  const size = { width: 400, height: 160 };
  const corners: PanelCorners = [{ x: 0.7, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const props = { image,editing: false,bounds: size,corners,canvasScale: 0.7,onCommit: jest.fn(),onPreview: jest.fn(),onEditingChange: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
  const toolbarStyle = () => StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style);
  const before = toolbarStyle();
  expect(before.left).toBeGreaterThan(5);
  await act(async () => renderer.update(<TracingImageControls {...props} editing />));
  expect(toolbarStyle()).toEqual(before); // Opening does not move the controller.
  const centers = renderer.root.findAllByType(TouchableOpacity)
    .filter(b => ['Hide reference image', 'Hide image controls'].includes(b.props.accessibilityLabel))
    .map(button => { const style = StyleSheet.flatten(button.props.style);
      return { x: before.left + style.left + style.width / 2, y: before.top + style.top + style.height / 2 }; });
  for (let i = 0; i < 5; i++) {
    const style = StyleSheet.flatten(renderer.root.findByProps({ testID: `reference-reveal-tool-${i}` }).props.style);
    centers.push({ x: before.left + style.left + style.width / 2, y: before.top + style.top + style.height / 2 });
  }
  for (const center of centers) {
    const distance = (160 * (center.x - 280) + 280 * center.y) / Math.hypot(160, 280);
    expect(distance).toBeGreaterThanOrEqual(16 - 0.00001); // Radius 12 plus four-point clearance.
  }
  await act(async () => renderer.unmount());
});

test('focused reference controls stay outside the bottom edge at normal size while gestures keep panel zoom', async () => {
  const corners: PanelCorners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.9, y: 1 }, { x: 0.45, y: 1 }];
  const props = { image,editing: true,bounds,canvasScale: 0.7,onCommit: jest.fn(),onPreview: jest.fn(),onEditingChange: jest.fn(),corners };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<TracingImageControls {...props} />); });
  const button = () => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Adjust reference opacity')!;
  const buttonStyle = StyleSheet.flatten(button().props.style);
  await act(async () => renderer.update(<TracingImageControls {...props} focused displayScale={4} canvasScale={2.8} />));
  const rootStyle = StyleSheet.flatten(renderer.root.findByProps({ testID: 'panel-reference-controls' }).props.style);
  expect(rootStyle.transform).toBeUndefined(); // The overlay lives outside the zoomed panel.
  const toolbar = StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-fixed-toolbar' }).props.style);
  expect(toolbar.left).toBeCloseTo(180 * 4);
  expect(toolbar.top).toBeGreaterThan(300 * 4);
  expect(StyleSheet.flatten(button().props.style)).toEqual(buttonStyle);
  const surface = renderer.root.findByType(PanelSurface);
  expect(surface.props.style.transform[0].scale).toBe(4);
  expect(surface.props.polygonPoints).toBe(corners);
  await act(async () => button().props.onPress());
  expect(renderer.root.findByType(OpacitySlider).props.canvasScale).toBeCloseTo(0.7);
  const popup = StyleSheet.flatten(renderer.root.findByProps({ testID: 'reference-opacity-popover' }).props.style);
  expect(popup.top).toBeGreaterThan(toolbar.top);
  await act(async () => renderer.unmount());
});
