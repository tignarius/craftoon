export const FREE_PAGE_LIMIT = 4;
export const FREE_FILE_LIMIT = 1;
export type ProFeature = 'save' | 'pages' | 'export';
export type AppMode = 'canvas' | 'library' | 'reader' | 'welcome';

export const upgradeReasons: Record<ProFeature, string> = {
  save: 'Free includes 1 saved comic. Unlock Pro to save more.',
  pages: 'Free includes 4 pages per comic. Unlock Pro to add more.',
  export: 'Export PDFs, email and print your comics with Craftoon Pro.',
};
export function canAddPage(isPro: boolean, pageCount: number) {
  return isPro || pageCount < FREE_PAGE_LIMIT;
}

export function canSaveStory(isPro: boolean, savedFileCount: number, isExisting: boolean) {
  return isPro || isExisting || savedFileCount < FREE_FILE_LIMIT;
}
