import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  useWindowDimensions,
  SafeAreaView,
  Alert,
} from 'react-native';
import SplashScreen from './src/SplashScreen';
import { Header } from './src/components/Header';
import { Toolbar } from './src/components/Toolbar';
import { Workspace } from './src/components/Workspace';
import {
  ComicPage,
  ComicPanel,
  ComicBubble,
  PanelMode,
  ToolType,
} from './src/types/comic';

function App(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'editor'>('splash');

  // Comic Studio State
  const [currentTool, setCurrentTool] = useState<ToolType>('panel');
  const [panelModes, setPanelModes] = useState<Record<string, PanelMode>>({});
  const [history, setHistory] = useState<ComicPanel[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Pages state
  const [pages, setPages] = useState<ComicPage[]>([
    {
      id: 'page-1',
      panels: [
        {
          id: 'panel-1',
          x: 40,
          y: 30,
          width: width > 100 ? width - 80 : 800,
          height: 380,
        },
        {
          id: 'panel-2',
          x: 40,
          y: 440,
          width: width > 100 ? width - 80 : 800,
          height: 380,
        },
      ],
      bubbles: [],
    },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = pages[currentPageIndex] || pages[0];

  // Helper to update current page panels and add to history
  const setPanelsWithHistory = (newPanels: ComicPanel[]) => {
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
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      const nextPanels = history[nextStep] || [];
      setPages((prev) =>
        prev.map((p, idx) => (idx === currentPageIndex ? { ...p, panels: nextPanels } : p))
      );
      setPanelModes({});
    }
  }, [history, historyStep, currentPageIndex]);

  // Panel creation & manipulation (matching web version)
  const handleAddPanel = (rect: { x: number; y: number; width: number; height: number }) => {
    const newPanel: ComicPanel = {
      id: `panel-${Date.now()}`,
      ...rect,
    };
    setPanelsWithHistory([...currentPage.panels, newPanel]);
    setPanelModes({ [newPanel.id]: 'layout' });
    setCurrentTool('panel');
  };

  const handleUpdatePanel = (id: string, updates: Partial<ComicPanel>) => {
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
    if (mode === 'draw') {
      setCurrentTool('pen');
    } else {
      setCurrentTool('panel');
    }
  };

  const handlePanelSelect = (id: string) => {
    const currentMode = panelModes[id];
    if (!currentMode) {
      setPanelModes({ [id]: 'layout' });
      setCurrentTool('panel');
    }
  };

  const handleBackgroundTap = () => {
    setPanelModes({});
    setCurrentTool('panel');
  };

  // Bubble operations
  const handleAddBubble = (pos?: { x: number; y: number }) => {
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
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex
          ? { ...p, bubbles: p.bubbles.map((b) => (b.id === id ? { ...b, ...updates } : b)) }
          : p
      )
    );
  };

  const handleDeleteBubble = (id: string) => {
    setPages((prev) =>
      prev.map((p, idx) =>
        idx === currentPageIndex ? { ...p, bubbles: p.bubbles.filter((b) => b.id !== id) } : p
      )
    );
  };

  // Story & Page Actions
  const handleNewStory = () => {
    const margin = 32;
    const gap = 20;
    const availableW = Math.max(300, width - margin * 2);
    const availableH = Math.max(400, height - 160);
    const itemH = (availableH - gap) / 2;

    const starterPanels: ComicPanel[] = [
      {
        id: `panel-${Date.now()}-1`,
        x: margin,
        y: 20,
        width: availableW,
        height: itemH,
      },
      {
        id: `panel-${Date.now()}-2`,
        x: margin,
        y: 20 + itemH + gap,
        width: availableW,
        height: itemH,
      },
    ];

    setPages([
      {
        id: `page-${Date.now()}`,
        panels: starterPanels,
        bubbles: [],
      },
    ]);
    setHistory([[starterPanels]]);
    setHistoryStep(0);
    setCurrentPageIndex(0);
    setPanelModes({});
    setCurrentTool('panel');
    setCurrentScreen('editor');
  };

  const handleAddPage = () => {
    const newPage: ComicPage = {
      id: `page-${Date.now()}`,
      panels: [],
      bubbles: [],
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
    setPanelModes({});
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

  const handlePrint = () => {
    Alert.alert('Print / Export', 'Ready to export your comic story page!');
  };

  if (currentScreen === 'editor') {
    return (
      <View style={styles.editorRoot}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safeHeader}>
          <Header
            currentPageIndex={currentPageIndex}
            totalPages={pages.length}
            onNewStory={() => setCurrentScreen('splash')}
            onLoadStory={() => setCurrentScreen('splash')}
            onSaveStory={() => Alert.alert('Saved', 'Story saved successfully!')}
            onPrint={handlePrint}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
            onAddPage={handleAddPage}
          />
        </SafeAreaView>

        {/* Master Workspace Canvas with native Apple PencilKit integration */}
        <View style={styles.workspaceWrapper}>
          <Workspace
            panels={currentPage.panels}
            panelModes={panelModes}
            bubbles={currentPage.bubbles}
            currentTool={currentTool}
            onAddPanel={handleAddPanel}
            onUpdatePanel={handleUpdatePanel}
            onDeletePanel={handleDeletePanel}
            onModeChange={handlePanelModeChange}
            onPanelSelect={handlePanelSelect}
            onBackgroundTap={handleBackgroundTap}
            onAddBubble={handleAddBubble}
            onUpdateBubble={handleUpdateBubble}
            onDeleteBubble={handleDeleteBubble}
          />
        </View>

        {/* Floating Bottom Toolbar */}
        <Toolbar
          currentTool={currentTool}
          onSelectTool={(tool) => {
            setCurrentTool(tool);
            if (tool === 'bubble') {
              handleAddBubble();
            }
          }}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <SplashScreen onNewStory={handleNewStory} onLoadStory={() => setCurrentScreen('editor')} />
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
  safeHeader: {
    backgroundColor: '#FFFFFF',
    zIndex: 100,
  },
  workspaceWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export default App;