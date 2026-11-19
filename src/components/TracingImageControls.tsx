import { PANEL_ICON_SCALE } from './panelIconSizing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Blend, Check, Eye, EyeOff, Maximize2, Move, RotateCw, Settings2, Trash2 } from 'lucide-react-native';
import { AppText as Text } from './AppText';
import { PanelCorners, TracingImage } from '../types/comic';
import { gizmoTransform, resizeTracingImage, rotateTracingImage } from '../utils/tracingImage';
import { PanelSurface } from './PanelSurface';
import { RECT_CORNERS } from '../utils/panelGeometry';

interface Props {
  image: TracingImage;
  editing: boolean;
  bounds: { width: number; height: number };
  canvasScale: number;
  corners?: PanelCorners;
  focused?: boolean;
  displayScale?: number;
  onEditingChange: (editing: boolean) => void;
  onPreview: (image: TracingImage | null) => void;
  onCommit: (image: TracingImage | undefined) => void | Promise<void>;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));
const IMAGE_ICON_SIZE = 15 * PANEL_ICON_SCALE * 1.2;
const IMAGE_BUTTON_SIZE = 24;
const IMAGE_BUTTON_GAP = 4;
const IMAGE_CONTROL_TARGET = 34;
const IMAGE_CONTROL_HEIGHT = 40;
const IMAGE_COLOR = '#0EA5E9';
const ACTIVE_COLOR = '#0369A1';

export function OpacitySlider({ value, canvasScale, onPreview, onCommit, compact = false }: {
  value: number; canvasScale: number; onPreview: (value: number) => void; onCommit: (value: number) => void; compact?: boolean;
}) {
  const latest = useRef({ value, canvasScale, onPreview, onCommit });
  latest.current = { value, canvasScale, onPreview, onCommit };
  const [width, setWidth] = useState(1);
  const trackWidth = useRef(width);
  trackWidth.current = width;
  const startX = useRef(0);
  const draft = useRef(value);
  const initialValue = useRef(value);
  const update = (x: number) => {
    draft.current = clamp(x / trackWidth.current, 0, 1);
    latest.current.onPreview(draft.current);
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      initialValue.current = latest.current.value;
      startX.current = event.nativeEvent.locationX;
      update(startX.current);
    },
    onPanResponderMove: (_, gesture) => update(startX.current + gesture.dx / latest.current.canvasScale),
    onPanResponderRelease: () => latest.current.onCommit(draft.current),
    onPanResponderTerminate: () => latest.current.onPreview(initialValue.current),
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <View style={styles.opacityRow}>
    {!compact && <Text style={styles.opacityLabel}>Opacity</Text>}
    <View testID="reference-opacity-slider" accessible accessibilityRole="adjustable"
      accessibilityLabel="Reference image opacity" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => onCommit(clamp(value + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1), 0, 1))}
      onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      style={styles.slider} {...responder.panHandlers}>
      <View pointerEvents="none" style={styles.track} />
      <View pointerEvents="none" style={[styles.filledTrack, { width: width * value }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: width * value - 6 }]} />
    </View>
    <Text style={styles.percentage}>{Math.round(value * 100)}%</Text>
  </View>;
}

