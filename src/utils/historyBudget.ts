import { ComicPage } from '../types/comic';

// Count unique retained payload strings; unchanged panels share their data across
// snapshots. Native ink references are small, while legacy ink/photos can be big.
export function boundHistory<T extends { pages: ComicPage[] }>(
  entries: T[], maxEntries = 100, maxBytes = 24 * 1024 * 1024,
): T[] {
  const candidates = entries.slice(-maxEntries);
  const payloads = new Set<string>();
  let bytes = 0;
  let first = candidates.length;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const added = new Set<string>();
    for (const page of candidates[i].pages) {
      for (const panel of page.panels) {
        for (const value of [panel.drawingData, panel.tracingImage?.uri]) {
          if (value && !payloads.has(value)) { added.add(value); }
        }
      }
      if (page.tracingImage?.uri && !payloads.has(page.tracingImage.uri)) { added.add(page.tracingImage.uri); }
    }
    const cost = [...added].reduce((total, value) => total + value.length * 2, 0);
    // Preserve the current state and one Undo even for an oversized document.
    if (candidates.length - first >= 2 && bytes + cost > maxBytes) { break; }
    added.forEach(value => payloads.add(value));
    bytes += cost;
    first = i;
  }
  return candidates.slice(first);
}
