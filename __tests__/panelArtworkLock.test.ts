import { lockedArtworkGeometry } from '../src/utils/panelArtworkLock';
import { autoArrangePanels } from '../src/utils/autoArrangePanels';
import { mergeGeometryInk } from '../src/utils/geometryInkHistory';
import type { ComicPanel, ComicPage } from '../src/types/comic';
const panel: ComicPanel = { id: 'a', x: 100, y: 120, width: 300, height: 300, artworkLocked: true,
  drawingData: 'craftoon-ink:before', tracingImage: { uri: 'file:///reference.jpg', x: 25, y: 30, width: 150, height: 160, rotation: 10, opacity: 0.4 } };

test('locked resizing keeps reference scale and disables ink resize and warp', () => {
  const update = lockedArtworkGeometry(panel, { width: 500, height: 150, resizeInk: true, warpInk: true,
    tracingImage: { ...panel.tracingImage!, width: 999 } });
  expect(update).toMatchObject({ width: 500, height: 150, resizeInk: false, warpInk: false });
  expect(update.tracingImage).toBe(panel.tracingImage);
  expect(panel.width).toBe(300);
});

test('locked reference images keep their page position during left resizing and panel movement', () => {
  const update = lockedArtworkGeometry(panel, { x: 60, y: 200, width: 340 });
  expect(update.tracingImage).toMatchObject({ x: 65, y: -50, width: 150, height: 160, rotation: 10 });
  expect(update.x! + update.tracingImage!.x).toBe(panel.x + panel.tracingImage!.x);
  expect(update.y! + update.tracingImage!.y).toBe(panel.y + panel.tracingImage!.y);
});

test('unlocked panels retain their normal transform behavior', () => {
  const update = { width: 500, resizeInk: true, warpInk: true };
  expect(lockedArtworkGeometry({ ...panel, artworkLocked: false }, update)).toBe(update);
});

test('auto arrange respects the lock independently for each panel', () => {
  const locked = { ...panel, y: 100, width: 220, height: 200 };
  const unlocked = { ...panel, id: 'b', x: 500, y: 100, width: 250, height: 200, artworkLocked: false };
  const result = autoArrangePanels([locked, unlocked], { width: 900, height: 1200 })!;
  expect(result[0]).toMatchObject({ artworkLocked: true, resizeInk: false, warpInk: false });
  expect(result[0].x + result[0].tracingImage!.x).toBe(locked.x + locked.tracingImage!.x);
  expect(result[0].tracingImage!.width).toBe(locked.tracingImage!.width);
  expect(result[1]).toMatchObject({ resizeInk: true, warpInk: true });
});

test('delayed locked-move ink updates do not overwrite an Undo snapshot at the old page position', () => {
  const before: ComicPage[] = [{ id: 'p', panels: [panel], bubbles: [] }];
  const after = [{ ...before[0], panels: [{ ...panel, x: 180, y: 220 }] }];
  const geometry = { x: 180, y: 220, width: 296, height: 296, sourceDrawingData: panel.drawingData };
  expect(mergeGeometryInk(before, 'a', 'craftoon-ink:after', geometry)).toBe(before);
  expect(mergeGeometryInk(after, 'a', 'craftoon-ink:after', geometry)[0].panels[0].drawingData).toBe('craftoon-ink:after');
});
