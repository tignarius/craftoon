import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Workspace } from '../src/components/Workspace';
import { Panel } from '../src/components/Panel';
import { PanelCornerHandle } from '../src/components/PanelCornerHandle';
import { Polygon } from 'react-native-svg';
import { PanelSurface } from '../src/components/PanelSurface';
import { worldCorners, fitPanelBesideNeighbors, panelRenderedFrame, panelsCollide } from '../src/utils/panelGeometry';
import { AppText } from '../src/components/AppText';
import { PencilKitView } from '../PencilKitView';
import { reshapePanelPoint } from '../src/utils/panelSnap';

jest.mock('lucide-react-native', () => ({ MoveHorizontal: () => null, ArrowUpRight: () => null, ZoomIn: () => null, ZoomOut: () => null, Image: () => null, Move: () => null, Pen: () => null, Lasso: () => null, Trash2: () => null, Eye: () => null, EyeOff: () => null, Settings2: () => null, Check: () => null, RotateCw: () => null, Maximize2: () => null }));
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
    expect(onMove).not.toHaveBeenCalled();
    await act(async () => move.onPanResponderRelease!({} as never, { dx: delta, dy: delta } as never));
    expect(onMove).toHaveBeenCalledTimes(1);
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
  expect(renderer.root.findAllByType(PanelSurface)[0].props.clipContent).toBe(true);
  await act(async () => renderer.update(<Workspace {...props} panels={panels.map((p,i) => i === 0 ? { ...p,tracingImage: { ...reference,x: -100,y: 200,width: 1000,height: 714,rotation: 75 } } : p)} panelModes={{ a: 'draw' }} />));
  expect(frames()).toEqual(originalFrames);
  renderer.root.findAllByType(PencilKitView).forEach((canvas,index) => {
    expect(canvas).toBe(canvases[index]);
    expect(canvas.props.drawingData).toBe(`ink-${panels[index].id}`);
  });
  await act(async () => renderer.update(<Workspace {...props} />));
  expect(renderer.root.findAllByType(PencilKitView)[0].props.transparentBackground).toBe(true);
  expect(renderer.root.findAllByType(PanelSurface)[0].props.clipContent).toBe(false);
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


test.each([
  [{ width: 900, height: 1200 }, 0.5, 10000, { x: 100, y: 100 }, { width: 788, height: 1088 }],
  [{ width: 1200, height: 900 }, 2, 10000, { x: 100, y: 100 }, { width: 1088, height: 788 }],
  [{ width: 900, height: 1200 }, 1, -10000, { x: 100, y: 100 }, { width: 80, height: 80 }],
  [{ width: 900, height: 1200 }, 1, 10000, { x: 850, y: 1150 }, { width: 38, height: 38 }],
])('panel resize stays within %j at scale %s, including minimum-size edge cases', async (bounds, scale, delta, position, expected) => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onResize = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel
      panel={{ ...panels[0], ...position }} mode="layout" canvasScale={scale} sheetBounds={bounds}
      otherPanels={[{ ...panels[1], x: bounds.width + 10, y: bounds.height + 10 }]}
      onSelect={jest.fn()} onModeChange={jest.fn()} onMove={jest.fn()} onResize={onResize}
      onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const resize = responder.mock.calls[1][0];
    await act(async () => {
      resize.onPanResponderGrant!({} as never, {} as never);
      resize.onPanResponderMove!({} as never, { dx: delta, dy: delta } as never);
    });
    expect(onResize).not.toHaveBeenCalled();
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: delta, dy: delta } as never));
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenLastCalledWith('a', { ...expected, resizeInk: true, warpInk: false });
    expect(position.x + expected.width).toBeLessThanOrEqual(bounds.width - 12);
    expect(position.y + expected.height).toBeLessThanOrEqual(bounds.height - 12);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('first tap selects an inactive panel without moving its layout', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onSelect = jest.fn();
  const onMove = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={panels[0]} mode={undefined}
      onSelect={onSelect} onModeChange={jest.fn()} onMove={onMove} onResize={jest.fn()}
      onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const move = responder.mock.calls[0][0];
    await act(async () => {
      move.onPanResponderGrant!({} as never, {} as never);
      move.onPanResponderMove!({} as never, { dx: 2, dy: 2 } as never);
      move.onPanResponderRelease!({} as never, { dx: 2, dy: 2 } as never);
    });
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(onMove).not.toHaveBeenCalled();
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('panel zoom toggles in Draw mode without changing or remounting any drawing', async () => {
  const onUpdatePanel = jest.fn(), onSheetBoundsChange = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} onUpdatePanel={onUpdatePanel}
    onSheetBoundsChange={onSheetBoundsChange} panelModes={{ a: 'draw' }} />); });
  const viewport = renderer.root.findAllByType(View).find(v => v.props.onLayout)!;
  await act(async () => viewport.props.onLayout({ nativeEvent: { layout: { width: 1024, height: 768 } } }));
  const canvases = renderer.root.findAllByType(PencilKitView);
  const before = renderer.root.findByProps({ testID: 'workspace-zoom-frame' }).props.style;
  onSheetBoundsChange.mockClear();
  const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label)!;
  await act(async () => button('Zoom in panel').props.onPress());
  const focused = renderer.root.findAllByType(Panel);
  expect(focused[0].props.focused).toBe(true);
  expect(focused[0].props.mode).toBe('draw');
  expect(renderer.root.findByProps({ testID: 'workspace-zoom-frame' }).props.style).toEqual(before);
  expect(focused[0].props.displayScale).toBeGreaterThan(1);
  expect(focused[0].props.hidden).toBe(false);
  expect(focused[1].props.hidden).toBe(true);
  expect(StyleSheet.flatten(focused[1].findAllByType(View)[0].props.style).opacity).toBe(0);
  expect(focused[1].props.interactive).toBe(false);
  canvases.forEach((canvas, i) => expect(renderer.root.findAllByType(PencilKitView)[i]).toBe(canvas));
  expect(onUpdatePanel).not.toHaveBeenCalled();
  expect(onSheetBoundsChange).not.toHaveBeenCalled();
  await act(async () => button('Zoom out panel').props.onPress());
  expect(renderer.root.findByProps({ testID: 'workspace-zoom-frame' }).props.style).toEqual(before);
  expect(renderer.root.findAllByType(Panel).every(p => p.props.interactive)).toBe(true);
  await act(async () => button('Zoom in panel').props.onPress());
  await act(async () => renderer.update(<Workspace {...props} panelModes={{ a: 'layout' }} />));
  expect(renderer.root.findAllByType(Panel).some(p => p.props.focused)).toBe(false);
  await act(async () => renderer.unmount());
});

