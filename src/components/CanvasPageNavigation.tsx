import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { iconColors } from './screenChrome';

interface CanvasPageNavigationProps {
  currentPageIndex: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onAddPage: () => void;
}

export function CanvasPageNavigation({ currentPageIndex, totalPages, onPrevious,
  onNext, onAddPage }: CanvasPageNavigationProps) {
  const firstPage = currentPageIndex === 0;
  const lastPage = currentPageIndex >= totalPages - 1;
  return (
    <View style={styles.navigation} pointerEvents="box-none">
      {firstPage ? <View style={styles.arrow} pointerEvents="none" /> : (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous canvas page"
        onPress={onPrevious} style={styles.arrow}
        hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }} activeOpacity={0.7}>
        <ChevronLeft size={18} color={iconColors.read} />
      </TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel={lastPage ? 'Add next canvas page' : 'Next canvas page'}
        accessibilityHint={lastPage ? 'Create a new blank page' : 'Go to the next page'}
        onPress={lastPage ? onAddPage : onNext} style={styles.arrow}
        hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }} activeOpacity={0.7}>
        <ChevronRight size={18} color={iconColors.read} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    ...StyleSheet.absoluteFillObject,
    // Match the existing 16pt workspace gutters without changing the drawing area.
    top: 16, bottom: 16, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  arrow: {
    width: 16, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
});
