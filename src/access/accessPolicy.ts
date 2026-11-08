export const FREE_PAGE_LIMIT = 4;
export type ProFeature = 'save' | 'pages' | 'export';
export type AppMode = 'canvas' | 'library' | 'reader' | 'welcome';

export const upgradeReasons: Record<ProFeature, string> = {
  save: 'Save this comic to your Library with Craftoon Pro.',
  pages: 'Free includes 4 pages per comic. Unlock Pro to add more.',
  export: 'Export PDFs, email and print your comics with Craftoon Pro.',
};
export function canAddPage(isPro: boolean, pageCount: number) {
  return isPro || pageCount < FREE_PAGE_LIMIT;
}
