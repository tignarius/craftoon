import { fitPanelBesideNeighbors, movePanelCorner, panelCorners, panelFocusTransform, panelControlLayout, panelHandleSide, neighboringHandleSide, movePanelHandle, resizePanelFromLeft, panelsCollide, RECT_CORNERS, worldCorners } from '../src/utils/panelGeometry';
import type { ComicPanel, PanelCorners } from '../src/types/comic';
const panel: ComicPanel = { id: 'a', x: 12, y: 12, width: 300, height: 400 };
const bounds = { width: 900, height: 1200 };

test('corner edits stay convex and bounded without changing the drawing frame', () => {
  const corners = movePanelCorner(panel, 0, 90, 60);
  expect(corners[0]).toEqual({ x: 0.3, y: 0.15 });
  const edited = { ...panel, corners };
  const limited = movePanelCorner(edited, 0, 10000, 10000);
  expect(limited).not.toEqual(RECT_CORNERS);
  expect(limited[0].x).toBeGreaterThan(corners[0].x);
  expect(panelCorners({ corners: limited })).toBe(limited);
  expect(movePanelCorner(panel, 2, 10000, 10000)).toEqual(RECT_CORNERS);
  expect(panel).toEqual({ id: 'a', x: 12, y: 12, width: 300, height: 400 });
  expect(panelCorners({ corners: [{ x: NaN, y: 0 }, ...RECT_CORNERS.slice(1)] as PanelCorners })).toBe(RECT_CORNERS);
});

test.each(['right', 'left', 'below', 'above'] as const)('a new panel %s follows a slanted edge at a perpendicular 16pt gap', side => {
  const neighbor: ComicPanel = { ...panel, x: 300, y: 300, width: 200, height: 200,
    corners: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.2 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.8 }] };
  const rect = { x: side === 'right' ? 516 : side === 'left' ? 84 : 300,
    y: side === 'below' ? 516 : side === 'above' ? 84 : 300, width: 200, height: 200 };
  const result = fitPanelBesideNeighbors(rect, [neighbor], bounds);
  expect(result.corners).toBeDefined();
  const quad = worldCorners(result), other = worldCorners(neighbor);
  const edge = { right: 3, left: 1, below: 0, above: 2 }[side];
  const source = { right: 1, left: 3, below: 2, above: 0 }[side];
  const a = other[source], b = other[(source + 1) % 4];
  for (const p of [quad[edge], quad[(edge + 1) % 4]]) {
    const distance = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);
    expect(distance).toBeCloseTo(16);
    expect(p.x).toBeGreaterThanOrEqual(12);
    expect(p.y).toBeGreaterThanOrEqual(12);
  }
  // The opposite side and the two perpendicular page-facing sides stay square.
  const opposite = (edge + 2) % 4;
  if (side === 'right' || side === 'left') {
    expect(quad[opposite].x).toBeCloseTo(quad[(opposite + 1) % 4].x);
    expect(quad[0].y).toBeCloseTo(quad[1].y);
    expect(quad[2].y).toBeCloseTo(quad[3].y);
  } else {
    expect(quad[opposite].y).toBeCloseTo(quad[(opposite + 1) % 4].y);
    expect(quad[0].x).toBeCloseTo(quad[3].x);
    expect(quad[1].x).toBeCloseTo(quad[2].x);
  }
  expect(panelsCollide(result, neighbor, 15.9)).toBe(false);
});

test('neighbor fitting ignores distant panels and rejects a slant that would leave the canvas', () => {
  expect(fitPanelBesideNeighbors({ x: 500, y: 500, width: 200, height: 200 }, [panel], bounds)).toEqual({ x: 500, y: 500, width: 200, height: 200 });
  const neighbor = { ...panel, corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.1, y: 1 }, { x: 0, y: 1 }] as PanelCorners };
  const rect = { x: 328, y: 12, width: 100, height: 1100 };
  expect(fitPanelBesideNeighbors(rect, [neighbor], bounds)).toEqual(rect);
});

test('polygon collision uses actual slanted edges, including a minimum gutter', () => {
  expect(panelsCollide(panel, { ...panel, x: 320 })).toBe(false);
  expect(panelsCollide(panel, { ...panel, x: 315 })).toBe(true);
  expect(panelsCollide(panel, { ...panel, x: 200 })).toBe(true);
});

test.each([{ width: 1024, height: 768 }, { width: 768, height: 1024 }])('focus fits the panel and centers it in either orientation: %j', viewport => {
  const focus = panelFocusTransform(panel, viewport, bounds);
  expect((panel.x + panel.width / 2) * focus.scale + focus.x).toBeCloseTo(bounds.width * focus.scale / 2);
  expect((panel.y + panel.height / 2) * focus.scale + focus.y).toBeCloseTo(bounds.height * focus.scale / 2);
  expect((panel.width + 24) * focus.scale).toBeLessThanOrEqual(viewport.width - 56 + 0.01);
  expect((panel.height + 24) * focus.scale).toBeLessThanOrEqual(viewport.height - 8 + 0.01);
});


