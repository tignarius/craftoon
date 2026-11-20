import type { ComicPanel, PanelCorners, PanelPoint } from '../types/comic';

export const RECT_CORNERS: PanelCorners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
import { PANEL_GAP, PANEL_SNAP_GAPS, SNAP_THRESHOLD } from './panelMetrics';
export { PANEL_GAP } from './panelMetrics';
const cross = (a: PanelPoint, b: PanelPoint, c: PanelPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function panelCorners(panel: Pick<ComicPanel, 'corners'>): PanelCorners {
  const points = panel.corners;
  if (points?.length !== 4 || !points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= -0.000001 && p.x <= 1.000001 && p.y >= -0.000001 && p.y <= 1.000001)) { return RECT_CORNERS; }
  // Fractional layout coordinates can produce 1 + a rounding epsilon after
  // reframing. Normalize that epsilon instead of replacing the whole shape.
  const clean = points.some(p => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)
    ? points.map(p => ({ x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) })) as PanelCorners : points;
  return clean.every((p, i) => cross(p, clean[(i + 1) % 4], clean[(i + 2) % 4]) > 0.002) ? clean : RECT_CORNERS;
}

export function worldCorners(panel: Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'>): PanelCorners {
  return panelCorners(panel).map(p => ({ x: panel.x + p.x * panel.width, y: panel.y + p.y * panel.height })) as PanelCorners;
}

// Respect the shortest edge of an existing valid shape when it is already
// narrower than the normal handle minimum (for example an arranged trapezoid).
export function panelMinimumEdgeLength(panel: Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'>) {
  const points = worldCorners(panel);
  return Math.min(48, ...points.map((p, i) => Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y)));
}

// The visible outline and controls sit inside the panel's two-point border.
// Keep this frame distinct from the retained ink/document frame.
export function panelRenderedFrame<T extends Pick<ComicPanel, 'x' | 'y' | 'width' | 'height'>>(panel: T): T {
  return { ...panel, x: panel.x + 2, y: panel.y + 2, width: panel.width - 4, height: panel.height - 4 };
}

// Keep ink coordinates stable: changing a corner changes only the clipping path.
export function movePanelCorner(panel: ComicPanel, index: number, dx: number, dy: number): PanelCorners {
  const original = panelCorners(panel);
  const minimumEdge = panelMinimumEdgeLength(panel);
  const make = (fraction: number) => {
    const points = original.map(p => ({ ...p })) as PanelCorners;
    points[index] = { x: Math.max(0, Math.min(1, original[index].x + dx * fraction / panel.width)),
      y: Math.max(0, Math.min(1, original[index].y + dy * fraction / panel.height)) };
    return points;
  };
  const valid = (points: PanelCorners) => {
    const world = points.map(p => ({ x: p.x * panel.width, y: p.y * panel.height }));
    return world.every((p, i) => cross(p, world[(i + 1) % 4], world[(i + 2) % 4]) >= 400
      && Math.hypot(p.x - world[(i + 1) % 4].x, p.y - world[(i + 1) % 4].y) >= minimumEdge - 0.001)
      && panelCorners({ corners: points }) === points;
  };
  const requested = make(1);
  if (valid(requested)) { return requested; }
  let low = 0, high = 1;
  for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (valid(make(mid))) { low = mid; } else { high = mid; } }
  return low > 0 ? make(low) : original;
}

type Rect = Pick<ComicPanel, 'x' | 'y' | 'width' | 'height'>;
type Line = { a: PanelPoint; b: PanelPoint };
function intersection(one: Line, two: Line): PanelPoint | null {
  const dx = one.b.x - one.a.x, dy = one.b.y - one.a.y;
  const ex = two.b.x - two.a.x, ey = two.b.y - two.a.y;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) < 0.0001) { return null; }
  const t = ((two.a.x - one.a.x) * ey - (two.a.y - one.a.y) * ex) / determinant;
  return { x: one.a.x + t * dx, y: one.a.y + t * dy };
}

