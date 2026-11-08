import React from 'react';
import { Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CanvasOrientation } from '../utils/canvasFormat';

export interface CanvasPickerAnchor { x: number; y: number; width: number; height: number }

function FormatPicture({ orientation }: { orientation: CanvasOrientation }) {
  const width = orientation === 'portrait' ? 34 : 48;
  const height = orientation === 'portrait' ? 48 : 34;
  const x = (72 - width) / 2 - 2;
  const y = (72 - height) / 2 - 2;
  const right = x + width;
  const bottom = y + height;
  return <Svg width={52} height={52} viewBox="0 0 72 72">
    <Defs><LinearGradient id={`paper-${orientation}`} x1="0" y1="0" x2="0.8" y2="1">
      <Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#E7EDF5" />
    </LinearGradient></Defs>
    <Rect x={x + 4} y={y + 5} width={width} height={height} rx={3} fill="#64748B" opacity={0.12} />
    <Rect x={x + 2} y={y + 2} width={width} height={height} rx={3} fill="#CBD5E1" />
    <Path d={`M${x + 3} ${y}H${right - 9}L${right} ${y + 9}V${bottom - 3}Q${right} ${bottom} ${right - 3} ${bottom}H${x + 3}Q${x} ${bottom} ${x} ${bottom - 3}V${y + 3}Q${x} ${y} ${x + 3} ${y}Z`}
      fill={`url(#paper-${orientation})`} stroke="#94A3B8" strokeWidth={1.3} />
    <Path d={`M${right - 9} ${y}V${y + 7}Q${right - 9} ${y + 9} ${right - 7} ${y + 9}H${right}`}
      fill="#D5DFEC" stroke="#94A3B8" strokeWidth={1} />
    <Path d={`M${x + 3} ${bottom - 4}V${y + 4}H${right - 13}`} fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
  </Svg>;
}

export function CanvasOrientationPicker({ visible, anchor, onSelect, onCancel }: {
  visible: boolean; anchor?: CanvasPickerAnchor;
  onSelect: (orientation: CanvasOrientation) => void; onCancel: () => void;
}) {
  const { width, height } = useWindowDimensions();
  if (!visible) { return null; }
  const center = anchor ? anchor.x + anchor.width / 2 : 80;
  const left = Math.max(12, Math.min(width - 180, center - 84));
  const top = Math.max(12, Math.min(height - 98, anchor ? anchor.y + anchor.height + 8 : 100));
  const arrowLeft = Math.max(14, Math.min(140, center - left - 6));
  return <View style={styles.overlay} accessibilityViewIsModal>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
      accessibilityLabel="Cancel canvas selection" onPress={onCancel} />
    <View style={[styles.card, { left, top }]}>
      <View style={[styles.caret, { left: arrowLeft }]} />
      <View style={styles.choices}>
        {(['portrait', 'landscape'] as const).map(orientation => <TouchableOpacity key={orientation}
          accessibilityRole="button" accessibilityLabel={orientation === 'portrait' ? 'Portrait canvas' : 'Landscape canvas'}
          accessibilityHint="Create a canvas and keep the screen in this orientation"
          onPress={() => onSelect(orientation)} style={styles.choice} activeOpacity={0.7}>
          <FormatPicture orientation={orientation} />
        </TouchableOpacity>)}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  card: { position: 'absolute', width: 168, backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0',
    shadowColor: '#334155', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 6 },
  caret: { position: 'absolute', top: -6, width: 12, height: 12,
    backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
  choices: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  choice: { borderRadius: 10, flex: 1, alignItems: 'center', paddingVertical: 4 },
});
