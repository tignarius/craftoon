import type { ComicPanel, PanelCorners } from '../src/types/comic';
import { fitPanelBesideNeighbors, worldCorners, panelsCollide, panelRenderedFrame } from '../src/utils/panelGeometry';
import { snapPanelMove, snapPanelResize, snapPanelShape, reshapePanelPoint } from '../src/utils/panelSnap';
import { SNAP_THRESHOLD } from '../src/utils/panelMetrics';

const renderedCorners = (panel: ComicPanel) => worldCorners(panelRenderedFrame(panel));

const bounds = { width: 900, height: 1200 };
const left: ComicPanel = { id: 'left', x: 12, y: 12, width: 300, height: 400,
  corners: [{ x: 0, y: 0 }, { x: 0.6, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
const right: ComicPanel = { id: 'right', ...fitPanelBesideNeighbors({ x: 210, y: 12, width: 440, height: 400 }, [left], bounds) };

const anglePanel: ComicPanel = { id: 'angle', x: 800, y: 100, width: 1000, height: 300 };
const angleBounds = { width: 3000, height: 1600 };
const visibleAngle = (panel: ComicPanel, side: 'left' | 'right') => {
  const points = renderedCorners(panel), top = points[side === 'left' ? 0 : 1], bottom = points[side === 'left' ? 3 : 2];
  return Math.atan2(bottom.x - top.x, bottom.y - top.y) * 180 / Math.PI;
};

test.each((['left', 'right'] as const).flatMap(side => [-60, -45, -30, -15, 0, 15, 30, 45, 60].map(angle => ({ side, angle }))))(
  'the $side corner lightly snaps its visible edge to $angle degrees', ({ side, angle }) => {
    const dx = Math.tan((angle + 1) * Math.PI / 180) * anglePanel.height;
    const result = reshapePanelPoint(anglePanel, side, dx, [], angleBounds);
    expect(visibleAngle({ ...anglePanel, ...result }, side)).toBeCloseTo(angle, 6);
    expect(worldCorners({ ...anglePanel, ...result }).map(p => p.y)).toEqual(worldCorners(anglePanel).map(p => p.y));
  });

test('continued dragging leaves an angle snap instead of staying locked to it', () => {
  const snapped = reshapePanelPoint(anglePanel, 'right', Math.tan(16 * Math.PI / 180) * 300, [], angleBounds);
  expect(visibleAngle({ ...anglePanel, ...snapped }, 'right')).toBeCloseTo(15, 6);
  const released = reshapePanelPoint(anglePanel, 'right', Math.tan(18 * Math.PI / 180) * 300, [], angleBounds);
  expect(visibleAngle({ ...anglePanel, ...released }, 'right')).toBeGreaterThan(17.5);
  expect(visibleAngle({ ...anglePanel, ...released }, 'right')).toBeLessThan(18.5);
});

test('a closer neighboring alignment still takes precedence over a 15-degree hint', () => {
  const dx = Math.tan(16 * Math.PI / 180) * 300;
  const target = anglePanel.x + anglePanel.width + dx;
  const above: ComicPanel = { id: 'above', x: target, y: 12, width: 100, height: 50 };
  const result = reshapePanelPoint(anglePanel, 'right', dx, [above], angleBounds);
  expect(worldCorners({ ...anglePanel, ...result })[2].x).toBeCloseTo(target);
  expect(visibleAngle({ ...anglePanel, ...result }, 'right')).toBeGreaterThan(15.5);
});

test('angle snapping still stops at actual overlap and keeps the polygon valid', () => {
  const neighbor: ComicPanel = { id: 'neighbor', x: 1880, y: 100, width: 200, height: 300 };
  const result = reshapePanelPoint(anglePanel, 'right', 400, [neighbor], angleBounds);
  expect(panelsCollide({ ...anglePanel, ...result }, neighbor, 0)).toBe(false);
  expect(result.corners).toHaveLength(4);
});

test.each(['left', 'right'] as const)('the %s resize guide passes through the rendered circle and aligns with a box above', side => {
  const subject: ComicPanel = { id: 'subject', x: 300, y: 400, width: 300, height: 300,
    corners: side === 'right' ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.65, y: 1 }, { x: 0, y: 1 }]
      : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.35, y: 1 }] };
  const above: ComicPanel = { id: 'above', x: 300, y: 12, width: 300, height: 200 };
  const index = side === 'right' ? 2 : 3;
  const target = renderedCorners(above)[side === 'right' ? 1 : 0].x;
  const guides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];
  const result = snapPanelResize(subject, target - renderedCorners(subject)[index].x + 1, 25, side, [above], bounds, guides);
  const handle = renderedCorners({ ...subject, ...result })[index];
  expect(handle.x).toBeCloseTo(target);
  expect(guides).toContainEqual({ type: 'vertical', pos: target });
  for (const guide of guides) { expect(guide.pos).toBeCloseTo(handle[guide.type === 'vertical' ? 'x' : 'y']); }
});

