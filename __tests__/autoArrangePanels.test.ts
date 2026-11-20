import { autoArrangePanels } from '../src/utils/autoArrangePanels';
import { createPanelGrid } from '../src/utils/panelGrid';
import { panelsCollide, worldCorners } from '../src/utils/panelGeometry';
import { ComicPanel } from '../src/types/comic';
const box = (id: string, x: number, y: number, width: number, height: number): ComicPanel => ({ id, x, y, width, height, layoutSource: 'manual' });
const bounds = { width: 900, height: 1200 };
const get = (panels: ComicPanel[], id: string) => panels.find(p => p.id === id)!;
function safe(panels: ComicPanel[]) {
  panels.forEach((p, i) => {
    worldCorners(p).forEach(point => { expect(point.x).toBeGreaterThanOrEqual(11.999); expect(point.x).toBeLessThanOrEqual(888.001); });
    panels.slice(i + 1).forEach(q => expect(panelsCollide(p, q, 15.99)).toBe(false));
  });
}

test('fills rough rows across the page using template gutters and preserves empty top and bottom', () => {
  const panels = [box('a', 80, 100, 300, 180), box('b', 450, 108, 280, 165), box('c', 55, 350, 720, 250)];
  const result = autoArrangePanels(panels, bounds)!;
  const [a, b, c] = result;
  expect(a.x).toBe(12); expect(b.x + b.width).toBeCloseTo(888);
  expect(b.x - a.x - a.width).toBeCloseTo(16);
  expect(a.y).toBe(100); expect(b.y).toBe(100); expect(a.height).toBe(b.height);
  expect(c.y - a.y - a.height).toBeCloseTo(16);
  expect(c.y + c.height).toBe(600); expect(c.x).toBe(12); expect(c.width).toBe(876);
  expect(result.map(p => p.id)).toEqual(panels.map(p => p.id));
  safe(result); expect(autoArrangePanels(result, bounds)).toBe(result);
});

test('uses the full height when the rough layout reaches both canvas edges', () => {
  const result = autoArrangePanels([box('a', 80, 12, 300, 528), box('b', 460, 650, 300, 538)], bounds)!;
  expect(result[0].y).toBe(12); expect(result[1].y + result[1].height).toBeCloseTo(1188);
  expect(result[1].y - result[0].y - result[0].height).toBeCloseTo(16); safe(result);
});

test('a tall panel beside two shorter panels keeps that topology and relative widths', () => {
  const panels = [box('tall', 40, 120, 250, 700), box('top', 340, 140, 450, 300), box('bottom', 350, 510, 440, 310)];
  const result = autoArrangePanels(panels, bounds)!;
  const a = get(result, 'tall'), b = get(result, 'top'), c = get(result, 'bottom');
  expect(a.y).toBe(120); expect(a.height).toBe(700);
  expect(b.x).toBe(c.x); expect(b.width).toBeCloseTo(c.width); expect(b.width).toBeGreaterThan(a.width);
  expect(c.y + c.height).toBeCloseTo(a.y + a.height); safe(result);
});

test.each([['portrait', bounds], ['landscape', { width: 1200, height: 900 }]] as const)('an existing %s template is a no-op', (_, size) => {
  const panels = createPanelGrid(3, 2, size, 'grid');
  expect(autoArrangePanels(panels, size)).toBe(panels);
});

test('keeps diagonal dividers parallel with a template-sized gutter', () => {
  const a = { ...box('a', 40, 100, 350, 500), corners: [{ x: 0, y: 0 }, { x: 0.7, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] as ComicPanel['corners'] };
  const b = { ...box('b', 310, 100, 470, 500), corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.24, y: 1 }] as ComicPanel['corners'] };
  const result = autoArrangePanels([a, b], bounds)!;
  const one = worldCorners(result[0]), two = worldCorners(result[1]);
  expect(one[1].x).toBeLessThan(one[2].x);
  expect(two[0].x - one[1].x).toBeCloseTo(two[3].x - one[2].x);
  safe(result);
  expect(autoArrangePanels(result, bounds)).toBe(result);
});

test('preserves ink references and scales reference images without mutating originals', () => {
  const panels = [{ ...box('a', 100, 150, 200, 300), drawingData: 'craftoon-ink:original', drawingHasStrokes: true,
    tracingImage: { uri: 'file:///photo.jpg', x: 10, y: 20, width: 100, height: 140, rotation: 30, opacity: 0.35 } }];
  const result = autoArrangePanels(panels, bounds)!;
  expect(result[0]).toMatchObject({ drawingData: 'craftoon-ink:original', drawingHasStrokes: true, resizeInk: true, warpInk: true, shapeRevision: 1 });
  expect(result[0].tracingImage).toMatchObject({ uri: 'file:///photo.jpg', rotation: 30, opacity: 0.35 });
  expect(result[0].tracingImage!.width).toBeCloseTo(100 * 872 / 196);
  expect(panels[0].width).toBe(200); expect(panels[0].tracingImage.width).toBe(100);
});

test('packs staggered sketches without overlap and refuses impossible space without altering panels', () => {
  const panels = [box('a', 40, 100, 400, 240), box('b', 460, 220, 300, 300), box('c', 60, 400, 330, 200)];
  safe(autoArrangePanels(panels, bounds)!);
  const tiny = [box('a', 20, 100, 100, 20), box('b', 150, 100, 100, 20)];
  expect(autoArrangePanels(tiny, bounds)).toBeNull(); expect(tiny[0].height).toBe(20);
  expect(autoArrangePanels([], bounds)).toEqual([]);
});