test('the panel border menu offers four persistent styles without touching ink', async () => {
  const onUpdatePanel = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} onUpdatePanel={onUpdatePanel} panelModes={{ a: 'layout' }} />); });
  const ink = renderer.root.findAllByType(PencilKitView)[0];
  const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === label)!;
  for (const borderStyle of ['solid', 'dashed', 'dotted', 'none']) {
    const leftControls = renderer.root.findAllByProps({ testID: 'panel-left-controls' })[0];
    expect(leftControls.findAllByType(TouchableOpacity).some(b => b.props.accessibilityLabel === 'Panel border: solid')).toBe(true);
    await act(async () => button('Panel border: solid').props.onPress());
    expect(renderer.root.findAllByProps({ testID: 'panel-border-menu' })[0].findAllByType(AppText)).toHaveLength(0);
    await act(async () => button(`Use ${borderStyle} panel border`).props.onPress());
    expect(onUpdatePanel).toHaveBeenLastCalledWith('a', { borderStyle });
  }
  await act(async () => renderer.update(<Workspace {...props} panels={panels.map(p => p.id === 'a' ? { ...p, borderStyle: 'none' } : p)} panelModes={{ a: 'draw' }} />));
  const panel = renderer.root.findAllByType(Panel)[0];
  expect(panel.findAllByProps({ testID: 'panel-border' })).toHaveLength(0);
  expect(panel.findByType(PencilKitView)).toBe(ink);
  expect(ink.props.drawingData).toBe('ink-a');
  await act(async () => renderer.unmount());
});

test('tapping the resize circle reveals only its cross-arrow handle; a drag moves only the bottom-right corner', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onShapeChange = jest.fn();
  const onMove = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={panels[0]} mode="layout" onShapeChange={onShapeChange}
      onSelect={jest.fn()} onModeChange={jest.fn()} onMove={onMove} onResize={jest.fn()} onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const ink = renderer.root.findByType(PencilKitView);
    const resize = responder.mock.calls[1][0];
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never));
    expect(renderer.root.findAllByType(PanelCornerHandle)).toHaveLength(1);
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Reshape panel corner 1' })).toHaveLength(0);
    const corner = responder.mock.calls[responder.mock.calls.length - 1][0];
    const move = responder.mock.calls[0][0];
    await act(async () => {
      move.onPanResponderGrant!({} as never, {} as never);
      move.onPanResponderMove!({} as never, { dx: 100, dy: 100 } as never);
    });
    expect(onMove).not.toHaveBeenCalled();
    await act(async () => corner.onPanResponderGrant!({} as never, {} as never));
    await act(async () => corner.onPanResponderMove!({} as never, { dx: -30, dy: -20 } as never));
    await act(async () => corner.onPanResponderMove!({} as never, { dx: -40, dy: -30 } as never));
    expect(onShapeChange).not.toHaveBeenCalled();
    await act(async () => corner.onPanResponderRelease!({} as never, { dx: -40, dy: -30 } as never));
    expect(onShapeChange).toHaveBeenCalledTimes(1);
    expect(onShapeChange.mock.calls[0][1].corners).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.75, y: 1 }, { x: 0, y: 1 }]);
    expect(renderer.root.findByType(PencilKitView)).toBe(ink);
    expect(ink.props.drawingData).toBe('ink-a');
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});


