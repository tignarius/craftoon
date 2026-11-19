import type { ComicPanel, PanelPoint, PanelCorners } from '../types/comic';
import { movePanelHandle, panelCorners, worldCorners, panelsCollide, panelVisibleBounds, panelRenderedFrame } from './panelGeometry';
import { PANEL_SNAP_GAPS, PANEL_PADDING, SNAP_THRESHOLD, CLOSE_SNAP_THRESHOLD } from './panelMetrics';

type Bounds = { width: number; height: number };
type Side = 'left' | 'right';
type PanelResizeResult = { x?: number; width: number; height: number; corners?: PanelCorners; shapeRevision?: number; resizeInk?: boolean; warpInk?: boolean; tracingImage?: ComicPanel['tracingImage'] };
export type PanelSnapGuide = { type: 'vertical' | 'horizontal'; pos: number };
type Guide = PanelSnapGuide;
type Target = { value: number; guide?: Guide; priority?: number; range?: number };

function closest(value: number, targets: Target[]) {
  // A nearby gutter is a magnetic hint, not a lock that outranks a closer
  // alignment with a different panel.
  return targets.filter(t => Math.abs(t.value - value) < (t.range ?? SNAP_THRESHOLD))
    .sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value) || (b.priority ?? 0) - (a.priority ?? 0))[0];
}

// The outward parallel of an actual polygon edge, not its enclosing rectangle.
function edgeAt(panel: ComicPanel, edge: number, axis: 'x' | 'y', at: number, gap: number) {
  const points = worldCorners(panel), a = points[edge], b = points[(edge + 1) % 4];
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  const ox = dy / length * gap, oy = -dx / length * gap;
  if (axis === 'x') {
    if (Math.abs(dy) < 0.001 || at < Math.min(a.y, b.y) - SNAP_THRESHOLD || at > Math.max(a.y, b.y) + SNAP_THRESHOLD) { return null; }
    return a.x + ox + (at - a.y - oy) / dy * dx;
  }
  if (Math.abs(dx) < 0.001 || at < Math.min(a.x, b.x) - SNAP_THRESHOLD || at > Math.max(a.x, b.x) + SNAP_THRESHOLD) { return null; }
  return a.y + oy + (at - a.x - ox) / dx * dy;
}

function pointTargets(point: PanelPoint, axis: 'x' | 'y', others: ComicPanel[], side: Side, bounds?: Bounds): Target[] {
  const result: Target[] = [];
  if (bounds) { result.push({ value: PANEL_PADDING }, { value: bounds[axis === 'x' ? 'width' : 'height'] - PANEL_PADDING }); }
  for (const other of others) {
    const points = worldCorners(other);
    for (const p of points) { result.push({ value: p[axis], range: CLOSE_SNAP_THRESHOLD }); }
    const edges = axis === 'x' ? [side === 'left' ? 1 : 3] : [0, 2];
    for (const edge of edges) {
      for (const gap of PANEL_SNAP_GAPS) {
        const value = edgeAt(other, edge, axis, point[axis === 'x' ? 'y' : 'x'], gap);
        if (value !== null) { result.push({ value, priority: 1 }); }
      }
    }
  }
  return result;
}

