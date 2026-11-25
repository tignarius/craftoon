import { snapPanelAspectResize } from '../src/utils/panelAspectSnap';
import { snapPanelResize } from '../src/utils/panelSnap';
import type { ComicPanel } from '../src/types/comic';

const panel: ComicPanel = { id: 'ink', x: 200, y: 200, width: 304, height: 204 };
const bounds = { width: 1600, height: 1400 };

test.each(['left', 'right'] as const)('the %s handle scales ink uniformly and fixes the opposite top corner', side => {
  const result = snapPanelAspectResize(panel, side === 'left' ? -61 : 61, 39, side, [], bounds);
  expect(result.aspectSnapped).toBe(true);
  const g = result.geometry;
  expect((g.width - 4) / 300).toBeCloseTo((g.height - 4) / 200, 10);
  expect(g.x! + (side === 'left' ? g.width : 0)).toBeCloseTo(panel.x + (side === 'left' ? panel.width : 0));
  expect(g.resizeInk).toBe(true);
  expect(g.warpInk).toBe(false);
});

test('shrinking preserves the inner ratio too', () => {
  const result = snapPanelAspectResize(panel, -89, -61, 'right', [], bounds);
  expect(result.aspectSnapped).toBe(true);
  expect(result.geometry.width).toBeLessThan(panel.width);
  expect((result.geometry.width - 4) / 300).toBeCloseTo((result.geometry.height - 4) / 200, 10);
});

test('a stronger snap captures a position outside the original six-point band', () => {
  expect(snapPanelAspectResize(panel, 60, 50, 'right', [], bounds).aspectSnapped).toBe(true);
});

test('a capture band and wider release band prevent flicker but allow free resizing', () => {
  expect(snapPanelAspectResize(panel, 60, 54, 'right', [], bounds).aspectSnapped).toBe(false);
  expect(snapPanelAspectResize(panel, 60, 54, 'right', [], bounds, 1, true).aspectSnapped).toBe(true);
  const released = snapPanelAspectResize(panel, 60, 64, 'right', [], bounds, 1, true);
  expect(released.aspectSnapped).toBe(false);
  expect(released.geometry).toEqual(snapPanelResize(panel, 60, 64, 'right', [], bounds));
});

test('the capture distance is measured on screen at different zoom levels', () => {
  expect(snapPanelAspectResize(panel, 60, 54, 'right', [], bounds, 0.5).aspectSnapped).toBe(true);
  expect(snapPanelAspectResize(panel, 60, 54, 'right', [], bounds, 2).aspectSnapped).toBe(false);
});

test('minimum size and canvas edges cannot be overridden by the ratio hint', () => {
  expect(snapPanelAspectResize(panel, -240, -160, 'right', [], bounds).aspectSnapped).toBe(false);
  expect(snapPanelAspectResize(panel, 600, 400, 'right', [], { width: 900, height: 800 }).aspectSnapped).toBe(false);
});

test('the hint cannot pull artwork into another panel', () => {
  const neighbor: ComicPanel = { id: 'neighbor', x: 559, y: 200, width: 200, height: 400 };
  expect(snapPanelAspectResize(panel, 60, 40, 'right', [neighbor], bounds).aspectSnapped).toBe(false);
});

test('normalized sloped corners keep their shape during proportional scaling', () => {
  const sloped: ComicPanel = { ...panel, corners: [{ x: 0, y: 0 }, { x: 0.8, y: 0 }, { x: 1, y: 1 }, { x: 0.2, y: 1 }] };
  const result = snapPanelAspectResize(sloped, 60, 40, 'right', [], bounds);
  expect(result.aspectSnapped).toBe(true);
  expect(result.geometry.corners).toEqual(sloped.corners);
  expect((result.geometry.width - 4) / 300).toBeCloseTo((result.geometry.height - 4) / 200);
});

test('each new gesture uses its own start ratio rather than a previous snap', () => {
  const changed = { ...panel, width: 404, height: 104 };
  const result = snapPanelAspectResize(changed, 80, 20, 'right', [], bounds);
  expect(result.aspectSnapped).toBe(true);
  expect((result.geometry.width - 4) / (result.geometry.height - 4)).toBeCloseTo(4);
});


test('locked artwork keeps the existing free resize behavior without ratio hints', () => {
  const locked = { ...panel, artworkLocked: true };
  const result = snapPanelAspectResize(locked, 61, 39, 'right', [], bounds);
  expect(result.aspectSnapped).toBe(false);
  expect(result.geometry).toEqual(snapPanelResize(locked, 61, 39, 'right', [], bounds));
});