// Only the facing edge inherits the neighbor's slope. Other edges stay aligned
// to the new rectangle, including the outer edges of the page.
export function fitPanelBesideNeighbors(rect: Rect, neighbors: ComicPanel[], bounds: { width: number; height: number }): Rect & { corners?: PanelCorners } {
  const points = worldCorners(rect);
  const lines: Line[] = points.map((a, i) => ({ a, b: points[(i + 1) % 4] }));
  const distances = [Infinity, Infinity, Infinity, Infinity];
  for (const other of neighbors) {
    if (!other.corners) { continue; }
    const verticalOverlap = Math.min(rect.y + rect.height, other.y + other.height) - Math.max(rect.y, other.y);
    const horizontalOverlap = Math.min(rect.x + rect.width, other.x + other.width) - Math.max(rect.x, other.x);
    const candidates = PANEL_SNAP_GAPS.flatMap(gap => [
      { edge: 3, source: 1, gap, distance: Math.abs(rect.x - (other.x + other.width + gap)), overlaps: verticalOverlap },
      { edge: 1, source: 3, gap, distance: Math.abs(rect.x + rect.width - (other.x - gap)), overlaps: verticalOverlap },
      { edge: 0, source: 2, gap, distance: Math.abs(rect.y - (other.y + other.height + gap)), overlaps: horizontalOverlap },
      { edge: 2, source: 0, gap, distance: Math.abs(rect.y + rect.height - (other.y - gap)), overlaps: horizontalOverlap },
    ]).sort((a, b) => Math.min(a.distance, SNAP_THRESHOLD) - Math.min(b.distance, SNAP_THRESHOLD));
    const otherPoints = worldCorners(other);
    for (const candidate of candidates) {
      if (candidate.overlaps < 32) { continue; }
      const a = otherPoints[candidate.source], b = otherPoints[(candidate.source + 1) % 4];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      // Clockwise screen coordinates: the right normal points out of the panel.
      const offset = { x: (b.y - a.y) / length * candidate.gap, y: -(b.x - a.x) / length * candidate.gap };
      const facing = { a: { x: a.x + offset.x, y: a.y + offset.y }, b: { x: b.x + offset.x, y: b.y + offset.y } };
      const vertical = candidate.edge === 1 || candidate.edge === 3;
      const low = vertical ? Math.max(rect.y, other.y) : Math.max(rect.x, other.x);
      const high = vertical ? Math.min(rect.y + rect.height, other.y + other.height) : Math.min(rect.x + rect.width, other.x + other.width);
      const axisLength = vertical ? facing.b.y - facing.a.y : facing.b.x - facing.a.x;
      if (Math.abs(axisLength) < 0.01) { continue; }
      const coordinateAt = (position: number) => vertical
        ? facing.a.x + (position - facing.a.y) / axisLength * (facing.b.x - facing.a.x)
        : facing.a.y + (position - facing.a.x) / axisLength * (facing.b.y - facing.a.y);
      const min = Math.min(coordinateAt(low), coordinateAt(high)), max = Math.max(coordinateAt(low), coordinateAt(high));
      const position = candidate.edge === 3 ? rect.x : candidate.edge === 1 ? rect.x + rect.width
        : candidate.edge === 0 ? rect.y : rect.y + rect.height;
      // The visible sloping edge may be far inside its rectangular frame. Match
      // anywhere along that edge, rather than only near the frame's extremum.
      const edgeDistance = Math.max(min - position, position - max, 0);
      const distance = Math.min(candidate.distance, edgeDistance);
      const outside = candidate.edge === 3 ? rect.x + rect.width > max + 50
        : candidate.edge === 1 ? rect.x < min - 50
        : candidate.edge === 0 ? rect.y + rect.height > max + 50 : rect.y < min - 50;
      if (!outside || distance > SNAP_THRESHOLD || distance >= distances[candidate.edge]) { continue; }
      lines[candidate.edge] = facing;
      distances[candidate.edge] = distance;
    }
  }
  if (distances.every(d => d === Infinity)) { return rect; }
  const corners = lines.map((line, i) => intersection(lines[(i + 3) % 4], line));
  if (corners.some(p => !p || p.x < 12 - 0.01 || p.y < 12 - 0.01 || p.x > bounds.width - 12 + 0.01 || p.y > bounds.height - 12 + 0.01)) { return rect; }
  const quad = corners as PanelCorners;
  if (!quad.every((p, i) => cross(p, quad[(i + 1) % 4], quad[(i + 2) % 4]) > 400)) { return rect; }
  const x = Math.min(...quad.map(p => p.x)), y = Math.min(...quad.map(p => p.y));
  const width = Math.max(...quad.map(p => p.x)) - x, height = Math.max(...quad.map(p => p.y)) - y;
  if (width < 50 || height < 50) { return rect; }
  const normalized = quad.map(p => ({ x: (p.x - x) / width, y: (p.y - y) / height })) as PanelCorners;
  if (panelCorners({ corners: normalized }) !== normalized) { return rect; }
  return { x, y, width, height, corners: normalized };
}

