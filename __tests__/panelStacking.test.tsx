import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Workspace } from '../src/components/Workspace';
import { Panel } from '../src/components/Panel';
import { PencilKitView } from '../PencilKitView';

jest.mock('lucide-react-native', () => ({ Move: () => null, Pen: () => null, Edit3: () => null, Trash2: () => null }));
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
  for (const mode of ['layout', 'draw', 'edit'] as const) {
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