function translationTargets(panel: ComicPanel, others: ComicPanel[], bounds: Bounds | undefined, axis: 'x' | 'y'): Target[] {
  const points = worldCorners(panel), result: Target[] = [];
  const values = points.map(p => p[axis]);
  if (bounds) {
    result.push({ value: PANEL_PADDING - Math.min(...values), guide: { type: axis === 'x' ? 'vertical' : 'horizontal', pos: PANEL_PADDING } });
    const end = bounds[axis === 'x' ? 'width' : 'height'] - PANEL_PADDING;
    result.push({ value: end - Math.max(...values), guide: { type: axis === 'x' ? 'vertical' : 'horizontal', pos: end } });
  }
  for (const other of others) {
    const neighbor = worldCorners(other);
    for (const own of points) {
      for (const p of neighbor) { result.push({ value: p[axis] - own[axis], range: CLOSE_SNAP_THRESHOLD, guide: { type: axis === 'x' ? 'vertical' : 'horizontal', pos: p[axis] } }); }
    }
    const pairs = axis === 'x' ? [[3, 1], [1, 3]] : [[0, 2], [2, 0]];
    for (const [ownEdge, otherEdge] of pairs) {
      const a = points[ownEdge], b = points[(ownEdge + 1) % 4];
      const c = neighbor[otherEdge], d = neighbor[(otherEdge + 1) % 4];
      const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
      if (Math.abs(dx * ey - dy * ex) > 0.02 * Math.hypot(dx, dy) * Math.hypot(ex, ey)) { continue; }
      const transverse = axis === 'x' ? 'y' : 'x';
      const low = Math.max(Math.min(a[transverse], b[transverse]), Math.min(c[transverse], d[transverse]));
      const high = Math.min(Math.max(a[transverse], b[transverse]), Math.max(c[transverse], d[transverse]));
      if (high - low < 32) { continue; }
      const middle = (low + high) / 2;
      const ownPosition = edgeAt(panel, ownEdge, axis, middle, 0);
      for (const gap of PANEL_SNAP_GAPS) {
        const target = edgeAt(other, otherEdge, axis, middle, gap);
        if (ownPosition !== null && target !== null) {
          result.push({ value: target - ownPosition, priority: 1, guide: { type: axis === 'x' ? 'vertical' : 'horizontal', pos: target } });
        }
      }
    }
  }
  return result;
}

export function snapPanelMove(panel: ComicPanel, position: { x: number; y: number }, others: ComicPanel[], bounds?: Bounds) {
  const guides: Guide[] = [];
  let next = { ...panel, ...position };
  for (const axis of ['y', 'x'] as const) {
    const target = closest(0, translationTargets(next, others, bounds, axis));
    if (target) {
      const snapped = { ...next, [axis]: next[axis] + target.value };
      const blocked = others.some(other => !panelsCollide(panelRenderedFrame(panel), panelRenderedFrame(other), 0)
        && panelsCollide(panelRenderedFrame(snapped), panelRenderedFrame(other), 0));
      if (!blocked) { next = snapped; if (target.guide) { guides.push(target.guide); } }
    }
  }
  const x = Math.max(PANEL_PADDING, Math.min(bounds ? Math.max(PANEL_PADDING, bounds.width - PANEL_PADDING - panel.width) : Infinity, next.x));
  const y = Math.max(PANEL_PADDING, Math.min(bounds ? Math.max(PANEL_PADDING, bounds.height - PANEL_PADDING - panel.height) : Infinity, next.y));
  return { x, y, guides: guides.filter(g => g.type === 'vertical' ? x === next.x : y === next.y) };
}

function resizeSlopedPanel(panel: ComicPanel, dx: number, side: Side, others: ComicPanel[], bounds?: Bounds, guides?: Guide[]): PanelResizeResult {
  const original = panelCorners(panel), world = worldCorners(panel), visible = panelVisibleBounds(panel);
  if (dx === 0) { return { x: panel.x, width: panel.width, height: panel.height, corners: panel.corners ?? original }; }
  const index = side === 'left' ? 3 : 2;
  const oldPoint = world[index];
  let delta = dx;
  const target = closest(oldPoint.x + dx, pointTargets({ x: oldPoint.x + dx, y: oldPoint.y }, 'x', others, side, bounds));
  if (target) { delta = target.value - oldPoint.x; }
  const make = (movement: number) => {
    const points = world.map((point, i) => ({ x: point.x + ((side === 'left' ? i === 0 || i === 3 : i === 1 || i === 2) ? movement : 0), y: point.y }));
    // The old frame exists only to retain artwork. It must not stop an edge
    // that is still moving through genuinely empty canvas space.
    const x = Math.min(panel.x, ...points.map(p => p.x));
    const width = Math.max(panel.x + panel.width, ...points.map(p => p.x)) - x;
    const corners = points.map(p => ({ x: (p.x - x) / width, y: Math.max(0, Math.min(1, (p.y - panel.y) / panel.height)) })) as PanelCorners;
    const reframed = Math.abs(x - panel.x) > 0.000001 || Math.abs(width - panel.width) > 0.000001;
    return { x, width, height: panel.height, corners, shapeRevision: (panel.shapeRevision ?? 0) + (reframed ? 1 : 0),
      ...(panel.tracingImage ? { tracingImage: { ...panel.tracingImage, x: panel.tracingImage.x + panel.x - x } } : {}) };
  };
  const initiallyOverlapping = new Set(others.filter(other => panelsCollide(panel, other, 0)).map(other => other.id));
  const valid = (candidate: ReturnType<typeof make>) => {
    if (panelCorners(candidate) !== candidate.corners) { return false; }
    const proposed = { ...panel, ...candidate }, current = panelVisibleBounds(proposed), points = worldCorners(proposed);
    return current.width >= Math.min(76, visible.width) - 0.001
      && points.every((p, i) => p.x >= PANEL_PADDING - 0.001 && (!bounds || p.x <= bounds.width - PANEL_PADDING + 0.001)
        && Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y) >= Math.min(48, visible.width / 2, visible.height / 2))
      && !others.some(other => !initiallyOverlapping.has(other.id) && panelsCollide(proposed, other, 0));
  };
  let result = make(delta);
  if (!valid(result)) {
    let low = 0, high = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (low + high) / 2;
      if (valid(make(delta * mid))) { low = mid; } else { high = mid; }
    }
    result = make(delta * low);
  }
  const points = worldCorners({ ...panel, ...result });
  if (target && Math.abs(points[index].x - target.value) < 0.001) { guides?.push({ type: 'vertical', pos: target.value }); }
  if (points.every((point, i) => Math.abs(point.x - world[i].x) < 0.000001)) {
    return { x: panel.x, width: panel.width, height: panel.height, corners: panel.corners ?? original };
  }
  return result;
}