function segmentDistance(p: PanelPoint, a: PanelPoint, b: PanelPoint) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function pointToPanelDistance(point: PanelPoint, panel: Rect & { corners?: PanelCorners }) {
  const points = worldCorners(panel);
  return Math.min(...points.map((a, i) => segmentDistance(point, a, points[(i + 1) % 4])));
}

export function panelsCollide(a: Rect & { corners?: PanelCorners }, b: Rect & { corners?: PanelCorners }, gap = 8) {
  const one = worldCorners(a), two = worldCorners(b);
  const separated = [...one, ...two].some((p, i) => {
    const polygon = i < 4 ? one : two;
    const q = polygon[(i + 1) % 4];
    const nx = q.y - p.y, ny = p.x - q.x;
    const project = (poly: PanelPoint[]) => poly.map(v => v.x * nx + v.y * ny);
    const left = project(one), right = project(two);
    return Math.max(...left) <= Math.min(...right) || Math.max(...right) <= Math.min(...left);
  });
  if (!separated) { return true; }
  return one.some(p => two.some((q, i) => segmentDistance(p, q, two[(i + 1) % 4]) < gap - 0.01))
    || two.some(p => one.some((q, i) => segmentDistance(p, q, one[(i + 1) % 4]) < gap - 0.01));
}

export function panelVisibleBounds(panel: Rect & Pick<ComicPanel, 'corners'>) {
  const points = worldCorners(panel);
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}

export function panelFocusTransform(panel: Rect & Pick<ComicPanel, 'corners'>, viewport: { width: number; height: number }, canvas: { width: number; height: number }) {
  const visible = panelVisibleBounds(panel);
  const scale = Math.max(0.01, Math.min(Math.max(1, viewport.width - 56) / (visible.width + 24), Math.max(1, viewport.height - 104) / (visible.height + 24)));
  const centerX = visible.x + visible.width / 2, centerY = visible.y + visible.height / 2;
  return { scale, centerX, centerY, x: (canvas.width / 2 - centerX) * scale, y: (canvas.height / 2 - centerY) * scale };
}

