import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PanResponder, TouchableOpacity } from 'react-native';
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
