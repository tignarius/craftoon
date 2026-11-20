import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
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
  return <Svg width={52} height={52} viewBox="0 0 72 72">
    <Defs>
      <LinearGradient id={`paper-${orientation}`} x1="0" y1="0" x2="0.7" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.45" stopColor="#EAF5FC" />
        <Stop offset="1" stopColor="#C8E2F3" />
      </LinearGradient>
      <LinearGradient id={`back-paper-${orientation}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E5F2FB" /><Stop offset="1" stopColor="#BBD9ED" />
      </LinearGradient>
    </Defs>
    <G>
      <Rect x={x + 4} y={y + 5} width={width} height={height} rx={4}
        fill={`url(#back-paper-${orientation})`} stroke="#92B3CB" strokeWidth={2.3} />
      <Rect x={x} y={y} width={width} height={height} rx={4}
        fill={`url(#paper-${orientation})`} stroke="#91ABC0" strokeWidth={2.6} />
      <Rect x={x + 2.3} y={y + 2.3} width={width - 4.6} height={height - 4.6} rx={2}
        fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={0.9} />
    </G>
  </Svg>;
}

export function CanvasOrientationPicker({ visible, anchor, placement = 'adaptive', onSelect, onCancel }: {
  visible: boolean; anchor?: CanvasPickerAnchor; placement?: 'adaptive' | 'below';
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
  const horizontal = width > height;
  const reveal = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'hidden' | 'open' | 'exiting'>('hidden');
  const [display, setDisplay] = useState<{ width: number; height: number; left: number; top: number; horizontal: boolean }>();
  const displayRef = useRef(display);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const transition = useRef(0);
  // Preserve the old position and entrance axis until the picker has folded away.
  useLayoutEffect(() => {
    const revision = ++transition.current;
    animation.current?.stop();
    if (!visible) {
      displayRef.current = undefined;
      setDisplay(undefined);
      setPhase('hidden');
      reveal.setValue(0);
    } else if (displayRef.current) {
      setPhase('exiting');
      animation.current = Animated.timing(reveal, { toValue: 0, duration: 130,
        easing: Easing.in(Easing.cubic), useNativeDriver: true });
      animation.current.start(({ finished }) => {
        if (finished && transition.current === revision) { setPhase('hidden'); }
      });
    }
    return () => { ++transition.current; animation.current?.stop(); };
  }, [visible, width, height, reveal]);
  const center = resolved ? resolved.x + resolved.width / 2 : 80;
  const landscape = width > height && placement !== 'below';
  const desiredLeft = landscape && resolved ? resolved.x - 168 - 8 : center - 84;
  const desiredTop = landscape && resolved
    ? resolved.y + (resolved.height - cardHeight) / 2
    : (resolved ? resolved.y + resolved.height + 8 : 100) + (placement === 'below' ? 6 : 0);
  const left = Math.max(12, Math.min(width - 180, desiredLeft));
  const top = Math.max(12, Math.min(height - cardHeight - 12, desiredTop));
  useLayoutEffect(() => {
    if (!visible || !ready || phase === 'exiting') { return; }
    const next = { width, height, left, top, horizontal };
    if (phase === 'hidden') {
      displayRef.current = next;
      setDisplay(next);
      setPhase('open');
      reveal.setValue(0);
      animation.current = Animated.timing(reveal, { toValue: 1, duration: 200,
        easing: Easing.out(Easing.cubic), useNativeDriver: true });
      animation.current.start();
    } else if (displayRef.current?.width === width && displayRef.current.height === height) {
      displayRef.current = next;
      setDisplay(previous => previous?.left === left && previous.top === top ? previous : next);
    }
  }, [visible, ready, phase, width, height, left, top, horizontal, reveal]);
  const slide = useMemo(() => reveal.interpolate({ inputRange: [0, 1],
    outputRange: [display?.horizontal ? 12 : -12, 0] }), [display?.horizontal, reveal]);
  const interactive = ready && phase === 'open' && display?.width === width && display.height === height;
  if (!visible) { return null; }
  return <View style={styles.overlay} accessibilityViewIsModal onLayout={remeasure}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
      accessibilityLabel="Cancel canvas selection" onPress={onCancel} />
    <Animated.View testID="canvas-orientation-card" pointerEvents={interactive ? 'auto' : 'none'} accessibilityElementsHidden={!interactive}
      onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0) { setCardHeight(previous => previous === next ? previous : next); } }}
      style={[styles.card, { left: display?.left ?? left, top: display?.top ?? top, opacity: phase === 'hidden' ? 0 : reveal,
        transform: [display?.horizontal ? { translateX: slide } : { translateY: slide }] }]}>
      <View style={styles.choices}>
        {(['portrait', 'landscape'] as const).map(orientation => <TouchableOpacity key={orientation}
          accessibilityRole="button" accessibilityLabel={orientation === 'portrait' ? 'Portrait canvas' : 'Landscape canvas'}
          accessibilityHint="Create a canvas and keep the screen in this orientation"
          onPress={() => onSelect(orientation)} style={styles.choice} activeOpacity={0.7}>
          <FormatPicture orientation={orientation} />
        </TouchableOpacity>)}
      </View>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  card: { position: 'absolute', width: 168, backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 12 * 0.85, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB' },
  choices: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  choice: { borderRadius: 10, flex: 1, alignItems: 'center', paddingVertical: 4 },
});
