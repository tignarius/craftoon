import { NativeModules } from 'react-native';
import { ComicPage } from '../types/comic';

export interface SavedStory {
  id: string;
  title: string;
  updatedAt: string;
  pages: ComicPage[];
}

export interface StorySummary {
  id: string;
  title: string;
  updatedAt: string;
  pageCount: number;
  thumbnailData?: string;
}

interface StoryLibraryModule {
  capturePages(pages: ComicPage[]): Promise<ComicPage[]>;
  restorePages(pages: ComicPage[]): Promise<void>;
  printStory(story: SavedStory): Promise<boolean>;
  saveStory(story: SavedStory): Promise<StorySummary>;
  listStories(): Promise<StorySummary[]>;
  loadStory(id: string): Promise<SavedStory>;
  deleteStory(id: string): Promise<{ token: string }>;
  restoreStory(token: string): Promise<StorySummary>;
}

export const storyLibrary = NativeModules.CraftoonLibrary as StoryLibraryModule;