test('drawing beside the visible sloping edge previews and creates the complementary trapezoid', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onAddPanel = jest.fn();
  const left = { ...panels[0], x: 12, y: 12, width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={[left]} onAddPanel={onAddPanel} />); });
    const gesture = responder.mock.calls[0][0];
    await act(async () => gesture.onPanResponderGrant!({ nativeEvent: { locationX: 210, locationY: 12 } } as never, {} as never));
    await act(async () => gesture.onPanResponderMove!({ nativeEvent: { locationX: 650, locationY: 412 } } as never, {} as never));
    const preview = renderer.root.findAllByProps({ testID: 'panel-creation-preview' })[0].findAllByType(Polygon)[0].props.points;
    await act(async () => gesture.onPanResponderRelease!({} as never, {} as never));
    expect(onAddPanel).toHaveBeenCalledTimes(1);
    const created = onAddPanel.mock.calls[0][0];
    expect(worldCorners(created).map(p => `${p.x},${p.y}`).join(' ')).toBe(preview);
    const quad = worldCorners(created);
    expect(quad[1].x - quad[0].x).toBeGreaterThan(quad[2].x - quad[3].x);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('deselecting adjacent trapezoids keeps their outlines above transparent rectangular ink surfaces', async () => {
  const left = { ...panels[0], x: 12, y: 12, width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const right = { ...panels[1], ...fitPanelBesideNeighbors({ x: 210, y: 12, width: 440, height: 400 }, [left], props.canvasSize) };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={[left, right]} panelModes={{ b: 'layout' }} />); });
  const ink = renderer.root.findAllByType(PencilKitView);
  await act(async () => renderer.update(<Workspace {...props} panels={[left, right]} panelModes={{}} />));
  renderer.root.findAllByType(Panel).forEach((view, index) => {
    const paper = view.findAllByProps({ testID: 'panel-paper' })[0];
    const border = view.findAllByProps({ testID: 'panel-border' })[0];
    expect(border.props.points).toBe(paper.props.points);
    expect(border.props.stroke).toBe('#1E293B');
    const surfaceStyle = StyleSheet.flatten(view.findByType(PanelSurface).props.style);
    expect(surfaceStyle.backgroundColor).toBe('transparent');
    expect(StyleSheet.flatten(view.findAllByProps({ testID: 'panel-outline-layer' })[0].props.style).zIndex).toBeGreaterThan(surfaceStyle.zIndex);
    expect(view.findByType(PencilKitView)).toBe(ink[index]);
    expect(ink[index].props.transparentBackground).toBe(true);
  });
  await act(async () => renderer.unmount());
});

