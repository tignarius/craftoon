import type { ComicPanel, PanelCorners, PanelPoint } from '../types/comic';
import { panelCorners, panelVisibleBounds, worldCorners } from './panelGeometry';
import { PANEL_GAP, PANEL_PADDING } from './panelMetrics';
import { lockedArtworkGeometry } from './panelArtworkLock';

type Axis = 'x' | 'y';
type Box = { x: number; y: number; width: number; height: number };
type Node = { panels: ComicPanel[]; box: Box; span: number; minimum: { width: number; height: number };
  split?: { axis: Axis; first: Node; second: Node; fraction: number; slope: number } };
const MIN_SIZE = 40;
const epsilon = 0.001;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const sizeKey = (axis: Axis) => axis === 'x' ? 'width' : 'height';
function extent(panels: ComicPanel[]): Box {
  const boxes = panels.map(panelVisibleBounds);
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

// Area/height of the convex hull is the mean width of a sloping region.
// Bounding-box widths double-count its tilt and cause repeated presses to drift.
function horizontalSpan(panels: ComicPanel[], height: number) {
  const points = panels.flatMap(worldCorners).sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: PanelPoint, b: PanelPoint, c: PanelPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (items: PanelPoint[]) => {
    const hull: PanelPoint[] = [];
    for (const p of items) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) { hull.pop(); }
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  const hull = [...half(points), ...half([...points].reverse())];
  return Math.abs(hull.reduce((area, p, i) => {
    const q = hull[(i + 1) % hull.length]; return area + p.x * q.y - q.x * p.y;
  }, 0)) / 2 / Math.max(1, height);
}

// Prefer real horizontal gutters (comic rows), then vertical gutters. For a
// staggered/non-slicing sketch, choose the least disruptive center partition.
// Every leaf still occupies its own region, so even that fallback cannot overlap.
function partition(panels: ComicPanel[], box: Box) {
  type Cut = { axis: Axis; first: ComicPanel[]; second: ComicPanel[]; score: number };
  const candidates: Cut[] = [];
  for (const axis of ['y', 'x'] as const) {
    const key = sizeKey(axis);
    const sorted = [...panels].sort((a, b) => {
      const one = panelVisibleBounds(a), two = panelVisibleBounds(b);
      return one[axis] - two[axis] || a.id.localeCompare(b.id);
    });
    let end = -Infinity;
    for (let i = 1; i < sorted.length; i++) {
      const previous = panelVisibleBounds(sorted[i - 1]);
      end = Math.max(end, previous[axis] + previous[key]);
      const gap = panelVisibleBounds(sorted[i])[axis] - end;
      if (gap >= -epsilon) {
        candidates.push({ axis, first: sorted.slice(0, i), second: sorted.slice(i), score: gap / box[key] });
      }
    }
    if (candidates.length) {
      return candidates.sort((a, b) => b.score - a.score)[0];
    }
  }
  for (const axis of ['y', 'x'] as const) {
    const key = sizeKey(axis);
    const sorted = [...panels].sort((a, b) => {
      const one = panelVisibleBounds(a), two = panelVisibleBounds(b);
      return one[axis] + one[key] / 2 - two[axis] - two[key] / 2 || a.id.localeCompare(b.id);
    });
    for (let i = 1; i < sorted.length; i++) {
      const first = sorted.slice(0, i), second = sorted.slice(i);
      const a = extent(first), b = extent(second);
      const overlap = Math.max(0, a[axis] + a[key] - b[axis]);
      const separation = b[axis] + b[key] / 2 - a[axis] - a[key] / 2;
      candidates.push({ axis, first, second,
        score: (separation - overlap * 2) / box[key] - Math.abs(i / panels.length - 0.5) * 0.01 });
    }
  }
  return candidates.sort((a, b) => b.score - a.score)[0];
}

function dividerSlope(first: ComicPanel[], second: ComicPanel[]) {
  let best = -Infinity, slope = 0;
  for (const a of first) {
    for (const b of second) {
      const aa = worldCorners(a), bb = worldCorners(b);
      const overlap = Math.min(aa[2].y, bb[3].y) - Math.max(aa[1].y, bb[0].y);
      if (overlap <= 0) { continue; }
      const distance = Math.abs((aa[1].x + aa[2].x - bb[0].x - bb[3].x) / 2);
      const score = overlap / (distance + 1);
      if (score > best) {
        best = score;
        slope = ((aa[2].x - aa[1].x) / Math.max(1, aa[2].y - aa[1].y)
          + (bb[3].x - bb[0].x) / Math.max(1, bb[3].y - bb[0].y)) / 2;
      }
    }
  }
  return slope;
}

function tree(panels: ComicPanel[]): Node {
  const box = extent(panels), span = horizontalSpan(panels, box.height);
  if (panels.length === 1) { return { panels, box, span, minimum: { width: MIN_SIZE, height: MIN_SIZE } }; }
  const cut = partition(panels, box);
  const first = tree(cut.first), second = tree(cut.second), key = sizeKey(cut.axis);
  return { panels, box, span, minimum: cut.axis === 'x'
    ? { width: first.minimum.width + second.minimum.width + PANEL_GAP, height: Math.max(first.minimum.height, second.minimum.height) }
    : { width: Math.max(first.minimum.width, second.minimum.width), height: first.minimum.height + second.minimum.height + PANEL_GAP },
  split: { axis: cut.axis, first, second,
    fraction: cut.axis === 'x' ? first.span / (first.span + second.span) : first.box[key] / (first.box[key] + second.box[key]),
    slope: cut.axis === 'x' ? dividerSlope(cut.first, cut.second) : 0 } };
}

// Recover an existing full-height quadrilateral from its top/bottom vertices.
// Its bounding rectangle alone loses the diagonal and shifts dividers on every
// re-pack. Keep already parallel, template-spaced dividers in page coordinates.
function existingRegion(node: Node, top: number, bottom: number): PanelCorners | undefined {
  const points = node.panels.flatMap(worldCorners);
  const upper = points.filter(p => Math.abs(p.y - top) < epsilon), lower = points.filter(p => Math.abs(p.y - bottom) < epsilon);
  if (upper.length < 2 || lower.length < 2) { return; }
  return [{ x: Math.min(...upper.map(p => p.x)), y: top }, { x: Math.max(...upper.map(p => p.x)), y: top },
    { x: Math.max(...lower.map(p => p.x)), y: bottom }, { x: Math.min(...lower.map(p => p.x)), y: bottom }];
}
const nearPoint = (a: PanelPoint, b: PanelPoint) => Math.hypot(a.x - b.x, a.y - b.y) < epsilon;
function existingVerticalSplit(first: Node, second: Node, region: PanelCorners): [PanelCorners, PanelCorners] | undefined {
  const a = existingRegion(first, region[0].y, region[3].y), b = existingRegion(second, region[0].y, region[3].y);
  if (!a || !b || !nearPoint(a[0], region[0]) || !nearPoint(a[3], region[3])
    || !nearPoint(b[1], region[1]) || !nearPoint(b[2], region[2])) { return; }
  const gapTop = b[0].x - a[1].x, gapBottom = b[3].x - a[2].x;
  const dx = a[2].x - a[1].x, dy = a[2].y - a[1].y;
  const distance = gapTop * dy / Math.hypot(dx, dy);
  if (Math.abs(gapTop - gapBottom) < epsilon && Math.abs(distance - PANEL_GAP) < epsilon) { return [a, b]; }
}

const mix = (a: PanelPoint, b: PanelPoint, t: number): PanelPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
function place(node: Node, region: PanelCorners, result: Map<string, PanelCorners>): boolean {
  const [tl, tr, br, bl] = region, height = bl.y - tl.y;
  const width = Math.min(tr.x - tl.x, br.x - bl.x);
  if (width + epsilon < node.minimum.width || height + epsilon < node.minimum.height) { return false; }
  if (!node.split) { result.set(node.panels[0].id, region); return true; }
  const { axis, first, second, fraction, slope } = node.split;
  if (axis === 'y') {
    // Keep the next row's top as the anchor. Absorb a changed middle panel by
    // extending the preceding bottom edge, rather than redistributing every
    // row's height and pulling already aligned panels away from their position.
    const firstHeight = clamp(second.box.y - tl.y - PANEL_GAP,
      first.minimum.height, height - PANEL_GAP - second.minimum.height);
    const a = mix(tl, bl, firstHeight / height), b = mix(tr, br, firstHeight / height);
    const c = mix(tl, bl, (firstHeight + PANEL_GAP) / height), d = mix(tr, br, (firstHeight + PANEL_GAP) / height);
    return place(first, [tl, tr, b, a], result) && place(second, [c, d, br, bl], result);
  }
  // Keep a sketched diagonal divider where space permits. Parallel edges have
  // a true 16-point perpendicular gutter; the outside of the page stays square.
  const existing = existingVerticalSplit(first, second, region);
  if (existing) {
    const trial = new Map<string, PanelCorners>();
    if (place(first, existing[0], trial) && place(second, existing[1], trial)) {
      trial.forEach((value, id) => result.set(id, value));
      return true;
    }
  }
  const topWidth = tr.x - tl.x, bottomWidth = br.x - bl.x;
  const tilt = slope * node.box.height * ((topWidth + bottomWidth) / 2 / node.span);
  const make = (amount: number): [PanelCorners, PanelCorners] => {
    const shift = tilt * amount / 2;
    const topCenter = tl.x + topWidth * fraction - shift;
    const bottomCenter = bl.x + bottomWidth * fraction + shift;
    const horizontalGap = PANEL_GAP * Math.hypot(1, (bottomCenter - topCenter) / height);
    const availableTop = topWidth - horizontalGap, availableBottom = bottomWidth - horizontalGap;
    const top = tl.x + clamp(availableTop * fraction - shift, first.minimum.width, availableTop - second.minimum.width);
    const bottom = bl.x + clamp(availableBottom * fraction + shift, first.minimum.width, availableBottom - second.minimum.width);
    // Derive the final offset from the actual clamped line, not the requested tilt.
    const gap = PANEL_GAP * Math.hypot(1, (bottom - top) / height);
    return [[tl, { x: top, y: tl.y }, { x: bottom, y: bl.y }, bl],
      [{ x: top + gap, y: tr.y }, tr, br, { x: bottom + gap, y: br.y }]];
  };
  for (const amount of [1, 0.5, 0]) {
    const [a, b] = make(amount);
    const trial = new Map<string, PanelCorners>();
    if (place(first, a, trial) && place(second, b, trial)) {
      trial.forEach((value, id) => result.set(id, value));
      return true;
    }
  }
  return false;
}

export type ArrangedPanelFrame = Pick<ComicPanel, 'id' | 'x' | 'y' | 'width' | 'height' | 'corners'>;
export const arrangedPanelFrames = (panels: ComicPanel[]): ArrangedPanelFrame[] => panels.map(({ id, x, y, width, height, corners }) =>
  ({ id, x, y, width, height, ...(corners ? { corners: corners.map(p => ({ ...p })) as PanelCorners } : {}) }));

function sameFrame(a: ArrangedPanelFrame, b: ArrangedPanelFrame) {
  const one = worldCorners(a), two = worldCorners(b);
  return one.every((p, i) => Math.abs(p.x - two[i].x) < epsilon && Math.abs(p.y - two[i].y) < epsilon);
}

/** Fill a rough page initially; later repair edited panels in their last arranged
 * regions while keeping unchanged siblings (including their ink frames) intact. */
export function autoArrangePanels(panels: ComicPanel[], bounds: { width: number; height: number }, baseline?: ArrangedPanelFrame[]): ComicPanel[] | null {
  if (!panels.length) { return panels; }
  if (![bounds.width, bounds.height].every(n => Number.isFinite(n) && n > PANEL_PADDING * 2)
    || panels.some(p => ![p.x, p.y, p.width, p.height].every(Number.isFinite) || p.width <= 4 || p.height <= 4)) { return null; }
  const previous = new Map(baseline?.map(panel => [panel.id, panel]));
  if (previous.size === panels.length && panels.every(panel => previous.has(panel.id))
    && panels.some(panel => sameFrame(panel, previous.get(panel.id)!))) {
    return applyTargets(panels, new Map(panels.map(panel => [panel.id, worldCorners(previous.get(panel.id)!)])));
  }
  const layout = tree(panels), box = layout.box;
  const top = clamp(box.y, PANEL_PADDING, bounds.height - PANEL_PADDING);
  const bottom = clamp(box.y + box.height, PANEL_PADDING, bounds.height - PANEL_PADDING);
  const targets = new Map<string, PanelCorners>();
  if (!place(layout, [{ x: PANEL_PADDING, y: top }, { x: bounds.width - PANEL_PADDING, y: top },
    { x: bounds.width - PANEL_PADDING, y: bottom }, { x: PANEL_PADDING, y: bottom }], targets)) { return null; }
  return applyTargets(panels, targets);
}

function applyTargets(panels: ComicPanel[], targets: Map<string, PanelCorners>): ComicPanel[] {
  let changed = false;
  const arranged = panels.map(panel => {
    const world = targets.get(panel.id)!;
    const x = Math.min(...world.map(p => p.x)), y = world[0].y;
    const width = Math.max(...world.map(p => p.x)) - x, height = world[3].y - y;
    if (world.every((point, i) => { const old = worldCorners(panel)[i]; return Math.abs(point.x - old.x) < epsilon && Math.abs(point.y - old.y) < epsilon; })) { return panel; }
    changed = true;
    const corners = world.map(p => ({ x: (p.x - x) / width, y: (p.y - y) / height })) as PanelCorners;
    const sx = Math.max(1, width - 4) / Math.max(1, panel.width - 4), sy = Math.max(1, height - 4) / Math.max(1, panel.height - 4);
    const updates: Partial<ComicPanel> = { x, y, width, height,
      corners: panel.corners || corners.some((p, i) => Math.abs(p.x - panelCorners({})[i].x) > epsilon) ? corners : undefined,
      shapeRevision: (panel.shapeRevision ?? 0) + 1, resizeInk: true, warpInk: true,
      ...(panel.tracingImage ? { tracingImage: { ...panel.tracingImage, x: panel.tracingImage.x * sx,
        y: panel.tracingImage.y * sy, width: panel.tracingImage.width * sx, height: panel.tracingImage.height * sy } } : {}) };
    return { ...panel, ...lockedArtworkGeometry(panel, updates) };
  });
  return changed ? arranged : panels;
}
