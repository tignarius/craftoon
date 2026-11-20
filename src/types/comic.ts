export type ToolType = 'panel' | 'pen' | 'bubble' | 'brush' | 'eraser' | 'select' | 'draw' | 'sticker';

export type PanelMode = 'layout' | 'draw';

export type PanelPoint = { x: number; y: number };
// Clockwise normalized corners: top-left, top-right, bottom-right, bottom-left.
export type PanelCorners = [PanelPoint, PanelPoint, PanelPoint, PanelPoint];
export type PanelBorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type PanelInkGeometry = { x?: number; y?: number; width: number; height: number; corners?: PanelCorners; sourceDrawingData?: string };

export interface ComicPanel {
  artworkLocked?: boolean; // Keep artwork fixed in page coordinates while editing the panel.
  corners?: PanelCorners;
  shapeRevision?: number;
  resizeInk?: boolean;
  warpInk?: boolean;
  adjustmentSide?: 'left' | 'right';
  borderStyle?: PanelBorderStyle;
  layoutSource?: 'manual' | 'template';
  tracingImage?: TracingImage;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  drawingHasStrokes?: boolean; // Native capture distinguishes blank PencilKit archives from artwork.
  drawingData?: string; // Native immutable ink reference; legacy Base64 remains readable.
}

export interface ComicBubble {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tailX?: number;
  tailY?: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export interface ComicSticker {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  uri?: string;
  text?: string;
  color?: string;
  bgColor?: string;
  fontSize?: number;
  rotation?: number;
}

export interface ComicPage {
  // Legacy page reference, retained only until it can be migrated into panels.
  tracingImage?: TracingImage;
  orientation?: 'portrait' | 'landscape';
  canvasSize?: { width: number; height: number };
  id: string;
  panels: ComicPanel[];
  bubbles: ComicBubble[];
  stickers?: ComicSticker[];
}

// Native photo files survive recovery, saving and restarts; legacy data URIs remain readable.
// Coordinates are local to the panel's content; panel movement carries the image.
export interface TracingImage {
  imageRef?: string; // Persistent native photo identifier; uri is resolved on load.
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible?: boolean;
}