export function snapPanelResize(panel: ComicPanel, dx: number, dy: number, side: Side, others: ComicPanel[], bounds?: Bounds, guides?: Guide[]): PanelResizeResult {
  const visible = panelRenderedFrame(panel);
  const captured: Guide[] = [];
  const neighbors = others.map(panelRenderedFrame);
  const frameBounds = bounds ? { width: bounds.width - 2, height: bounds.height - 2 } : undefined;
  let resized = snapPanelResizeFrame(visible, dx, dy, side, neighbors, frameBounds, captured);
  const blocked = (candidate: PanelResizeResult) => neighbors.some(other => !panelsCollide(visible, other, 0)
    && panelsCollide({ ...visible, ...candidate }, other, 0));
  if (blocked(resized)) {
    const unsnapped = snapPanelResizeFrame(visible, dx, dy, side, [], frameBounds);
    if (!blocked(unsnapped)) { resized = unsnapped; captured.length = 0; }
  }
  const point = worldCorners({ ...visible, ...resized })[side === 'left' ? 3 : 2];
  // A clamp or the second axis can invalidate an earlier snap. Only show
  // guides that actually pass through the final visible handle center.
  guides?.push(...captured.filter(guide => Math.abs(guide.pos - point[guide.type === 'vertical' ? 'x' : 'y']) < 0.001));
  return { ...resized, ...(resized.x !== undefined ? { x: resized.x - 2 } : {}), width: resized.width + 4, height: resized.height + 4 };
}

