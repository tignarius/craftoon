import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Workspace } from '../src/components/Workspace';
import { Panel } from '../src/components/Panel';
import { PencilKitView } from '../PencilKitView';

jest.mock('lucide-react-native', () => ({ Image: () => null, Move: () => null, Pen: () => null, Lasso: () => null, Trash2: () => null, Eye: () => null, EyeOff: () => null, Settings2: () => null, Check: () => null, RotateCw: () => null, Maximize2: () => null }));
jest.mock('../PencilKitView', () => ({ PencilKitView: jest.fn(() => null) }));
jest.mock('../src/components/SpeechBubble', () => ({ SpeechBubble: () => null }));

const panels = ['a', 'b'].map(id => ({ id, x: 12, y: 12, width: 160, height: 160, drawingData: `ink-${id}` }));
const props: React.ComponentProps<typeof Workspace> = {
  panels, canvasSize: { width: 900, height: 1200 }, panelModes: {}, bubbles: [], currentTool: 'panel',
  onSheetBoundsChange: jest.fn(), onAddPanel: jest.fn(), onUpdatePanel: jest.fn(), onDeletePanel: jest.fn(),
  onModeChange: jest.fn(), onPanelSelect: jest.fn(), onPanelDoubleTap: jest.fn(), onBackgroundTap: jest.fn(),
  onAddBubble: jest.fn(), onUpdateBubble: jest.fn(), onDeleteBubble: jest.fn(),
};

test('raising a panel changes its z order without moving or remounting PencilKit siblings', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} />); });
  const originalCanvases = renderer.root.findAllByType(PencilKitView);
  await act(async () => renderer.update(<Workspace {...props} panels={[panels[1], panels[0]]} panelModes={{ a: 'layout' }} />));
  const rendered = renderer.root.findAllByType(Panel);
  expect(rendered.map(item => item.props.panel.id)).toEqual(['a', 'b']);
  expect(rendered.map(item => item.props.stackOrder)).toEqual([1, 0]);
  const canvases = renderer.root.findAllByType(PencilKitView);
  canvases.forEach((canvas, index) => {
    expect(canvas).toBe(originalCanvases[index]);
    expect(canvas.props.drawingData).toBe(`ink-${panels[index].id}`);
  });
  await act(async () => renderer.unmount());
});

test('selection does not change the frame or layout border surrounding PencilKit', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} />); });
  const frame = () => {
    const panel = renderer.root.findAllByType(Panel)[0];
    const style = StyleSheet.flatten(panel.findAllByType(View)[0].props.style);
    return { left: style.left, top: style.top, width: style.width, height: style.height, borderWidth: style.borderWidth };
  };
  const before = frame();
  for (const mode of ['layout', 'draw'] as const) {
    await act(async () => renderer.update(<Workspace {...props} panelModes={{ a: mode }} />));
    expect(frame()).toEqual(before);
  }
  await act(async () => renderer.unmount());
});


test.each([
  [{ width: 900, height: 1200 }, 0.5, 10000, { x: 728, y: 1028 }],
  [{ width: 1200, height: 900 }, 2, 10000, { x: 1028, y: 728 }],
  [{ width: 900, height: 1200 }, 1, -10000, { x: 12, y: 12 }],
])('panel movement stops inside all canvas edges for %j at scale %s', async (bounds, scale, delta, expected) => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onMove = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel
      panel={{ ...panels[0], x: 100, y: 100 }} mode="layout" canvasScale={scale} sheetBounds={bounds}
      onSelect={jest.fn()} onModeChange={jest.fn()} onMove={onMove} onResize={jest.fn()}
      onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const move = responder.mock.calls[0][0];
    await act(async () => {
      move.onPanResponderGrant!({} as never, {} as never);
      move.onPanResponderMove!({} as never, { dx: delta, dy: delta } as never);
    });
    expect(onMove).toHaveBeenLastCalledWith('a', expected);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('transforming a tracing reference never shifts, remounts or obscures a panel canvas', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const reference = { uri: 'data:image/png;base64,reference', x: 50, y: 60, width: 700, height: 500, rotation: 0, opacity: 0.35 };
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={panels.map((p,i) => i === 0 ? { ...p,tracingImage: reference } : p)} panelModes={{ a: 'draw' }} />); });
  const canvases = renderer.root.findAllByType(PencilKitView);
  const frames = () => renderer.root.findAllByType(Panel).map(panel => {
    const style = StyleSheet.flatten(panel.findAllByType(View)[0].props.style);
    return { left: style.left, top: style.top, width: style.width, height: style.height };
  });
  const originalFrames = frames();
  expect(canvases[0].props.transparentBackground).toBe(true);
  await act(async () => renderer.update(<Workspace {...props} panels={panels.map((p,i) => i === 0 ? { ...p,tracingImage: { ...reference,x: -100,y: 200,width: 1000,height: 714,rotation: 75 } } : p)} panelModes={{ a: 'draw' }} />));
  expect(frames()).toEqual(originalFrames);
  renderer.root.findAllByType(PencilKitView).forEach((canvas,index) => {
    expect(canvas).toBe(canvases[index]);
    expect(canvas.props.drawingData).toBe(`ink-${panels[index].id}`);
  });
  await act(async () => renderer.update(<Workspace {...props} />));
  expect(renderer.root.findAllByType(PencilKitView)[0].props.transparentBackground).toBe(false);
  expect(frames()).toEqual(originalFrames);
  await act(async () => renderer.unmount());
});