test('clamped resizing never leaves a guide at a rejected target', () => {
  const subject: ComicPanel = { id: 'subject', x: 100, y: 100, width: 300, height: 400 };
  const outside: ComicPanel = { id: 'outside', x: 860, y: 12, width: 100, height: 40 };
  const guides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];
  const result = snapPanelResize(subject, 560, 0, 'right', [outside], bounds, guides);
  const handle = renderedCorners({ ...subject, ...result })[2];
  expect(subject.x + result.width).toBeLessThanOrEqual(bounds.width - 12);
  for (const guide of guides) { expect(guide.pos).toBeCloseTo(handle[guide.type === 'vertical' ? 'x' : 'y']); }
  expect(guides.some(guide => guide.type === 'vertical')).toBe(false);
});

test.each([4, 16])('moving panels snaps to a %s-point gutter horizontally and vertically', gap => {
  const neighbor: ComicPanel = { id: 'neighbor', x: 100, y: 100, width: 200, height: 200 };
  const subject: ComicPanel = { id: 'subject', x: 400, y: 100, width: 200, height: 200 };
  expect(snapPanelMove(subject, { x: 300 + gap + 1, y: 100 }, [neighbor], bounds).x).toBeCloseTo(300 + gap);
  expect(snapPanelMove({ ...subject, x: 100, y: 400 }, { x: 100, y: 300 + gap + 1 }, [neighbor], bounds).y).toBeCloseTo(300 + gap);
});

test.each([4, 16])('circle resizing and corner reshaping snap to a %s-point gutter', gap => {
  const neighbor: ComicPanel = { id: 'neighbor', x: 340, y: 100, width: 200, height: 400 };
  const subject: ComicPanel = { id: 'subject', x: 100, y: 100, width: 200, height: 400 };
  const dx = 340 - gap - 300 + 1;
  const resized = snapPanelResize(subject, dx, 0, 'right', [neighbor], bounds);
  expect(renderedCorners({ ...subject, ...resized })[2].x).toBeCloseTo(342 - gap);
  const shaped = reshapePanelPoint(subject, 'right', dx, [neighbor], bounds);
  expect(worldCorners({ ...subject, ...shaped })[2].x).toBeCloseTo(340 - gap);
});

test.each([4, 16])('sloping parallel edges snap to a %s-point perpendicular gutter', gap => {
  const offset = (gap - 16) * Math.sqrt(1 + (120 / 400) ** 2);
  const moved = snapPanelMove(right, { x: right.x + offset + 1, y: right.y }, [left], bounds);
  expect(moved.x).toBeCloseTo(right.x + offset);
  expect(panelsCollide({ ...right, ...moved }, left, gap - 0.01)).toBe(false);
});

test.each([-2, 2])('moving an existing trapezoid snaps its real facing edge at the original gutter (%s)', delta => {
  const result = snapPanelMove(right, { x: right.x + delta, y: right.y + 5 }, [left], bounds);
  expect(result.x).toBeCloseTo(right.x);
  expect(result.y).toBeCloseTo(right.y);
  expect(worldCorners({ ...right, ...result })).toEqual(worldCorners(right));
});

