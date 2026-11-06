import { createPanelGrid, gridSelectionAt, GRID_CELL_SIZE, GRID_LIMIT } from '../src/utils/panelGrid';

const bounds = { width: 960, height: 1200 };

test.each([2, 3, 4])('%i-column square layouts fill the page with equal, separated panels', count => {
  const panels = createPanelGrid(count, count, bounds, 'test');
  expect(panels).toHaveLength(count * count);
  expect(new Set(panels.map(panel => panel.id)).size).toBe(panels.length);
  expect(new Set(panels.map(panel => panel.width)).size).toBe(1);
  expect(new Set(panels.map(panel => panel.height)).size).toBe(1);
  expect(panels[0].x).toBe(12);
  expect(panels[0].y).toBe(12);
  const last = panels[panels.length - 1];
  expect(last.x + last.width).toBeCloseTo(bounds.width - 12);
  expect(last.y + last.height).toBeCloseTo(bounds.height - 12);
  panels.forEach((panel, index) => {
    panels.slice(index + 1).forEach(other => {
      const horizontal = Math.max(other.x - panel.x - panel.width, panel.x - other.x - other.width);
      const vertical = Math.max(other.y - panel.y - panel.height, panel.y - other.y - other.height);
      expect(Math.max(horizontal, vertical)).toBeGreaterThanOrEqual(16 - 0.0001);
    });
  });
});

test('a rectangular drag preserves independent column and row counts', () => {
  const choice = gridSelectionAt(GRID_CELL_SIZE * 2.5, GRID_CELL_SIZE * 1.5);
  expect(choice).toEqual({ columns: 3, rows: 2 });
  const panels = createPanelGrid(choice!.columns, choice!.rows, bounds, 'rectangle');
  expect(new Set(panels.map(panel => panel.x)).size).toBe(3);
  expect(new Set(panels.map(panel => panel.y)).size).toBe(2);
});

test('releasing outside the grid cancels selection and invalid grids create no panels', () => {
  const extent = GRID_LIMIT * GRID_CELL_SIZE;
  expect(gridSelectionAt(-1, 20)).toBeNull();
  expect(gridSelectionAt(20, extent)).toBeNull();
  expect(gridSelectionAt(extent - 1, extent - 1)).toEqual({ columns: 4, rows: 4 });
  expect(createPanelGrid(0, 4, bounds, 'invalid')).toEqual([]);
  expect(createPanelGrid(5, 4, bounds, 'invalid')).toEqual([]);
  expect(createPanelGrid(4, 4, { width: 24, height: 24 }, 'small')).toEqual([]);
});
