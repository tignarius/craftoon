import { createPanelInFreeSpace } from '../src/utils/panelCreation';
import { panelsCollide, worldCorners, panelRenderedFrame } from '../src/utils/panelGeometry';
import { reshapePanelPoint } from '../src/utils/panelSnap';
import { SNAP_THRESHOLD, PANEL_PADDING } from '../src/utils/panelMetrics';
const bounds = { width: 900, height: 1200 };
const panel = { id: 'existing', x: 300, y: 300, width: 200, height: 200 };

test.each([900, 1200])('the first panel snaps near the left and right drawing limits of a %s-wide canvas', width => {
  const result = createPanelInFreeSpace({ x: PANEL_PADDING + 10, y: 80 }, { x: width - PANEL_PADDING - 10, y: 360 }, [], { width, height: 1200 });
  expect(result).toEqual({ x: PANEL_PADDING, y: 80, width: width - PANEL_PADDING * 2, height: 280 });
});

test('first-panel canvas edge magnets release when the pointer leaves their capture range', () => {
  const right = bounds.width - PANEL_PADDING;
  const inside = createPanelInFreeSpace({ x: 22, y: 80 }, { x: right - SNAP_THRESHOLD + 0.1, y: 360 }, [], bounds)!;
  expect(inside.x + inside.width).toBeCloseTo(right);
  const outside = createPanelInFreeSpace({ x: 22, y: 80 }, { x: right - SNAP_THRESHOLD - 0.1, y: 360 }, [], bounds)!;
  expect(outside.x + outside.width).toBeCloseTo(right - SNAP_THRESHOLD - 0.1);
  const free = createPanelInFreeSpace({ x: 60, y: 80 }, { x: 800, y: 360 }, [], bounds);
  expect(free).toEqual({ x: 60, y: 80, width: 740, height: 280 });
});

test.each([0.25, 1, 4, 16])('a new box can begin beside the narrow top of an outward-sloping box (offset %s)', offset => {
  const original = { id: 'sloped', x: 12, y: 12, width: 300, height: 400 };
  const sloped = { ...original, ...reshapePanelPoint(original, 'right', 220, [], bounds) };
  const top = worldCorners(panelRenderedFrame(sloped))[1];
  const result = createPanelInFreeSpace({ x: top.x + offset, y: sloped.y }, { x: 850, y: 412 }, [sloped], bounds);
  expect(result).not.toBeNull();
  expect(result?.corners).toBeDefined();
  expect(panelsCollide(result!, sloped, 3.99)).toBe(false);
});

test.each(['left', 'right'] as const)('the %s side of a bottom-wide box allows a complementary neighbor', side => {
  const original = { id: 'sloped', x: 350, y: 12, width: 200, height: 400 };
  const sloped = { ...original, ...reshapePanelPoint(original, side, side === 'left' ? -140 : 140, [], bounds) };
  const points = worldCorners(panelRenderedFrame(sloped));
  const start = { x: points[side === 'left' ? 0 : 1].x + (side === 'left' ? -0.25 : 0.25), y: sloped.y };
  const result = createPanelInFreeSpace(start, { x: side === 'left' ? 12 : 888, y: 412 }, [sloped], bounds);
  expect(result?.corners).toBeDefined();
  expect(panelsCollide(result!, sloped, 3.99)).toBe(false);
  const quad = worldCorners(result!);
  expect(quad[1].x - quad[0].x).toBeGreaterThan(quad[2].x - quad[3].x);
});

test.each([4, 16])('a lower box keeps growing across both upper boxes at a %s-point gutter', gap => {
  const upper = [
    { id: 'upper-left', x: 12, y: 12, width: 300, height: 400 },
    { id: 'upper-right', x: 312 + gap, y: 12, width: 400, height: 400 },
  ];
  const start = { x: 12, y: 412 + gap };
  for (const endX of [280, 312, 312 + gap, 400, 700, 850]) {
    const result = createPanelInFreeSpace(start, { x: endX, y: 700 }, upper, bounds);
    expect(result).not.toBeNull();
    expect(result!.x + result!.width).toBeCloseTo(endX);
    expect(upper.some(other => panelsCollide(result!, other, 3.99))).toBe(false);
  }
});

test('a box beside a column keeps growing beyond the first stacked box', () => {
  const stacked = [
    { id: 'top', x: 12, y: 12, width: 300, height: 300 },
    { id: 'bottom', x: 12, y: 316, width: 300, height: 400 },
  ];
  const result = createPanelInFreeSpace({ x: 316, y: 12 }, { x: 700, y: 850 }, stacked, bounds);
  expect(result).toEqual({ x: 316, y: 12, width: 384, height: 838 });
});

test.each([
  ['right', { x: 600, y: 350 }, { x: 100, y: 450 }],
  ['left', { x: 200, y: 350 }, { x: 700, y: 450 }],
  ['above', { x: 350, y: 200 }, { x: 450, y: 700 }],
  ['below', { x: 350, y: 600 }, { x: 450, y: 100 }],
] as const)('a drag from %s stops before the existing box instead of crossing it', (side, start, end) => {
  const result = createPanelInFreeSpace(start, end, [panel], bounds);
  expect(result).not.toBeNull();
  expect(panelsCollide(result!, panel, 3.9)).toBe(false);
  const points = worldCorners(result!);
  if (side === 'right') { expect(Math.min(...points.map(p => p.x))).toBeGreaterThanOrEqual(504); }
  if (side === 'left') { expect(Math.max(...points.map(p => p.x))).toBeLessThanOrEqual(296); }
  if (side === 'above') { expect(Math.max(...points.map(p => p.y))).toBeLessThanOrEqual(296); }
  if (side === 'below') { expect(Math.min(...points.map(p => p.y))).toBeGreaterThanOrEqual(504); }
});

test('dragging from the gutter into the occupied side produces no new box', () => {
  expect(createPanelInFreeSpace({ x: 504, y: 350 }, { x: 350, y: 450 }, [panel], bounds)).toBeNull();
  expect(createPanelInFreeSpace({ x: 296, y: 350 }, { x: 450, y: 450 }, [panel], bounds)).toBeNull();
  expect(createPanelInFreeSpace({ x: 350, y: 350 }, { x: 800, y: 800 }, [panel], bounds)).toBeNull();
});

test('free-side restriction preserves the complementary sloped shape', () => {
  const sloped = { ...panel, x: 12, y: 12, width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as import('../src/types/comic').PanelCorners };
  const result = createPanelInFreeSpace({ x: 210, y: 12 }, { x: 650, y: 412 }, [sloped], bounds);
  expect(result?.corners).toBeDefined();
  expect(panelsCollide(result!, sloped, 3.9)).toBe(false);
  const p = worldCorners(result!);
  expect(p[1].x - p[0].x).toBeGreaterThan(p[2].x - p[3].x);
});