test('a non-slicing pinwheel sketch still yields separate, stable panel regions', () => {
  const panels = [box('top', 40, 100, 560, 170), box('right', 620, 100, 180, 560),
    box('bottom', 240, 680, 560, 180), box('left', 40, 290, 180, 570), box('center', 240, 290, 360, 370)];
  const result = autoArrangePanels(panels, bounds)!;
  expect(result).not.toBeNull(); expect(result).toHaveLength(5); safe(result);
  expect(autoArrangePanels(result, bounds)).toBe(result);
});


test('even a small intentional vertical blank margin is retained', () => {
  const result = autoArrangePanels([box('a', 60, 20, 300, 1160)], bounds)!;
  expect(result[0]).toMatchObject({ x: 12, y: 20, width: 876, height: 1160 });
});


test('shortening a middle panel extends its bottom without moving already aligned outer rows', () => {
  const top = box('top', 12, 12, 876, 300);
  const middle = box('middle', 12, 328, 876, 150);
  const bottom = box('bottom', 12, 744, 876, 444);
  const result = autoArrangePanels([top, middle, bottom], bounds)!;
  expect(result[0]).toBe(top);
  expect(result[1]).toMatchObject({ y: 328, height: 400 });
  expect(result[2]).toBe(bottom);
  safe(result); expect(autoArrangePanels(result, bounds)).toBe(result);
});

test('moving a middle row keeps each row top anchored and adjusts only the needed bottom edges', () => {
  const panels = [box('top', 12, 12, 876, 300), box('middle', 12, 388, 876, 160), box('bottom', 12, 744, 876, 444)];
  const result = autoArrangePanels(panels, bounds)!;
  expect(result.map(p => p.y)).toEqual([12, 388, 744]);
  expect(result[0].height).toBe(360); expect(result[1].height).toBe(340);
  expect(result[2]).toBe(panels[2]); safe(result);
});

test('editing the middle of one column does not pull down the top panels in either column', () => {
  const grid = createPanelGrid(2, 3, bounds, 'grid');
  const edited = grid.map((p, i) => i === 3 ? { ...p, height: p.height / 2 } : p);
  const result = autoArrangePanels(edited, bounds)!;
  result.forEach((p, i) => {
    expect(p.y).toBeCloseTo(grid[i].y);
    expect(p.height).toBeCloseTo(grid[i].height);
    expect(p.x).toBeCloseTo(grid[i].x);
  });
  expect(result[0]).toBe(edited[0]); expect(result[1]).toBe(edited[1]);
  expect(result[4]).toBe(edited[4]); expect(result[5]).toBe(edited[5]); safe(result);
});

test('repairing one moved panel leaves all aligned siblings at their exact frames', () => {
  const baseline = createPanelGrid(2, 3, bounds, 'stable');
  const edited = baseline.map((p, i) => i === 3 ? { ...p, x: p.x - 24, y: p.y + 24 } : p);
  const result = autoArrangePanels(edited, bounds, baseline)!;
  result.forEach((p, i) => {
    if (i !== 3) { expect(p).toBe(edited[i]); }
    expect(p.x).toBeCloseTo(baseline[i].x);
    expect(p.y).toBeCloseTo(baseline[i].y);
    expect(p.width).toBeCloseTo(baseline[i].width);
    expect(p.height).toBeCloseTo(baseline[i].height);
  });
  expect(autoArrangePanels(result, bounds, baseline)).toBe(result);
});

test('adding a panel or sketching a whole new arrangement uses the new layout rather than an obsolete baseline', () => {
  const baseline = createPanelGrid(2, 2, bounds, 'stable');
  const moved = baseline.map(p => ({ ...p, y: p.y + 15 }));
  expect(autoArrangePanels(moved, bounds, baseline)![0].y).toBe(27);
  const extra = [...baseline.slice(0, 2), box('new', 30, 800, 600, 200)];
  expect(autoArrangePanels(extra, bounds, baseline)!.map(p => p.id)).toEqual(extra.map(p => p.id));
});

test('three already fitted slanted columns keep their exact dividers without an in-memory baseline', () => {
  const y = 800, height = 388;
  const firstGap = 16 * Math.hypot(1, 60 / height), secondGap = 16 * Math.hypot(1, 50 / height);
  const quad = (id: string, topLeft: number, topRight: number, bottomRight: number, bottomLeft: number): ComicPanel => {
    const x = Math.min(topLeft, bottomLeft), width = Math.max(topRight, bottomRight) - x;
    return { id, x, y, width, height, corners: [{ x: (topLeft - x) / width, y: 0 }, { x: (topRight - x) / width, y: 0 },
      { x: (bottomRight - x) / width, y: 1 }, { x: (bottomLeft - x) / width, y: 1 }] };
  };
  const panels = [quad('left', 12, 310, 250, 12), quad('middle', 310 + firstGap, 550, 600, 250 + firstGap),
    quad('right', 550 + secondGap, 888, 888, 600 + secondGap)];
  safe(panels);
  for (let i = 0; i < 5; i++) { expect(autoArrangePanels(panels, bounds)).toBe(panels); }
});
