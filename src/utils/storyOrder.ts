import { StorySummary } from '../services/storyLibrary';

function creationTime(story: StorySummary): number {
  if (story.createdAt) {
    const timestamp = Date.parse(story.createdAt);
    if (Number.isFinite(timestamp)) { return timestamp; }
  }
  // Older app versions embedded the original creation time in the story ID.
  const match = /^story-(\d+)$/.exec(story.id);
  if (match) { return Number(match[1]); }
  const fallback = Date.parse(story.updatedAt);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function compareStoryCreation(a: StorySummary, b: StorySummary): number {
  return creationTime(b) - creationTime(a) || a.id.localeCompare(b.id);
}

// Unranked/new comics precede an existing manual order.
export function compareStoryOrder(a: StorySummary, b: StorySummary): number {
  const x = a.libraryOrder ?? -1, y = b.libraryOrder ?? -1;
  return x - y || compareStoryCreation(a, b);
}

export interface LibraryCardFrame { x: number; y: number; width: number; height: number }
export function libraryDropTarget(ids: string[], frames: Map<string, LibraryCardFrame>, x: number, y: number): number {
  // Include the dragged card's new slot so an unchanged pointer cannot swap back.
  return ids.findIndex(id => {
    const frame = frames.get(id);
    return frame && x >= frame.x && x <= frame.x + frame.width &&
      y >= frame.y && y <= frame.y + frame.height;
  });
}
