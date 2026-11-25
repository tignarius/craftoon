import type { ComicPanel } from '../types/comic';
import { panelCorners, panelRenderedFrame, panelsCollide, worldCorners, panelMinimumEdgeLength } from './panelGeometry';
import { PANEL_PADDING } from './panelMetrics';
import { snapPanelResize, PanelSnapGuide } from './panelSnap';

// Capture/release distances are screen points, independent of canvas zoom.
export function snapPanelAspectResize(panel: ComicPanel, dx: number, dy: number,
  side: 'left' | 'right', others: ComicPanel[], bounds: { width: number; height: number } | undefined,
  canvasScale = 1, wasSnapped = false) {
  const fallback = () => {
    const guides: PanelSnapGuide[] = [];
    return { geometry: snapPanelResize(panel, dx, dy, side, others, bounds, guides), guides, aspectSnapped: false };
  };
  const w = panel.width - 4, h = panel.height - 4;
  if (panel.artworkLocked || w <= 0 || h <= 0 || !Number.isFinite(canvasScale) || canvasScale <= 0) return fallback();
  const corner = panelCorners(panel)[side === 'left' ? 3 : 2];
  const run = (corner.x - (side === 'left' ? 1 : 0)) * w, rise = corner.y * h;
  const lengthSquared = run * run + rise * rise;
  if (lengthSquared < 1) return fallback();
  const delta = (dx * run + dy * rise) / lengthSquared;
  const scale = 1 + delta;
  const distance = Math.hypot(dx - delta * run, dy - delta * rise) * canvasScale;
  if (!Number.isFinite(scale) || scale <= 0 || distance > (wasSnapped ? 16 : 10)) return fallback();
  // Scale the inner drawing frame, not its fixed two-point border inset.
  // Otherwise small panels would still stretch their ink unevenly.
  const width = 4 + w * scale, height = 4 + h * scale;
  if (width < Math.min(80, panel.width) || height < Math.min(80, panel.height)) return fallback();
  const geometry = { x: side === 'left' ? panel.x + panel.width - width : panel.x,
    width, height, corners: panel.corners, resizeInk: true, warpInk: false };
  const candidate = panelRenderedFrame({ ...panel, ...geometry });
  const points = worldCorners(candidate);
  if (points.some((p, i) => Math.hypot(p.x - points[(i + 1) % 4].x, p.y - points[(i + 1) % 4].y)
    < panelMinimumEdgeLength(panel) - 0.001)) return fallback();
  const outside = points.some(p => p.x < PANEL_PADDING || p.y < PANEL_PADDING
    || (bounds && (p.x > bounds.width - PANEL_PADDING || p.y > bounds.height - PANEL_PADDING)));
  const blocked = others.some(other => !panelsCollide(panelRenderedFrame(panel), panelRenderedFrame(other), 0)
    && panelsCollide(candidate, panelRenderedFrame(other), 0));
  if (outside || blocked) return fallback();
  return { geometry, guides: [] as PanelSnapGuide[], aspectSnapped: true };
}