function snapPanelResizeFrame(panel: ComicPanel, dx: number, dy: number, side: Side, others: ComicPanel[], bounds?: Bounds, guides?: Guide[]): PanelResizeResult {
  const points = panelCorners(panel);
  const sloped = Math.abs(points[0].x - points[3].x) > 0.0001 || Math.abs(points[1].x - points[2].x) > 0.0001;
  const visible = panelVisibleBounds(panel);
  const expandedInkFrame = Math.abs(visible.x - panel.x) > 0.001 || Math.abs(visible.width - panel.width) > 0.001;
  if (sloped || expandedInkFrame) {
    const horizontal = resizeSlopedPanel(panel, dx, side, others, bounds, guides);
    if (dy === 0) { return { ...horizontal, resizeInk: true, warpInk: false }; }
    const resized = { ...panel, ...horizontal }, corners = panelCorners(resized);
    const corner = corners[side === 'left' ? 3 : 2];
    if (corner.y < 0.001) { return { ...horizontal, resizeInk: true, warpInk: false }; }
    const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
    const minimum = Math.min(76, visible.height) / Math.max(0.001, maxY - minY);
    const maximum = bounds ? (bounds.height - PANEL_PADDING - panel.y) / Math.max(0.001, maxY) : Infinity;
    const clampHeight = (height: number) => Math.max(minimum, Math.min(maximum, height));
    let height = clampHeight(panel.height + dy / corner.y);
    const point = { x: resized.x + corner.x * resized.width, y: panel.y + corner.y * height };
    const target = closest(point.y, pointTargets(point, 'y', others, side, bounds));
    if (target) { height = clampHeight((target.value - panel.y) / corner.y); }
    const initiallyOverlapping = new Set(others.filter(other => panelsCollide(resized, other, 0)).map(other => other.id));
    const valid = (nextHeight: number) => !others.some(other => !initiallyOverlapping.has(other.id)
      && panelsCollide({ ...resized, height: nextHeight }, other, 0));
    if (!valid(height)) {
      let low = 0, high = 1;
      for (let i = 0; i < 28; i++) {
        const mid = (low + high) / 2;
        if (valid(panel.height + (height - panel.height) * mid)) { low = mid; } else { high = mid; }
      }
      height = panel.height + (height - panel.height) * low;
    }
    if (target && Math.abs(panel.y + corner.y * height - target.value) < 0.001) {
      guides?.push({ type: 'horizontal', pos: target.value });
    }
    return { ...horizontal, height, resizeInk: true, warpInk: false };
  }
  const right = panel.x + panel.width;
  let width = Math.max(76, panel.width + (side === 'left' ? -dx : dx));
  let height = Math.max(76, panel.height + dy);
  const corner = panelCorners(panel)[side === 'left' ? 3 : 2];
  let x = side === 'left' ? right - width : panel.x;
  let point = { x: x + corner.x * width, y: panel.y + corner.y * height };
  const yTarget = closest(point.y, pointTargets(point, 'y', others, side, bounds));
  if (yTarget && corner.y > 0.001) { height = (yTarget.value - panel.y) / corner.y; }
  point = { ...point, y: panel.y + corner.y * height };
  const xTarget = closest(point.x, pointTargets(point, 'x', others, side, bounds));
  if (xTarget) {
    if (side === 'left' && 1 - corner.x > 0.001) { width = (right - xTarget.value) / (1 - corner.x); }
    else if (side === 'right' && corner.x > 0.001) { width = (xTarget.value - panel.x) / corner.x; }
  }
  width = Math.min(side === 'left' ? Math.max(1, right - PANEL_PADDING) : bounds ? Math.max(1, bounds.width - PANEL_PADDING - panel.x) : Infinity, Math.max(76, width));
  height = Math.min(bounds ? Math.max(1, bounds.height - PANEL_PADDING - panel.y) : Infinity, Math.max(76, height));
  x = side === 'left' ? right - width : panel.x;
  if (xTarget && Math.abs(x + corner.x * width - xTarget.value) < 0.001) { guides?.push({ type: 'vertical', pos: xTarget.value }); }
  if (yTarget && Math.abs(panel.y + corner.y * height - yTarget.value) < 0.001) { guides?.push({ type: 'horizontal', pos: yTarget.value }); }
  return { ...(side === 'left' ? { x } : {}), width, height, resizeInk: true, warpInk: false };
}

export function snapPanelShape(panel: ComicPanel, side: Side, dx: number, others: ComicPanel[] = [], bounds?: Bounds) {
  const moved = movePanelHandle(panel, side, dx);
  const index = side === 'left' ? 3 : 2;
  const point = worldCorners({ ...panel, corners: moved })[index];
  const target = closest(point.x, [...pointTargets(point, 'x', others, side, bounds), { value: panel.x }, { value: panel.x + panel.width }]);
  if (!target || dx === 0) { return moved; }
  return movePanelHandle(panel, side, dx + target.value - point.x);
}


export type ShapeUpdate = Pick<ComicPanel, 'x' | 'width' | 'height' | 'corners' | 'shapeRevision' | 'resizeInk' | 'warpInk' | 'tracingImage'>;