test('the right-hand panel places both resize and reshape controls on its left side', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onResize = jest.fn(), onShapeChange = jest.fn();
  const left = { ...panels[0], x: 12, y: 12, width: 300, height: 400 };
  const right = { ...panels[1], x: 328, y: 12, width: 300, height: 400, adjustmentSide: 'left' as const };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={right} otherPanels={[left]} mode="layout" canvasScale={2}
      sheetBounds={{ width: 900, height: 1200 }} onResize={onResize} onShapeChange={onShapeChange}
      onSelect={jest.fn()} onModeChange={jest.fn()} onMove={jest.fn()} onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const circle = renderer.root.findAllByProps({ accessibilityLabel: 'Resize or reshape panel' })[0];
    expect(StyleSheet.flatten(circle.props.style).left).toBe(-14);
    const resize = responder.mock.calls[1][0];
    await act(async () => {
      resize.onPanResponderGrant!({} as never, {} as never);
      resize.onPanResponderMove!({} as never, { dx: 100, dy: 80 } as never);
    });
    expect(onResize).not.toHaveBeenCalled();
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: 100, dy: 80 } as never));
    expect(onResize).toHaveBeenLastCalledWith('b', { x: 378, width: 250, height: 440, resizeInk: true, warpInk: false });
    await act(async () => resize.onPanResponderGrant!({} as never, {} as never));
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never));
    expect(renderer.root.findAllByType(PanelCornerHandle)).toHaveLength(1);
    expect(renderer.root.findByType(PanelCornerHandle).props.side).toBe('left');
    const corner = responder.mock.calls[responder.mock.calls.length - 1][0];
    await act(async () => {
      corner.onPanResponderGrant!({} as never, {} as never);
      corner.onPanResponderMove!({} as never, { dx: 0, dy: 200 } as never);
      corner.onPanResponderRelease!({} as never, { dx: 0, dy: 200 } as never);
    });
    expect(onShapeChange).not.toHaveBeenCalled();
    await act(async () => {
      corner.onPanResponderGrant!({} as never, {} as never);
      corner.onPanResponderMove!({} as never, { dx: 120, dy: -200 } as never);
      corner.onPanResponderRelease!({} as never, { dx: 120, dy: -200 } as never);
    });
    expect(onShapeChange).toHaveBeenCalledTimes(1);
    expect(onShapeChange.mock.calls[0][1].corners).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.2, y: 1 }]);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('a box can be drawn beside the narrow top after the first box is widened at the bottom', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onAddPanel = jest.fn();
  const original = { id: 'sloped', x: 12, y: 12, width: 300, height: 400 };
  const sloped = { ...original, ...reshapePanelPoint(original, 'right', 220, [], { width: 900, height: 1200 }) };
  const top = worldCorners(panelRenderedFrame(sloped))[1];
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={[sloped]} onAddPanel={onAddPanel} />); });
    const gesture = responder.mock.calls[0][0];
    await act(async () => gesture.onPanResponderGrant!({ nativeEvent: { locationX: top.x + 0.25, locationY: sloped.y } } as never, {} as never));
    for (const x of [600, 700, 850]) {
      await act(async () => gesture.onPanResponderMove!({ nativeEvent: { locationX: x, locationY: 412 } } as never, {} as never));
    }
    expect(renderer.root.findAllByProps({ testID: 'panel-creation-preview' }).length).toBeGreaterThan(0);
    await act(async () => gesture.onPanResponderRelease!({} as never, {} as never));
    expect(onAddPanel).toHaveBeenCalledTimes(1);
    const next = onAddPanel.mock.calls[0][0];
    expect(next.corners).toBeDefined();
    expect(next.x + next.width).toBeCloseTo(850);
    expect(panelsCollide(next, sloped, 3.99)).toBe(false);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test.each([4, 16])('drawing below two boxes passes the first edge snap and continues at a %s-point gutter', async gap => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onAddPanel = jest.fn();
  const upper = [
    { id: 'upper-left', x: 12, y: 12, width: 300, height: 400 },
    { id: 'upper-right', x: 312 + gap, y: 12, width: 400, height: 400 },
  ];
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={upper} onAddPanel={onAddPanel} />); });
    const gesture = responder.mock.calls[0][0];
    await act(async () => gesture.onPanResponderGrant!({ nativeEvent: { locationX: 12, locationY: 412 + gap } } as never, {} as never));
    for (const x of [280, 312, 400, 850]) {
      await act(async () => gesture.onPanResponderMove!({ nativeEvent: { locationX: x, locationY: 700 } } as never, {} as never));
    }
    expect(onAddPanel).not.toHaveBeenCalled();
    const preview = renderer.root.findAllByProps({ testID: 'panel-creation-preview' })[0].findAllByType(Polygon)[0].props.points;
    expect(preview).toContain('850,700');
    await act(async () => gesture.onPanResponderRelease!({} as never, {} as never));
    expect(onAddPanel).toHaveBeenCalledTimes(1);
    expect(onAddPanel.mock.calls[0][0]).toEqual({ x: 12, y: 412 + gap, width: 838, height: 700 - 412 - gap });
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('dragging from beside a box into its occupied side shows no preview and creates nothing', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onAddPanel = jest.fn(), onBackgroundTap = jest.fn();
  const existing = { ...panels[0], x: 300, y: 300, width: 200, height: 200 };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={[existing]} onAddPanel={onAddPanel} onBackgroundTap={onBackgroundTap} />); });
    const gesture = responder.mock.calls[0][0];
    await act(async () => gesture.onPanResponderGrant!({ nativeEvent: { locationX: 516, locationY: 350 } } as never, {} as never));
    await act(async () => gesture.onPanResponderMove!({ nativeEvent: { locationX: 350, locationY: 450 } } as never, {} as never));
    expect(renderer.root.findAllByProps({ testID: 'panel-creation-preview' })).toHaveLength(0);
    await act(async () => gesture.onPanResponderRelease!({} as never, {} as never));
    expect(onAddPanel).not.toHaveBeenCalled();
    expect(onBackgroundTap).not.toHaveBeenCalled();
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test.each([false, true])('a new panel stays visible at its last free position when dragged into an existing box (return to free side: %s)', async returnToFreeSide => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onAddPanel = jest.fn();
  const existing = { ...panels[0], x: 300, y: 300, width: 200, height: 200 };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={[existing]} onAddPanel={onAddPanel} />); });
    const gesture = responder.mock.calls[0][0];
    const drag = (x: number) => gesture.onPanResponderMove!({ nativeEvent: { locationX: x, locationY: 450 } } as never, {} as never);
    const preview = () => renderer.root.findAllByProps({ testID: 'panel-creation-preview' })[0].findAllByType(Polygon)[0].props.points;
    await act(async () => gesture.onPanResponderGrant!({ nativeEvent: { locationX: 516, locationY: 350 } } as never, {} as never));
    await act(async () => drag(650));
    const freePreview = preview();
    await act(async () => drag(350));
    expect(preview()).toBe(freePreview);
    expect(onAddPanel).not.toHaveBeenCalled();
    if (returnToFreeSide) {
      await act(async () => drag(700));
      expect(preview()).not.toBe(freePreview);
    }
    await act(async () => gesture.onPanResponderRelease!({} as never, {} as never));
    expect(onAddPanel).toHaveBeenCalledTimes(1);
    const saved = onAddPanel.mock.calls[0][0];
    expect(saved.x).toBe(516);
    expect(saved.width).toBe(returnToFreeSide ? 184 : 134);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('moving an existing box toward an occupied box keeps its last free position', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onMove = jest.fn();
  const left = { ...panels[0], x: 300, y: 300, width: 200, height: 200 };
  const right = { ...panels[1], x: 516, y: 300, width: 200, height: 200 };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const options = { mode: 'layout' as const, otherPanels: [left], sheetBounds: { width: 900, height: 1200 },
    onMove, onSelect: jest.fn(), onModeChange: jest.fn(), onResize: jest.fn(), onDelete: jest.fn(), onDoubleTap: jest.fn() };
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel {...options} panel={right} />); });
    const gesture = responder.mock.calls[0][0];
    await act(async () => gesture.onPanResponderGrant!({} as never, {} as never));
    await act(async () => gesture.onPanResponderMove!({} as never, { dx: 50, dy: 0 } as never));
    expect(onMove).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'panel-container' }).props.style).left).toBe(566);
    await act(async () => gesture.onPanResponderMove!({} as never, { dx: -200, dy: 0 } as never));
    expect(onMove).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'panel-container' }).props.style).left).toBe(566);
    await act(async () => gesture.onPanResponderRelease!({} as never, { dx: -200, dy: 0 } as never));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenLastCalledWith('b', { x: 566, y: 300 });
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('overlapping polygon frames pass empty-area touches through and keep the first panel selectable', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onPanelSelect = jest.fn();
  const shaped = [
    { ...panels[0], x: 12, width: 400, height: 400, corners: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.4, y: 1 }, { x: 0, y: 1 }] },
    { ...panels[1], x: 80, width: 620, height: 400, corners: [{ x: 0.7, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.6, y: 1 }] },
  ].map(panel => ({ ...panel, corners: panel.corners as import('../src/types/comic').PanelCorners }));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panels={shaped} onPanelSelect={onPanelSelect} />); });
    renderer.root.findAllByType(PanelSurface).forEach(surface => expect(surface.props.pointerEvents).toBe('box-none'));
    const first = responder.mock.calls[1][0];
    await act(async () => {
      first.onPanResponderGrant!({} as never, {} as never);
      first.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never);
    });
    expect(onPanelSelect).toHaveBeenLastCalledWith('a');
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('switching panel mode clears corner editing immediately so later Layout selection is not locked', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onModeChange = jest.fn(), onDoubleTap = jest.fn();
  const panel = { ...panels[0], corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.7, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const options = { panel, onModeChange, onDoubleTap, onSelect: jest.fn(), onMove: jest.fn(), onResize: jest.fn(), onDelete: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel {...options} mode="layout" />); });
    const move = responder.mock.calls[0][0], resize = responder.mock.calls[1][0];
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never));
    expect(renderer.root.findAllByType(PanelCornerHandle)).toHaveLength(1);
    const modeButton = renderer.root.findAllByType(TouchableOpacity).find(b => b.props.accessibilityLabel === 'Panel mode: Layout')!;
    await act(async () => modeButton.props.onPress());
    expect(onModeChange).toHaveBeenCalledWith('a');
    expect(renderer.root.findAllByType(PanelCornerHandle)).toHaveLength(0);
    await act(async () => renderer.update(<Panel {...options} mode="draw" />));
    await act(async () => renderer.update(<Panel {...options} mode="layout" />));
    await act(async () => {
      move.onPanResponderGrant!({} as never, {} as never);
      move.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never);
    });
    expect(onDoubleTap).toHaveBeenCalledWith('a');
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('zoom refits and recenters after a panel is reduced while retaining its larger ink frame', async () => {
  const original = { ...panels[0], x: 100, y: 100, width: 600, height: 600 };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const options = { ...props, panels: [original], panelModes: { a: 'draw' as const }, onImportTracingImage: jest.fn() };
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...options} />); });
  const viewport = renderer.root.findAllByType(View).find(v => v.props.onLayout)!;
  await act(async () => viewport.props.onLayout({ nativeEvent: { layout: { width: 1024, height: 768 } } }));
  const leftButtons = () => renderer.root.findAllByProps({ testID: 'panel-left-controls' })[0].findAllByType(TouchableOpacity);
  expect(leftButtons().map(b => b.props.accessibilityLabel)).toEqual(['Panel mode: Draw', 'Zoom in panel', 'Import panel reference image']);
  await act(async () => leftButtons()[1].props.onPress());
  const beforeScale = renderer.root.findByType(Panel).props.canvasScale;
  const ink = renderer.root.findByType(PencilKitView);
  const corners = [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.45 }, { x: 0.1, y: 0.45 }] as import('../src/types/comic').PanelCorners;
  await act(async () => renderer.update(<Workspace {...options} panels={[{ ...original, corners }]} />));
  const panel = renderer.root.findByType(Panel);
  expect(panel.props.canvasScale).toBeGreaterThan(beforeScale);
  const localCenterX = 150 - original.width / 2;
  const localCenterY = 165 - original.height / 2;
  expect(panel.props.displayPosition.x + original.width / 2 + localCenterX * panel.props.displayScale).toBeCloseTo(450);
  expect(panel.props.displayPosition.y + original.height / 2 + localCenterY * panel.props.displayScale).toBeCloseTo(600);
  expect(panel.findByType(PencilKitView)).toBe(ink);
  expect(leftButtons().map(b => b.props.accessibilityLabel)).toEqual(['Panel mode: Draw', 'Zoom out panel', 'Import panel reference image']);
  await act(async () => renderer.unmount());
});