test('snap capture is ten percent narrower and does not pull a trapezoid from outside that range', () => {
  expect(SNAP_THRESHOLD).toBeCloseTo(16.2);
  expect(snapPanelMove(right, { x: right.x + 16, y: right.y }, [left], bounds).x).toBeCloseTo(right.x);
  expect(snapPanelMove(right, { x: right.x + 17, y: right.y }, [left], bounds).x).toBeCloseTo(right.x + 17);
});

test.each(['left', 'right'] as const)('resizing the %s handle snaps the actual inset bottom point', side => {
  const panel: ComicPanel = { id: 'resize', x: 100, y: 100, width: 300, height: 400,
    corners: side === 'right' ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.7, y: 1 }, { x: 0, y: 1 }]
      : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.3, y: 1 }] };
  const neighbor: ComicPanel = side === 'right'
    ? { id: 'next', x: 340, y: 100, width: 200, height: 400 }
    : { id: 'next', x: 12, y: 100, width: 160, height: 400 };
  const result = snapPanelResize(panel, side === 'right' ? 10 : -5, 0, side, [neighbor], bounds);
  const point = renderedCorners({ ...panel, ...result })[side === 'left' ? 3 : 2];
  expect(point.x).toBeCloseTo(side === 'right' ? 326 : 186);
  expect(point.y).toBeCloseTo(498);
  if (side === 'left') { expect(result.x! + result.width).toBeCloseTo(400); }
});

test('horizontal shape editing snaps a point to the sloping neighbor without changing its height', () => {
  const result = snapPanelShape(right, 'left', 10, [left], bounds);
  expect(worldCorners({ ...right, corners: result })[3].x).toBeCloseTo(worldCorners(right)[3].x);
  expect(result[3].y).toBe(right.corners![3].y);
  const first = snapPanelShape(left, 'right', -10, [right], bounds);
  expect(worldCorners({ ...left, corners: first })[2].x).toBeCloseTo(worldCorners(left)[2].x);
});

test('a shape handle can snap back to its straight edge but a vertical-only drag creates no change', () => {
  const panel: ComicPanel = { id: 'box', x: 100, y: 100, width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0, y: 1 }] as PanelCorners };
  expect(snapPanelShape(panel, 'right', 50)[2]).toEqual({ x: 1, y: 1 });
  expect(snapPanelShape(panel, 'right', 0)).toBe(panel.corners);
});

test('the close edge snap has a wider range while the outer gutter snap keeps its existing range', () => {
  // Seventeen points inside the existing edge: the old 16.2 range missed this.
  const point = worldCorners(right)[0];
  const edge = worldCorners(left)[1];
  const x = right.x + edge.x - point.x - 18;
  const snapped = snapPanelMove(right, { x, y: right.y }, [left], bounds);
  expect(worldCorners({ ...right, ...snapped })[0].x).toBeCloseTo(edge.x);
  expect(snapPanelMove(right, { x: right.x + 17, y: right.y }, [left], bounds).x).toBeCloseTo(right.x + 17);
});

test.each([
  ['left', -35], ['left', 35], ['right', -35], ['right', 35],
] as const)('the %s circle preserves the sloping edge angle and height while adjusting horizontally by %s', (side, dx) => {
  const panel: ComicPanel = { id: 'fixed-slope', x: 100, y: 100, width: 300, height: 400,
    corners: side === 'right' ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.7, y: 1 }, { x: 0, y: 1 }]
      : [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.3, y: 1 }] };
  const old = renderedCorners(panel);
  const result = snapPanelResize(panel, dx, 0, side, [], bounds);
  const points = renderedCorners({ ...panel, ...result });
  expect(result.height).toBe(panel.height);
  const pair = side === 'left' ? [0, 3] : [1, 2];
  const fixed = side === 'left' ? [1, 2] : [0, 3];
  for (const i of pair) {
    expect(points[i].x).toBeCloseTo(old[i].x + dx);
    expect(points[i].y).toBe(old[i].y);
  }
  for (const i of fixed) { expect(points[i].x).toBeCloseTo(old[i].x); }
  const angle = (p: typeof points) => Math.atan2(p[pair[1]].y - p[pair[0]].y, p[pair[1]].x - p[pair[0]].x);
  expect(angle(points)).toBeCloseTo(angle(old), 10);
});