export function TracingImageControls(props: Props) {
  type Tool = 'move' | 'rotate' | 'scale';
  const [activeTool,setActiveTool] = useState<Tool>('move');
  const [opacityOpen,setOpacityOpen] = useState(false);
  const reveal = useRef(new Animated.Value(props.editing ? 1 : 0)).current;
  const [toolsMounted, setToolsMounted] = useState(props.editing);
  const [toolsReady, setToolsReady] = useState(props.editing);
  useEffect(() => {
    if (props.editing) { setToolsMounted(true); }
    setToolsReady(false);
    const animation = Animated.timing(reveal, { toValue: props.editing ? 1 : 0,
      duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) { setToolsReady(props.editing); if (!props.editing) { setToolsMounted(false); } }
    });
    return () => animation.stop();
  }, [props.editing, reveal]);
  useEffect(() => {
    if (!props.editing) { setOpacityOpen(false); setActiveTool('move'); }
  },[props.editing]);
  const latest = useRef({ ...props,activeTool });
  latest.current = { ...props,activeTool };
  const visibilityIntent = useRef(props.image.visible !== false);
  const visibilityPending = useRef(0);
  useEffect(() => {
    if (!visibilityPending.current) { visibilityIntent.current = props.image.visible !== false; }
  }, [props.image.visible]);
  const toggleVisibility = async () => {
    visibilityIntent.current = !visibilityIntent.current;
    const image = { ...latest.current.image, visible: visibilityIntent.current };
    visibilityPending.current++;
    latest.current.onPreview(image);
    try { await latest.current.onCommit(image); }
    finally {
      visibilityPending.current--;
      if (!visibilityPending.current) { latest.current.onPreview(null); }
    }
  };
  const draft = useRef(props.image);
  const start = useRef(props.image);
  const operation = useRef<Tool>('move');
  const gestureVector = useRef({ x: 0,y: -80 });
  const moved = useRef(false);
  const pairStart = useRef<{ distance: number; angle: number; x: number; y: number } | null>(null);
  const count = useRef(0);
  const pair = (event: GestureResponderEvent) => {
    const [a,b] = event.nativeEvent.touches;
    if (!a || !b) { return null; }
    return { distance: Math.hypot(b.pageX-a.pageX,b.pageY-a.pageY),angle: Math.atan2(b.pageY-a.pageY,b.pageX-a.pageX),
      x: (a.pageX+b.pageX)/2,y: (a.pageY+b.pageY)/2 };
  };
  const origin = useRef({ x: 0,y: 0 });
  const baseline = (event: GestureResponderEvent) => {
    start.current = draft.current;
    const touch = event.nativeEvent.touches[0];
    origin.current = { x: touch?.pageX ?? 0,y: touch?.pageY ?? 0 };
    pairStart.current = pair(event);
    count.current = event.nativeEvent.touches.length;
  };
  const commit = async () => {
    try { await latest.current.onCommit(draft.current); }
    finally { latest.current.onPreview(null); }
  };
  const cancel = () => latest.current.onPreview(null);
  const transform = (dx: number,dy: number) => {
    const tool = operation.current;
    if (tool === 'move') { return; }
    draft.current = gizmoTransform(start.current,tool,gestureVector.current,
      { x: dx/latest.current.canvasScale,y: dy/latest.current.canvasScale });
    latest.current.onPreview(draft.current);
  };
  const move = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => latest.current.editing,
    onMoveShouldSetPanResponder: () => latest.current.editing,
    onPanResponderGrant: event => {
      setOpacityOpen(false);
      draft.current = latest.current.image;
      baseline(event);
      operation.current = latest.current.activeTool;
      const vector = { x: event.nativeEvent.locationX-latest.current.bounds.width/2,
        y: event.nativeEvent.locationY-latest.current.bounds.height/2 };
      gestureVector.current = Math.hypot(vector.x,vector.y) > 16 ? vector : { x: 0,y: -80 };
    },
    onPanResponderMove: (event,gesture) => {
      if (operation.current !== 'move') { transform(gesture.dx,gesture.dy); return; }
      if (count.current !== event.nativeEvent.touches.length) { baseline(event); return; }
      const current = pair(event);
      const previous = pairStart.current;
      const scale = latest.current.canvasScale;
      if (current && previous) {
        const resized = resizeTracingImage(start.current,current.distance/Math.max(1,previous.distance));
        draft.current = { ...rotateTracingImage(resized,(current.angle-previous.angle)*180/Math.PI),
          x: resized.x+(current.x-previous.x)/scale,y: resized.y+(current.y-previous.y)/scale };
      } else {
        const touch = event.nativeEvent.touches[0];
        if (!touch) { return; }
        draft.current = { ...start.current,x: start.current.x+(touch.pageX-origin.current.x)/scale,
          y: start.current.y+(touch.pageY-origin.current.y)/scale };
      }
      latest.current.onPreview(draft.current);
    },
    onPanResponderRelease: commit,
    onPanResponderTerminate: cancel,
    onPanResponderTerminationRequest: () => false,
  })).current;
  const makeToolHandle = (tool: 'rotate' | 'scale') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setActiveTool(tool);
      setOpacityOpen(false);
      operation.current = tool;
      draft.current = latest.current.image;
      start.current = draft.current;
      moved.current = false;
      gestureVector.current = tool === 'rotate' ? { x: 0,y: -80 } : { x: 60,y: 60 };
    },
    onPanResponderMove: (_,gesture) => {
      if (Math.hypot(gesture.dx,gesture.dy) < 3) { return; }
      moved.current = true;
      transform(gesture.dx,gesture.dy);
    },
    onPanResponderRelease: () => moved.current ? commit() : cancel(),
    onPanResponderTerminate: cancel,
    onPanResponderTerminationRequest: () => false,
  });
  const rotate = useRef(makeToolHandle('rotate')).current;
  const scale = useRef(makeToolHandle('scale')).current;
  const visible = props.image.visible !== false;
  const corners = props.corners ?? RECT_CORNERS;
  const zoom = Math.max(0.01, props.displayScale ?? 1);
  const controlsScale = props.canvasScale / zoom;
  const bottomLeft = { x: corners[3].x * props.bounds.width * zoom, y: corners[3].y * props.bounds.height * zoom };
  const toolbarInset = 4;
  const bottomWidth = Math.max(IMAGE_CONTROL_TARGET * 2 + toolbarInset,
    (corners[2].x - corners[3].x) * props.bounds.width * zoom - 10);
  const toolbarHeight = IMAGE_CONTROL_HEIGHT + toolbarInset;
  // Anchor visible circles rather than the transparent hit area. Use the
  // midpoint between the original 15-point gap and the closer 2-point gap.
  const circleBottom = 2 + (IMAGE_CONTROL_HEIGHT + IMAGE_BUTTON_SIZE) / 2;
  const toolbarTop = props.focused ? bottomLeft.y + 2 : bottomLeft.y - circleBottom - 8.5;
  const popupWidth = Math.min(180,Math.max(48,bottomWidth));
  // Keep Eye and Settings/Done fixed. Only the tools unfold to their right;
  // narrow panels wrap tools above (or below when focused) the fixed controls.
  const toolPositions = useMemo(() => {
    let toolX = IMAGE_CONTROL_TARGET * 2 + 7, row = 0;
    return Array.from({ length: 5 }, () => {
      if (toolX + IMAGE_BUTTON_SIZE > bottomWidth - toolbarInset) { toolX = 0; row++; }
      const top = row === 0 ? (IMAGE_CONTROL_HEIGHT - IMAGE_BUTTON_SIZE) / 2
        : props.focused ? IMAGE_CONTROL_HEIGHT + IMAGE_BUTTON_GAP + (row - 1) * (IMAGE_BUTTON_SIZE + IMAGE_BUTTON_GAP)
          : -row * (IMAGE_BUTTON_SIZE + IMAGE_BUTTON_GAP);
      const position = { left: 2 + toolX, top: 2 + top };
      toolX += IMAGE_BUTTON_SIZE + IMAGE_BUTTON_GAP;
      return position;
    });
  }, [bottomWidth, props.focused]);
  let toolbarLeft = bottomLeft.x + (props.focused ? 0 : 5);
  if (!props.focused) {
    const top = { x: corners[0].x * props.bounds.width * zoom, y: corners[0].y * props.bounds.height * zoom };
    const dx = bottomLeft.x - top.x, dy = bottomLeft.y - top.y;
    if (dy > 0.001) {
      const radius = IMAGE_BUTTON_SIZE / 2;
      // Include the wrapped tools even while closed, so the controller stays
      // in place when opening. Measure clearance perpendicular to the slope.
      const centers = [
        { x: 2 + IMAGE_CONTROL_TARGET / 2, y: 2 + IMAGE_CONTROL_HEIGHT / 2 },
        { x: 2 + IMAGE_CONTROL_TARGET * 1.5, y: 2 + IMAGE_CONTROL_HEIGHT / 2 },
        ...toolPositions.map(position => ({ x: position.left + radius, y: position.top + radius })),
      ];
      for (const center of centers) {
        const y = toolbarTop + center.y;
        if (y + radius < top.y || y - radius > bottomLeft.y) { continue; }
        const requiredCenter = top.x + dx * (y - top.y) / dy + (radius + 4) * Math.hypot(dx, dy) / dy;
        toolbarLeft = Math.max(toolbarLeft, requiredCenter - center.x);
      }
    }
  }
  const toolSlides = useMemo(() => toolPositions.map(position => reveal.interpolate({ inputRange: [0, 1],
    outputRange: [2 + IMAGE_CONTROL_TARGET * 1.5 - IMAGE_BUTTON_SIZE / 2 - position.left, 0] })), [reveal, toolPositions]);
  const toolsVisible = props.editing || toolsMounted;
  const toolsTop = toolsVisible ? Math.min(2, ...toolPositions.map(p => p.top)) : 2;
  const toolsBottom = toolsVisible ? Math.max(toolbarHeight - 2, ...toolPositions.map(p => p.top + IMAGE_BUTTON_SIZE)) : toolbarHeight - 2;
  const animatedTool = (index: number, child: React.ReactNode) => <Animated.View
    key={index} testID={`reference-reveal-tool-${index}`} pointerEvents={props.editing && toolsReady ? 'box-none' : 'none'}
    accessibilityElementsHidden={!props.editing || !toolsReady}
    importantForAccessibility={props.editing && toolsReady ? 'auto' : 'no-hide-descendants'}
    style={{ position: 'absolute', ...toolPositions[index], width: IMAGE_BUTTON_SIZE, height: IMAGE_BUTTON_SIZE,
      opacity: reveal, transform: [{ translateX: toolSlides[index] }] }}>
    {child}
  </Animated.View>;
  const selected = (tool: Tool) => activeTool === tool && styles.selected;
  return <View pointerEvents="box-none" testID="panel-reference-controls"
    style={styles.overlay}>
    {props.editing && visible && <PanelSurface pointerEvents="box-none" polygonPoints={corners} clipContent
      style={{ position: 'absolute', left: 0, top: 0, width: props.bounds.width, height: props.bounds.height,
        transformOrigin: 'top left', transform: [{ scale: zoom }] }}>
      <View testID="reference-image-gesture-surface" style={StyleSheet.absoluteFill} {...move.panHandlers} />
    </PanelSurface>}
    {props.editing && opacityOpen && <View testID="reference-opacity-popover"
      style={[styles.opacityCard,{ width: popupWidth,left: toolbarLeft,
        top: props.focused ? toolbarTop+toolsBottom+6 : toolbarTop+toolsTop-38 }]}>
      <OpacitySlider value={props.image.opacity} canvasScale={controlsScale} compact={popupWidth < 150}
        onPreview={opacity => props.onPreview({ ...props.image,opacity })}
        onCommit={async opacity => { try { await props.onCommit({ ...props.image,opacity }); } finally { props.onPreview(null); } }} />
    </View>}
    <View testID="reference-fixed-toolbar" pointerEvents="box-none"
      style={[styles.toolbar,{ left: toolbarLeft,top: toolbarTop,width: bottomWidth,height: toolbarHeight,maxWidth: bottomWidth }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? 'Hide reference image' : 'Show reference image'}
        accessibilityHint="This panel only" onPress={toggleVisibility}
        style={[styles.controlTarget,{ left: 2, top: 2 }]}>
        <View pointerEvents="none" style={styles.button}>
        {visible ? <Eye size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={IMAGE_COLOR} /> : <EyeOff size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={IMAGE_COLOR} />}
        </View>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={props.editing ? 'Hide image controls' : 'Show image controls'}
        onPress={() => props.onEditingChange(!props.editing)} style={[styles.controlTarget,{ left: 2 + IMAGE_CONTROL_TARGET, top: 2 }]}>
        <View pointerEvents="none" style={[styles.button,props.editing && styles.doneButton]}>
        {props.editing ? <Check size={IMAGE_ICON_SIZE} strokeWidth={2.2} color="#16A34A" /> : <Settings2 size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={IMAGE_COLOR} />}
        </View>
      </TouchableOpacity>
      {toolsVisible && <>
        {animatedTool(0, <TouchableOpacity testID="reference-move-handle" accessibilityRole="button" accessibilityLabel="Move reference image"
          accessibilityState={{ selected: activeTool === 'move' }} accessibilityHint="Drag inside the panel to move the image"
          onPress={() => { setActiveTool('move'); setOpacityOpen(false); }} style={[styles.button,selected('move')]}>
          <Move size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={activeTool === 'move' ? ACTIVE_COLOR : IMAGE_COLOR} />
        </TouchableOpacity>)}
        {animatedTool(1, <View testID="reference-rotate-handle" accessible accessibilityRole="adjustable" accessibilityLabel="Rotate reference image"
          accessibilityHint="Drag this control or drag inside the panel to rotate"
          accessibilityState={{ selected: activeTool === 'rotate' }}
          accessibilityValue={{ min: 0,max: 360,now: Math.round(props.image.rotation) }}
          accessibilityActions={[{ name: 'increment' },{ name: 'decrement' }]}
          onAccessibilityTap={() => { setActiveTool('rotate'); setOpacityOpen(false); }}
          onAccessibilityAction={event => props.onCommit(rotateTracingImage(props.image,event.nativeEvent.actionName === 'increment' ? 15 : -15))}
          style={[styles.button,selected('rotate')]} {...rotate.panHandlers}>
          <RotateCw size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={activeTool === 'rotate' ? ACTIVE_COLOR : IMAGE_COLOR} />
        </View>)}
        {animatedTool(2, <View testID="reference-scale-handle" accessible accessibilityRole="adjustable" accessibilityLabel="Resize reference image"
          accessibilityHint="Drag this control or drag inside the panel to resize"
          accessibilityState={{ selected: activeTool === 'scale' }}
          accessibilityActions={[{ name: 'increment' },{ name: 'decrement' }]}
          onAccessibilityTap={() => { setActiveTool('scale'); setOpacityOpen(false); }}
          onAccessibilityAction={event => props.onCommit(resizeTracingImage(props.image,event.nativeEvent.actionName === 'increment' ? 1.1 : 1/1.1))}
          style={[styles.button,selected('scale')]} {...scale.panHandlers}>
          <Maximize2 size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={activeTool === 'scale' ? ACTIVE_COLOR : IMAGE_COLOR} />
        </View>)}
        {animatedTool(3, <TouchableOpacity accessibilityRole="button" accessibilityLabel="Adjust reference opacity" accessibilityState={{ expanded: opacityOpen }}
          onPress={() => setOpacityOpen(value => !value)} style={[styles.button,opacityOpen && styles.selected]}>
          <Blend size={IMAGE_ICON_SIZE} strokeWidth={2.2} color={opacityOpen ? ACTIVE_COLOR : IMAGE_COLOR} />
        </TouchableOpacity>)}
        {animatedTool(4, <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete reference image"
          onPress={() => props.onCommit(undefined)} style={[styles.button,styles.deleteButton]}><Trash2 size={IMAGE_ICON_SIZE} strokeWidth={2.2} color="#EF4444" /></TouchableOpacity>)}
      </>}

    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject,zIndex: 50 },
  toolbar: { position: 'absolute',overflow: 'visible' },
  controlTarget: { position: 'absolute',width: IMAGE_CONTROL_TARGET,height: IMAGE_CONTROL_HEIGHT,alignItems: 'center',justifyContent: 'center' },
  selected: { backgroundColor: '#F0F9FF',borderColor: ACTIVE_COLOR },
  deleteButton: { borderColor: '#EF4444' },
  doneButton: { borderColor: '#16A34A' },
  button: { width: IMAGE_BUTTON_SIZE,height: IMAGE_BUTTON_SIZE,borderRadius: IMAGE_BUTTON_SIZE/2,
    alignItems: 'center',justifyContent: 'center',backgroundColor: '#FFFFFF',borderWidth: 1.25,borderColor: IMAGE_COLOR,
    boxShadow: [{ offsetX: 0,offsetY: 1,blurRadius: 2,color: 'rgba(0,0,0,0.22)' },
      { offsetX: 0,offsetY: 0,blurRadius: 5,spreadDistance: 2,color: 'rgba(255,255,255,0.95)' }] },
  opacityCard: { position: 'absolute',left: 5,paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.97)',borderRadius: 8,borderWidth: StyleSheet.hairlineWidth,borderColor: '#CBD5E1' },
  opacityRow: { flexDirection: 'row',alignItems: 'center',gap: 6,height: 28 },
  opacityLabel: { fontSize: 9,color: '#64748B' },
  percentage: { fontSize: 9,color: '#64748B',width: 26,textAlign: 'right' },
  slider: { flex: 1,height: 28,justifyContent: 'center' },
  track: { position: 'absolute',left: 0,right: 0,height: 2,borderRadius: 2,backgroundColor: '#D9D2E6' },
  filledTrack: { position: 'absolute',height: 2,borderRadius: 2,backgroundColor: '#9B83BF' },
  thumb: { position: 'absolute',width: 12,height: 12,borderRadius: 6,backgroundColor: '#FFFFFF',borderWidth: 1.5,borderColor: '#9B83BF' },
});
