import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePro } from './access/ProProvider';
import { compareStoryCreation } from './utils/storyOrder';
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
  const busyRef = useRef(false);
  const lastCardPressRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    storyLibrary.listStories().then(items => {
      if (mounted) { setStories([...items].sort(compareStoryCreation)); }
    }).catch(() => {
      if (mounted) { setError(true); }
    }).finally(() => {
      if (mounted) { setLoading(false); }
    });
    return () => { mounted = false; };
  }, [refreshKey]);

  const open = async (id: string, mode: 'reader' | 'editor' = 'reader') => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    lastCardPressRef.current = null;
    setOpeningId(id);
    try { await onOpen(id, mode); } finally { setOpeningId(null); busyRef.current = false; }
  };

  const select = (id: string) => {
    if (busyRef.current) { return; }
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
      setStories(items => [...items.filter(item => item.id !== restored.id), restored]
        .sort(compareStoryCreation));
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
    } catch {
      Alert.alert('Could not prepare email', 'Your comic is still in Library. Please try again.');
    } finally { setEmailing(false); busyRef.current = false; }
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <ScreenHeader mode="library" onPrint={printSelected} printLabel="Print selected comic"
        printDisabled={!selectedId || openingId !== null || deletingId !== null || emailing} printing={printing}
        onEmail={emailSelected} emailing={emailing}
        emailDisabled={openingId !== null || deletingId !== null || printing || emailing}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Canvas"
          accessibilityHint={selectedId ? 'Edit the selected comic' : 'Return to your current canvas'}
          disabled={openingId !== null || deletingId !== null || printing || emailing}
          style={screenChrome.action} onPress={() => selectedId ? open(selectedId, 'editor') : onHome()} activeOpacity={0.7}>
          <SquarePen size={22} color={iconColors.canvas} />
        </TouchableOpacity>
      </ScreenHeader>
      <Pressable testID="library-background" accessible={false} style={styles.libraryBody} onPress={clearSelection}>
      {loading ? <ActivityIndicator style={styles.center} color="#0D9488" /> : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not open your library</Text>
          <TouchableOpacity style={styles.retry} onPress={() => setRefreshKey(key => key + 1)}>
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={`gallery-${columns}`}
          numColumns={columns}
          columnWrapperStyle={styles.galleryRow}
          data={stories}
          extraData={{ selectedId, openingId, deletingId, printing, emailing }}
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
            <TouchableOpacity
              accessibilityLabel={item.title}
              accessibilityHint="Tap to show actions. Double-tap to open in Canvas. Tap again after a pause to deselect."
              accessibilityState={{ selected: selectedId === item.id, disabled: openingId !== null || deletingId !== null || printing || emailing }}
              accessibilityActions={[
                { name: 'edit', label: 'Edit comic' },
                { name: 'open', label: 'Read comic' },
                ...(selectedId === item.id ? [{ name: 'delete', label: 'Delete comic' }] : []),
              ]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'open') { open(item.id); }
                if (event.nativeEvent.actionName === 'edit') { open(item.id, 'editor'); }
                if (event.nativeEvent.actionName === 'delete') { remove(item); }
              }}
              style={[styles.card, { width: cardWidth }, selectedId === item.id && styles.cardSelected]}
              disabled={openingId !== null || deletingId !== null || printing || emailing}
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
                    style={styles.modeButton} disabled={openingId !== null || deletingId !== null || printing || emailing}
                    onPress={event => { event.stopPropagation(); open(item.id, 'editor'); }}>
                    <SquarePen size={22} color={iconColors.canvas} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Read ${item.title}`}
                    style={styles.modeButton} disabled={openingId !== null || deletingId !== null || printing || emailing}
                    onPress={event => { event.stopPropagation(); open(item.id, 'reader'); }}>
                    <Glasses size={22} color={iconColors.read} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}
                    style={styles.deleteButton} disabled={openingId !== null || deletingId !== null || printing || emailing}
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
      </Pressable>
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
