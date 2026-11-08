import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppMode } from '../access/accessPolicy';
import { modeDetails, usePro } from '../access/ProProvider';

export function ModeInfoButton({ mode, pageCount }: { mode: AppMode; pageCount?: number }) {
  const anchor = useRef<View>(null);
  const { openInfo } = usePro();
  const details = modeDetails[mode];
  const Icon = details.icon;
  const open = () => {
    if (!anchor.current) { openInfo(mode, undefined, pageCount); return; }
    anchor.current.measureInWindow((x, y, width, height) => openInfo(mode, { x, y, width, height }, pageCount));
  };
  return <View ref={anchor} collapsable={false}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`About ${details.title}`}
      accessibilityHint="Current mode, developer information and Craftoon Pro"
      onPress={open} activeOpacity={0.7} style={[styles.button, { backgroundColor: details.tint, borderColor: details.color }]}>
      <Icon size={22} color={details.color} />
    </TouchableOpacity>
  </View>;
}
const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#334155', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
});
