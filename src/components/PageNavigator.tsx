import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { AppText as Text } from './AppText';
import { PageArrow } from './PageArrow';

export function PageNavigator({ dismissSignal, currentPageIndex, totalPages, onPrevious, onNext, onAddPage, onDeletePage }: {
  dismissSignal?: number;
  currentPageIndex: number; totalPages: number;
  onPrevious: () => void; onNext: () => void; onAddPage: () => void; onDeletePage?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [dismissSignal]);
  const first = currentPageIndex === 0;
  const last = currentPageIndex >= totalPages - 1;
  const actions = [
    { label: 'Previous page', disabled: first, onPress: onPrevious, icon: <PageArrow direction="left" /> },
    { label: 'Delete current page', disabled: false, onPress: onDeletePage, icon: <Minus size={18} color="#64748B" /> },
    { label: 'Add next canvas page', disabled: false, onPress: onAddPage, icon: <Plus size={18} color="#64748B" /> },
    { label: 'Next page', disabled: last, onPress: onNext, icon: <PageArrow direction="right" /> },
  ];
  return <View style={styles.navigation} onTouchStart={event => event.stopPropagation()}>
    {expanded && <View style={styles.controls}>
      {actions.map(action => <TouchableOpacity key={action.label} accessibilityRole="button"
        accessibilityLabel={action.label} accessibilityState={{ disabled: action.disabled }}
        disabled={action.disabled} onPress={action.onPress} activeOpacity={0.65}
        style={[styles.button, action.disabled && styles.disabled]}>
        {action.icon}
      </TouchableOpacity>)}
    </View>}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Page ${currentPageIndex + 1} of ${totalPages}`}
      accessibilityHint="Show or hide page controls" accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} style={styles.toggle} activeOpacity={0.65}>
      <Text accessible={false} style={styles.number}>{currentPageIndex + 1} / {totalPages}</Text>
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  controls: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(100,116,139,0.22)', backgroundColor: 'rgba(241,245,249,0.45)' },
  button: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)' },
  disabled: { opacity: 0.25 },
  toggle: { minWidth: 44, height: 32, paddingHorizontal: 8, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(148,163,184,0.28)',
    shadowColor: '#334155', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  number: { fontSize: 14, fontWeight: '600', color: '#64748B' },
});
