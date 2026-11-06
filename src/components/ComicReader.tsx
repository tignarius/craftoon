import React from 'react';
import { requireNativeComponent, StyleSheet, ViewProps, NativeSyntheticEvent, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppText as Text } from './AppText';
import { iconColors } from './screenChrome';
import { ComicPage } from '../types/comic';

interface NativeReaderProps extends ViewProps {
  pages: ComicPage[];
  pageIndex: number;
  onPageChange: (event: NativeSyntheticEvent<{ pageIndex: number }>) => void;
}
const NativeReader = requireNativeComponent<NativeReaderProps>('CraftoonReader');

export function ComicReader({ pages, pageIndex, onPageChange }: {
  pages: ComicPage[]; pageIndex: number; onPageChange: (index: number) => void;
}) {
  return <View style={styles.reader}>
    <NativeReader style={styles.reader} pages={pages} pageIndex={pageIndex}
    accessibilityLabel="Comic book. Swipe left or right to turn pages."
    onPageChange={event => onPageChange(event.nativeEvent.pageIndex)} />
    <SafeAreaView style={styles.footer}>
      <View style={styles.navigation}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous page"
          disabled={pageIndex === 0} accessibilityState={{ disabled: pageIndex === 0 }}
          style={[styles.pageButton, pageIndex === 0 && styles.disabled]}
          onPress={() => onPageChange(pageIndex - 1)}>
          <ChevronLeft size={22} color={iconColors.read} />
        </TouchableOpacity>
        <Text style={styles.pageCount} accessibilityLiveRegion="polite">{pageIndex + 1} / {pages.length}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next page"
          disabled={pageIndex >= pages.length - 1} accessibilityState={{ disabled: pageIndex >= pages.length - 1 }}
          style={[styles.pageButton, pageIndex >= pages.length - 1 && styles.disabled]}
          onPress={() => onPageChange(pageIndex + 1)}>
          <ChevronRight size={22} color={iconColors.read} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  reader: { flex: 1, backgroundColor: '#F1F5F9' },
  footer: { backgroundColor: '#F1F5F9' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  pageButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageCount: { fontSize: 13, fontWeight: '700', color: '#64748B', minWidth: 64, textAlign: 'center' },
  disabled: { opacity: 0.3 },
});