// Find a horizontal strip inside the polygon so controls never float in a
// clipped-off corner. Compact panels use smaller buttons rather than overlap.
export function panelControlLayout(panel: Pick<ComicPanel, 'width' | 'height' | 'corners'>, buttonCount = 3, buttonScale = 1) {
  const width = panel.width - 4, height = panel.height - 4;
  const points = panelCorners(panel).map(p => ({ x: p.x * width, y: p.y * height }));
  const span = (y: number) => {
    const xs: number[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % 4];
      if (Math.abs(a.y - b.y) < 0.01) {
        if (Math.abs(y - a.y) < 0.01) { xs.push(a.x, b.x); }
      } else if (y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) {
        xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
      }
    });
    return xs.length >= 2 ? { left: Math.min(...xs) + 6, right: Math.max(...xs) - 6 } : null;
  };
  let best = { top: 6, left: 6, right: width - 6, available: 0 };
  for (let top = 6; top <= height - 35 - 6; top += 4) {
    const a = span(top), b = span(top + 35);
    if (!a || !b) { continue; }
    const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
    if (right - left > best.available) { best = { top, left, right, available: right - left }; }
    if (right - left >= (buttonCount === 3 ? 117 : (buttonCount + 0.35) * 35 * buttonScale + (buttonCount - 1) * 6 + 2.1)) { break; }
  }
  return { top: best.top, left: best.left, right: width - best.right,
    buttonSize: buttonCount === 3 ? Math.min(35, Math.max(14, (best.available - 12) / 3))
      : Math.min(35, Math.max(8, (best.available - (buttonCount - 1) * 6 - 2.1) / ((buttonCount + 0.35) * buttonScale))) };
}


// Prefer the facing side of the nearest panel in the same row. A saved choice
// keeps the handle stable when that neighbor is moved or removed later.
export function neighboringHandleSide(panel: Pick<ComicPanel, 'id' | 'x' | 'y' | 'width' | 'height' | 'corners'>, others: ComicPanel[]): 'left' | 'right' | undefined {
  let closest = Infinity;
  let side: 'left' | 'right' | undefined;
  const center = panel.x + panel.width / 2;
  for (const other of others) {
    if (other.id === panel.id) { continue; }
    const overlap = Math.min(panel.y + panel.height, other.y + other.height) - Math.max(panel.y, other.y);
    if (overlap < Math.min(32, panel.height / 2, other.height / 2)) { continue; }
    const otherCenter = other.x + other.width / 2;
    const distance = Math.max(0, otherCenter < center ? panel.x - other.x - other.width : other.x - panel.x - panel.width);
    if (distance < closest) { closest = distance; side = otherCenter < center ? 'left' : 'right'; }
  }
  return side;
}

export function panelHandleSide(panel: ComicPanel, others: ComicPanel[] = []) {
  return panel.adjustmentSide ?? neighboringHandleSide(panel, others) ?? 'right';
}

export function movePanelHandle(panel: ComicPanel, side: 'left' | 'right', dx: number) {
  const original = panelCorners(panel);
  const moved = movePanelCorner(panel, side === 'left' ? 3 : 2, dx, 0);
  return moved.every((point, i) => point.x === original[i].x && point.y === original[i].y) ? original : moved;
}

export function resizePanelFromLeft(panel: ComicPanel, dx: number, dy: number,
  bounds?: { width: number; height: number }, others: ComicPanel[] = []) {
  const right = panel.x + panel.width;
  let left = panel.x + dx;
  let height = Math.max(80, panel.height + dy);
  for (const other of others) {
    if (Math.abs(left - (other.x + other.width + PANEL_GAP)) < SNAP_THRESHOLD) { left = other.x + other.width + PANEL_GAP; }
    if (Math.abs(panel.y + height - other.y + PANEL_GAP) < SNAP_THRESHOLD) { height = other.y - PANEL_GAP - panel.y; }
    else if (Math.abs(panel.y + height - other.y - other.height) < SNAP_THRESHOLD) { height = other.y + other.height - panel.y; }
  }
  if (bounds && Math.abs(panel.y + height - bounds.height + 12) < SNAP_THRESHOLD) { height = bounds.height - 12 - panel.y; }
  const width = Math.min(Math.max(1, right - 12), Math.max(80, right - left));
  height = Math.min(bounds ? Math.max(1, bounds.height - 12 - panel.y) : Infinity, Math.max(80, height));
  return { x: right - width, width, height };
}
