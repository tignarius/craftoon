import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { PageArrow } from './PageArrow';
import { iconColors } from './screenChrome';

interface CanvasPageNavigationProps {
  currentPageIndex: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onAddAfterPage: () => void;
}

export function CanvasPageNavigation({ currentPageIndex, totalPages, onPrevious,
  onNext, onAddAfterPage }: CanvasPageNavigationProps) {
  return <View style={styles.navigation} pointerEvents="box-none">
    {currentPageIndex > 0 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous canvas page"
      onPress={onPrevious} style={[styles.button, styles.outsideLeft]} activeOpacity={0.7}>
      <PageArrow direction="left" color={iconColors.read} />
    </TouchableOpacity> : <View style={styles.button} pointerEvents="none" />}
    {currentPageIndex < totalPages - 1 ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next canvas page"
      onPress={onNext} style={[styles.button, styles.outsideRight]} activeOpacity={0.7}>
      <PageArrow direction="right" color={iconColors.read} />
    </TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add next canvas page"
      accessibilityHint="Insert a blank page after this page" onPress={onAddAfterPage}
      style={[styles.button, styles.outsideRight]} activeOpacity={0.7}>
      <View pointerEvents="none" style={styles.plusOffset}><Plus size={17.6} color="#0F766E" strokeWidth={3} /></View>
    </TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  navigation: { ...StyleSheet.absoluteFillObject, top: 12, bottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plusOffset: { transform: [{ translateX: 3 }] },
  outsideLeft: { alignItems: 'flex-start', paddingLeft: 10 },
  outsideRight: { alignItems: 'flex-end', paddingRight: 10 },
  button: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
});