test('a circle drag passes the side gutter to align with the box above, but cannot overlap its neighbor', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onResize = jest.fn(), onGuidesChange = jest.fn();
  const panel = { id: 'subject', x: 100, y: 400, width: 300, height: 300 };
  const otherPanels = [
    { id: 'side', x: 500, y: 400, width: 200, height: 300 },
    { id: 'above', x: 300, y: 12, width: 202, height: 200 },
  ];
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={panel} otherPanels={otherPanels}
      mode="layout" sheetBounds={{ width: 900, height: 1200 }} onResize={onResize} onGuidesChange={onGuidesChange}
      onSelect={jest.fn()} onModeChange={jest.fn()} onMove={jest.fn()} onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const gesture = responder.mock.calls[1][0];
    const point = () => {
      const frame = renderer.root.findByType(PencilKitView).props.shapeFrame;
      return frame.x + 2 + frame.corners[2].x * frame.width;
    };
    await act(async () => gesture.onPanResponderGrant!({} as never, {} as never));
    await act(async () => gesture.onPanResponderMove!({} as never, { dx: 100, dy: 0 } as never));
    expect(point()).toBeCloseTo(498); // Four-point gutter beside the neighbor.
    await act(async () => gesture.onPanResponderMove!({} as never, { dx: 102, dy: 0 } as never));
    expect(point()).toBeCloseTo(500); // Continue two more points to match above.
    expect(onGuidesChange).toHaveBeenLastCalledWith(expect.arrayContaining([{ type: 'vertical', pos: 500 }]));
    await act(async () => gesture.onPanResponderMove!({} as never, { dx: 200, dy: 0 } as never));
    expect(point()).toBeCloseTo(500); // Rejected overlap retains the last valid box.
    expect(onResize).not.toHaveBeenCalled();
    await act(async () => gesture.onPanResponderRelease!({} as never, { dx: 200, dy: 0 } as never));
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(panelsCollide(panelRenderedFrame({ ...panel, ...onResize.mock.calls[0][1] }), panelRenderedFrame(otherPanels[0]), 0)).toBe(false);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('the same circle gesture uses the latest neighbor geometry rather than its original frame', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onResize = jest.fn();
  const panel = { ...panels[0], x: 100, y: 100, width: 700, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 300 / 700, y: 0 }, { x: 0.3, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const neighbor = { ...panels[1], x: 400, y: 100, width: 400, height: 400,
    corners: [{ x: 0.45, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.2, y: 1 }] as import('../src/types/comic').PanelCorners };
  const options = { panel, mode: 'layout' as const, sheetBounds: { width: 900, height: 1200 }, onResize,
    onSelect: jest.fn(), onModeChange: jest.fn(), onMove: jest.fn(), onDelete: jest.fn(), onDoubleTap: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel {...options} otherPanels={[neighbor]} />); });
    const circle = responder.mock.calls[1][0];
    await act(async () => circle.onPanResponderGrant!({} as never, {} as never));
    await act(async () => circle.onPanResponderMove!({} as never, { dx: 240, dy: 0 } as never));
    expect(onResize).not.toHaveBeenCalled();
    const preview = () => { const frame = renderer.root.findByType(PencilKitView).props.shapeFrame;
      return worldCorners({ ...panel, x: frame.x + 2, y: panel.y + 2, width: frame.width, height: frame.height, corners: frame.corners })[2].x; };
    const first = preview();
    const farther = { ...neighbor, corners: [{ x: 0.95, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.85, y: 1 }] as import('../src/types/comic').PanelCorners };
    await act(async () => renderer.update(<Panel {...options} otherPanels={[farther]} />));
    await act(async () => circle.onPanResponderMove!({} as never, { dx: 300, dy: 0 } as never));
    expect(onResize).not.toHaveBeenCalled();
    const current = preview();
    expect(current).toBeGreaterThan(first);
    expect(current).toBeCloseTo(worldCorners(panelRenderedFrame(panel))[2].x + 300);
    await act(async () => circle.onPanResponderRelease!({} as never, { dx: 300, dy: 0 } as never));
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(worldCorners(panelRenderedFrame({ ...panel, ...onResize.mock.calls[0][1] }))[2].x).toBeCloseTo(current);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('the outward arrow previews movement with the fractional coordinates from the live canvas', async () => {
  const responder = jest.spyOn(PanResponder, 'create');
  const onShapeChange = jest.fn();
  const panel = { id: 'first', x: 101.7187681642817, y: 65.15627789427381, width: 565.3594227596514, height: 319.2187333514457,
    corners: [{ x: 0, y: 0 }, { x: 0.6169371394030448, y: 0 }, { x: 0.6170746742227466, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const neighbor = { id: 'next', x: 427.5624938881959, y: panel.y, width: 460.4375061118041, height: panel.height,
    corners: [{ x: 0.06719152787156571, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.3953870215741407, y: 1 }] as import('../src/types/comic').PanelCorners };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={panel} otherPanels={[neighbor]} mode="layout"
      sheetBounds={{ width: 900, height: 1200 }} onShapeChange={onShapeChange} onSelect={jest.fn()} onModeChange={jest.fn()}
      onMove={jest.fn()} onResize={jest.fn()} onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
    const resize = responder.mock.calls[1][0];
    await act(async () => resize.onPanResponderRelease!({} as never, { dx: 0, dy: 0 } as never));
    const arrow = responder.mock.calls[responder.mock.calls.length - 1][0];
    await act(async () => arrow.onPanResponderGrant!({} as never, {} as never));
    await act(async () => arrow.onPanResponderMove!({} as never, { dx: 100, dy: 0 } as never));
    const preview = renderer.root.findByType(PanelCornerHandle).props.panel;
    expect(worldCorners(preview)[2].x).toBeCloseTo(worldCorners(panel)[2].x + 100);
    expect(renderer.root.findByType(PanelCornerHandle).props.side).toBe('right');
    await act(async () => arrow.onPanResponderRelease!({} as never, { dx: 100, dy: 0 } as never));
    expect(onShapeChange).toHaveBeenCalledTimes(1);
    expect(worldCorners({ ...panel, ...onShapeChange.mock.calls[0][1] })[2].x).toBeCloseTo(worldCorners(panel)[2].x + 100);
  } finally {
    if (renderer) { await act(async () => renderer.unmount()); }
    responder.mockRestore();
  }
});

test('the native ink renderer receives the current clipping polygon through Draw, Layout and resizing', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  const panel = { ...panels[0], width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const options = { ...props, panels: [panel], panelModes: { a: 'draw' as const } };
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...options} />); });
  const ink = renderer.root.findByType(PencilKitView);
  expect(ink.props.polygonPoints).toEqual(panel.corners);
  const changed = { ...panel, width: 450, corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  await act(async () => renderer.update(<Workspace {...options} panels={[changed]} />));
  expect(renderer.root.findByType(PencilKitView)).toBe(ink);
  expect(ink.props.polygonPoints).toEqual(changed.corners);
  await act(async () => renderer.update(<Workspace {...options} panels={[changed]} panelModes={{ a: 'layout' }} />));
  expect(ink.props.polygonPoints).toEqual(changed.corners);
  expect(ink.props.isDrawingActive).toBe(false);
  await act(async () => renderer.update(<Workspace {...options} panels={[changed]} panelModes={{}} />));
  expect(ink.props.polygonPoints).toEqual(changed.corners);
  expect(ink.props.drawingData).toBe('ink-a');
  await act(async () => renderer.unmount());
});

