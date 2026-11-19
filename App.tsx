import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  useWindowDimensions,
  Alert,
  Keyboard,
  ActivityIndicator,
  AppState,
} from 'react-native';
import SplashScreen from './src/SplashScreen';
import { ProProvider, usePro } from './src/access/ProProvider';
import { canAddPage, canSaveStory, FREE_PAGE_LIMIT } from './src/access/accessPolicy';
import { ComicReader } from './src/components/ComicReader';
import LibraryScreen from './src/LibraryScreen';
import { storyLibrary, SavedStory } from './src/services/storyLibrary';
import { CanvasOrientationPicker, CanvasPickerAnchor } from './src/components/CanvasOrientationPicker';
import { canvasSizeFor, CanvasOrientation, pageCanvasSize, pageOrientation } from './src/utils/canvasFormat';
import { lockCanvasOrientation } from './src/services/canvasOrientation';
import { sameComicPages } from './src/utils/comicContent';
import { neighboringHandleSide } from './src/utils/panelGeometry';
import { mergeGeometryInk } from './src/utils/geometryInkHistory';
import { boundHistory } from './src/utils/historyBudget';
import { SaveComicDialog } from './src/components/SaveComicDialog';
import { Header } from './src/components/Header';
import { Workspace } from './src/components/Workspace';
import { CanvasPageNavigation } from './src/components/CanvasPageNavigation';
import { createPanelGrid } from './src/utils/panelGrid';
import { fitTracingImage, migrateTracingPage, legacyPanelReference } from './src/utils/tracingImage';
import {
  ComicPage,
  ComicPanel,
  ComicBubble,
  PanelMode,
  ToolType,
  TracingImage,
} from './src/types/comic';

