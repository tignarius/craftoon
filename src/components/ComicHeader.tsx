import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  ArrowLeft,
  LayoutGrid,
  Undo2,
  Redo2,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
} from 'lucide-react-native';

interface ComicHeaderProps {
  currentPageIndex: number;
  totalPages: number;
  onBack: () => void;
  onOpenTemplates: () => void;
  onAddPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onClearPage: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const ComicHeader: React.FC<ComicHeaderProps> = ({
  currentPageIndex,
  totalPages,
  onBack,
  onOpenTemplates,
  onAddPage,
  onPrevPage,
  onNextPage,
  onClearPage,
  onUndo,
  onRedo,
}) => {
  return (
    <View style={styles.container}>
      {/* Left: Back + Title */}
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>

        <View style={styles.titleBadge}>
          <Layers size={16} color="#1ABC9C" />
          <Text style={styles.titleText}>Craftoon Studio</Text>
        </View>

        <View style={styles.divider} />

        {/* Templates Button */}
        <TouchableOpacity
          style={styles.templateButton}
          onPress={onOpenTemplates}
          activeOpacity={0.7}
        >
          <LayoutGrid size={16} color="#4F46E5" />
          <Text style={styles.templateButtonText}>Templates</Text>
        </TouchableOpacity>
      </View>

      {/* Center: Page Navigation */}
      <View style={styles.centerSection}>
        <TouchableOpacity
          style={[styles.pageNavButton, currentPageIndex === 0 && styles.disabledBtn]}
          onPress={onPrevPage}
          disabled={currentPageIndex === 0}
        >
          <ChevronLeft size={18} color={currentPageIndex === 0 ? '#D1D5DB' : '#374151'} />
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            Page {currentPageIndex + 1} / {totalPages}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.pageNavButton, currentPageIndex >= totalPages - 1 && styles.disabledBtn]}
          onPress={onNextPage}
          disabled={currentPageIndex >= totalPages - 1}
        >
          <ChevronRight size={18} color={currentPageIndex >= totalPages - 1 ? '#D1D5DB' : '#374151'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addPageButton} onPress={onAddPage} activeOpacity={0.7}>
          <Plus size={16} color="#10B981" />
          <Text style={styles.addPageText}>Add Page</Text>
        </TouchableOpacity>
      </View>

      {/* Right: Actions */}
      <View style={styles.rightSection}>
        {onUndo && (
          <TouchableOpacity style={styles.iconButton} onPress={onUndo} activeOpacity={0.7}>
            <Undo2 size={18} color="#4B5563" />
          </TouchableOpacity>
        )}
        {onRedo && (
          <TouchableOpacity style={styles.iconButton} onPress={onRedo} activeOpacity={0.7}>
            <Redo2 size={18} color="#4B5563" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.clearButton} onPress={onClearPage} activeOpacity={0.7}>
          <Trash2 size={16} color="#EF4444" />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 100,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6FFFA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D9488',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  templateButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  pageIndicator: {
    paddingHorizontal: 10,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  addPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  addPageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
});