test('changing panel selection reuses unchanged native shape-frame props', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Workspace {...props} panelModes={{ a: 'draw' }} />); });
  const frames = renderer.root.findAllByType(PencilKitView).map(ink => ink.props.shapeFrame);
  await act(async () => renderer.update(<Workspace {...props} panelModes={{ b: 'draw' }} />));
  renderer.root.findAllByType(PencilKitView).forEach((ink, i) => expect(ink.props.shapeFrame).toBe(frames[i]));
  await act(async () => renderer.unmount());
});

test.each(['solid', 'dashed', 'dotted', 'none'] as const)('panel zoom preserves the screen thickness and spacing of a %s outline', async borderStyle => {
  const panel = { ...panels[0], borderStyle };
  const options = { panel, mode: 'draw' as const, onSelect: jest.fn(), onModeChange: jest.fn(), onMove: jest.fn(),
    onResize: jest.fn(), onDelete: jest.fn(), onDoubleTap: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Panel {...options} canvasScale={0.7} />); });
  const outline = () => renderer.root.findByProps({ testID: 'panel-outline-layer' }).findByType(Polygon).props;
  const before = outline();
  const ink = renderer.root.findByType(PencilKitView);
  try {
    await act(async () => renderer.update(<Panel {...options} focused displayScale={4} canvasScale={2.8} />));
    const layer = renderer.root.findByProps({ testID: 'panel-outline-layer' });
    const svgStyle = StyleSheet.flatten(layer.props.style);
    const sheetScale = 0.7;
    const rasterScale = svgStyle.transform.reduce((value: number, transform: { scale?: number }) => value * (transform.scale ?? 1), sheetScale);
    // The SVG itself reaches the screen at 1:1 scale: rerasterized, not stretched.
    expect(rasterScale).toBeCloseTo(1);
    expect(layer.parent).toBe(renderer.root.findByProps({ testID: 'panel-container' }).parent);
    expect(outline().strokeWidth * rasterScale).toBeCloseTo(before.strokeWidth * sheetScale);
    expect(layer.props.viewBox).toBe(`0 0 ${layer.props.width} ${layer.props.height}`);
    if (before.strokeDasharray) {
      const original = before.strokeDasharray.split(' ').map(Number);
      outline().strokeDasharray.split(' ').map(Number).forEach((value: number, index: number) => {
        expect(value * rasterScale).toBeCloseTo(original[index] * sheetScale);
      });
    }
    expect(renderer.root.findByType(PencilKitView)).toBe(ink);
    expect(ink.props.drawingData).toBe(panel.drawingData);
    const parse = (points: string) => points.split(' ').map(point => point.split(',').map(Number));
    const source = parse(before.points), rendered = parse(outline().points);
    rendered.forEach((point, index) => point.forEach((coordinate, axis) => {
      expect((coordinate - rendered[0][axis]) * rasterScale)
        .toBeCloseTo((source[index][axis] - source[0][axis]) * 4 * sheetScale);
    }));
    await act(async () => renderer.update(<Panel {...options} canvasScale={0.7} />));
    expect(outline().strokeWidth).toBe(before.strokeWidth);
    expect(outline().strokeDasharray).toBe(before.strokeDasharray);
  } finally { await act(async () => renderer.unmount()); }
});