test('reference controls exist only on panels with images, including when the image is hidden', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const reference = { uri: 'data:image/png;base64,reference',x: 5,y: 5,width: 100,height: 100,rotation: 0,opacity: 0.35 };
  const onTracingImageChange = jest.fn();
  const withReference = panels.map((p,i) => i === 0 ? { ...p,tracingImage: reference } : p);
  const options = { ...props,onTracingImageChange,onTracingEditingChange: jest.fn() };
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...options} panels={withReference} />); });
  const panelViews = renderer.root.findAllByType(Panel);
  const imageButtons = (panel: typeof panelViews[0]) => panel.findAllByType(TouchableOpacity)
    .filter(button => String(button.props.accessibilityLabel).includes('reference image') || String(button.props.accessibilityLabel).includes('image controls'));
  expect(imageButtons(panelViews[0]).length).toBe(2);
  expect(imageButtons(panelViews[1])).toHaveLength(0);
  await act(async () => imageButtons(panelViews[0])[0].props.onPress());
  expect(onTracingImageChange).toHaveBeenLastCalledWith('a',{ ...reference,visible: false });
  await act(async () => renderer.update(<Workspace {...options} panels={withReference.map(p => p.id === 'a' ? { ...p,tracingImage: { ...reference,visible: false } } : p)} />));
  expect(renderer.root.findAllByType(TouchableOpacity).some(b => b.props.accessibilityLabel === 'Show reference image')).toBe(true);
  expect(renderer.root.findAllByProps({ testID: 'panel-reference-image-a' })).toHaveLength(0);
  await act(async () => renderer.update(<Workspace {...options} panels={panels} />));
  expect(renderer.root.findAllByProps({ testID: 'panel-reference-controls' })).toHaveLength(0);
  await act(async () => renderer.unmount());
});


test('image import replaces the top-right delete action only in Draw mode and targets that panel', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const onImportTracingImage = jest.fn();
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} onImportTracingImage={onImportTracingImage} panelModes={{ b: 'layout' }} />); });
  const panel = () => renderer.root.findAllByType(Panel).find(p => p.props.panel.id === 'b')!;
  const button = (label: string) => panel().findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label);
  const deleteStyle = StyleSheet.flatten(button('Delete panel')!.props.style);
  expect(button('Import panel reference image')).toBeUndefined();
  await act(async () => renderer.update(<Workspace {...props} onImportTracingImage={onImportTracingImage} panelModes={{ b: 'draw' }} />));
  const image = button('Import panel reference image')!;
  const imageStyle = StyleSheet.flatten(image.props.style);
  expect({ width: imageStyle.width,height: imageStyle.height,borderRadius: imageStyle.borderRadius }).toEqual({
    width: deleteStyle.width,height: deleteStyle.height,borderRadius: deleteStyle.borderRadius,
  });
  expect(button('Delete panel')).toBeUndefined();
  await act(async () => image.props.onPress());
  expect(onImportTracingImage).toHaveBeenCalledWith('b');
  await act(async () => renderer.update(<Workspace {...props} onImportTracingImage={onImportTracingImage} importingTracingImage panelModes={{ b: 'draw' }} />));
  expect(button('Import panel reference image')!.props.disabled).toBe(true);
  await act(async () => renderer.update(<Workspace {...props} onImportTracingImage={onImportTracingImage} panelModes={{ b: 'layout' }} />));
  expect(button('Import panel reference image')).toBeUndefined();
  await act(async () => renderer.unmount());
});

test('Draw mode pauses ink only during reference manipulation and resumes when controls close', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const options = { ...props,panelModes: { a: 'draw' as const } };
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...options} />); });
  const canvas = () => renderer.root.findAllByType(PencilKitView)[0];
  const original = canvas();
  expect(canvas().props.isDrawingActive).toBe(true);
  await act(async () => renderer.update(<Workspace {...options} editingTracingPanelId="a" />));
  expect(canvas()).toBe(original);
  expect(canvas().props.isDrawingActive).toBe(false);
  expect(canvas().props.drawingTool).toBe('pen');
  expect(renderer.root.findAllByType(Panel)[0].props.mode).toBe('draw');
  await act(async () => renderer.update(<Workspace {...options} editingTracingPanelId={null} />));
  expect(canvas().props.isDrawingActive).toBe(true);
  expect(canvas().props.drawingData).toBe('ink-a');
  await act(async () => renderer.unmount());
});

test('panel mode cycles only Layout and Draw; stroke selection stays in the native palette', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const onModeChange = jest.fn();
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} onModeChange={onModeChange} panelModes={{ a: 'layout' }} />); });
  const panel = () => renderer.root.findAllByType(Panel).find(p => p.props.panel.id === 'a')!;
  await act(async () => panel().props.onModeChange('a'));
  expect(onModeChange).toHaveBeenLastCalledWith('a', 'draw');
  await act(async () => renderer.update(<Workspace {...props} onModeChange={onModeChange} panelModes={{ a: 'draw' }} />));
  expect(panel().findByType(PencilKitView).props.drawingTool).toBe('pen');
  await act(async () => panel().props.onModeChange('a'));
  expect(onModeChange).toHaveBeenLastCalledWith('a', 'layout');
  await act(async () => renderer.unmount());
});
