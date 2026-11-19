import type { ComicPage, PanelInkGeometry } from '../types/comic';
import { panelCorners } from './panelGeometry';

// A native ink resize finishes the geometry action; it is not a new stroke.
// Patch matching snapshots, including a delayed result after another action,
// while leaving the pre-drag geometry and newer strokes untouched.
export function mergeGeometryInk(pages: ComicPage[], id: string, drawingData: string, geometry: PanelInkGeometry): ComicPage[] {
  let changed = false;
  const result = pages.map(page => {
    let pageChanged = false;
    const panels = page.panels.map(panel => {
      if (panel.id !== id || panel.drawingData === drawingData
        || (panel.drawingData ?? '') !== (geometry.sourceDrawingData ?? '')
        || Math.abs(panel.width - 4 - geometry.width) > 0.001
        || Math.abs(panel.height - 4 - geometry.height) > 0.001
        || JSON.stringify(panelCorners(panel)) !== JSON.stringify(panelCorners({ corners: geometry.corners }))) { return panel; }
      changed = pageChanged = true;
      return { ...panel, drawingData };
    });
    return pageChanged ? { ...page, panels } : page;
  });
  return changed ? result : pages;
}