function CraftoonApp(): React.JSX.Element {
  const { status: { isPro }, requirePro, infoOpen } = usePro();
  const { width, height } = useWindowDimensions();
  const [appState, setAppState] = useState(AppState.currentState ?? 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  // 1. 처음 앱 시작 시 스플래시 화면 먼저 표시
  const [pageMenuDismissSignal, setPageMenuDismissSignal] = useState(0);
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'editor' | 'library' | 'reader'>('splash');

  // Comic Studio State (기본 툴: 칸을 드래그해서 그리는 panel 툴)
  const formatAnchorRef = useRef<CanvasPickerAnchor | undefined>(undefined);
  const [formatPicker, setFormatPicker] = useState<'new' | 'reset' | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('panel');
  const [panelModes, setPanelModes] = useState<Record<string, PanelMode>>({});
  useEffect(() => { if (infoOpen) { setPanelModes({}); } }, [infoOpen]);

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
  const latestPages = useRef(pages);
  latestPages.current = pages;
  const activePageId = useRef(currentPage.id);
  activePageId.current = currentPage.id;
  const [editingTracingPanelId, setEditingTracingPanelId] = useState<string | null>(null);
  const tracingUpdateQueue = useRef<Promise<void>>(Promise.resolve());
  const tracingUpdateWorker = useRef<(id: string, image: TracingImage | undefined) => Promise<void>>(async () => {});
  const appMounted = useRef(true);
  useEffect(() => { appMounted.current = true; return () => { appMounted.current = false; }; }, []);
  useEffect(() => {
    setEditingTracingPanelId(id => id && panelModes[id] !== 'draw' ? null : id);
  }, [panelModes]);
  const [importingTracingImage, setImportingTracingImage] = useState(false);
  const importingTracingRef = useRef(false);
  useEffect(() => { setEditingTracingPanelId(null); }, [currentPage.id, currentScreen, infoOpen]);
  const canvasBoundsRef = useRef({ width: 900, height: 1200 });
  const handleSheetBoundsChange = useCallback((bounds: { width: number; height: number }) => {
    canvasBoundsRef.current = bounds;
    setPages(previous => previous.map((page, index) => {
      if (index !== currentPageIndex) { return page; }
      const stored = page.canvasSize;
      if (stored) {
        const expandsWidth = pageOrientation(page) === 'landscape' && bounds.width > stored.width && bounds.height === stored.height;
        const expandsHeight = pageOrientation(page) === 'portrait' && bounds.height > stored.height && bounds.width === stored.width;
        if (!expandsWidth && !expandsHeight) { return page; }
      }
      return { ...page, canvasSize: bounds, orientation: pageOrientation(page) };
    }));
  }, [currentPageIndex]);
  const [storyId, setStoryId] = useState(() => `story-${Date.now()}`);
  const [storyTitle, setStoryTitle] = useState('Untitled comic');
  const savingRef = useRef(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setSaveConfirmed(false);
    return () => {
      if (saveFeedbackTimer.current) { clearTimeout(saveFeedbackTimer.current); }
    };
  }, [storyId, currentScreen]);
  const emailingRef = useRef(false);
  const [emailing, setEmailing] = useState(false);
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submittingName, setSubmittingName] = useState(false);
  const submittingNameRef = useRef(false);
  const hasSavedStoryRef = useRef(false);
  const newAfterSaveRef = useRef(false);
  const layoutAfterSaveRef = useRef<(() => void) | null>(null);
  const hasCanvasSessionRef = useRef(false);
  const editRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  // Library previews have their own document; browsing never replaces the draft.
  const [previewStory, setPreviewStory] = useState<SavedStory | null>(null);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const recoveryErrorShownRef = useRef(false);

  type Snapshot = {
    pages: ComicPage[]; pageIndex: number; storyId: string; title: string; saved: boolean;
  };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const historyState = useRef({ entries: history, step: historyStep });
  historyState.current = { entries: history, step: historyStep };
  useEffect(() => {
    const subscription = AppState.addEventListener('memoryWarning', () => {
      const retained = history.slice(Math.max(0, historyStep - 1), historyStep + 1);
      setHistory(retained);
      setHistoryStep(retained.length - 1);
    });
    return () => subscription.remove();
  }, [history, historyStep]);
  useEffect(() => {
    if (!storyLibrary.retainInkReferences) { return; }
    const retained = new Set<string>();
    for (const items of [pages, ...history.map(entry => entry.pages)]) {
      for (const page of items) {
        for (const panel of page.panels) {
          if (panel.drawingData?.startsWith('craftoon-ink:')) { retained.add(panel.drawingData); }
        }
      }
    }
    storyLibrary.retainInkReferences([...retained]).catch(() => { /* Keep ink if cleanup cannot run. */ });
  }, [pages, history]);
  const snapshot = (items = pages, pageIndex = currentPageIndex): Snapshot => ({
    pages: items, pageIndex, storyId, title: storyTitle, saved: hasSavedStoryRef.current,
  });
  const recordChange = (next: Snapshot, previous = snapshot()) => {
    // Queued image updates can finish in one React batch. Preserve each Undo
    // step rather than reading the history from an earlier render.
    const latest = historyState.current;
    const past = latest.step < 0 ? [previous] : latest.entries.slice(0, latest.step + 1);
    // Refresh the current entry with captured ink and the latest viewport.
    past[past.length - 1] = previous;
    const updated = boundHistory([...past, next]);
    historyState.current = { entries: updated, step: updated.length - 1 };
    setHistory(updated);
    setHistoryStep(updated.length - 1);
    editRevisionRef.current += 1;
  };
  const changePages = (items: ComicPage[], pageIndex = currentPageIndex, previousPages = pages) => {
    recordChange(snapshot(items, pageIndex), snapshot(previousPages));
    setPages(items);
    setCurrentPageIndex(pageIndex);
  };

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        // Older native development builds may not have the recovery bridge yet.
        const draft = await storyLibrary.loadDraft?.();
        if (!active || !draft?.pages.length) { return; }
        // Choosing a format or adding empty pages creates a checkpoint too.
        // Resume only actual work; leave empty unnamed sessions at the splash.
        const hasWork = draft.pages.some(page => page.panels.length > 0 || page.bubbles.length > 0 ||
          !!page.stickers?.length || !!page.tracingImage);
        if (!draft.isSaved && !hasWork) { return; }
        if (draft.isSaved) {
          try {
            const saved = await storyLibrary.loadStory(draft.id);
            if (!active) { return; }
            // A fully saved document is available in Library. Start fresh;
            // preserve recovery when later edits differ or Library cannot load.
            if (sameComicPages(draft.pages, saved.pages)) { return; }
          } catch { /* Keep the recovery copy available if Library is missing. */ }
        }
        if (!active) { return; }
        await storyLibrary.restorePages(draft.pages);
        if (!active) { return; }
        hasCanvasSessionRef.current = true;
        hasSavedStoryRef.current = draft.isSaved === true;
        editRevisionRef.current = 1;
        savedRevisionRef.current = 0;
        setStoryId(draft.id);
        setStoryTitle(draft.title || 'Untitled comic');
        setPages(draft.pages.map(migrateTracingPage));
        setCurrentPageIndex(Number.isInteger(draft.pageIndex)
          ? Math.max(0, Math.min(draft.pageIndex, draft.pages.length - 1)) : 0);
        setHistory([]);
        setHistoryStep(-1);
        setPanelModes({});
        setCurrentTool('panel');
        setPreviewStory(null);
        setCurrentScreen('editor');
      } catch {
        if (active) {
          Alert.alert('Could not restore canvas', 'The last recovery file is preserved. Your saved comics are still in Library.');
        }
      } finally { if (active) { setRecoveryReady(true); } }
    };
    restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!recoveryReady || !hasCanvasSessionRef.current || !storyLibrary.saveDraft) { return; }
    let active = true;
    // Keep native recovery metadata current for all drafts, including unnamed
    // comics. Native checkpoints add ink that has not reached JavaScript yet.
    storyLibrary.saveDraft({ id: storyId, title: storyTitle, pages,
      pageIndex: currentPageIndex, isSaved: hasSavedStoryRef.current,
      updatedAt: new Date().toISOString(),
    }).then(() => { recoveryErrorShownRef.current = false; }).catch(() => {
      if (!active || recoveryErrorShownRef.current) { return; }
      recoveryErrorShownRef.current = true;
      Alert.alert('Could not protect canvas', 'Please save your comic before closing the app. Automatic recovery could not be written.');
    });
    return () => { active = false; };
  }, [recoveryReady, storyId, storyTitle, pages, currentPageIndex]);

  const ensureSaveAllowed = async (mode: 'canvas' | 'library' = 'canvas') => {
    if (!isPro && pages.length > FREE_PAGE_LIMIT) { requirePro('pages', mode); return false; }
    if (isPro || hasSavedStoryRef.current) { return true; }
    try {
      const saved = await storyLibrary.listStories();
      if (canSaveStory(isPro, saved.length, saved.some(item => item.id === storyId))) { return true; }
      requirePro('save', mode);
    } catch {
      Alert.alert('Could not check Library', 'Your comic is still open. Please try saving again.');
    }
    return false;
  };

  const persistStory = useCallback(async (title = storyTitle, items = pages) => {
    const revision = editRevisionRef.current;
    await storyLibrary.saveStory({
      id: storyId, title, pages: items, updatedAt: new Date().toISOString(),
    });
    hasSavedStoryRef.current = true;
    savedRevisionRef.current = revision;
    setStoryTitle(title);
  }, [storyId, storyTitle, pages]);

  useEffect(() => {
    if ((!isPro && pages.length > FREE_PAGE_LIMIT) || saveDialogVisible || currentScreen !== 'editor' || !hasSavedStoryRef.current ||
        editRevisionRef.current === savedRevisionRef.current) { return; }
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      if (savingRef.current) { timer = setTimeout(save, 200); return; }
      savingRef.current = true;
      persistStory().catch(() => {
        Alert.alert('Could not save', 'Your changes are still open. Please try saving again.');
      }).finally(() => { savingRef.current = false; });
    };
    timer = setTimeout(save, 1000);
    return () => clearTimeout(timer);
  }, [pages, currentScreen, persistStory, saveDialogVisible, isPro]);

  const handleSaveStory = async () => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    if (!await ensureSaveAllowed()) { savingRef.current = false; return; }
    if (hasSavedStoryRef.current) {
      savingRef.current = true;
      if (saveFeedbackTimer.current) { clearTimeout(saveFeedbackTimer.current); }
      setSaveConfirmed(false);
      return persistStory().then(() => {
        setSaveConfirmed(true);
        saveFeedbackTimer.current = setTimeout(() => setSaveConfirmed(false), 1000);
      }).catch(() => {
        Alert.alert('Could not save', 'Your comic is still open. Please try again.');
      }).finally(() => { savingRef.current = false; });
    }
    // Reserve the document while naming it. Autosave/navigation cannot steal
    // the save lock, and PencilKit relinquishes its first responder/tool palette.
    savingRef.current = true;
    setPanelModes({});
    setSaveName(storyTitle);
    setSaveError(null);
    setSaveDialogVisible(true);
  };

  const cancelSaveName = () => {
    if (submittingNameRef.current) { return; }
    Keyboard.dismiss();
    setSaveDialogVisible(false);
    newAfterSaveRef.current = false;
    layoutAfterSaveRef.current = null;
    savingRef.current = false;
  };

  const confirmSaveName = async () => {
    if (submittingNameRef.current) { return; }
    submittingNameRef.current = true;
    setSubmittingName(true);
    setSaveError(null);
    Keyboard.dismiss();
    try {
      if (!await ensureSaveAllowed()) { return; }
      await persistStory(saveName.trim() || 'Untitled comic');
      setSaveDialogVisible(false);
      savingRef.current = false;
      const applyLayout = layoutAfterSaveRef.current;
      layoutAfterSaveRef.current = null;
      if (applyLayout) { applyLayout(); }
      if (newAfterSaveRef.current) {
        newAfterSaveRef.current = false;
        setFormatPicker('new');
      }
    } catch {
      // Keep the entered name and the canvas so Save can be retried immediately.
      setSaveError('Could not save. Your comic is still open. Please try again.');
    } finally {
      submittingNameRef.current = false;
      setSubmittingName(false);
    }
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
        if (hasSavedStoryRef.current && (isPro || pages.length <= FREE_PAGE_LIMIT)) { await persistStory(storyTitle, captured); }
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
        if (hasSavedStoryRef.current && (isPro || pages.length <= FREE_PAGE_LIMIT)) {
          await persistStory();
        } else {
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
            if (!await ensureSaveAllowed('library')) { return; }
            try { await persistStory(); } catch {
              Alert.alert('Could not save', 'Your current comic is still available. Please try again.');
              return;
            }
          }
        }
      }
      const story = await storyLibrary.loadStory(id);
      if (mode === 'reader') {
        setPreviewStory(story);
        setPreviewPageIndex(0);
      } else {
        const pageIndex = previewStory?.id === id ? previewPageIndex : 0;
        await storyLibrary.restorePages(story.pages);
        hasCanvasSessionRef.current = true;
        hasSavedStoryRef.current = true;
        editRevisionRef.current = 0;
        savedRevisionRef.current = 0;
        setStoryId(story.id);
        setStoryTitle(story.title);
        setPages(story.pages.map(migrateTracingPage));
        setCurrentPageIndex(pageIndex);
        setHistory([]);
        setHistoryStep(-1);
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
    if (!hasCanvasSessionRef.current) { requestFormat('new'); return; }
    savingRef.current = true;
    try {
      await storyLibrary.restorePages(pages);
      setPreviewStory(null);
      setCurrentScreen('editor');
    } catch {
      Alert.alert('Could not return to Canvas', 'Your current comic is still available. Please try again.');
    } finally { savingRef.current = false; }
  };

  const setPanelsWithHistory = (newPanels: ComicPanel[]) => {
    changePages(pages.map((page, index) => index === currentPageIndex
      ? migrateTracingPage({ ...page, panels: newPanels }) : page));
  };

  const restoreHistory = async (step: number) => {
    if (savingRef.current || step < 0 || step >= history.length) { return; }
    savingRef.current = true;
    try {
      const target = history[step];
      await storyLibrary.restorePages(target.pages);
      setPages(target.pages);
      setCurrentPageIndex(target.pageIndex);
      if (target.storyId !== storyId) {
        setStoryId(target.storyId);
        setStoryTitle(target.title);
        hasSavedStoryRef.current = target.saved;
      }
      setHistoryStep(step);
      editRevisionRef.current += 1;
      setPanelModes({});
    } catch {
      Alert.alert('Could not restore', 'Your current canvas is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const handleUndo = () => restoreHistory(historyStep - 1);
  const handleRedo = () => restoreHistory(historyStep + 1);

  const handleImportTracingImage = async (panelId: string) => {
    if (!currentPage.panels.some(panel => panel.id === panelId) || importingTracingRef.current || savingRef.current) { return; }
    importingTracingRef.current = true;
    setImportingTracingImage(true);
    const targetId = currentPage.id;
    try {
      const picked = await storyLibrary.pickTracingImage();
      if (!picked || targetId !== activePageId.current) { return; }
      const captured = await storyLibrary.capturePages(latestPages.current);
      if (targetId !== activePageId.current) { return; }
      if (!captured.find(page => page.id === targetId)?.panels.some(panel => panel.id === panelId)) { return; }
      changePages(captured.map(page => page.id === targetId ? {
        ...page, panels: page.panels.map(panel => panel.id === panelId ? {
          ...panel, tracingImage: fitTracingImage(picked, { width: Math.max(1, panel.width - 4), height: Math.max(1, panel.height - 4) }),
        } : panel),
      } : page), currentPageIndex, captured);
      setPanelModes({ [panelId]: 'draw' });
      setEditingTracingPanelId(null);
    } catch (error) {
      Alert.alert('Could not import image', error instanceof Error
        ? error.message : 'This photo could not be loaded. Please try selecting it again.');
    } finally { importingTracingRef.current = false; setImportingTracingImage(false); }
  };
  const applyTracingImageChange = async (panelId: string, tracingImage: TracingImage | undefined) => {
    savingRef.current = true;
    const targetId = currentPage.id;
    try {
      // Capture native ink before recording history, including strokes whose
      // drawing-change callback has not reached JavaScript yet.
      const captured = await storyLibrary.capturePages(latestPages.current);
      if (targetId !== activePageId.current) { return; }
      if (!captured.find(page => page.id === targetId)?.panels.some(panel => panel.id === panelId)) { return; }
      const updated = captured.map(page => page.id === targetId ? { ...page,
        panels: page.panels.map(panel => panel.id === panelId ? { ...panel, tracingImage } : panel),
      } : page);
      changePages(updated, currentPageIndex, captured);
      latestPages.current = updated;
      if (!tracingImage) { setEditingTracingPanelId(null); }
    } catch {
      Alert.alert('Could not update reference image', 'Your drawing is preserved. Please try again.');
    } finally { savingRef.current = false; }
  };
  tracingUpdateWorker.current = applyTracingImageChange;
  const handleTracingImageChange = (panelId: string, tracingImage: TracingImage | undefined) => {
    const targetId = currentPage.id;
    const operation = tracingUpdateQueue.current.then(async () => {
      // Reference visibility must not be silently dropped during another
      // capture/autosave. Serialize updates and use the newest render context.
      while (appMounted.current && targetId === activePageId.current && savingRef.current) {
        await new Promise<void>(resolve => setTimeout(resolve, 16));
      }
      if (!appMounted.current || targetId !== activePageId.current) { return; }
      await tracingUpdateWorker.current(panelId, tracingImage);
    });
    tracingUpdateQueue.current = operation.catch(() => {});
    return operation;
  };
  const handleTracingEditingChange = (panelId: string, editing: boolean) => {
    setPanelModes({ [panelId]: 'draw' });
    setEditingTracingPanelId(editing ? panelId : null);
  };

  // 사용자가 드래그해서 칸을 그렸을 때 패널 추가
  const handleAddPanel = (rect: Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'>) => {
    const newPanel: ComicPanel = {
      id: `panel-${Date.now()}`,
      layoutSource: 'manual',
      ...rect,
    };
    newPanel.adjustmentSide = neighboringHandleSide(newPanel, currentPage.panels);
    newPanel.tracingImage = legacyPanelReference(currentPage, newPanel);
    setPanelsWithHistory([...currentPage.panels, newPanel]);
    // 박스를 생성하면 레이아웃 모드를 유지하여 크기/위치 조절 가능
    setPanelModes({ [newPanel.id]: 'layout' });
  };

  const handleCreateLayout = async (columns: number, rows: number) => {
    if (savingRef.current) { return; }
    const addingPage = currentPage.panels.length > 0 || currentPage.bubbles.length > 0;
    if (addingPage && !canAddPage(isPro, pages.length)) { requirePro('pages', 'canvas'); return; }
    const bounds = pageCanvasSize(addingPage ? pages[0] : currentPage);
    const prefix = `panel-grid-${Date.now()}`;
    const panels = createPanelGrid(columns, rows, bounds, prefix);
    if (!panels.length) { return; }
    savingRef.current = true;
    let awaitingChoice = false;
    setPanelModes({});
    try {
      // Include the latest native strokes before offering to save the old layout.
      const captured = await storyLibrary.capturePages(latestPages.current);
      setPages(captured);
      const applyLayout = () => {
        if (addingPage) {
          const page: ComicPage = { id: `page-${Date.now()}`, panels, bubbles: [], canvasSize: bounds, orientation: pageOrientation(captured[0]) };
          changePages([...captured, page], captured.length, captured);
        } else {
          changePages(captured.map((page, index) => index === currentPageIndex
            ? migrateTracingPage({ ...page, panels }) : page), currentPageIndex, captured);
        }
        setPanelModes({});
        setCurrentTool('panel');
      };
      const hasWork = captured.some(page => page.bubbles.length > 0 || !!page.stickers?.length ||
        !!page.tracingImage || page.panels.some(panel =>
          // Older template panels predate layoutSource but have a dedicated ID prefix.
          (panel.layoutSource ?? (panel.id.startsWith('panel-grid-') ? 'template' : 'manual')) === 'manual' ||
          !!panel.tracingImage ||
          (panel.drawingHasStrokes ?? !!panel.drawingData)));
      const hasUnsavedChanges = !hasSavedStoryRef.current ||
        editRevisionRef.current !== savedRevisionRef.current || !sameComicPages(captured, pages);
      if (!hasWork || !hasUnsavedChanges) { applyLayout(); return; }
      awaitingChoice = true;
      Alert.alert('Save current comic?', 'Save your current comic before applying a layout template?', [
        { text: 'Cancel', style: 'cancel', onPress: () => { savingRef.current = false; } },
        { text: "Don't Save", style: 'destructive', onPress: () => {
          applyLayout();
          savingRef.current = false;
        } },
        { text: 'Save', onPress: async () => {
          if (!await ensureSaveAllowed()) { savingRef.current = false; return; }
          layoutAfterSaveRef.current = applyLayout;
          setSaveName(storyTitle);
          setSaveError(null);
          setSaveDialogVisible(true);
        } },
      ], { cancelable: false });
    } catch {
      Alert.alert('Could not apply template', 'Your current comic is still open. Please try again.');
    } finally { if (!awaitingChoice) { savingRef.current = false; } }
  };

  const handleCommitPanelGeometry = async (id: string, updates: Partial<ComicPanel>) => {
    const targetId = currentPage.id;
    try {
      // Local drag previews have not transformed ink yet. Capture the original
      // native strokes so Undo restores both geometry and artwork together.
      const captured = await storyLibrary.capturePages(latestPages.current);
      if (targetId !== activePageId.current) { return; }
      const target = captured.find(page => page.id === targetId)?.panels.find(panel => panel.id === id);
      if (!target) { return; }
      changePages(captured.map(page => page.id === targetId ? { ...page,
        panels: [...page.panels.filter(panel => panel.id !== id), { ...target, ...updates }],
      } : page), currentPageIndex, captured);
    } catch {
      Alert.alert('Could not update panel', 'Your drawing is preserved. Please try again.');
    }
  };
  const handleGeometryInkChange = (id: string, drawingData: string, geometry: import('./src/types/comic').PanelInkGeometry) => {
    setPages(previous => mergeGeometryInk(previous, id, drawingData, geometry));
    setHistory(previous => previous.map(entry => {
      const items = mergeGeometryInk(entry.pages, id, drawingData, geometry);
      return items === entry.pages ? entry : { ...entry, pages: items };
    }));
  };

  const handleUpdatePanel = (id: string, updates: Partial<ComicPanel>) => {
    const panel = currentPage.panels.find(item => item.id === id);
    if (!panel || (Object.keys(updates) as (keyof ComicPanel)[])
      .every(key => panel[key] === updates[key])) { return; }
    // Panel array order is also the paint order in Canvas and saved previews.
    // Keep the most recently edited panel last so it stays above its siblings.
    const updatedPanels = [
      ...currentPage.panels.filter(item => item.id !== id),
      { ...panel, ...updates },
    ];
    setPanelsWithHistory(updatedPanels);
  };

  const handleDeletePanel = (id: string) => {
    const remainingPanels = currentPage.panels.filter((p) => p.id !== id);
    setPanelsWithHistory(remainingPanels);
    const updatedModes = { ...panelModes };
    delete updatedModes[id];
    setPanelModes(updatedModes);
  };

  const bringPanelToFront = (id: string) => {
    const panel = currentPage.panels.find(item => item.id === id);
    if (!panel || currentPage.panels[currentPage.panels.length - 1]?.id === id) { return; }
    setPanelsWithHistory([...currentPage.panels.filter(item => item.id !== id), panel]);
  };

  const handlePanelModeChange = (id: string, mode: PanelMode) => {
    setEditingTracingPanelId(null);
    bringPanelToFront(id);
    setPanelModes({ [id]: mode });
  };

  // A single tap resumes drawing; Layout is an explicit mode-button choice.
  const handlePanelSelect = (id: string) => {
    setEditingTracingPanelId(null);
    bringPanelToFront(id);
    setPanelModes({ [id]: 'draw' });
  };

  const handleBackgroundTap = () => {
    setEditingTracingPanelId(null);
    setPanelModes({});
  };

  // 박스 자체를 다시 클릭하거나 더블클릭하면 드로우 모드로 전환!
  const handlePanelDoubleTap = (id: string) => {
    setEditingTracingPanelId(null);
    bringPanelToFront(id);
    setPanelModes({ [id]: 'draw' });
  };

  // Bubble edits share the document history with layout and drawing edits.
  const handleAddBubble = (pos?: { x: number; y: number }) => {
    const bubble: ComicBubble = {
      id: `bubble-${Date.now()}`, x: pos ? pos.x : width / 2 - 80,
      y: pos ? pos.y : height / 2 - 50, width: 160, height: 90, text: '',
    };
    changePages(pages.map((page, index) => index === currentPageIndex
      ? { ...page, bubbles: [...page.bubbles, bubble] } : page));
  };
  const handleUpdateBubble = (id: string, updates: Partial<ComicBubble>) => {
    changePages(pages.map((page, index) => index === currentPageIndex
      ? { ...page, bubbles: page.bubbles.map(b => b.id === id ? { ...b, ...updates } : b) } : page));
  };
  const handleDeleteBubble = (id: string) => {
    changePages(pages.map((page, index) => index === currentPageIndex
      ? { ...page, bubbles: page.bubbles.filter(b => b.id !== id) } : page));
  };

  // Story & Page Actions
  const handleNewStory = (capturedPages = pages, orientation: CanvasOrientation = 'portrait') => {
    const nextId = `story-${Date.now()}`;
    const nextPages: ComicPage[] = [{ id: `page-${Date.now()}`, panels: [], bubbles: [], orientation, canvasSize: canvasSizeFor(orientation) }];
    if (hasCanvasSessionRef.current) {
      recordChange({ pages: nextPages, pageIndex: 0, storyId: nextId, title: 'Untitled comic', saved: false }, snapshot(capturedPages));
    } else {
      setHistory([]);
      setHistoryStep(-1);
      editRevisionRef.current = 0;
    }
    hasCanvasSessionRef.current = true;
    savedRevisionRef.current = editRevisionRef.current;
    setPreviewStory(null);
    hasSavedStoryRef.current = false;
    setStoryId(nextId);
    setStoryTitle('Untitled comic');
    setPages(nextPages);
    setCurrentPageIndex(0);
    setPanelModes({});
    setCurrentTool('panel');
    setCurrentScreen('editor');
  };

  const requestFormat = async (kind: 'new', anchor?: CanvasPickerAnchor) => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    formatAnchorRef.current = anchor;
    setPanelModes({});
    try {
      const captured = await storyLibrary.capturePages(pages);
      setPages(captured);
      const hasWork = hasCanvasSessionRef.current && captured.some(page =>
        page.panels.length > 0 || page.bubbles.length > 0 || !!page.stickers?.length || !!page.tracingImage);
      const hasUnsavedChanges = !hasSavedStoryRef.current ||
        editRevisionRef.current !== savedRevisionRef.current || !sameComicPages(captured, pages);
      if (!hasWork || !hasUnsavedChanges) { setFormatPicker(kind); return; }
      Alert.alert('Save current comic?', 'Save your current comic before starting a new one?', [
        { text: 'Cancel', style: 'cancel' },
        { text: "Don't Save", style: 'destructive', onPress: () => {
          // Discard immediately, even if the orientation chooser is canceled.
          handleNewStory(captured, pageOrientation(captured[0]));
          setFormatPicker('reset');
        } },
        { text: 'Save', onPress: async () => {
          if (!await ensureSaveAllowed()) { return; }
          savingRef.current = true;
          newAfterSaveRef.current = true;
          setSaveName(storyTitle);
          setSaveError(null);
          setSaveDialogVisible(true);
        } },
      ], { cancelable: false });
    } catch {
      Alert.alert('Could not create comic', 'Your current comic is still open. Please try again.');
    } finally { savingRef.current = false; }
  };
  const selectFormat = async (orientation: CanvasOrientation) => {
    if (!formatPicker || savingRef.current) { return; }
    savingRef.current = true;
    try {
      const captured = await storyLibrary.capturePages(pages);
      formatAnchorRef.current = undefined;
      setFormatPicker(null);
      if (formatPicker === 'reset') {
        const nextPages = captured.map(page => ({ ...page, orientation, canvasSize: canvasSizeFor(orientation) }));
        setPages(nextPages);
        // Format selection completes the same New action; Undo still restores
        // the discarded comic in one step rather than another blank document.
        setHistory(previous => previous.map((entry, index) => index === historyStep
          ? { ...entry, pages: nextPages } : entry));
      } else {
        handleNewStory(captured, orientation);
      }
    } catch {
      Alert.alert('Could not create comic', 'Your current comic is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const enterReader = async () => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    try {
      // Flush native ink before unmounting PencilKit, including a just-ended stroke.
      const captured = await storyLibrary.capturePages(pages);
      setPages(captured);
      setPreviewStory(null);
      setPanelModes({});
      setCurrentScreen('reader');
    } catch {
      Alert.alert('Could not open reader', 'Your current canvas is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const insertPage = async (insertionIndex: number) => {
    if (savingRef.current) { return; }
    if (!canAddPage(isPro, pages.length)) { requirePro('pages', 'canvas'); return; }
    const orientation = pageOrientation(pages[0]);
    const canvasSize = pageCanvasSize(pages[0]);
    savingRef.current = true;
    try {
      const captured = await storyLibrary.capturePages(pages);
      const index = Math.max(0, Math.min(insertionIndex, captured.length));
      const nextPages: ComicPage[] = [...captured.slice(0, index), {
        id: `page-${Date.now()}`, panels: [], bubbles: [], orientation, canvasSize,
      }, ...captured.slice(index)];
      recordChange(snapshot(nextPages, index), snapshot(captured));
      setPages(nextPages);
      setCurrentPageIndex(index);
      setPanelModes({});
    } catch {
      Alert.alert('Could not create page', 'Your current comic is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const handleAddPage = () => insertPage(currentPageIndex + 1);

  const deleteCurrentPage = async () => {
    try {
      // Capture the deleted page too, so Undo restores its latest native ink.
      const captured = await storyLibrary.capturePages(pages);
      const nextPages = captured.filter((_, index) => index !== currentPageIndex);
      if (!nextPages.length) {
        nextPages.push({ id: `page-${Date.now()}`, panels: [], bubbles: [],
          orientation: pageOrientation(captured[0]), canvasSize: pageCanvasSize(captured[0]) });
      }
      const nextIndex = Math.min(currentPageIndex, nextPages.length - 1);
      recordChange(snapshot(nextPages, nextIndex), snapshot(captured));
      setPages(nextPages);
      setCurrentPageIndex(nextIndex);
      setPanelModes({});
    } catch {
      Alert.alert('Could not delete page', 'Your current page is still open. Please try again.');
    } finally { savingRef.current = false; }
  };

  const handleDeletePage = () => {
    if (savingRef.current) { return; }
    savingRef.current = true;
    let decided = false;
    Alert.alert('Delete page?', `Delete page ${currentPageIndex + 1}? You can restore it with Undo.`, [
      { text: 'Cancel', style: 'cancel', onPress: () => {
        if (decided) { return; }
        decided = true;
        savingRef.current = false;
      } },
      { text: 'Delete', style: 'destructive', onPress: () => {
        if (decided) { return; }
        decided = true;
        return deleteCurrentPage();
      } },
    ], { cancelable: false });
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

  const orientation = currentScreen === 'editor' || currentScreen === 'reader'
    ? pageOrientation(displayedPages[displayedPageIndex]) : 'automatic';
  useEffect(() => {
    if (!recoveryReady || appState !== 'active') { return; }
    let active = true;
    lockCanvasOrientation(orientation).catch(() => {
      if (active) { Alert.alert('Could not rotate', 'Your page is preserved. Please reopen the canvas to try again.'); }
    });
    return () => { active = false; };
  }, [orientation, recoveryReady, appState]);

  const wrap = (content: React.ReactNode) => <View style={styles.workspaceWrapper}>
    {content}
    <CanvasOrientationPicker anchor={formatAnchorRef.current} placement={currentScreen === 'splash' ? 'adaptive' : 'below'} visible={formatPicker !== null} onSelect={selectFormat} onCancel={() => { formatAnchorRef.current = undefined; setFormatPicker(null); }} />
  </View>;

  const handleEmail = async () => {
    if (currentScreen !== 'reader' || emailingRef.current) { return; }
    if (!requirePro('export', 'reader')) { return; }
    emailingRef.current = true;
    setEmailing(true);
    try {
      const story = readingPreview ?? {
        id: storyId, title: storyTitle, pages: await storyLibrary.capturePages(pages),
        updatedAt: new Date().toISOString(),
      };
      await storyLibrary.emailStory(story);
    } catch {
      Alert.alert('Could not prepare email', 'Your comic is still open. Please try again.');
    } finally { emailingRef.current = false; setEmailing(false); }
  };

  const handlePrint = () => {
    if (currentScreen !== 'reader' || emailingRef.current) { return; }
    if (!requirePro('export', 'reader')) { return; }
    storyLibrary.printStory(readingPreview ?? {
      id: storyId, title: storyTitle, pages, updatedAt: new Date().toISOString(),
    }).catch(() => Alert.alert('Could not print', 'Please try again.'));
  };

  if (!recoveryReady) {
    return <View style={styles.restoring}>
      <ActivityIndicator color="#0D9488" accessibilityLabel="Restoring canvas" />
    </View>;
  }

  if (currentScreen === 'library') {
    return wrap(<LibraryScreen onHome={returnToCanvas} onOpen={handleOpenStory}
      onDeleted={id => {
        if (id === storyId) {
          handleNewStory();
          setCurrentScreen('library');
        }
      }} />);
  }

  if (currentScreen === 'editor' || currentScreen === 'reader') {
    return wrap(
      <View style={styles.editorRoot} onTouchStart={() => setPageMenuDismissSignal(value => value + 1)}>
        <StatusBar hidden />
        <SaveComicDialog visible={saveDialogVisible} name={saveName} saving={submittingName}
          error={saveError} onChangeName={setSaveName} onSave={confirmSaveName} onCancel={cancelSaveName} />
          <Header
            pageMenuDismissSignal={pageMenuDismissSignal}
            reading={currentScreen === 'reader'}
            showHistory={history.length > 0}
            canUndo={historyStep > 0}
            canRedo={historyStep >= 0 && historyStep < history.length - 1}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onEdit={() => readingPreview ? handleOpenStory(readingPreview.id, 'editor') : setCurrentScreen('editor')}
            onRead={enterReader}
            currentPageIndex={displayedPageIndex}
            totalPages={displayedPages.length}
            onNewStory={anchor => requestFormat('new', anchor)}
            onLoadStory={enterLibrary}
            onSaveStory={handleSaveStory}
            saveConfirmed={saveConfirmed}
            onPrint={handlePrint}
            onEmail={handleEmail}
            emailing={emailing}
            onPrevPage={readingPreview ? () => setPreviewPageIndex(index => Math.max(0, index - 1)) : handlePrevPage}
            onNextPage={readingPreview ? () => setPreviewPageIndex(index => Math.min(displayedPages.length - 1, index + 1)) : handleNextPage}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onCreateLayout={handleCreateLayout}
          />

        {/* 만화 작업 영역 (빈 도화지에서 드래그하여 패널 생성, 패널 안 탭 시 바로 드로잉) */}
        <View style={styles.workspaceWrapper}>
          {currentScreen === 'reader' ? (
            <ComicReader key={pageOrientation(displayedPages[displayedPageIndex])} pages={displayedPages} pageIndex={displayedPageIndex}
              onPageChange={readingPreview ? setPreviewPageIndex : setCurrentPageIndex} />
          ) : <Workspace
            onImportTracingImage={handleImportTracingImage}
            importingTracingImage={importingTracingImage}
            editingTracingPanelId={editingTracingPanelId}
            onTracingImageChange={handleTracingImageChange}
            onTracingEditingChange={handleTracingEditingChange}
            canvasSize={pageCanvasSize(currentPage)}
            onSheetBoundsChange={handleSheetBoundsChange}
            panels={currentPage.panels}
            panelModes={panelModes}
            bubbles={currentPage.bubbles}
            currentTool={currentTool}
            onAddPanel={handleAddPanel}
            onUpdatePanel={handleUpdatePanel}
            onCommitPanelGeometry={handleCommitPanelGeometry}
            onGeometryInkChange={handleGeometryInkChange}
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
              onPrevious={handlePrevPage} onNext={handleNextPage}
              onAddAfterPage={() => insertPage(currentPageIndex + 1)} />
          )}
        </View>

      </View>
    );
  }

  // 기본 스플래시 화면
  return wrap(
    <View style={styles.container}>
      <StatusBar hidden />
      <SplashScreen
        onNewStory={anchor => hasCanvasSessionRef.current ? returnToCanvas() : requestFormat('new', anchor)}
        onLoadStory={enterLibrary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  restoring: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
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

export default function App(): React.JSX.Element {
  return <ProProvider><CraftoonApp /></ProProvider>;
}
