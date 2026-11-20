import type { ComicPage } from '../types/comic';
import { sameComicPages } from './comicContent';

// The native bridge returns fresh JSON objects even for an unchanged drawing.
// Retain those panel objects/corner arrays so capture does not resend their
// geometry to PencilKit or invalidate stable React render props.
export function reuseCapturedPages(previous: ComicPage[], captured: ComicPage[]): ComicPage[] {
  const oldPages = new Map(previous.map(page => [page.id, page]));
  const result = captured.map(page => {
    const old = oldPages.get(page.id);
    if (!old) { return page; }
    const oldPanels = new Map(old.panels.map(panel => [panel.id, panel]));
    const panels = page.panels.map(panel => {
      const before = oldPanels.get(panel.id);
      if (!before) { return panel; }
      const { drawingData: _oldInk, drawingHasStrokes: _oldPresence, ...oldGeometry } = before;
      const { drawingData: _newInk, drawingHasStrokes: _newPresence, ...geometry } = panel;
      // Canonical comparison also tolerates native dictionary key ordering.
      if (!sameComicPages([{ ...page, panels: [oldGeometry] }], [{ ...page, panels: [geometry] }])) { return panel; }
      if (before.drawingData === panel.drawingData && before.drawingHasStrokes === panel.drawingHasStrokes) { return before; }
      return { ...before, drawingData: panel.drawingData, drawingHasStrokes: panel.drawingHasStrokes };
    });
    const shared = { ...page, panels };
    return sameComicPages([old], [shared]) ? old : shared;
  });
  return result.length === previous.length && result.every((page, index) => page === previous[index]) ? previous : result;
}
