import { canvasSizeFor, coverAspectRatio, fitCanvas, pageCanvasSize, pageOrientation } from '../src/utils/canvasFormat';

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
    expect(size.width * scale).toBeLessThanOrEqual(viewport.width - 72 + 0.01);
    expect(size.height * scale).toBeLessThanOrEqual(viewport.height - 24 + 0.01);
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
