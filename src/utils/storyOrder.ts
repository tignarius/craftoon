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
