export type ToolType = 'panel' | 'pen' | 'bubble' | 'brush' | 'eraser' | 'select' | 'draw' | 'sticker';

export type PanelMode = 'layout' | 'draw' | 'edit';

export interface ComicPanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  drawingData?: string; // 드로잉 base64 데이터 (페이지 전환 및 저장 시 유지)
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
  orientation?: 'portrait' | 'landscape';
  canvasSize?: { width: number; height: number };
  id: string;
  panels: ComicPanel[];
  bubbles: ComicBubble[];
  stickers?: ComicSticker[];
}
