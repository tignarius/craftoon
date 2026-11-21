import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Alert,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePro } from './access/ProProvider';
import { compareStoryOrder, libraryDropTarget, LibraryCardFrame } from './utils/storyOrder';
import { coverAspectRatio } from './utils/canvasFormat';
import { ScreenHeader } from './components/ScreenHeader';
import { iconColors, screenChrome } from './components/screenChrome';
import { AppText as Text } from './components/AppText';
import { BookOpen, Glasses, SquarePen, Trash2 } from 'lucide-react-native';
import { storyLibrary, StorySummary } from './services/storyLibrary';

interface LibraryScreenProps {
  onHome: () => void;
  onOpen: (id: string, mode: 'reader' | 'editor') => Promise<void>;
  onDeleted: (id: string) => void;
}

export default function LibraryScreen({ onHome, onOpen, onDeleted }: LibraryScreenProps) {
  const { width } = useWindowDimensions();
  const { requirePro } = usePro();
  const columns = Math.min(4, Math.max(2, Math.floor(width / 240)));
  const cardWidth = (width - 32 - 16 * (columns - 1)) / columns;
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ token: string; story: StorySummary } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const bodyRef = useRef<View>(null);
  const listRef = useRef<FlatList<StorySummary>>(null);
  const cardRefs = useRef(new Map<string, View>());
  const framesRef = useRef(new Map<string, LibraryCardFrame>());
  const storiesRef = useRef(stories);
  storiesRef.current = stories;
  const bodyFrame = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const scrollOffset = useRef(0), contentHeight = useRef(0);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const dragRef = useRef<{ id: string; before: StorySummary[]; grabX: number; grabY: number;
    width: number; height: number; pageX: number; pageY: number } | null>(null);
  const dragStartRef = useRef<object | null>(null);
  const suppressPressUntil = useRef(0);
  const lastReorderAt = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const busyRef = useRef(false);
  const lastCardPressRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    storyLibrary.listStories().then(items => {
      if (mounted) { setStories([...items].sort(compareStoryOrder)); }
    }).catch(() => {
      if (mounted) { setError(true); }
    }).finally(() => {
      if (mounted) { setLoading(false); }
    });
    return () => { mounted = false; };
  }, [refreshKey]);

  const measureCard = (id: string) => {
    cardRefs.current.get(id)?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) framesRef.current.set(id, { x: x - bodyFrame.current.x,
        y: y - bodyFrame.current.y + scrollOffset.current, width: w, height: h });
    });
  };

  useEffect(() => {
    if (draggingId) for (const id of cardRefs.current.keys()) measureCard(id);
  // Refresh slot geometry after the grid reflows, not on every touch movement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, draggingId]);

  const saveOrder = async (before: StorySummary[], next: StorySummary[]) => {
    try {
      await storyLibrary.reorderStories(next.map(item => item.id));
    } catch {
      if (mounted.current) {
        storiesRef.current = before; setStories(before);
        Alert.alert('Could not save order', 'The previous comic order has been restored. Please try again.');
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setReordering(false);
    }
  };

  const moveCard = (pageX: number, pageY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.pageX = pageX; drag.pageY = pageY;
    const body = bodyFrame.current;
    dragPosition.setValue({ x: pageX - body.x - drag.grabX, y: pageY - body.y - drag.grabY });
    if (Date.now() - lastReorderAt.current < 80) return;
    const current = storiesRef.current;
    const from = current.findIndex(item => item.id === drag.id);
    const to = libraryDropTarget(current.map(item => item.id), framesRef.current,
      pageX - body.x, pageY - body.y + scrollOffset.current);
    if (from < 0 || to < 0 || from === to) return;
    lastReorderAt.current = Date.now();
    const next = [...current]; next.splice(to, 0, ...next.splice(from, 1));
    storiesRef.current = next; setStories(next);
  };

  const finishDrag = (cancel = false) => {
    const drag = dragRef.current;
    if (!drag) {
      if (dragStartRef.current) {
        dragStartRef.current = null; busyRef.current = false; setReordering(false);
        suppressPressUntil.current = Date.now() + 300;
      }
      return;
    }
    dragRef.current = null; setDraggingId(null);
    suppressPressUntil.current = Date.now() + 300;
    const next = storiesRef.current.map((item, index) => ({ ...item, libraryOrder: index }));
    if (cancel || next.every((item, index) => item.id === drag.before[index]?.id)) {
      storiesRef.current = drag.before; setStories(drag.before);
      busyRef.current = false; setReordering(false); return;
    }
    storiesRef.current = next; setStories(next);
    void saveOrder(drag.before, next);
  };

  const beginDrag = (id: string, event: GestureResponderEvent) => {
    if (busyRef.current || storiesRef.current.length < 2) return;
    const body = bodyRef.current, card = cardRefs.current.get(id);
    if (!body || !card) return;
    const { pageX, pageY } = event.nativeEvent;
    const request = {}; dragStartRef.current = request;
    busyRef.current = true; setReordering(true); setSelectedId(null);
    lastCardPressRef.current = null;
    body.measureInWindow((x, y, w, h) => {
      if (dragStartRef.current !== request || !mounted.current) return;
      bodyFrame.current = { x, y, width: w, height: h };
      for (const key of cardRefs.current.keys()) measureCard(key);
      card.measureInWindow((cx, cy, cw, ch) => {
        if (dragStartRef.current !== request || !mounted.current) return;
        dragStartRef.current = null;
        if (cw <= 0 || ch <= 0) { busyRef.current = false; setReordering(false); return; }
        lastReorderAt.current = 0;
        dragRef.current = { id, before: storiesRef.current, grabX: pageX - cx, grabY: pageY - cy,
          width: cw, height: ch, pageX, pageY };
        dragPosition.setValue({ x: cx - x, y: cy - y });
        setDraggingId(id);
      });
    });
  };

  useEffect(() => {
    if (!draggingId) return;
    const timer = setInterval(() => {
      const drag = dragRef.current;
      if (!drag) return;
      const y = drag.pageY - bodyFrame.current.y;
      const step = y < 60 ? -14 : y > bodyFrame.current.height - 60 ? 14 : 0;
      if (!step) return;
      const offset = Math.max(0, Math.min(Math.max(0, contentHeight.current - bodyFrame.current.height), scrollOffset.current + step));
      if (offset === scrollOffset.current) return;
      scrollOffset.current = offset;
      listRef.current?.scrollToOffset({ offset, animated: false });
      moveCard(drag.pageX, drag.pageY);
    }, 40);
    return () => clearInterval(timer);
  // Movement reads refs so scrolling never restarts a drag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  useEffect(() => { if (dragRef.current || dragStartRef.current) finishDrag(true); }, [columns, width]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scrollOffset.current = 0; framesRef.current.clear(); }, [columns]);

  const reorderAccessible = (id: string, direction: number) => {
    if (busyRef.current) return;
    const before = storiesRef.current, from = before.findIndex(item => item.id === id), to = from + direction;
    if (from < 0 || to < 0 || to >= before.length) return;
    const next = [...before]; next.splice(to, 0, ...next.splice(from, 1));
    const ranked = next.map((item, index) => ({ ...item, libraryOrder: index }));
    busyRef.current = true; setReordering(true);
    storiesRef.current = ranked; setStories(ranked);
    void saveOrder(before, ranked);
  };

  const open = async (id: string, mode: 'reader' | 'editor' = 'reader') => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    lastCardPressRef.current = null;
    setOpeningId(id);
    try { await onOpen(id, mode); } finally { setOpeningId(null); busyRef.current = false; }
  };

  const select = (id: string) => {
    if (busyRef.current || Date.now() < suppressPressUntil.current) { return; }
    const time = Date.now();
    const previous = lastCardPressRef.current;
    if (previous?.id === id && time >= previous.time && time - previous.time <= 350) {
      lastCardPressRef.current = null;
      return open(id, 'editor');
    }
    lastCardPressRef.current = { id, time };
    setSelectedId(current => current === id ? null : id);
  };

  const clearSelection = () => {
    if (busyRef.current) { return; }
    lastCardPressRef.current = null;
    setSelectedId(null);
  };

  const remove = async (story: StorySummary) => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    lastCardPressRef.current = null;
    setDeletingId(story.id);
    try {
      const receipt = await storyLibrary.deleteStory(story.id);
      setStories(items => items.filter(item => item.id !== story.id));
      setSelectedId(null);
      setDeleted({ token: receipt.token, story });
      onDeleted(story.id);
    } catch {
      Alert.alert('Could not delete', 'Your comic is still in Library. Please try again.');
    } finally { setDeletingId(null); busyRef.current = false; }
  };

  const undoDelete = async () => {
    if (!deleted || busyRef.current) { return; }
    busyRef.current = true;
    try {
      const restored = await storyLibrary.restoreStory(deleted.token);
      const next = [...storiesRef.current.filter(item => item.id !== restored.id),
        { ...restored, libraryOrder: deleted.story.libraryOrder }].sort(compareStoryOrder);
      storiesRef.current = next; setStories(next);
      try { await storyLibrary.reorderStories(next.map(item => item.id)); }
      catch { Alert.alert('Could not save order', 'Your comic was restored, but its library position could not be saved.'); }
      setSelectedId(restored.id);
      setDeleted(null);
    } catch (error) {
      if ((error as { code?: string }).code === 'PRO_REQUIRED') { requirePro('save', 'library'); }
      else { Alert.alert('Could not restore', 'Please try again.'); }
    } finally { busyRef.current = false; }
  };

  const printSelected = async () => {
    if (!selectedId || busyRef.current) { return; }
    if (!requirePro('export', 'library')) { return; }
    busyRef.current = true;
    lastCardPressRef.current = null;
    setPrinting(true);
    try {
      const story = await storyLibrary.loadStory(selectedId);
      await storyLibrary.printStory(story);
    } catch {
      Alert.alert('Could not print', 'Please try printing this comic again.');
    } finally { setPrinting(false); busyRef.current = false; }
  };

  const emailSelected = async () => {
    if (busyRef.current) { return; }
    if (!selectedId) {
      Alert.alert('Select a comic', 'Choose a comic in your library to email.');
      return;
    }
    if (!requirePro('export', 'library')) { return; }
    busyRef.current = true;
    lastCardPressRef.current = null;
    setEmailing(true);
    try {
      const story = await storyLibrary.loadStory(selectedId);
      await storyLibrary.emailStory(story);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      Alert.alert('Could not prepare email', detail || 'Your comic is still in Library. Please try again.');
    } finally { setEmailing(false); busyRef.current = false; }
  };

  const controlsDisabled = openingId !== null || deletingId !== null || printing || emailing || reordering;
  const draggedStory = stories.find(item => item.id === draggingId);
  return (
    <View style={styles.root}>
      {Platform.OS !== 'ios' && <StatusBar hidden />}
      <ScreenHeader mode="library" onPrint={printSelected} printLabel="Print selected comic"
        printDisabled={!selectedId || controlsDisabled} printing={printing}
        onEmail={emailSelected} emailing={emailing}
        emailDisabled={controlsDisabled}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Canvas"
          accessibilityHint={selectedId ? 'Edit the selected comic' : 'Return to your current canvas'}
          disabled={controlsDisabled}
          style={screenChrome.action} onPress={() => selectedId ? open(selectedId, 'editor') : onHome()} activeOpacity={0.7}>
          <SquarePen size={22} color={iconColors.canvas} />
        </TouchableOpacity>
      </ScreenHeader>
      <View ref={bodyRef} onLayout={() => {
        if (dragRef.current || dragStartRef.current) finishDrag(true);
        bodyRef.current?.measureInWindow((x, y, w, h) => { bodyFrame.current = { x, y, width: w, height: h }; });
      }}
      onMoveShouldSetResponderCapture={() => dragRef.current !== null}
      onResponderMove={event => moveCard(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      onResponderRelease={() => finishDrag()}
      onResponderTerminationRequest={() => dragRef.current === null}
      onResponderTerminate={() => finishDrag(true)}
      onTouchEnd={() => finishDrag()}
      onTouchCancel={() => finishDrag(true)}
      testID="library-drag-surface" accessible={false} style={styles.libraryBody}>
      <Pressable testID="library-background" accessible={false} style={styles.libraryBody} onPress={clearSelection}>
      {loading ? <ActivityIndicator style={styles.center} color="#0D9488" /> : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not open your library</Text>
          <TouchableOpacity style={styles.retry} onPress={() => setRefreshKey(key => key + 1)}>
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList ref={listRef} scrollEnabled={!draggingId}
          onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
          onContentSizeChange={(_, h) => { contentHeight.current = h; }}
          key={`gallery-${columns}`}
          numColumns={columns}
          columnWrapperStyle={styles.galleryRow}
          data={stories}
          extraData={{ selectedId, openingId, deletingId, printing, emailing, draggingId, reordering }}
          keyExtractor={story => story.id}
          contentContainerStyle={stories.length ? styles.gallery : styles.emptyList}
          ListEmptyComponent={
            <View style={styles.center}>
              <BookOpen size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No saved comics yet</Text>
              <Text style={styles.emptyText}>Create a comic in Canvas, then save it here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity ref={node => { if (node) cardRefs.current.set(item.id, node); else { cardRefs.current.delete(item.id); framesRef.current.delete(item.id); } }}
              onLayout={() => measureCard(item.id)}
              onLongPress={event => beginDrag(item.id, event)} delayLongPress={350}
              accessibilityLabel={item.title}
              accessibilityHint="Tap to show actions. Double-tap to open in Canvas. Tap again after a pause to deselect. Hold and drag to reorder."
              accessibilityState={{ selected: selectedId === item.id, disabled: controlsDisabled }}
              accessibilityActions={[
                { name: 'edit', label: 'Edit comic' },
                { name: 'open', label: 'Read comic' },
                { name: 'moveEarlier', label: 'Move comic earlier' },
                { name: 'moveLater', label: 'Move comic later' },
                ...(selectedId === item.id ? [{ name: 'delete', label: 'Delete comic' }] : []),
              ]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'moveEarlier') reorderAccessible(item.id, -1);
                if (event.nativeEvent.actionName === 'moveLater') reorderAccessible(item.id, 1);
                if (event.nativeEvent.actionName === 'open') { open(item.id); }
                if (event.nativeEvent.actionName === 'edit') { open(item.id, 'editor'); }
                if (event.nativeEvent.actionName === 'delete') { remove(item); }
              }}
              style={[styles.card, { width: cardWidth }, selectedId === item.id && styles.cardSelected, draggingId === item.id && styles.dragPlaceholder]}
              disabled={controlsDisabled}
              onPress={event => { event?.stopPropagation(); select(item.id); }}
            >
              <View testID={`comic-cover-${item.id}`} style={[styles.thumbnailFrame, { aspectRatio: coverAspectRatio(item) }]}>
                {item.thumbnailData ? (
                  <Image source={{ uri: item.thumbnailData }} style={[styles.thumbnail, selectedId === item.id && styles.thumbnailSelected]}
                    blurRadius={selectedId === item.id ? 2 : 0} resizeMode="contain" accessibilityLabel={`${item.title} preview`} />
                ) : <BookOpen size={36} color="#94A3B8" />}
                {selectedId === item.id && (
                  <View style={styles.cardActions}>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`}
                    style={styles.modeButton} disabled={controlsDisabled}
                    onPress={event => { event.stopPropagation(); open(item.id, 'editor'); }}>
                    <SquarePen size={22} color={iconColors.canvas} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Read ${item.title}`}
                    style={styles.modeButton} disabled={controlsDisabled}
                    onPress={event => { event.stopPropagation(); open(item.id, 'reader'); }}>
                    <Glasses size={22} color={iconColors.read} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}
                    style={styles.deleteButton} disabled={controlsDisabled}
                    onPress={event => { event.stopPropagation(); remove(item); }}>
                    {deletingId === item.id ? <ActivityIndicator size="small" color="#DC2626" /> :
                      <Trash2 size={22} color={iconColors.delete} />}
                  </TouchableOpacity>
                  </View>
                )}
                {openingId === item.id && (
                  <View style={styles.loadingOverlay}><ActivityIndicator color="#0D9488" /></View>
                )}
              </View>
              <View style={styles.storyDetails}>
                <Text numberOfLines={1} style={styles.storyTitle}>{item.title}</Text>
                <Text style={styles.storyMeta}>
                  {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'} · {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      {draggedStory && dragRef.current && <Animated.View pointerEvents="none" testID="library-drag-preview"
        style={[styles.card, styles.dragPreview, { width: dragRef.current.width, height: dragRef.current.height,
          transform: dragPosition.getTranslateTransform() }]}>
        <View style={[styles.thumbnailFrame, { aspectRatio: coverAspectRatio(draggedStory) }]}>
          {draggedStory.thumbnailData ? <Image source={{ uri: draggedStory.thumbnailData }} style={styles.thumbnail} resizeMode="contain" /> : <BookOpen size={36} color="#94A3B8" />}
        </View>
        <View style={styles.storyDetails}><Text numberOfLines={1} style={styles.storyTitle}>{draggedStory.title}</Text>
          <Text style={styles.storyMeta}>{draggedStory.pageCount} {draggedStory.pageCount === 1 ? 'page' : 'pages'}</Text></View>
      </Animated.View>}
      </Pressable>
      </View>
      {deleted && (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <Text numberOfLines={1} style={styles.undoMessage}>Comic deleted</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Restore ${deleted.story.title}`}
            onPress={undoDelete} style={styles.undoButton}>
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  libraryBody: { flex: 1 },
  gallery: { padding: 16, paddingBottom: 100, gap: 20 },
  galleryRow: { gap: 16 },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#334155', marginTop: 20 },
  emptyText: { fontSize: 16, color: '#64748B', marginTop: 10, textAlign: 'center' },
  retry: { padding: 16, marginTop: 12 },
  link: { fontSize: 16, fontWeight: '700', color: '#0D9488' },
  card: { padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: '#E2E8F0', alignSelf: 'flex-start' },
  dragPlaceholder: { opacity: 0.2 },
  dragPreview: { position: 'absolute', top: 0, left: 0, zIndex: 10, borderColor: '#8B5CF6',
    shadowColor: '#1E293B', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  cardSelected: { borderColor: '#0D9488', backgroundColor: '#F0FDFA' },
  cardActions: { ...StyleSheet.absoluteFillObject, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  modeButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF1F2',
    alignItems: 'center', justifyContent: 'center' },
  thumbnailFrame: { width: '100%', borderRadius: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EDF2F7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailSelected: { opacity: 0.55 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center', justifyContent: 'center' },
  storyDetails: { paddingHorizontal: 4, paddingTop: 12, paddingBottom: 6 },
  storyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  undoBar: { position: 'absolute', left: 24, right: 24, bottom: 28,
    borderRadius: 14, paddingLeft: 20, paddingRight: 8, paddingVertical: 6,
    backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center' },
  undoMessage: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  undoButton: { paddingHorizontal: 16, paddingVertical: 12 },
  undoText: { color: '#5EEAD4', fontSize: 15, fontWeight: '700' },
  storyMeta: { fontSize: 12, lineHeight: 18, color: '#64748B', marginTop: 5 },
});
