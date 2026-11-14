import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CanvasOrientation } from '../utils/canvasFormat';

export interface CanvasPickerAnchor {
  x: number; y: number; width: number; height: number;
  measure?: (onMeasured: (rect: CanvasPickerAnchor) => void) => void;
}

// Keep a live ref rather than the native view itself, so an open picker can
// follow rotation/reflow without retaining an unmounted source screen.
export function measureCanvasPickerAnchor(target: React.RefObject<View | null>, onReady: (anchor?: CanvasPickerAnchor) => void) {
  const measure = (onMeasured: (rect: CanvasPickerAnchor) => void) => {
    target.current?.measureInWindow((x, y, width, height) => onMeasured({ x, y, width, height }));
  };
  if (!target.current) { onReady(); return; }
  measure(rect => onReady({ ...rect, measure }));
}

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
  const [measured, setMeasured] = useState<{ source: CanvasPickerAnchor; rect: CanvasPickerAnchor; width: number; height: number }>();
  const [cardHeight, setCardHeight] = useState(86);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const remeasure = useCallback(() => {
    const revision = ++generation.current;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    if (!visible || !anchor?.measure) { return; }
    // Measure after native layout, not from the pre-rotation button coordinates.
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      anchor.measure?.(rect => {
        if (generation.current !== revision || rect.width <= 0 || rect.height <= 0 ||
          ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) { return; }
        setMeasured(previous => previous?.source === anchor && previous.width === width && previous.height === height &&
          previous.rect.x === rect.x && previous.rect.y === rect.y && previous.rect.width === rect.width && previous.rect.height === rect.height
          ? previous : { source: anchor, rect, width, height });
      });
    });
  }, [anchor, visible, width, height]);
  useLayoutEffect(() => {
    remeasure();
    return () => {
      generation.current += 1;
      if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    };
  }, [remeasure]);
  const ready = !anchor?.measure || (measured?.source === anchor && measured.width === width && measured.height === height);
  const resolved = measured && measured.source === anchor ? measured.rect : anchor;
  if (!visible) { return null; }
  const center = resolved ? resolved.x + resolved.width / 2 : 80;
  const landscape = width > height;
  const desiredLeft = landscape && resolved ? resolved.x - 168 - 8 : center - 84;
  const desiredTop = landscape && resolved
    ? resolved.y + (resolved.height - cardHeight) / 2
    : resolved ? resolved.y + resolved.height + 8 : 100;
  const left = Math.max(12, Math.min(width - 180, desiredLeft));
  const top = Math.max(12, Math.min(height - cardHeight - 12, desiredTop));
  return <View style={styles.overlay} accessibilityViewIsModal onLayout={remeasure}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
      accessibilityLabel="Cancel canvas selection" onPress={onCancel} />
    <View testID="canvas-orientation-card" pointerEvents={ready ? 'auto' : 'none'} accessibilityElementsHidden={!ready}
      onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0) { setCardHeight(previous => previous === next ? previous : next); } }}
      style={[styles.card, { left, top, opacity: ready ? 1 : 0 }]}>
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
  choices: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  choice: { borderRadius: 10, flex: 1, alignItems: 'center', paddingVertical: 4 },
});