test('a vertical-only circle drag fixes the top and follows both original side angles', () => {
  const result = snapPanelResize(left, 0, -200, 'right', [], bounds);
  expect(result.height).toBe(left.height - 200);
  const before = renderedCorners(left), after = renderedCorners({ ...left, ...result });
  expect(after[0]).toEqual(before[0]); expect(after[1]).toEqual(before[1]);
  for (const [top, bottom] of [[0, 3], [1, 2]]) {
    expect(after[bottom].y).toBeCloseTo(before[bottom].y - 200);
    expect((after[bottom].x - after[top].x) / (after[bottom].y - after[top].y))
      .toBeCloseTo((before[bottom].x - before[top].x) / (before[bottom].y - before[top].y), 10);
  }
});

test('a shape point keeps its final convex form at the limit instead of resetting to a rectangle', () => {
  const panel: ComicPanel = { id: 'limit', x: 100, y: 100, width: 300, height: 400 };
  const first = reshapePanelPoint(panel, 'right', -200, [], bounds);
  const limit = reshapePanelPoint(panel, 'right', -10000, [], bounds);
  const points = worldCorners({ ...panel, ...limit });
  expect(points[2].x).toBeLessThanOrEqual(worldCorners({ ...panel, ...first })[2].x);
  expect(points[2].x - points[3].x).toBeGreaterThanOrEqual(48 - 0.001);
  expect(limit.corners![2].x).toBeLessThan(0.5);
});

test('a neighboring point can follow an edited edge beyond its original frame, keeping the opposite edge fixed', () => {
  const first: ComicPanel = { id: 'first', x: 100, y: 100, width: 300, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.7, y: 1 }, { x: 0, y: 1 }] };
  const next: ComicPanel = { id: 'next', ...fitPanelBesideNeighbors({ x: 416, y: 100, width: 300, height: 400 }, [first], bounds) };
  const edited: ComicPanel = { ...first, ...reshapePanelPoint(first, 'right', -100, [next], bounds) };
  const old = worldCorners(next);
  const expected = 210 + 16 * Math.sqrt(1 + (190 / 400) ** 2);
  const moved = reshapePanelPoint(next, 'left', expected - old[3].x, [edited], bounds);
  const points = worldCorners({ ...next, ...moved });
  expect(moved.x).toBeLessThan(next.x);
  expect(points[3].x).toBeCloseTo(expected);
  expect(points[1].x).toBeCloseTo(old[1].x);
  expect(points[2].x).toBeCloseTo(old[2].x);
  expect(points.every((p, i) => p.y === old[i].y)).toBe(true);
});

test('circle limits ignore old ink frames and follow each newly edited neighboring polygon', () => {
  const panel: ComicPanel = { id: 'subject', x: 100, y: 100, width: 700, height: 400,
    corners: [{ x: 0, y: 0 }, { x: 300 / 700, y: 0 }, { x: 0.3, y: 1 }, { x: 0, y: 1 }] };
  const neighbor: ComicPanel = { id: 'neighbor', x: 400, y: 100, width: 400, height: 400,
    corners: [{ x: 0.7, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.6, y: 1 }] };
  const old = renderedCorners(panel);
  const permitted = snapPanelResize(panel, 240, 0, 'right', [neighbor], bounds);
  expect(renderedCorners({ ...panel, ...permitted })[2].x).toBeCloseTo(old[2].x + 240);
  expect(panelsCollide(panelRenderedFrame({ ...panel, ...permitted }), panelRenderedFrame(neighbor), 4)).toBe(false);
  const closer: ComicPanel = { ...neighbor, corners: [{ x: 0.45, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.2, y: 1 }] };
  const limited = snapPanelResize(panel, 240, 0, 'right', [closer], bounds);
  const movement = renderedCorners({ ...panel, ...limited })[2].x - old[2].x;
  expect(movement).toBeGreaterThan(150);
  expect(movement).toBeLessThan(180);
  expect(panelsCollide(panelRenderedFrame({ ...panel, ...limited }), panelRenderedFrame(closer), 0)).toBe(false);
  const farther: ComicPanel = { ...neighbor, corners: [{ x: 0.95, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.85, y: 1 }] };
  expect(renderedCorners({ ...panel, ...snapPanelResize(panel, 300, 0, 'right', [farther], bounds) })[2].x).toBeCloseTo(old[2].x + 300);
});

