import { ComicPage, ComicPanel, TracingImage } from '../types/comic';

export function fitTracingImage(image: { uri: string; imageRef?: string; width: number; height: number },
  canvas: { width: number; height: number }): TracingImage {
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * 0.9;
  const width = image.width * scale;
  const height = image.height * scale;
  return { uri: image.uri, ...(image.imageRef ? { imageRef: image.imageRef } : {}), width, height, x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2, rotation: 0, opacity: 0.35 };
}

export function resizeTracingImage(image: TracingImage, factor: number): TracingImage {
  // Keep the center fixed when zooming, with practical limits in page units.
  const longest = Math.max(image.width, image.height);
  const bounded = Math.max(20, Math.min(12000, longest * factor)) / longest;
  const width = image.width * bounded;
  const height = image.height * bounded;
  return { ...image, width, height, x: image.x + (image.width - width) / 2,
    y: image.y + (image.height - height) / 2 };
}

export function legacyPanelReference(page: ComicPage, panel: ComicPanel): TracingImage | undefined {
  if (panel.tracingImage) { return panel.tracingImage; }
  const image = page.tracingImage;
  return image ? { ...image, x: image.x - panel.x - 2, y: image.y - panel.y - 2 } : undefined;
}

export function migrateTracingPage(page: ComicPage): ComicPage {
  if (!page.tracingImage || page.panels.length === 0) { return page; }
  return { ...page, tracingImage: undefined,
    panels: page.panels.map(panel => ({ ...panel, tracingImage: legacyPanelReference(page, panel) })) };
}

export function gizmoTransform(image: TracingImage, operation: 'rotate' | 'scale',
  start: { x: number; y: number }, delta: { x: number; y: number }): TracingImage {
  const next = { x: start.x + delta.x, y: start.y + delta.y };
  if (operation === 'scale') {
    return resizeTracingImage(image, Math.hypot(next.x, next.y) / Math.max(1, Math.hypot(start.x, start.y)));
  }
  const angle = (Math.atan2(next.y, next.x) - Math.atan2(start.y, start.x)) * 180 / Math.PI;
  return rotateTracingImage(image, angle);
}

export function rotateTracingImage(image: TracingImage, degrees: number): TracingImage {
  return { ...image, rotation: ((image.rotation + degrees) % 360 + 360) % 360 };
}
