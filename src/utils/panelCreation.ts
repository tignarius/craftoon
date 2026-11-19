import type { ComicPanel, PanelPoint } from '../types/comic';
import { fitPanelBesideNeighbors, panelsCollide, worldCorners, panelRenderedFrame } from './panelGeometry';
import { PANEL_CLOSE_GAP, PANEL_PADDING, SNAP_THRESHOLD } from './panelMetrics';

type Draft = Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'>;
const clamp = (n: number, max: number) => Math.max(PANEL_PADDING, Math.min(max - PANEL_PADDING, n));

export function snapCanvasEdgeX(value: number, width: number): number {
  const x = clamp(value, width), right = Math.max(PANEL_PADDING, width - PANEL_PADDING);
  if (x - PANEL_PADDING <= SNAP_THRESHOLD) { return PANEL_PADDING; }
  if (right - x <= SNAP_THRESHOLD) { return right; }
  return x;
}

export function createPanelInFreeSpace(start: PanelPoint, pointer: PanelPoint, panels: ComicPanel[], bounds: { width: number; height: number }): Draft | null {
  const firstPanel = panels.length === 0;
  const anchor = { x: firstPanel ? snapCanvasEdgeX(start.x, bounds.width) : clamp(start.x, bounds.width), y: clamp(start.y, bounds.height) };
  let endX = firstPanel ? snapCanvasEdgeX(pointer.x, bounds.width) : clamp(pointer.x, bounds.width), endY = clamp(pointer.y, bounds.height);
  const directionX = Math.sign(endX - anchor.x), directionY = Math.sign(endY - anchor.y);
  for (const panel of panels) {
    // Hit-test the visible polygon, not its retained ink frame. At a narrow
    // sloping corner a point can be outside two edges: prefer the free side
    // the gesture is moving into instead of clamping it against the other.
    const points = worldCorners(panelRenderedFrame(panel));
    const outside = points.map((a, edge) => {
      const b = points[(edge + 1) % 4];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      return { edge, distance: (dy * (anchor.x - a.x) - dx * (anchor.y - a.y)) / length,
        movingOutward: dy * (endX - anchor.x) - dx * (endY - anchor.y) > 0 };
    }).filter(e => e.distance > 0.01).sort((a, b) => Number(b.movingOutward) - Number(a.movingOutward) || b.distance - a.distance);
    // A gesture starting inside an existing polygon cannot create another box.
    if (!outside.length) { return null; }
    const edge = outside[0].edge;
    // Only occupied space plus the minimum gutter blocks a new box. Using
    // the larger snap gutter here incorrectly fences off a whole lower row
    // when its anchor sits four points below an existing row.
    const xOverlap = Math.max(anchor.x, endX) > panel.x - PANEL_CLOSE_GAP && Math.min(anchor.x, endX) < panel.x + panel.width + PANEL_CLOSE_GAP;
    const yOverlap = Math.max(anchor.y, endY) > panel.y - PANEL_CLOSE_GAP && Math.min(anchor.y, endY) < panel.y + panel.height + PANEL_CLOSE_GAP;
    // Stay on the same free side throughout the gesture, including leftward
    // and upward drags. Fitting below restores the exact slanted facing edge.
    if (yOverlap && edge === 1) { endX = Math.max(endX, Math.min(anchor.x, panel.x + panel.width + PANEL_CLOSE_GAP)); }
    if (yOverlap && edge === 3) { endX = Math.min(endX, Math.max(anchor.x, panel.x - PANEL_CLOSE_GAP)); }
    if (xOverlap && edge === 2) { endY = Math.max(endY, Math.min(anchor.y, panel.y + panel.height + PANEL_CLOSE_GAP)); }
    if (xOverlap && edge === 0) { endY = Math.min(endY, Math.max(anchor.y, panel.y - PANEL_CLOSE_GAP)); }
  }
  if (Math.sign(endX - anchor.x) !== directionX || Math.sign(endY - anchor.y) !== directionY) { return null; }
  const raw = { x: Math.min(anchor.x, endX), y: Math.min(anchor.y, endY), width: Math.abs(endX - anchor.x), height: Math.abs(endY - anchor.y) };
  if (raw.width < 1 || raw.height < 1) { return null; }
  const result = fitPanelBesideNeighbors(raw, panels, bounds);
  return panels.some(p => panelsCollide(result, p, PANEL_CLOSE_GAP)) ? null : result;
}