test('panel controls stay below a clipped corner and compact buttons do not overlap', () => {
  const layout = panelControlLayout({ width: 300, height: 400, corners: [{ x: 0, y: 0.4 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] });
  expect(layout.top).toBeGreaterThan(6);
  expect(layout.left).toBeGreaterThanOrEqual(6);
  expect(layout.buttonSize * 3 + 12).toBeLessThanOrEqual(296 - layout.left - layout.right + 0.01);
  const compact = panelControlLayout({ width: 80, height: 80 });
  expect(compact.buttonSize).toBeLessThan(35);
  expect(compact.buttonSize * 3 + 12).toBeLessThanOrEqual(64);
});

test.each([
  [0.6, 1, true],
  [1, 0.6, false],
])('a neighboring trapezoid complements the visible edge even inside its bounding frame (%s, %s)', (top, bottom, bottomLonger) => {
  const left: ComicPanel = { ...panel, corners: [{ x: 0, y: 0 }, { x: top, y: 0 }, { x: bottom, y: 1 }, { x: 0, y: 1 }] };
  // Start next to the narrow end, far from the rectangular frame's right edge.
  const right = fitPanelBesideNeighbors({ x: 210, y: 12, width: 440, height: 400 }, [left], bounds);
  expect(right.corners).toBeDefined();
  const quad = worldCorners(right), neighbor = worldCorners(left);
  const topWidth = quad[1].x - quad[0].x, bottomWidth = quad[2].x - quad[3].x;
  expect(bottomLonger ? topWidth > bottomWidth : topWidth < bottomWidth).toBe(true);
  expect(quad[1].x).toBeCloseTo(quad[2].x);
  expect(quad[0].y).toBeCloseTo(neighbor[1].y);
  expect(quad[3].y).toBeCloseTo(neighbor[2].y);
  expect(panelsCollide(right, left, 15.9)).toBe(false);
});


test('adjacent panels use facing lower handles and a saved side survives a missing neighbor', () => {
  const left = { ...panel, id: 'left' }, right = { ...panel, id: 'right', x: 328 };
  expect(panelHandleSide(left, [right])).toBe('right');
  expect(panelHandleSide(right, [left])).toBe('left');
  expect(neighboringHandleSide(right, [left])).toBe('left');
  expect(panelHandleSide({ ...right, adjustmentSide: 'left' }, [])).toBe('left');
  expect(neighboringHandleSide(left, [{ ...right, y: 600 }])).toBeUndefined();
});

test('shape handles move only horizontally on the selected side', () => {
  const right = movePanelHandle(panel, 'right', -60);
  expect(right).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0, y: 1 }]);
  const left = movePanelHandle(panel, 'left', 60);
  expect(left).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.2, y: 1 }]);
  expect(movePanelHandle(panel, 'left', 0)).toBe(RECT_CORNERS);
});

test('the left resize handle preserves the right edge while resizing width and height within the paper', () => {
  const right = { ...panel, x: 328, width: 300 };
  expect(resizePanelFromLeft(right, -50, 100, bounds)).toEqual({ x: 278, width: 350, height: 500 });
  expect(resizePanelFromLeft(right, -10000, 10000, bounds)).toEqual({ x: 12, width: 616, height: 1176 });
  expect(resizePanelFromLeft(right, 10000, -10000, bounds)).toEqual({ x: 548, width: 80, height: 80 });
});

test('zoom uses the latest visible polygon rather than an older expanded drawing frame', () => {
  const original: ComicPanel = { id: 'zoom', x: 100, y: 100, width: 600, height: 600 };
  const viewport = { width: 1024, height: 768 };
  const before = panelFocusTransform(original, viewport, bounds);
  const reduced: ComicPanel = { ...original, corners: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.45 }, { x: 0.1, y: 0.45 }] };
  const after = panelFocusTransform(reduced, viewport, bounds);
  expect(after.scale).toBeGreaterThan(before.scale);
  expect(after.centerX).toBeCloseTo(250);
  expect(after.centerY).toBeCloseTo(265);
  expect(210 * after.scale).toBeLessThanOrEqual(760);
  expect(180 * after.scale).toBeLessThanOrEqual(968);
});

test('fractional-frame rounding does not turn a trapezoid back into its original rectangle', () => {
  const corners = [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 0.8, y: 1.0000000000000002 }, { x: 0, y: 1.0000000000000002 }] as PanelCorners;
  const normalized = panelCorners({ corners });
  expect(normalized).not.toEqual(RECT_CORNERS);
  expect(normalized[2]).toEqual({ x: 0.8, y: 1 });
});
