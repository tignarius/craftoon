import { expandCanvasToViewport, canvasSizeFor, coverAspectRatio, fitCanvas, pageCanvasSize, pageOrientation } from '../src/utils/canvasFormat';

test('legacy page sizes determine orientation without changing stored dimensions', () => {
  const page = { id: 'legacy', panels: [], bubbles: [], canvasSize: { width: 1032, height: 672 } };
  expect(pageOrientation(page)).toBe('landscape');
  expect(pageCanvasSize(page)).toEqual(page.canvasSize);
});

test('a legacy page without a canvas size still includes every panel', () => {
  expect(pageCanvasSize({ id: 'old', panels: [{ id: 'p', x: 800, y: 1100, width: 300, height: 400 }], bubbles: [] }))
    .toEqual({ width: 1112, height: 1512 });
});

test.each(['portrait', 'landscape'] as const)('%s canvas fits any viewport without stretching or changing the document', orientation => {
  const size = canvasSizeFor(orientation);
  const original = { ...size };
  for (const viewport of [{ width: 834, height: 1120 }, { width: 1194, height: 760 }]) {
    const scale = fitCanvas(size, viewport);
    expect(size.width * scale).toBeLessThanOrEqual(viewport.width - 56 + 0.01);
    expect(size.height * scale).toBeLessThanOrEqual(viewport.height - 8 + 0.01);
    expect((size.width * scale) / (size.height * scale)).toBeCloseTo(size.width / size.height);
    expect(size).toEqual(original);
  }
});


test('library covers follow their source canvas aspect ratio', () => {
  expect(coverAspectRatio({ canvasSize: { width: 900, height: 1200 } })).toBe(0.75);
  expect(coverAspectRatio({ canvasSize: { width: 1200, height: 900 } })).toBeCloseTo(4 / 3);
  expect(coverAspectRatio({ canvasSize: { width: 1100, height: 700 } })).toBeCloseTo(11 / 7);
  expect(coverAspectRatio({ orientation: 'landscape' })).toBeCloseTo(4 / 3);
  expect(coverAspectRatio({ canvasSize: { width: 0, height: 0 } })).toBe(0.75);
});


test.each([
  ['landscape', { width: 1024, height: 712 }],
  ['portrait', { width: 768, height: 968 }],
] as const)('%s canvas uses more of the long screen dimension without changing the page', (orientation, viewport) => {
  const size = canvasSizeFor(orientation);
  const priorScale = Math.min((viewport.width - 72) / size.width, (viewport.height - 24) / size.height);
  const scale = fitCanvas(size, viewport);
  const edge = orientation === 'landscape' ? size.width : size.height;
  expect(edge * scale).toBeGreaterThan(edge * priorScale + 10);
  expect(size).toEqual(orientation === 'landscape' ? { width: 1200, height: 900 } : { width: 900, height: 1200 });
});


test('landscape paper expands toward the side controls without scaling document coordinates', () => {
  const size = { width: 1200, height: 900 };
  const viewport = { width: 1194, height: 760 };
  const expanded = expandCanvasToViewport(size, viewport);
  const scale = fitCanvas(expanded, viewport);
  expect(expanded.width).toBeGreaterThan(size.width);
  expect(expanded.height).toBe(size.height);
  expect(expanded.width * scale).toBeCloseTo(viewport.width - 56, 0);
  expect(size).toEqual({ width: 1200, height: 900 });
  expect(expandCanvasToViewport(expanded, viewport)).toBe(expanded);
  expect(expandCanvasToViewport(expanded, { width: 834, height: 1194 })).toBe(expanded);
  const portrait = { width: 900, height: 1200 };
  expect(expandCanvasToViewport(portrait, viewport)).toBe(portrait);
});


test('portrait paper expands vertically to the viewport while preserving its width and never shrinking', () => {
  const size = { width: 900, height: 1200 };
  const viewport = { width: 768, height: 1000 };
  const expanded = expandCanvasToViewport(size, viewport);
  expect(expanded.width).toBe(size.width);
  expect(expanded.height).toBeGreaterThan(size.height);
  expect(expanded.height * fitCanvas(expanded, viewport)).toBeCloseTo(viewport.height - 8);
  expect(expandCanvasToViewport(expanded, viewport)).toBe(expanded);
  expect(expandCanvasToViewport(expanded, { width: 768, height: 900 })).toBe(expanded);
  expect(size).toEqual({ width: 900, height: 1200 });
});
