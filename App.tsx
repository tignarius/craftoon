import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import SplashScreen from './src/SplashScreen';
import { ComicReader } from './src/components/ComicReader';
import LibraryScreen from './src/LibraryScreen';
import { storyLibrary, SavedStory } from './src/services/storyLibrary';
import { Header } from './src/components/Header';
import { Workspace } from './src/components/Workspace';
import { CanvasPageNavigation } from './src/components/CanvasPageNavigation';
import { createPanelGrid } from './src/utils/panelGrid';
import {
  ComicPage,
  ComicPanel,
  ComicBubble,
  PanelMode,
  ToolType,
} from './src/types/comic';

function App(): React.JSX.Element {
  const { width, height } = Dimensions.get('window');
  // 1. 처음 앱 시작 시 스플래시 화면 먼저 표시
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'editor' | 'library' | 'reader'>('splash');

  // Comic Studio State (기본 툴: 칸을 드래그해서 그리는 panel 툴)
  const [currentTool, setCurrentTool] = useState<ToolType>('panel');
  const [panelModes, setPanelModes] = useState<Record<string, PanelMode>>({});
  const [history, setHistory] = useState<ComicPanel[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // 2. 사용자가 직접 레이아웃을 그릴 수 있도록 빈 캔버스로 시작
  const [pages, setPages] = useState<ComicPage[]>([
    {
      id: 'page-1',
      panels: [],
      bubbles: [],
    },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = pages[currentPageIndex] || pages[0];
  const canvasBoundsRef = useRef({ width: 900, height: 1200 });
  const handleSheetBoundsChange = useCallback((bounds: { width: number; height: number }) => {
    canvasBoundsRef.current = bounds;
    setPages(previous => previous.map((page, index) => {
      if (index !== currentPageIndex ||
          (page.canvasSize?.width === bounds.width && page.canvasSize?.height === bounds.height)) {
        return page;
      }
      return { ...page, canvasSize: bounds };
    }));
  }, [currentPageIndex]);
  const [storyId, setStoryId] = useState(() => `story-${Date.now()}`);
  const [storyTitle, setStoryTitle] = useState('Untitled comic');
  const savingRef = useRef(false);
  const hasSavedStoryRef = useRef(false);
  const hasCanvasSessionRef = useRef(false);
  const editRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  // Library previews have their own document; browsing never replaces the draft.
  const [previewStory, setPreviewStory] = useState<SavedStory | null>(null);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

  const persistStory = async (title = storyTitle) => {
    const revision = editRevisionRef.current;
    await storyLibrary.saveStory({
      id: storyId, title, pages, updatedAt: new Date().toISOString(),
    });
    hasSavedStoryRef.current = true;
    savedRevisionRef.current = revision;
    setStoryTitle(title);
  };

  const leaveCanvas = async (next: () => void) => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    try {
      if (hasSavedStoryRef.current || pages.some(page => page.panels.length || page.bubbles.length)) {
        await persistStory();
      }
      setPanelModes({});
      next();
    } catch {
      Alert.alert('Could not save', 'Your comic is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const handleSaveStory = () => {
    if (savingRef.current) { return; }
    Alert.prompt('Save comic', 'Choose a name for this comic.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: async (name?: string) => {
        if (savingRef.current) { return; }
        savingRef.current = true;
        try {
          await persistStory(name?.trim() || 'Untitled comic');
          Alert.alert('Saved', 'Your comic is available in Library.');
        } catch {
          Alert.alert('Could not save', 'Your comic is still open. Please try again.');
        } finally { savingRef.current = false; }
      } },
    ], 'plain-text', storyTitle);
  };

  const enterLibrary = async () => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    try {
      if (hasCanvasSessionRef.current && (currentScreen === 'editor' ||
          (currentScreen === 'reader' && !previewStory))) {
        const captured = await storyLibrary.capturePages(pages);
        if (captured.some((page, index) => page.panels.some((panel, panelIndex) =>
          panel.drawingData !== pages[index]?.panels[panelIndex]?.drawingData))) {
          editRevisionRef.current += 1;
        }
        setPages(captured);
      }
      setPreviewStory(null);
      setCurrentScreen('library');
    } catch {
      Alert.alert('Could not open Library', 'Your current canvas is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const handleOpenStory = async (id: string, mode: 'reader' | 'editor') => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    try {
      // A library preview/print may have activated a saved version in PencilKit.
      // Restore the in-memory draft, not its older file, before resuming it.
      if (id === storyId && hasCanvasSessionRef.current) {
        await storyLibrary.restorePages(pages);
        setPreviewStory(null);
        setCurrentScreen(mode);
        return;
      }
      if (mode === 'editor' && hasCanvasSessionRef.current &&
          editRevisionRef.current !== savedRevisionRef.current) {
        const choice = await new Promise<'save' | 'discard' | 'cancel'>(resolve => {
          Alert.alert('Save current comic?',
            `Save changes to "${storyTitle}" before editing another comic?`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
              { text: "Don't Save", style: 'destructive', onPress: () => resolve('discard') },
              { text: 'Save', onPress: () => resolve('save') },
            ], { cancelable: false });
        });
        if (choice === 'cancel') { return; }
        if (choice === 'save') {
          try { await persistStory(); } catch {
            Alert.alert('Could not save', 'Your current comic is still available. Please try again.');
            return;
          }
        }
      }
      const story = await storyLibrary.loadStory(id);
      if (mode === 'reader') {
        setPreviewStory(story);
        setPreviewPageIndex(0);
      } else {
        const pageIndex = previewStory?.id === id ? previewPageIndex : 0;
        hasCanvasSessionRef.current = true;
        hasSavedStoryRef.current = true;
        editRevisionRef.current = 0;
        savedRevisionRef.current = 0;
        setStoryId(story.id);
        setStoryTitle(story.title);
        setPages(story.pages);
        setCurrentPageIndex(pageIndex);
        setHistory([story.pages[pageIndex].panels]);
        setHistoryStep(0);
        setPanelModes({});
        setCurrentTool('panel');
        setPreviewStory(null);
      }
      setCurrentScreen(mode);
    } catch {
      Alert.alert('Could not load', 'Your current comic is still available. Please try again.');
    } finally { savingRef.current = false; }
  };

  const returnToCanvas = async () => {
    if (savingRef.current) { return; }
    if (!hasCanvasSessionRef.current) { handleNewStory(); return; }
    savingRef.current = true;
    try {
      await storyLibrary.restorePages(pages);
      setPreviewStory(null);
      setCurrentScreen('editor');
    } catch {
      Alert.alert('Could not return to Canvas', 'Your current comic is still available. Please try again.');
    } finally { savingRef.current = false; }
  };

  // Helper to update current page panels and add to history
  const setPanelsWithHistory = (newPanels: ComicPanel[]) => {
    editRevisionRef.current += 1;
    const updatedHistory = history.slice(0, historyStep + 1);
    updatedHistory.push(newPanels);
    setHistory(updatedHistory);
    setHistoryStep(updatedHistory.length - 1);

    setPages((prev) =>
      prev.map((p, idx) => (idx === currentPageIndex ? { ...p, panels: newPanels } : p))
    );
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      editRevisionRef.current += 1;
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      const prevPanels = history[prevStep] || [];
      setPages((prev) =>
        prev.map((p, idx) => (idx === currentPageIndex ? { ...p, panels: prevPanels } : p))
      );
      setPanelModes({});
    }
  }, [history, historyStep, currentPageIndex]);

  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      editRevisionRef.current += 1;
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      const nextPanels = history[nextStep] || [];
      setPages((prev) =>
        prev.map((p, idx) => (idx === currentPageIndex ? { ...p, panels: nextPanels } : p))
      );
      setPanelModes({});
    }
  }, [history, historyStep, currentPageIndex]);

  // 사용자가 드래그해서 칸을 그렸을 때 패널 추가
  const handleAddPanel = (rect: { x: number; y: number; width: number; height: number }) => {
    const newPanel: ComicPanel = {
      id: `panel-${Date.now()}`,
      ...rect,
    };
    setPanelsWithHistory([...currentPage.panels, newPanel]);
    // 박스를 생성하면 레이아웃 모드를 유지하여 크기/위치 조절 가능
    setPanelModes({ [newPanel.id]: 'layout' });
  };

  const handleCreateLayout = (columns: number, rows: number) => {
    const bounds = canvasBoundsRef.current;
    const prefix = `panel-grid-${Date.now()}`;
    const panels = createPanelGrid(columns, rows, bounds, prefix);
    if (!panels.length) { return; }
    if (currentPage.panels.length || currentPage.bubbles.length) {
      editRevisionRef.current += 1;
      const page: ComicPage = { id: `page-${Date.now()}`, panels, bubbles: [], canvasSize: bounds };
      setPages(previous => [...previous, page]);
      setCurrentPageIndex(pages.length);
      setHistory([panels]);
      setHistoryStep(0);
    } else {
      setPanelsWithHistory(panels);
    }
    setPanelModes({});
    setCurrentTool('panel');
  };

  const handleUpdatePanel = (id: string, updates: Partial<ComicPanel>) => {
    const panel = currentPage.panels.find(item => item.id === id);
    if (!panel || (Object.keys(updates) as (keyof ComicPanel)[])
      .every(key => panel[key] === updates[key])) { return; }
    const updatedPanels = currentPage.panels.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    setPanelsWithHistory(updatedPanels);
  };

  const handleDeletePanel = (id: string) => {
    const remainingPanels = currentPage.panels.filter((p) => p.id !== id);
    setPanelsWithHistory(remainingPanels);
    const updatedModes = { ...panelModes };
    delete updatedModes[id];
    setPanelModes(updatedModes);
  };

  const handlePanelModeChange = (id: string, mode: PanelMode) => {
    setPanelModes({ [id]: mode });
  };

  // 다른 박스를 클릭해도 일단 레이아웃 모드가 먼저 작동!
  const handlePanelSelect = (id: string) => {
    setPanelModes({ [id]: 'layout' });
  };

  const handleBackgroundTap = () => {
    setPanelModes({});
  };

  // 박스 자체를 다시 클릭하거나 더블클릭하면 드로우 모드로 전환!
  const handlePanelDoubleTap = (id: string) => {
    setPanelModes({ [id]: 'draw' });
  };

  // Bubble operations
  const handleAddBubble = (pos?: { x: number; y: number }) => {
    editRevisionRef.current += 1;
    const newBubble: ComicBubble = {
      id: `bubble-${Date.now()}`,
      x: pos ? pos.x : width / 2 - 80,
      y: pos ? pos.y : height / 2 - 50,
      width: 160,
      height: 90,
      text: '',
    };
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex ? { ...p, bubbles: [...p.bubbles, newBubble] } : p
      )
    );
  };

  const handleUpdateBubble = (id: string, updates: Partial<ComicBubble>) => {
    editRevisionRef.current += 1;
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex
          ? { ...p, bubbles: p.bubbles.map((b) => (b.id === id ? { ...b, ...updates } : b)) }
          : p
      )
    );
  };

  const handleDeleteBubble = (id: string) => {
    editRevisionRef.current += 1;
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex ? { ...p, bubbles: p.bubbles.filter((b) => b.id !== id) } : p
      )
    );
  };

  // Story & Page Actions
  const handleNewStory = () => {
    hasCanvasSessionRef.current = true;
    editRevisionRef.current = 0;
    savedRevisionRef.current = 0;
    setPreviewStory(null);
    hasSavedStoryRef.current = false;
    setStoryId(`story-${Date.now()}`);
    setStoryTitle('Untitled comic');
    // 새 스토리 시작: 빈 캔버스로 진입
    setPages([
      {
        id: `page-${Date.now()}`,
        panels: [],
        bubbles: [],
      },
    ]);
    setHistory([[]]);
    setHistoryStep(0);
    setCurrentPageIndex(0);
    setPanelModes({});
    setCurrentTool('panel');
    setCurrentScreen('editor');
  };

  const handleAddPage = () => {
    editRevisionRef.current += 1;
    const newPage: ComicPage = {
      id: `page-${Date.now()}`,
      panels: [],
      bubbles: [],
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
    setPanelModes({});
    setHistory([[]]);
    setHistoryStep(0);
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      setPanelModes({});
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setPanelModes({});
    }
  };

  const readingPreview = currentScreen === 'reader' ? previewStory : null;
  const displayedPages = readingPreview?.pages ?? pages;
  const displayedPageIndex = readingPreview ? previewPageIndex : currentPageIndex;

  const handlePrint = () => {
    storyLibrary.printStory(readingPreview ?? {
      id: storyId, title: storyTitle, pages, updatedAt: new Date().toISOString(),
    }).catch(() => Alert.alert('Could not print', 'Please try again.'));
  };

  const activePanelId = Object.keys(panelModes).find((id) => panelModes[id]);

  if (currentScreen === 'library') {
    return <LibraryScreen onHome={returnToCanvas} onOpen={handleOpenStory}
      onDeleted={id => {
        if (id === storyId) {
          handleNewStory();
          setCurrentScreen('library');
        }
      }} />;
  }

  if (currentScreen === 'editor' || currentScreen === 'reader') {
    return (
      <View style={styles.editorRoot}>
        <StatusBar hidden />
          <Header
            reading={currentScreen === 'reader'}
            onEdit={() => readingPreview ? handleOpenStory(readingPreview.id, 'editor') : setCurrentScreen('editor')}
            onRead={() => {
              setPreviewStory(null);
              setPanelModes({});
              setCurrentScreen('reader');
            }}
            currentPageIndex={displayedPageIndex}
            totalPages={displayedPages.length}
            onNewStory={() => leaveCanvas(handleNewStory)}
            onLoadStory={enterLibrary}
            onSaveStory={handleSaveStory}
            onPrint={handlePrint}
            onPrevPage={readingPreview ? () => setPreviewPageIndex(index => Math.max(0, index - 1)) : handlePrevPage}
            onNextPage={readingPreview ? () => setPreviewPageIndex(index => Math.min(displayedPages.length - 1, index + 1)) : handleNextPage}
            onAddPage={handleAddPage}
            onCreateLayout={handleCreateLayout}
          />

        {/* 만화 작업 영역 (빈 도화지에서 드래그하여 패널 생성, 패널 안 탭 시 바로 드로잉) */}
        <View style={styles.workspaceWrapper}>
          {currentScreen === 'reader' ? (
            <ComicReader pages={displayedPages} pageIndex={displayedPageIndex}
              onPageChange={readingPreview ? setPreviewPageIndex : setCurrentPageIndex} />
          ) : <Workspace
            onSheetBoundsChange={handleSheetBoundsChange}
            panels={currentPage.panels}
            panelModes={panelModes}
            bubbles={currentPage.bubbles}
            currentTool={currentTool}
            onAddPanel={handleAddPanel}
            onUpdatePanel={handleUpdatePanel}
            onDeletePanel={handleDeletePanel}
            onModeChange={handlePanelModeChange}
            onPanelSelect={handlePanelSelect}
            onPanelDoubleTap={handlePanelDoubleTap}
            onBackgroundTap={handleBackgroundTap}
            onAddBubble={handleAddBubble}
            onUpdateBubble={handleUpdateBubble}
            onDeleteBubble={handleDeleteBubble}
          />}
          {currentScreen === 'editor' && (
            <CanvasPageNavigation currentPageIndex={currentPageIndex} totalPages={pages.length}
              onPrevious={handlePrevPage} onNext={handleNextPage} onAddPage={handleAddPage} />
          )}
        </View>
      </View>
    );
  }

  // 기본 스플래시 화면
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <SplashScreen
        onNewStory={handleNewStory}
        onLoadStory={enterLibrary}
      />
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
    backgroundColor: '#F1F5F9',
  },
  safeHeader: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
  workspaceWrapper: {
    flex: 1,
  },
});

export default App;