test('a close fixed top corner does not block the bottom arrow from entering the empty space beside a sloping neighbor', () => {
  // Regression geometry from the live canvas: the top corners are close,
  // while the lower point still has substantial free space to its right.
  const panel: ComicPanel = { id: 'first', x: 101.7187681642817, y: 65.15627789427381, width: 565.3594227596514, height: 319.2187333514457,
    corners: [{ x: 0, y: 0 }, { x: 0.6169371394030448, y: 0 }, { x: 0.6170746742227466, y: 1 }, { x: 0, y: 1 }] };
  const neighbor: ComicPanel = { id: 'next', x: 427.5624938881959, y: panel.y, width: 460.4375061118041, height: panel.height,
    corners: [{ x: 0.06719152787156571, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.3953870215741407, y: 1 }] };
  const before = worldCorners(panel);
  const result = reshapePanelPoint(panel, 'right', 100, [neighbor], bounds);
  const points = worldCorners({ ...panel, ...result });
  expect(points[2].x).toBeCloseTo(before[2].x + 100);
  expect(points[1]).toEqual(before[1]);
  expect(points[0]).toEqual(before[0]);
  expect(points[2].y).toBe(before[2].y);
  expect(panelsCollide({ ...panel, ...result }, neighbor, 0)).toBe(false);
  const stopped = reshapePanelPoint(panel, 'right', 1000, [neighbor], bounds);
  expect(worldCorners({ ...panel, ...stopped })[2].x).toBeGreaterThan(points[2].x);
  expect(panelsCollide({ ...panel, ...stopped }, neighbor, 0)).toBe(false);
});

test.each(['left', 'right'] as const)('a standalone %s arrow extends beyond the original frame into free canvas', side => {
  const panel: ComicPanel = { id: 'outward', x: 300, y: 100, width: 200, height: 400 };
  const result = reshapePanelPoint(panel, side, side === 'left' ? -130 : 130, [], bounds);
  const before = worldCorners(panel), after = worldCorners({ ...panel, ...result });
  const index = side === 'left' ? 3 : 2;
  expect(after[index].x).toBeCloseTo(before[index].x + (side === 'left' ? -130 : 130));
  expect(after[index].y).toBe(before[index].y);
  expect(result.width).toBeGreaterThan(panel.width);
});


test.each(['left', 'right'] as const)('the %s circle resizes a sloping panel diagonally', side => {
  const panel: ComicPanel = { ...left, x: 200, y: 100 };
  const before = renderedCorners(panel);
  const result = snapPanelResize(panel, side === 'left' ? -40 : 40, 100, side, [], bounds);
  const after = renderedCorners({ ...panel, ...result });
  expect(result.height).toBe(500);
  expect(after[0].y).toBe(before[0].y);
  expect(after[1].y).toBe(before[1].y);
  expect(after[2].y).toBe(before[2].y + 100);
  expect(after[3].y).toBe(before[3].y + 100);
  const movedTop = side === 'left' ? 0 : 1;
  expect(after[movedTop].x).toBeCloseTo(before[movedTop].x + (side === 'left' ? -40 : 40));
  for (const [top, bottom] of [[0, 3], [1, 2]]) {
    expect((after[bottom].x - after[top].x) / (after[bottom].y - after[top].y))
      .toBeCloseTo((before[bottom].x - before[top].x) / (before[bottom].y - before[top].y), 10);
  }
});

