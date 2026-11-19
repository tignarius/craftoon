import type { ComicPanel } from '../types/comic';

export const GRID_LIMIT = 4;
export const GRID_CELL_SIZE = 38;

export function gridSelectionAt(x: number, y: number) {
  const extent = GRID_LIMIT * GRID_CELL_SIZE;
  if (x < 0 || y < 0 || x >= extent || y >= extent) { return null; }
  return { columns: Math.floor(x / GRID_CELL_SIZE) + 1, rows: Math.floor(y / GRID_CELL_SIZE) + 1 };
}

export function createPanelGrid(columns: number, rows: number,
  bounds: { width: number; height: number }, idPrefix: string): ComicPanel[] {
  if (![columns, rows].every(value => Number.isInteger(value) && value >= 1 && value <= GRID_LIMIT)) {
    return [];
  }
  const padding = 12;
  const gap = 16;
  const width = (bounds.width - 2 * padding - gap * (columns - 1)) / columns;
  const height = (bounds.height - 2 * padding - gap * (rows - 1)) / rows;
  if (width <= 0 || height <= 0) { return []; }
  return Array.from({ length: rows * columns }, (_, index) => ({
    id: `${idPrefix}-${index}`,
    layoutSource: 'template' as const,
    x: padding + (index % columns) * (width + gap),
    y: padding + Math.floor(index / columns) * (height + gap),
    width, height,
  }));
}
