import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from './AppText';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

interface PageNavigatorProps {
  currentPageIndex: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
}

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  currentPageIndex,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddPage,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.navBtn, currentPageIndex === 0 && styles.disabledBtn]}
        onPress={onPrevPage}
        disabled={currentPageIndex === 0}
        activeOpacity={0.7}
      >
        <ChevronLeft size={20} color={currentPageIndex === 0 ? '#CBD5E1' : '#334155'} />
      </TouchableOpacity>

      <View style={styles.pageBadge}>
        <Text style={styles.pageText}>
          {currentPageIndex + 1} <Text style={styles.slashText}>/</Text> {totalPages}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.navBtn, currentPageIndex >= totalPages - 1 && styles.disabledBtn]}
        onPress={onNextPage}
        disabled={currentPageIndex >= totalPages - 1}
        activeOpacity={0.7}
      >
        <ChevronRight size={20} color={currentPageIndex >= totalPages - 1 ? '#CBD5E1' : '#334155'} />
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.addBtn} onPress={onAddPage} activeOpacity={0.7}>
        <Plus size={18} color="#0D9488" />
        <Text style={styles.addText}>Page</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
  pageBadge: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  slashText: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#CCFBF1',
  },
  addText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
});