test('vertical sloping resize stops at the canvas edge and at the latest neighboring polygon', () => {
  const limit = snapPanelResize(left, 0, 3000, 'right', [], bounds);
  expect(left.y + limit.height).toBeCloseTo(bounds.height - 12);
  const below: ComicPanel = { id: 'below', x: 12, y: 550, width: 300, height: 200 };
  const stopped = snapPanelResize(left, 0, 300, 'right', [below], bounds);
  expect(left.y + stopped.height).toBeCloseTo(554, 1);
  expect(panelsCollide(panelRenderedFrame({ ...left, ...stopped }), panelRenderedFrame(below), 0)).toBe(false);
  const smaller = snapPanelResize(left, 0, -3000, 'right', [], bounds);
  expect(smaller.height).toBe(80);
});

test('auto-arranged trapezoids with a short top edge remain editable by both gizmos', () => {
  const left: ComicPanel = { id: 'short-left', x: 12, y: 12, width: 800, height: 480,
    corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.05, y: 1 }, { x: 0, y: 1 }] };
  const gap = 16 * Math.hypot(1, 760 / 480);
  const x = 52 + gap, width = 888 - x;
  const right: ComicPanel = { id: 'short-right', x, y: 12, width, height: 480,
    corners: [{ x: 760 / width, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
  const reshaped = reshapePanelPoint(right, 'left', 80, [left], bounds);
  const original = worldCorners(right), changed = worldCorners({ ...right, ...reshaped });
  expect(changed[3].x).toBeGreaterThan(original[3].x + 40);
  expect(changed[0]).toEqual(original[0]);
  expect(panelsCollide({ ...right, ...reshaped }, left, 0)).toBe(false);
  const resized = snapPanelResize(right, -40, 0, 'left', [left], bounds);
  expect(worldCorners({ ...right, ...resized })[3].x).toBeLessThan(original[3].x);
  const vertical = snapPanelResize(right, 0, -60, 'left', [], bounds);
  expect(vertical.height).toBeLessThan(right.height - 40);
});


test('shrinking a narrow-top box follows the neighboring slope and preserves its gutter, then grows back', () => {
  const leftBox: ComicPanel = { id: 'slope-neighbor', x: 12, y: 12, width: 800, height: 480,
    corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.05, y: 1 }, { x: 0, y: 1 }] };
  const gap = 16 * Math.hypot(1, 760 / 480), x = 52 + gap, width = 888 - x;
  const subject: ComicPanel = { id: 'narrow-top', x, y: 12, width, height: 480,
    corners: [{ x: 760 / width, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
  const before = renderedCorners(subject), neighbor = renderedCorners(leftBox);
  const update = snapPanelResize(subject, 0, -120, 'left', [leftBox], bounds);
  const smaller = { ...subject, ...update }, after = renderedCorners(smaller);
  expect(after[0]).toEqual(before[0]); expect(after[1]).toEqual(before[1]);
  expect(update.height).toBe(subject.height - 120);
  expect(after[3].x).toBeGreaterThan(before[3].x + 100);
  expect(after[2].x - after[3].x).toBeLessThan(before[2].x - before[3].x);
  const distance = (p: { x: number; y: number }) => {
    const a = neighbor[1], b = neighbor[2];
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
  };
  expect(distance(after[3])).toBeCloseTo(distance(before[3]), 2);
  expect(panelsCollide(panelRenderedFrame(smaller), panelRenderedFrame(leftBox), 0)).toBe(false);
  const restored = renderedCorners({ ...smaller, ...snapPanelResize(smaller, 0, 120, 'left', [leftBox], bounds) });
  restored.forEach((p, i) => { expect(p.x).toBeCloseTo(before[i].x, 5); expect(p.y).toBeCloseTo(before[i].y, 5); });
  expect(update).toMatchObject({ resizeInk: true, warpInk: true });
});
