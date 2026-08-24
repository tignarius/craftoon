export type ToolType = 'select' | 'panel' | 'draw' | 'bubble' | 'sticker';

export type BubbleType = 'speech' | 'thought' | 'shout' | 'caption';

export interface ComicPanel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
}

export interface ComicBubble {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  type: BubbleType;
  fontSize: number;
  color: string;
  backgroundColor: string;
}

export interface ComicSticker {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  bgColor: string;
  fontSize: number;
  rotation: number;
}

export interface ComicPage {
  id: string;
  panels: ComicPanel[];
  bubbles: ComicBubble[];
  stickers: ComicSticker[];
}
