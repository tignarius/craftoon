import React from 'react';
import { ScreenHeader } from './ScreenHeader';
import { iconColors, screenChrome } from './screenChrome';
import { TemplatePicker } from './TemplatePicker';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from './AppText';
import {
  File,
  BookPlus,
  LibraryBig,
  SquarePen,
  Glasses,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react-native';

interface HeaderProps {
  reading?: boolean;
  onEdit?: () => void;
  onRead?: () => void;
  currentPageIndex: number;
  totalPages: number;
  onNewStory: () => void;
  onLoadStory: () => void;
  onSaveStory: () => void;
  onPrint: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onCreateLayout: (columns: number, rows: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  reading = false,
  onEdit,
  onRead,
  currentPageIndex,
  totalPages,
  onNewStory,
  onLoadStory,
  onSaveStory,
  onPrint,
  onPrevPage,
  onNextPage,
  onAddPage,
  onCreateLayout,
}) => {
  return (
    <ScreenHeader onPrint={onPrint}
      center={!reading ? (<>
        {totalPages <= 1 && !reading ? (
          <TouchableOpacity
            style={styles.singleAddBtn}
            onPress={onAddPage}
            activeOpacity={0.7}
          >
            <Plus size={18} color="#0D9488" />
          </TouchableOpacity>
        ) : (
          <View style={styles.pageGroup} pointerEvents="auto">
            <TouchableOpacity
              accessibilityLabel="Previous page" style={[styles.pageBtn, currentPageIndex === 0 && styles.disabledBtn]}
              onPress={onPrevPage}
              disabled={currentPageIndex === 0}
              activeOpacity={0.7}
            >
              <ChevronLeft size={18} color={currentPageIndex === 0 ? '#CBD5E1' : '#334155'} />
            </TouchableOpacity>

            <Text style={styles.pageTxt}>
              {currentPageIndex + 1} / {totalPages}
            </Text>

            <TouchableOpacity
              accessibilityLabel="Next page" style={[styles.pageBtn, currentPageIndex >= totalPages - 1 && styles.disabledBtn]}
              onPress={onNextPage}
              disabled={currentPageIndex >= totalPages - 1}
              activeOpacity={0.7}
            >
              <ChevronRight size={18} color={currentPageIndex >= totalPages - 1 ? '#CBD5E1' : '#334155'} />
            </TouchableOpacity>

            {!reading && <View style={styles.pageDivider} />}

            {!reading && <TouchableOpacity style={styles.addPageBtn} onPress={onAddPage} activeOpacity={0.7}>
              <Plus size={16} color="#0D9488" />
            </TouchableOpacity>}
          </View>
        )}
      </>
) : undefined}>
      {!reading && <View style={screenChrome.action}>
        <TemplatePicker onSelect={onCreateLayout} />
      </View>}
      <View style={styles.actionGroup}>
        {!reading && <TouchableOpacity accessibilityRole="button" accessibilityLabel="New"
          accessibilityHint="Start a blank comic" style={screenChrome.action} onPress={onNewStory} activeOpacity={0.7}>
          <File size={22} color={iconColors.newComic} />
        </TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Library"
          style={screenChrome.action} onPress={onLoadStory} activeOpacity={0.7}>
          <LibraryBig size={22} color={iconColors.library} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={reading ? 'Edit comic' : 'Save comic'}
          style={screenChrome.action} onPress={reading ? onEdit : onSaveStory} activeOpacity={0.7}>
          {reading ? <SquarePen size={22} color={iconColors.canvas} /> : <BookPlus size={22} color={iconColors.save} />}
        </TouchableOpacity>
        {!reading && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Read comic"
          style={screenChrome.action} onPress={onRead} activeOpacity={0.7}>
          <Glasses size={22} color={iconColors.read} />
        </TouchableOpacity>}
      </View>

    </ScreenHeader>
  );
};

const styles = StyleSheet.create({
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  singleAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    borderWidth: 1,
    borderColor: '#99F6E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTxt: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginHorizontal: 8,
  },
  pageDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  addPageBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
});