// Use the visible edge's angle from vertical, including the inset outline and
// any reframing when a corner extends beyond its original ink frame.
function cornerAngleTarget(panel: ComicPanel, side: Side, x: number): number | undefined {
  const points = worldCorners(panel), top = points[side === 'left' ? 0 : 1], bottom = points[side === 'left' ? 3 : 2];
  if (panel.width <= 4 || panel.height <= 4) { return undefined; }
  const dy = (bottom.y - top.y) * (1 - 4 / panel.height);
  if (dy <= 0.001) { return undefined; }
  const angleAt = (value: number) => {
    const width = Math.max(panel.x + panel.width, value) - Math.min(panel.x, value);
    return Math.atan2((value - top.x) * (1 - 4 / width), dy) * 180 / Math.PI;
  };
  const angle = angleAt(x), target = Math.round(angle / 15) * 15;
  // A narrow capture band lets continued dragging leave the snap naturally.
  if (Math.abs(target) >= 90 || Math.abs(angle - target) > 2) { return undefined; }
  const run = Math.tan(target * Math.PI / 180) * dy;
  const a = top.x + run, b = top.x + run / (1 - 4 / panel.width);
  let low = Math.min(a, b) - 0.001, high = Math.max(a, b) + 0.001;
  for (let i = 0; i < 36; i++) {
    const mid = (low + high) / 2;
    if (angleAt(mid) < target) { low = mid; } else { high = mid; }
  }
  return (low + high) / 2;
}

export function reshapePanelPoint(panel: ComicPanel, side: Side, dx: number, others: ComicPanel[] = [], bounds?: Bounds): ShapeUpdate {
  const original = worldCorners(panel), index = side === 'left' ? 3 : 2;
  const point = original[index];
  let targetX = Math.max(PANEL_PADDING, Math.min(bounds ? bounds.width - PANEL_PADDING : Infinity, point.x + dx));
  const rawX = targetX;
  const angleTarget = dx === 0 ? undefined : cornerAngleTarget(panel, side, rawX);
  const angleAllowed = angleTarget !== undefined && angleTarget >= PANEL_PADDING
    && (!bounds || angleTarget <= bounds.width - PANEL_PADDING);
  const alignmentTargets = pointTargets({ x: rawX, y: point.y }, 'x', others, side, bounds);
  const snap = closest(rawX, [...alignmentTargets, ...(angleAllowed ? [{ value: angleTarget, range: Infinity }] : [])]);
  if (dx !== 0 && snap) { targetX = snap.value; }
  const make = (fraction: number): ShapeUpdate => {
    const world = original.map(p => ({ ...p }));
    world[index].x = point.x + (targetX - point.x) * fraction;
    const x = Math.min(panel.x, ...world.map(p => p.x));
    const width = Math.max(panel.x + panel.width, ...world.map(p => p.x)) - x;
    const corners = world.map(p => ({ x: Math.max(0, Math.min(1, (p.x - x) / width)), y: Math.max(0, Math.min(1, (p.y - panel.y) / panel.height)) })) as PanelCorners;
    const reframed = Math.abs(x - panel.x) > 0.000001 || Math.abs(width - panel.width) > 0.000001;
    return { x, width, height: panel.height, corners, resizeInk: false, warpInk: true,
      shapeRevision: (panel.shapeRevision ?? 0) + (reframed ? 1 : 0),
      ...(panel.tracingImage ? { tracingImage: { ...panel.tracingImage, x: panel.tracingImage.x + panel.x - x } } : {}) };
  };
  const initiallyOverlapping = new Set(others.filter(other => panelsCollide(panel, other, 0)).map(p => p.id));
  const valid = (update: ShapeUpdate) => {
    const candidate = { ...panel, ...update }, points = worldCorners(candidate);
    return panelCorners(candidate) === candidate.corners && points.every((p, i) =>
      p.x >= PANEL_PADDING - 0.001 && (!bounds || p.x <= bounds.width - PANEL_PADDING + 0.001)
      && Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y) >= Math.min(48, panel.width / 2, panel.height / 2))
      && !others.some(other => !initiallyOverlapping.has(other.id)
        && panelsCollide(candidate, other, 0));
  };
  let result = make(1);
  if (!valid(result) && angleAllowed && snap?.value === angleTarget) {
    // An angle hint must never pull a valid freehand position into another box.
    targetX = rawX;
    result = make(1);
  }
  if (valid(result)) { return result; }
  let low = 0, high = 1;
  for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (valid(make(mid))) { low = mid; } else { high = mid; } }
  return make(low);
}
