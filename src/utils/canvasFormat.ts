import { ComicPage } from '../types/comic';

export type CanvasOrientation = 'portrait' | 'landscape';

// Keep a small gutter for the page arrows while giving the paper more screen space.
export const CANVAS_VIEW_INSET = { horizontal: 28, vertical: 4 };
export const canvasSizeFor = (orientation: CanvasOrientation) => orientation === 'landscape'
  ? { width: 1200, height: 900 } : { width: 900, height: 1200 };

export function pageOrientation(page: ComicPage): CanvasOrientation {
  return page.orientation ?? (page.canvasSize && page.canvasSize.width > page.canvasSize.height ? 'landscape' : 'portrait');
}

export function pageCanvasSize(page: ComicPage) {
  const size = page.canvasSize;
  if (size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0) {
    return size;
  }
  // Older saves may predate canvasSize. Keep all their existing content visible.
  const fallback = canvasSizeFor(pageOrientation(page));
  return {
    width: Math.max(fallback.width, ...[...page.panels, ...page.bubbles].map(panel => panel.x + panel.width + 12)),
    height: Math.max(fallback.height, ...[...page.panels, ...page.bubbles].map(panel => panel.y + panel.height + 12)),
  };
}

export function expandCanvasToViewport(size: { width: number; height: number }, viewport: { width: number; height: number }) {
  if (viewport.width <= 56 || viewport.height <= 8) { return size; }
  const availableWidth = viewport.width - CANVAS_VIEW_INSET.horizontal * 2;
  const availableHeight = viewport.height - CANVAS_VIEW_INSET.vertical * 2;
  if (size.width > size.height && viewport.width > viewport.height) {
    const width = Math.max(size.width, Math.ceil(size.height * availableWidth / availableHeight));
    return width > size.width ? { width, height: size.height } : size;
  }
  if (size.height >= size.width && viewport.height >= viewport.width) {
    const height = Math.max(size.height, Math.ceil(size.width * availableHeight / availableWidth));
    return height > size.height ? { width: size.width, height } : size;
  }
  return size;
}

export function fitCanvas(size: { width: number; height: number }, viewport: { width: number; height: number }) {
  return Math.max(0.01, Math.min(Math.max(1, viewport.width - CANVAS_VIEW_INSET.horizontal * 2) / size.width, Math.max(1, viewport.height - CANVAS_VIEW_INSET.vertical * 2) / size.height));
}

export function coverAspectRatio(cover: {
  canvasSize?: { width: number; height: number }; orientation?: CanvasOrientation;
}) {
  const size = cover.canvasSize;
  if (size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0) {
    return size.width / size.height;
  }
  return cover.orientation === 'landscape' ? 4 / 3 : 3 / 4;
}
