import { PANEL_ICON_SCALE } from './panelIconSizing';
import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Blend, Check, Eye, EyeOff, Maximize2, Move, RotateCw, Settings2, Trash2 } from 'lucide-react-native';
import { AppText as Text } from './AppText';
import { TracingImage } from '../types/comic';
import { gizmoTransform, resizeTracingImage, rotateTracingImage } from '../utils/tracingImage';

interface Props {
  image: TracingImage;
  editing: boolean;
  bounds: { width: number; height: number };
  canvasScale: number;
  onEditingChange: (editing: boolean) => void;
  onPreview: (image: TracingImage | null) => void;
  onCommit: (image: TracingImage | undefined) => void | Promise<void>;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value));

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
  useEffect(() => {
    if (!props.editing) { setOpacityOpen(false); setActiveTool('move'); }
  },[props.editing]);
  const latest = useRef({ ...props,activeTool });
  latest.current = { ...props,activeTool };
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
  const columns = Math.max(1,Math.floor((props.bounds.width-14)/28));
  const toolbarHeight = 4+28*Math.ceil((props.editing ? 7 : 2)/columns);
  const popupWidth = Math.min(180,Math.max(48,props.bounds.width-12));
  const selected = (tool: Tool) => activeTool === tool && styles.selected;
  return <View pointerEvents="box-none" testID="panel-reference-controls" style={styles.overlay}>
    {props.editing && visible && <View testID="reference-image-gesture-surface" style={StyleSheet.absoluteFill} {...move.panHandlers} />}
    {props.editing && opacityOpen && <View testID="reference-opacity-popover"
      style={[styles.opacityCard,{ width: popupWidth,bottom: toolbarHeight+10 }]}>
      <OpacitySlider value={props.image.opacity} canvasScale={props.canvasScale} compact={popupWidth < 150}
        onPreview={opacity => props.onPreview({ ...props.image,opacity })}
        onCommit={async opacity => { try { await props.onCommit({ ...props.image,opacity }); } finally { props.onPreview(null); } }} />
    </View>}
    <View testID="reference-fixed-toolbar" style={[styles.toolbar,{ maxWidth: Math.max(32,props.bounds.width-10) },!props.editing && styles.quiet]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? 'Hide reference image' : 'Show reference image'}
        accessibilityHint="This panel only" onPress={() => props.onCommit({ ...props.image,visible: !visible })} style={styles.button}>
        {visible ? <Eye size={15 * PANEL_ICON_SCALE} color="#64748B" /> : <EyeOff size={15 * PANEL_ICON_SCALE} color="#64748B" />}
      </TouchableOpacity>
      {props.editing && <>
        <TouchableOpacity testID="reference-move-handle" accessibilityRole="button" accessibilityLabel="Move reference image"
          accessibilityState={{ selected: activeTool === 'move' }} accessibilityHint="Drag inside the panel to move the image"
          onPress={() => { setActiveTool('move'); setOpacityOpen(false); }} style={[styles.button,selected('move')]}>
          <Move size={15 * PANEL_ICON_SCALE} color={activeTool === 'move' ? '#7C3AED' : '#64748B'} />
        </TouchableOpacity>
        <View testID="reference-rotate-handle" accessible accessibilityRole="adjustable" accessibilityLabel="Rotate reference image"
          accessibilityHint="Drag this control or drag inside the panel to rotate"
          accessibilityState={{ selected: activeTool === 'rotate' }}
          accessibilityValue={{ min: 0,max: 360,now: Math.round(props.image.rotation) }}
          accessibilityActions={[{ name: 'increment' },{ name: 'decrement' }]}
          onAccessibilityTap={() => { setActiveTool('rotate'); setOpacityOpen(false); }}
          onAccessibilityAction={event => props.onCommit(rotateTracingImage(props.image,event.nativeEvent.actionName === 'increment' ? 15 : -15))}
          style={[styles.button,selected('rotate')]} {...rotate.panHandlers}>
          <RotateCw size={15 * PANEL_ICON_SCALE} color={activeTool === 'rotate' ? '#7C3AED' : '#64748B'} />
        </View>
        <View testID="reference-scale-handle" accessible accessibilityRole="adjustable" accessibilityLabel="Resize reference image"
          accessibilityHint="Drag this control or drag inside the panel to resize"
          accessibilityState={{ selected: activeTool === 'scale' }}
          accessibilityActions={[{ name: 'increment' },{ name: 'decrement' }]}
          onAccessibilityTap={() => { setActiveTool('scale'); setOpacityOpen(false); }}
          onAccessibilityAction={event => props.onCommit(resizeTracingImage(props.image,event.nativeEvent.actionName === 'increment' ? 1.1 : 1/1.1))}
          style={[styles.button,selected('scale')]} {...scale.panHandlers}>
          <Maximize2 size={15 * PANEL_ICON_SCALE} color={activeTool === 'scale' ? '#7C3AED' : '#64748B'} />
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Adjust reference opacity" accessibilityState={{ expanded: opacityOpen }}
          onPress={() => setOpacityOpen(value => !value)} style={[styles.button,opacityOpen && styles.selected]}>
          <Blend size={15 * PANEL_ICON_SCALE} color={opacityOpen ? '#7C3AED' : '#64748B'} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Delete reference image"
          onPress={() => props.onCommit(undefined)} style={styles.button}><Trash2 size={15 * PANEL_ICON_SCALE} color="#B56C76" /></TouchableOpacity>
      </>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={props.editing ? 'Hide image controls' : 'Show image controls'}
        onPress={() => props.onEditingChange(!props.editing)} style={styles.button}>
        {props.editing ? <Check size={15 * PANEL_ICON_SCALE} color="#64748B" /> : <Settings2 size={15 * PANEL_ICON_SCALE} color="#64748B" />}
      </TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject,zIndex: 50 },
  toolbar: { position: 'absolute',bottom: 5,left: 5,flexDirection: 'row',flexWrap: 'wrap',padding: 2,
    backgroundColor: 'rgba(255,255,255,0.94)',borderRadius: 8,borderWidth: StyleSheet.hairlineWidth,borderColor: '#CBD5E1' },
  quiet: { opacity: 0.65 },
  selected: { backgroundColor: '#F1EAFB' },
  button: { width: 28,height: 28,borderRadius: 6,alignItems: 'center',justifyContent: 'center' },
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
