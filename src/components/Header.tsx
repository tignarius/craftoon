import React, { useRef } from 'react';
import { CanvasPickerAnchor } from './CanvasOrientationPicker';
import { AppText as Text } from './AppText';
import { PageNavigator } from './PageNavigator';
import { ScreenHeader } from './ScreenHeader';
import { iconColors, screenChrome } from './screenChrome';
import { TemplatePicker } from './TemplatePicker';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  File,
  BookPlus,
  Check,
  LibraryBig,
  SquarePen,
  Glasses,
  Undo2,
  Redo2,
} from 'lucide-react-native';

interface HeaderProps {
  reading?: boolean;
  pageMenuDismissSignal?: number;
  showHistory?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onEdit?: () => void;
  onRead?: () => void;
  currentPageIndex: number;
  totalPages: number;
  onNewStory: (anchor?: CanvasPickerAnchor) => void;
  onLoadStory: () => void;
  onSaveStory: () => void;
  saveConfirmed?: boolean;
  onPrint: () => void;
  onEmail?: () => void;
  emailing?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage?: () => void;
  onCreateLayout: (columns: number, rows: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  reading = false,
  pageMenuDismissSignal,
  currentPageIndex, totalPages,
  showHistory = false, canUndo = false, canRedo = false, onUndo, onRedo,
  onEdit,
  onRead,
  onNewStory,
  onLoadStory,
  onSaveStory,
  saveConfirmed = false,
  onPrint,
  onEmail, emailing = false,
  onCreateLayout,
  onPrevPage, onNextPage, onAddPage, onDeletePage,
}) => {
  const newButton = useRef<View>(null);
  const openNew = () => {
    if (!newButton.current) { onNewStory(); return; }
    newButton.current.measureInWindow((x, y, width, height) => onNewStory({ x, y, width, height }));
  };
  return (
    <ScreenHeader mode={reading ? 'reader' : 'canvas'} pageCount={totalPages} onPrint={reading ? onPrint : undefined} printDisabled={emailing}
      onEmail={reading ? onEmail : undefined} emailLabel="Email comic" emailing={emailing}
      trailing={!reading ? <PageNavigator dismissSignal={pageMenuDismissSignal} currentPageIndex={currentPageIndex} totalPages={totalPages}
        onPrevious={onPrevPage} onNext={onNextPage} onAddPage={onAddPage} onDeletePage={onDeletePage} /> : undefined}>
      {!reading && <View style={screenChrome.action}>
        <TemplatePicker onSelect={onCreateLayout} />
      </View>}
      <View style={styles.actionGroup}>
        {!reading && <View ref={newButton} collapsable={false}><TouchableOpacity accessibilityRole="button" accessibilityLabel="New"
          accessibilityHint="Start a blank comic" style={screenChrome.action} onPress={openNew} activeOpacity={0.7}>
          <File size={22} color={iconColors.newComic} />
        </TouchableOpacity></View>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Library"
          style={screenChrome.action} onPress={onLoadStory} activeOpacity={0.7}>
          <LibraryBig size={22} color={iconColors.library} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={reading ? 'Edit comic' : 'Save comic'}
          style={screenChrome.action} onPress={reading ? onEdit : onSaveStory} activeOpacity={0.7}>
          {reading ? <SquarePen size={22} color={iconColors.canvas} /> : saveConfirmed
            ? <Check size={22} color="#059669" /> : <BookPlus size={22} color={iconColors.save} />}
          {!reading && saveConfirmed && <View style={styles.savedToast} pointerEvents="none">
            <Text style={styles.savedText} accessibilityLiveRegion="polite">Saved</Text>
          </View>}
        </TouchableOpacity>
        {!reading && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Read comic"
          style={screenChrome.action} onPress={onRead} activeOpacity={0.7}>
          <Glasses size={22} color={iconColors.read} />
        </TouchableOpacity>}
        {!reading && showHistory && <>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Undo"
            accessibilityState={{ disabled: !canUndo }} disabled={!canUndo}
            style={[screenChrome.action, !canUndo && styles.disabledBtn]} onPress={onUndo}>
            <Undo2 size={22} color={iconColors.canvas} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Redo"
            accessibilityState={{ disabled: !canRedo }} disabled={!canRedo}
            style={[screenChrome.action, !canRedo && styles.disabledBtn]} onPress={onRedo}>
            <Redo2 size={22} color={iconColors.canvas} />
          </TouchableOpacity>
        </>}
      </View>

    </ScreenHeader>
  );
};

const styles = StyleSheet.create({
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  savedToast: { position: 'absolute', top: 44, minWidth: 64, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 10, backgroundColor: '#ECFDF5',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#A7F3D0',
    shadowColor: '#064E3B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  savedText: { fontSize: 12, fontWeight: '600', color: '#047857', textAlign: 'center' },
  disabledBtn: {
    opacity: 0.35,
  },
});
