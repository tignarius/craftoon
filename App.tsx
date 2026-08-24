import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import SplashScreen from './src/SplashScreen';
import { ComicHeader } from './src/components/ComicHeader';
import { ComicToolbar } from './src/components/ComicToolbar';
import { ComicWorkspace } from './src/components/ComicWorkspace';
import { TemplateModal } from './src/components/TemplateModal';
import { StickerPickerModal } from './src/components/StickerPickerModal';
import {
  ComicPage,
  ComicPanel,
  ComicBubble,
  ComicSticker,
  ToolType,
} from './src/types/comic';

function App(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'editor'>('splash');

  // Comic Studio State
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);

  // Default initial page with 2 starter comic panels
  const initialPanels: ComicPanel[] = [
    {
      id: 'panel-1',
      x: 32,
      y: 80,
      width: width > 100 ? width - 64 : 500,
      height: 340,
      borderWidth: 3,
      borderColor: '#111827',
      borderRadius: 4,
    },
    {
      id: 'panel-2',
      x: 32,
      y: 440,
      width: width > 100 ? width - 64 : 500,
      height: 340,
      borderWidth: 3,
      borderColor: '#111827',
      borderRadius: 4,
    },
  ];

  const [pages, setPages] = useState<ComicPage[]>([
    {
      id: 'page-1',
      panels: initialPanels,
      bubbles: [],
      stickers: [],
    },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = pages[currentPageIndex] || pages[0];

  // Navigation handlers
  const handleNewStory = () => {
    // Generate starter layout fitted to current screen dimensions
    const margin = 32;
    const gap = 20;
    const availableW = Math.max(300, width - margin * 2);
    const availableH = Math.max(400, height - 180);
    const itemH = (availableH - gap) / 2;

    const defaultPanels: ComicPanel[] = [
      {
        id: `panel-${Date.now()}-1`,
        x: margin,
        y: 20,
        width: availableW,
        height: itemH,
        borderWidth: 3,
        borderColor: '#111827',
        borderRadius: 4,
      },
      {
        id: `panel-${Date.now()}-2`,
        x: margin,
        y: 20 + itemH + gap,
        width: availableW,
        height: itemH,
        borderWidth: 3,
        borderColor: '#111827',
        borderRadius: 4,
      },
    ];

    setPages([
      {
        id: `page-${Date.now()}`,
        panels: defaultPanels,
        bubbles: [],
        stickers: [],
      },
    ]);
    setCurrentPageIndex(0);
    setActiveTool('select');
    setCurrentScreen('editor');
  };

  const handleLoadStory = () => {
    setCurrentScreen('editor');
  };

  // Page management
  const handleAddPage = () => {
    const newPage: ComicPage = {
      id: `page-${Date.now()}`,
      panels: [],
      bubbles: [],
      stickers: [],
    };
    const newPages = [...pages, newPage];
    setPages(newPages);
    setCurrentPageIndex(newPages.length - 1);
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const handleClearPage = () => {
    updateCurrentPage({ panels: [], bubbles: [], stickers: [] });
  };

  // Update current page helpers
  const updateCurrentPage = (updates: Partial<ComicPage>) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === currentPageIndex ? { ...p, ...updates } : p))
    );
  };

  const handleApplyTemplate = (newPanels: ComicPanel[]) => {
    updateCurrentPage({ panels: newPanels });
    setActiveTool('select');
  };

  const handleAddBubble = () => {
    const newBubble: ComicBubble = {
      id: `bubble-${Date.now()}`,
      x: width / 2 - 80,
      y: height / 2 - 60,
      width: 160,
      height: 90,
      text: 'Hello!',
      type: 'speech',
      fontSize: 16,
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
    };
    updateCurrentPage({ bubbles: [...currentPage.bubbles, newBubble] });
    setActiveTool('select');
  };

  const handleAddSticker = (stickerData: Omit<ComicSticker, 'id' | 'x' | 'y'>) => {
    const newSticker: ComicSticker = {
      id: `sticker-${Date.now()}`,
      x: width / 2 - 40,
      y: height / 2 - 30,
      ...stickerData,
    };
    updateCurrentPage({ stickers: [...currentPage.stickers, newSticker] });
    setActiveTool('select');
  };

  if (currentScreen === 'editor') {
    return (
      <View style={styles.editorRoot}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safeTop}>
          <ComicHeader
            currentPageIndex={currentPageIndex}
            totalPages={pages.length}
            onBack={() => setCurrentScreen('splash')}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onAddPage={handleAddPage}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onClearPage={handleClearPage}
          />
        </SafeAreaView>

        {/* Main Canvas Workspace */}
        <View style={styles.workspaceWrapper}>
          <ComicWorkspace
            activeTool={activeTool}
            panels={currentPage.panels}
            bubbles={currentPage.bubbles}
            stickers={currentPage.stickers}
            onUpdatePanels={(panels) => updateCurrentPage({ panels })}
            onUpdateBubbles={(bubbles) => updateCurrentPage({ bubbles })}
            onUpdateStickers={(stickers) => updateCurrentPage({ stickers })}
            onSelectTool={(tool) => setActiveTool(tool)}
          />
        </View>

        {/* Floating Bottom Toolbar */}
        <ComicToolbar
          activeTool={activeTool}
          onSelectTool={(tool) => setActiveTool(tool)}
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onOpenStickers={() => setIsStickerModalOpen(true)}
          onAddBubble={handleAddBubble}
        />

        {/* Layout Template Preset Modal */}
        <TemplateModal
          visible={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          canvasWidth={width}
          canvasHeight={height - 80}
          onApplyTemplate={handleApplyTemplate}
        />

        {/* Comic Sticker SFX Modal */}
        <StickerPickerModal
          visible={isStickerModalOpen}
          onClose={() => setIsStickerModalOpen(false)}
          onSelectSticker={handleAddSticker}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <SplashScreen onNewStory={handleNewStory} onLoadStory={handleLoadStory} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  editorRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeTop: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
  workspaceWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default App;