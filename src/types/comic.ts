export type ToolType = 'panel' | 'pen' | 'bubble' | 'brush' | 'eraser';

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

export interface ComicPage {
  id: string;
  panels: ComicPanel[];
  bubbles: ComicBubble[];
}
