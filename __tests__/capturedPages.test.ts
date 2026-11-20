import { reuseCapturedPages } from '../src/utils/capturedPages';
import type { ComicPage, PanelCorners } from '../src/types/comic';
const pages: ComicPage[] = [{ id: 'p', bubbles: [], panels: [{ id: 'a', x: 12, y: 12, width: 300, height: 400,
  drawingData: 'craftoon-ink:old', corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 1 }, { x: 0, y: 1 }] as PanelCorners }] }];

test('native JSON copies do not replace unchanged pages, panel frames or corner arrays', () => {
  expect(reuseCapturedPages(pages, JSON.parse(JSON.stringify(pages)))).toBe(pages);
});

test('a new ink reference keeps the same corner array while actual geometry updates remain visible', () => {
  const captured = JSON.parse(JSON.stringify(pages));
  captured[0].panels[0].drawingData = 'craftoon-ink:new';
  const result = reuseCapturedPages(pages, captured);
  expect(result[0].panels[0].drawingData).toBe('craftoon-ink:new');
  expect(result[0].panels[0].corners).toBe(pages[0].panels[0].corners);
  captured[0].panels[0].width = 500;
  expect(reuseCapturedPages(pages, captured)[0].panels[0].width).toBe(500);
});
