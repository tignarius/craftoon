import { NativeModules } from 'react-native';
import { ComicPage } from '../types/comic';

export interface SavedStory {
  id: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  pages: ComicPage[];
}

export interface StorySummary {
  libraryOrder?: number;
  id: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  pageCount: number;
  thumbnailData?: string;
  orientation?: 'portrait' | 'landscape';
  canvasSize?: { width: number; height: number };
}

export interface CanvasDraft extends SavedStory {
  pageIndex: number;
  isSaved: boolean;
}

interface StoryLibraryModule {
  retainInkReferences?(references: string[]): Promise<void>;
  pickTracingImage(): Promise<{ uri: string; imageRef?: string; width: number; height: number } | null>;
  saveDraft(draft: CanvasDraft): Promise<void>;
  loadDraft(): Promise<CanvasDraft | null>;
  capturePages(pages: ComicPage[]): Promise<ComicPage[]>;
  restorePages(pages: ComicPage[]): Promise<void>;
  printStory(story: SavedStory): Promise<boolean>;
  emailStory(story: SavedStory): Promise<boolean>;
  saveStory(story: SavedStory): Promise<StorySummary>;
  listStories(): Promise<StorySummary[]>;
  renameStory(id: string, title: string): Promise<StorySummary>;
  reorderStories(ids: string[]): Promise<void>;
  loadStory(id: string): Promise<SavedStory>;
  deleteStory(id: string): Promise<{ token: string }>;
  restoreStory(token: string): Promise<StorySummary>;
}

export const storyLibrary = NativeModules.CraftoonLibrary as StoryLibraryModule;