test('focused vector outlines render only the visible polygon rather than its retained ink frame', async () => {
  const panel = { ...panels[0], width: 700, height: 600,
    corners: [{ x: 0.2, y: 0.1 }, { x: 0.6, y: 0.1 }, { x: 0.4, y: 0.5 }, { x: 0.2, y: 0.5 }] as import('../src/types/comic').PanelCorners };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Panel panel={panel} mode="draw" focused displayScale={3} canvasScale={1.5}
    onSelect={jest.fn()} onModeChange={jest.fn()} onMove={jest.fn()} onResize={jest.fn()} onDelete={jest.fn()} onDoubleTap={jest.fn()} />); });
  try {
    const svg = renderer.root.findByProps({ testID: 'panel-outline-layer' });
    // Visible width/height at final scale plus 1.75pt antialiasing padding per side.
    expect(svg.props.width).toBeCloseTo(421.1);
    expect(svg.props.height).toBeCloseTo(361.1);
    expect(svg.findByType(Polygon).props.strokeWidth).toBeCloseTo(1.5);
    expect(renderer.root.findByType(PencilKitView).props.shapeFrame.width).toBe(696);
  } finally { await act(async () => renderer.unmount()); }
});

test.each([0.5, 0.8, 1.2])('focused controls follow the short top edge and keep normal icon sizes at sheet scale %s', async sheetScale => {
  const panel = { ...panels[0], x: 100, y: 90, width: 400, height: 300,
    corners: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const options = { panel, mode: 'draw' as const, onSelect: jest.fn(), onModeChange: jest.fn(), onMove: jest.fn(),
    onResize: jest.fn(), onDelete: jest.fn(), onDoubleTap: jest.fn(), onToggleFocus: jest.fn(), onImportTracingImage: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { renderer = ReactTestRenderer.create(<Panel {...options} canvasScale={sheetScale} />); });
  const buttons = () => renderer.root.findByProps({ testID: 'panel-left-controls' }).findAllByType(TouchableOpacity);
  const originalSizes = buttons().map(button => StyleSheet.flatten(button.props.style).width);
  const originalGap = StyleSheet.flatten(buttons()[0].props.style).marginRight;
  const focused = { focused: true, displayScale: 3, displayPosition: { x: 500, y: 600 }, canvasScale: sheetScale * 3 };
  try {
    await act(async () => renderer.update(<Panel {...options} {...focused} />));
    const toolbar = renderer.root.findByProps({ testID: 'panel-toolbar' });
    const style = StyleSheet.flatten(toolbar.props.style);
    // Magnified painted top-left is (700, 306); the lower-left is far to its left.
    expect(style.left).toBeCloseTo(700);
    expect(style.top! + style.height! + 10).toBeCloseTo(306);
    expect(toolbar.parent).toBe(renderer.root.findByProps({ testID: 'panel-container' }).parent);
    const extraScale = (style.transform ?? []).reduce((value: number, item: { scale?: number }) => value * (item.scale ?? 1), 1);
    buttons().forEach((button, index) => {
      const size = StyleSheet.flatten(button.props.style).width!;
      expect(Number(size) * sheetScale * extraScale).toBeCloseTo(Number(originalSizes[index]) * sheetScale);
    });
    expect(StyleSheet.flatten(buttons()[0].props.style).marginRight).toBe(originalGap);
    const changed = { ...panel, corners: [{ x: 0.25, y: 0.1 }, { x: 1, y: 0.1 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
    await act(async () => renderer.update(<Panel {...options} {...focused} panel={changed} />));
    const updated = StyleSheet.flatten(renderer.root.findByProps({ testID: 'panel-toolbar' }).props.style);
    expect(updated.left).toBeCloseTo(403);
    expect(updated.top! + updated.height! + 10).toBeCloseTo(394.8);
  } finally { await act(async () => renderer.unmount()); }
});
