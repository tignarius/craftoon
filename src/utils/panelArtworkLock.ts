import type { ComicPanel } from '../types/comic';

// Locked artwork stays in page coordinates. Its local origin compensates for
// panel movement, while its pixels/ink never scale or warp with the new frame.
export function lockedArtworkGeometry(panel: ComicPanel, updates: Partial<ComicPanel>): Partial<ComicPanel> {
  if (!panel.artworkLocked) { return updates; }
  const dx = panel.x - (updates.x ?? panel.x), dy = panel.y - (updates.y ?? panel.y);
  return { ...updates, resizeInk: false, warpInk: false,
    ...(panel.tracingImage ? { tracingImage: dx || dy
      ? { ...panel.tracingImage, x: panel.tracingImage.x + dx, y: panel.tracingImage.y + dy }
      : panel.tracingImage } : {}) };
}
