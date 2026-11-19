import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Image,
  ActivityIndicator,
} from 'react-native';
import { ComicPanel, PanelMode, TracingImage, PanelCorners, PanelBorderStyle, PanelInkGeometry } from '../types/comic';
import { TracingImageControls } from './TracingImageControls';
import Svg, { Polygon } from 'react-native-svg';
import { PanelSurface } from './PanelSurface';
import { PANEL_ICON_SCALE } from './panelIconSizing';
import { PanelBorderIcon } from './PanelBorderIcon';
import { PanelCornerHandle } from './PanelCornerHandle';
import { snapPanelMove, snapPanelResize, PanelSnapGuide, ShapeUpdate } from '../utils/panelSnap';
import { panelCorners, panelControlLayout, panelHandleSide, panelsCollide, panelRenderedFrame } from '../utils/panelGeometry';
import { Image as ImageIcon, Move, Pen, Trash2, ZoomIn, ZoomOut } from 'lucide-react-native';
import { PencilKitView } from '../../PencilKitView';

const MODE_STYLE = {
  layout: { border: '#3B82F6', icon: '#3B82F6', bg: '#FFFFFF', buttonBorder: '#3B82F6' },
  draw:   { border: '#F97316', icon: '#F97316', bg: '#FFFFFF', buttonBorder: '#F97316' },
  null:   { border: '#1E293B', icon: '#1E293B', bg: 'transparent', buttonBorder: 'transparent' },
};

interface PanelProps {
  selectionTimestamp?: number;
  interactive?: boolean;
  hidden?: boolean;
  displayPosition?: { x: number; y: number };
  displayScale?: number;
  focused?: boolean;
  onToggleFocus?: () => void;
  onShapeChange?: (id: string, update: ShapeUpdate) => void;
  onBorderStyleChange?: (id: string, style: PanelBorderStyle) => void;
  onImportTracingImage?: (panelId: string) => void;
  importingTracingImage?: boolean;
  stackOrder?: number;
  canvasScale?: number;
  panel: ComicPanel;
  mode: PanelMode | undefined;
  transparentBackground?: boolean;
  tracingEditing?: boolean;
  onTracingEditingChange?: (panelId: string, editing: boolean) => void;
  onTracingImageChange?: (panelId: string, image: TracingImage | undefined) => void | Promise<void>;
  otherPanels?: ComicPanel[];
  sheetBounds?: { width: number; height: number };
  onGuidesChange?: (guides: { type: 'vertical' | 'horizontal'; pos: number }[]) => void;
  onSelect: (id: string) => void;
  onModeChange: (id: string) => void;
  onMove: (id: string, newPos: { x: number; y: number }) => void;
  onResize: (id: string, newSize: { width: number; height: number; x?: number; y?: number; corners?: PanelCorners; shapeRevision?: number; resizeInk?: boolean; warpInk?: boolean; tracingImage?: ComicPanel['tracingImage'] }) => void;
  onDelete: (id: string) => void;
  onDoubleTap: (id: string) => void;
  onDrawingUpdate?: (id: string, drawingData: string, geometry?: PanelInkGeometry) => void;
}

const PANEL_BORDER_WIDTH = 2;
const RESIZE_HANDLE_SIZE = 28;

export const Panel: React.FC<PanelProps> = ({
  selectionTimestamp = 0,
  interactive = true,
  hidden = false,
  displayPosition,
  displayScale = 1,
  focused = false,
  onToggleFocus,
  onShapeChange,
  onBorderStyleChange,
  onImportTracingImage,
  importingTracingImage = false,
  stackOrder = 0,
  canvasScale = 1,
  panel: storedPanel,
  mode,
  transparentBackground = false,
  tracingEditing = false,
  onTracingEditingChange,
  onTracingImageChange,
  otherPanels = [],
  sheetBounds,
  onGuidesChange,
  onSelect,
  onModeChange,
  onMove,
  onResize,
  onDelete,
  onDoubleTap,
  onDrawingUpdate,
}) => {
  const [reshaping, setReshaping] = useState(false);
  const reshapingSideRef = useRef(panelHandleSide(storedPanel, otherPanels));
  const reshapingRef = useRef(reshaping);
  reshapingRef.current = reshaping;
  const [borderMenu, setBorderMenu] = useState(false);
  useEffect(() => { setReshaping(false); setBorderMenu(false); }, [mode]);
  const [shapePreview, setShapePreview] = useState<ShapeUpdate | null>(null);
  const [geometryPreview, setGeometryPreview] = useState<Partial<ComicPanel> | null>(null);
  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);
  useEffect(() => { setGeometryPreview(null); }, [storedPanel.x, storedPanel.y, storedPanel.width, storedPanel.height, storedPanel.corners, mode]);
  useEffect(() => { setShapePreview(null); }, [storedPanel.corners, mode]);
  const panel = { ...storedPanel, ...geometryPreview, ...shapePreview };
  const corners = panelCorners(panel);
  const previewingShape = shapePreview !== null || geometryPreview !== null;
  const nativeShapeFrame = useMemo(() => ({ x: panel.x, width: panel.width - 4, height: panel.height - 4,
    revision: panel.shapeRevision ?? 0, preview: previewingShape, resizeInk: panel.resizeInk ?? false,
    warpInk: panel.warpInk ?? false, corners,
    contentBounds: {
      x: Math.min(...corners.map(p => p.x)) * (panel.width - 4),
      y: Math.min(...corners.map(p => p.y)) * (panel.height - 4),
      width: (Math.max(...corners.map(p => p.x)) - Math.min(...corners.map(p => p.x))) * (panel.width - 4),
      height: (Math.max(...corners.map(p => p.y)) - Math.min(...corners.map(p => p.y))) * (panel.height - 4),
    } }),
    [panel.x, panel.width, panel.height, panel.shapeRevision, panel.resizeInk, panel.warpInk, corners, previewingShape]);
  const shapePoints = corners.map(p => `${2 + p.x * (panel.width - 4)},${2 + p.y * (panel.height - 4)}`).join(' ');
  const handleSide = resizingSide ?? (reshaping ? reshapingSideRef.current : panelHandleSide(panel, otherPanels));
  const handleIndex = handleSide === 'left' ? 3 : 2;
  const handleSideRef = useRef(handleSide);
  handleSideRef.current = handleSide;
  const toggleReshaping = () => {
    if (!reshapingRef.current) { reshapingSideRef.current = handleSideRef.current; }
    setReshaping(value => !value);
  };
  const resizeStartRef = useRef(panel);
  const resizeSideRef = useRef(handleSide);
  const toolbar = panelControlLayout({ ...panel, corners });
  const visualButtonSize = toolbar.buttonSize * PANEL_ICON_SCALE;
  const buttonDimensions = { width: visualButtonSize, height: visualButtonSize, borderRadius: visualButtonSize / 2 };
  const touchPadding = (toolbar.buttonSize - visualButtonSize) / 2;
  const iconHitSlop = { top: touchPadding, right: touchPadding, bottom: touchPadding, left: touchPadding };
  const iconSize = Math.min(25, toolbar.buttonSize * 0.72) * PANEL_ICON_SCALE;
  const borderStyle = panel.borderStyle ?? 'solid';
  const [tracingPreview, setTracingPreview] = useState<TracingImage | null>(null);
  useEffect(() => { setTracingPreview(null); }, [panel.tracingImage, tracingEditing]);
  const reference = tracingPreview ?? panel.tracingImage;
  const referenceVisible = !!reference && reference.visible !== false;
  const referenceRenderScale = focused ? Math.max(1, canvasScale) : 1;
  const scaleRef = useRef(canvasScale);
  scaleRef.current = canvasScale;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const panelRef = useRef(panel);
  panelRef.current = panel;

  const otherPanelsRef = useRef(otherPanels);
  otherPanelsRef.current = otherPanels;

  const sheetBoundsRef = useRef(sheetBounds);
  sheetBoundsRef.current = sheetBounds;

  const onGuidesChangeRef = useRef(onGuidesChange);
  onGuidesChangeRef.current = onGuidesChange;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;

  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  const moveStartPanelRef = useRef(storedPanel);
  const moveResultRef = useRef<{ x: number; y: number } | null>(null);
  const resizeResultRef = useRef<ReturnType<typeof snapPanelResize> | null>(null);
  const resizeDraggedRef = useRef(false);
  const finishMove = () => {
    const result = moveResultRef.current;
    moveResultRef.current = null;
    if (result && (result.x !== moveStartPanelRef.current.x || result.y !== moveStartPanelRef.current.y)) {
      Promise.resolve(onMoveRef.current(panelRef.current.id, result))
        .finally(() => setGeometryPreview(current => current === result ? null : current));
    } else { setGeometryPreview(null); }
    onGuidesChangeRef.current?.([]);
  };
  const finishResize = () => {
    setResizingSide(null);
    const result = resizeResultRef.current;
    resizeResultRef.current = null;
    const start = resizeStartRef.current;
    if (result && (result.width !== start.width || result.height !== start.height
      || (result.x !== undefined && result.x !== start.x)
      || JSON.stringify(result.corners) !== JSON.stringify(start.corners))) {
      Promise.resolve(onResizeRef.current(panelRef.current.id, result))
        .finally(() => setGeometryPreview(current => current === result ? null : current));
    } else { setGeometryPreview(null); }
    onGuidesChangeRef.current?.([]);
  };
  const startPosRef = useRef({ x: panel.x, y: panel.y });

  // Double-tap tracking
  const lastTapRef = useRef<number>(0);
  const DOUBLE_TAP_DELAY = 300;

  // 이미 선택된 패널인지 추적 (선택 직후 첫 터치에서는 이동 막기)
  const isAlreadySelectedRef = useRef(false);

  // Layout mode: move panel with magnetic snap
  const movePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => modeRef.current === 'layout' || !modeRef.current,
      onMoveShouldSetPanResponder: (_, g) => {
        if (modeRef.current !== 'layout' || reshapingRef.current) return false;
        return Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12;
      },
      onPanResponderGrant: () => {
        moveResultRef.current = null;
        startPosRef.current = { x: panelRef.current.x, y: panelRef.current.y };
        moveStartPanelRef.current = panelRef.current;
        isAlreadySelectedRef.current = modeRef.current === 'layout';
      },
      onPanResponderMove: (_, g) => {
        if (modeRef.current !== 'layout' || reshapingRef.current) return;
        if (!isAlreadySelectedRef.current) return;
        const dx = Math.abs(g.dx);
        const dy = Math.abs(g.dy);
        if (dx > 12 || dy > 12 || moveResultRef.current) {
          const target = snapPanelMove(panelRef.current, {
            x: startPosRef.current.x + g.dx / scaleRef.current,
            y: startPosRef.current.y + g.dy / scaleRef.current,
          }, otherPanelsRef.current, sheetBoundsRef.current);
          if (otherPanelsRef.current.some(other => !panelsCollide(panelRenderedFrame(moveStartPanelRef.current), panelRenderedFrame(other), 0)
            && panelsCollide(panelRenderedFrame({ ...panelRef.current, x: target.x, y: target.y }), panelRenderedFrame(other), 0))) { return; }
          moveResultRef.current = { x: target.x, y: target.y };
          setGeometryPreview(moveResultRef.current);
          onGuidesChangeRef.current?.(target.guides);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (moveResultRef.current) { finishMove(); isAlreadySelectedRef.current = false; return; }
        if (reshapingRef.current) {
          if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
            setReshaping(false);
            setShapePreview(null);
          }
          isAlreadySelectedRef.current = false;
          onGuidesChangeRef.current?.([]);
          return;
        }
        const dx = Math.abs(g.dx);
        const dy = Math.abs(g.dy);
        if (dx < 10 && dy < 10) {
          const now = Date.now();
          if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // 더블클릭 시 바로 드로우 모드로 진입
            onDoubleTapRef.current(panelRef.current.id);
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
            // 이미 레이아웃 모드로 선택된 박스 자체를 클릭하면 드로우 모드로 전환!
            if (isAlreadySelectedRef.current) {
              onDoubleTapRef.current(panelRef.current.id); // draw 모드로 전환
            } else {
              // A first tap selects the panel directly in Draw mode.
              onSelectRef.current(panelRef.current.id);
            }
          }
        }
        isAlreadySelectedRef.current = false;
        if (onGuidesChangeRef.current) {
          onGuidesChangeRef.current([]);
        }
      },
      onPanResponderTerminate: finishMove,
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // Layout mode: resize handle with magnetic snap
  const resizePR = useRef(
    PanResponder.create({
      onPanResponderTerminationRequest: () => false,
      onStartShouldSetPanResponder: () => modeRef.current === 'layout',
      onPanResponderGrant: () => {
        resizeResultRef.current = null;
        resizeDraggedRef.current = false;
        resizeStartRef.current = panelRef.current;
        resizeSideRef.current = handleSideRef.current;
        setResizingSide(resizeSideRef.current);
      },
      onPanResponderMove: (_, g) => {
        if (modeRef.current !== 'layout') { return; }
        if (Math.abs(g.dx) >= 5 || Math.abs(g.dy) >= 5) { resizeDraggedRef.current = true; }
        const guides: PanelSnapGuide[] = [];
        const target = snapPanelResize(resizeStartRef.current, g.dx / scaleRef.current, g.dy / scaleRef.current,
          resizeSideRef.current, otherPanelsRef.current, sheetBoundsRef.current, guides);
        if (otherPanelsRef.current.some(other => !panelsCollide(panelRenderedFrame(resizeStartRef.current), panelRenderedFrame(other), 0)
          && panelsCollide(panelRenderedFrame({ ...resizeStartRef.current, ...target }), panelRenderedFrame(other), 0))) {
          onGuidesChangeRef.current?.([]);
          return;
        }
        resizeResultRef.current = target;
        setGeometryPreview(target);
        onGuidesChangeRef.current?.(guides);
      },
      onPanResponderRelease: (_, g) => {
        if (!resizeDraggedRef.current && Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) {
          resizeResultRef.current = null;
          setGeometryPreview(null);
          setResizingSide(null);
          toggleReshaping();
        } else { finishResize(); }
        if (onGuidesChangeRef.current) {
          onGuidesChangeRef.current([]);
        }
      },
      onPanResponderTerminate: finishResize,
    })
  ).current;

  const styleConfig = MODE_STYLE[mode ?? 'null'];
  const isDraw = mode === 'draw';
  const isDrawingOrEditing = isDraw;
  const editingReference = isDraw && tracingEditing;
  // Render a focused outline at final screen size, outside the panel's
  // transformed subtree. Crop to visible vertices rather than the retained
  // (potentially much larger) ink frame.
  const focusedOutline = focused ? (() => {
    const sheetScale = Math.max(0.01, canvasScale / Math.max(0.01, displayScale));
    const points = corners.map(point => ({
      x: (2 + point.x * (panel.width - 4)) * displayScale * sheetScale,
      y: (2 + point.y * (panel.height - 4)) * displayScale * sheetScale,
    }));
    const minX = Math.min(...points.map(point => point.x)), minY = Math.min(...points.map(point => point.y));
    const stroke = (mode ? 3 : panel.borderWidth ?? 2) * sheetScale;
    const padding = stroke / 2 + 1;
    return {
      sheetScale,
      left: (displayPosition?.x ?? panel.x) + panel.width * (1 - displayScale) / 2 + (minX - padding) / sheetScale,
      top: (displayPosition?.y ?? panel.y) + panel.height * (1 - displayScale) / 2 + (minY - padding) / sheetScale,
      width: Math.max(...points.map(point => point.x)) - minX + padding * 2,
      height: Math.max(...points.map(point => point.y)) - minY + padding * 2,
      points: points.map(point => `${point.x - minX + padding},${point.y - minY + padding}`).join(' '),
    };
  })() : null;
  const outlineStrokeScale = focusedOutline?.sheetScale ?? 1;
  const outlineDash = (values: number[]) => values.map(value => value * outlineStrokeScale).join(' ');

  // This overlay is a sibling of the magnified panel. It already avoids the
  // panel zoom; keep the sheet's normal fit scale so icons match their
  // unzoomed screen size. Anchor to the actual top-left vertex, not min X.
  const focusedToolbarStyle = {
    left: (displayPosition?.x ?? panel.x) + panel.width * (1 - displayScale) / 2
      + (2 + corners[0].x * (panel.width - 4)) * displayScale,
    top: (displayPosition?.y ?? panel.y) + panel.height * (1 - displayScale) / 2
      + (2 + corners[0].y * (panel.height - 4)) * displayScale
      - (visualButtonSize + 10),
    right: undefined,
    width: visualButtonSize * 3 + 12 + (visualButtonSize + 6) * 0.35,
    height: visualButtonSize,
  };
  const outlineWidth = focusedOutline?.width ?? panel.width;
  const outlineHeight = focusedOutline?.height ?? panel.height;
  const focusedVectorStyle = focusedOutline ? {
    left: focusedOutline.left, top: focusedOutline.top, opacity: hidden ? 0 : 1,
    transformOrigin: 'top left' as const, transform: [{ scale: 1 / focusedOutline.sheetScale }],
  } : undefined;
  const focusedPaper = focusedOutline && <Svg pointerEvents="none" testID="focused-panel-paper-layer"
    style={[{ position: 'absolute', zIndex: stackOrder }, focusedVectorStyle]}
    width={outlineWidth} height={outlineHeight} viewBox={`0 0 ${outlineWidth} ${outlineHeight}`}>
    <Polygon testID="panel-paper" points={focusedOutline.points} fill={transparentBackground ? 'none' : '#FFFFFF'} />
  </Svg>;
  // Composite the vector outline above both toolbars' white halos. Keep it
  // outside the ink container so a sibling image toolbar cannot wash it out.
  const panelOutline = (
    <Svg pointerEvents="none" testID="panel-outline-layer"
      style={[{ position: 'absolute', left: displayPosition?.x ?? panel.x, top: displayPosition?.y ?? panel.y,
        opacity: hidden ? 0 : 1, zIndex: 85, transform: [{ scale: displayScale }] }, focusedVectorStyle]}
      width={outlineWidth} height={outlineHeight} viewBox={`0 0 ${outlineWidth} ${outlineHeight}`}>
      {borderStyle !== 'none' && <Polygon testID="panel-border" points={focusedOutline?.points ?? shapePoints} fill="none"
        stroke={mode ? styleConfig.border : panel.borderColor ?? '#1E293B'}
        strokeWidth={(mode ? 3 : panel.borderWidth ?? 2) * outlineStrokeScale}
        strokeDasharray={borderStyle === 'dashed' ? outlineDash([8, 6]) : borderStyle === 'dotted' ? outlineDash([0.1, 6]) : undefined}
        strokeLinecap={borderStyle === 'dotted' ? 'round' : 'butt'} />}
      {mode && borderStyle === 'none' && <Polygon points={focusedOutline?.points ?? shapePoints} fill="none"
        stroke={styleConfig.border} strokeWidth={3 * outlineStrokeScale} strokeDasharray={outlineDash([4, 5])} opacity={0.65} />}
    </Svg>
  );
  const panelControls = mode && !hidden ? (
        <View testID="panel-toolbar" style={[styles.topBar, focused ? focusedToolbarStyle : { top: toolbar.top, left: toolbar.left, right: toolbar.right }]} pointerEvents="box-none">
          <View testID="panel-left-controls" style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Panel mode: ${mode === 'draw' ? 'Draw' : 'Layout'}`}
            accessibilityHint="Switch between Layout and Draw. Use the lasso in the drawing palette to select strokes."
            style={[styles.circleButton, buttonDimensions, { marginRight: (visualButtonSize + 6) * 0.35, backgroundColor: styleConfig.bg, borderColor: styleConfig.buttonBorder }]}
            onPress={() => {
              setReshaping(false);
              setShapePreview(null);
              setBorderMenu(false);
              isAlreadySelectedRef.current = false;
              lastTapRef.current = 0;
              onModeChange(storedPanel.id);
            }}
            activeOpacity={0.9}
            hitSlop={{ top: 8 + touchPadding, right: 8 + touchPadding, bottom: 8 + touchPadding, left: 8 + touchPadding }}
          >
            {mode === 'layout' && <Move size={iconSize} color={styleConfig.icon} strokeWidth={2.2} />}
            {mode === 'draw' && <Pen size={iconSize} color={styleConfig.icon} strokeWidth={2.2} />}
          </TouchableOpacity>

          {mode === 'layout' && onBorderStyleChange && <TouchableOpacity accessibilityRole="button"
            activeOpacity={0.9}
            hitSlop={iconHitSlop} accessibilityLabel={`Panel border: ${borderStyle}`} accessibilityState={{ expanded: borderMenu }}
            onPress={() => setBorderMenu(value => !value)} style={[styles.circleButton, buttonDimensions, { borderColor: styleConfig.buttonBorder }]}>
            <PanelBorderIcon value={borderStyle} size={iconSize} color={styleConfig.icon} />
          </TouchableOpacity>}
          {mode === 'draw' && onToggleFocus && <TouchableOpacity accessibilityRole="button"
            activeOpacity={0.9}
            hitSlop={iconHitSlop} accessibilityLabel={focused ? 'Zoom out panel' : 'Zoom in panel'} onPress={onToggleFocus}
            style={[styles.circleButton, buttonDimensions, { borderColor: styleConfig.buttonBorder }]}>
            {focused ? <ZoomOut size={iconSize} color={styleConfig.icon} strokeWidth={2.2} /> : <ZoomIn size={iconSize} color={styleConfig.icon} strokeWidth={2.2} />}
          </TouchableOpacity>}
          {mode === 'draw' && onImportTracingImage && <TouchableOpacity
            accessibilityRole="button" hitSlop={iconHitSlop} accessibilityLabel="Import panel reference image"
            accessibilityHint="Choose an image for this panel from Photos or Files"
            accessibilityState={{ disabled: importingTracingImage, busy: importingTracingImage }}
            disabled={importingTracingImage} onPress={() => onImportTracingImage(panel.id)}
            style={[styles.circleButton, buttonDimensions, { borderColor: styleConfig.buttonBorder }, importingTracingImage && styles.importing]} activeOpacity={0.9}>
            {importingTracingImage ? <ActivityIndicator size="small" color={styleConfig.icon} />
              : <ImageIcon size={iconSize} color={styleConfig.icon} strokeWidth={2.2} />}
          </TouchableOpacity>}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
          {mode === 'layout' && (
            <TouchableOpacity
              accessibilityRole="button"
              hitSlop={iconHitSlop} accessibilityLabel="Delete panel"
              style={[styles.circleButton, buttonDimensions, { borderColor: styleConfig.buttonBorder }]}
              onPress={() => onDelete(panel.id)}
              activeOpacity={0.9}
            >
              <Trash2 size={iconSize} color={styleConfig.icon} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
          </View>
          {borderMenu && mode === 'layout' && <View testID="panel-border-menu" style={[styles.borderMenu, { left: Math.min(toolbar.buttonSize + 6, Math.max(0, panel.width - 4 - toolbar.left - toolbar.right - 44)) }]}>
            {(['solid', 'dashed', 'dotted', 'none'] as PanelBorderStyle[]).map(value => <TouchableOpacity key={value}
              accessibilityRole="button" accessibilityLabel={`Use ${value} panel border`} accessibilityState={{ selected: borderStyle === value }}
              style={[styles.borderOption, borderStyle === value && { backgroundColor: '#EAF1FF' }]}
              onPress={() => { onBorderStyleChange?.(panel.id, value); setBorderMenu(false); }}>
              <PanelBorderIcon value={value} color={styleConfig.icon} />
            </TouchableOpacity>)}
          </View>}
        </View>
  ) : null;

  const referenceControls = isDraw && panel.tracingImage && reference && onTracingImageChange && onTracingEditingChange && <View
      testID="panel-reference-overlay" pointerEvents={interactive && !hidden ? 'box-none' : 'none'}
      accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={{ position: 'absolute', overflow: 'visible', opacity: hidden ? 0 : 1, zIndex: focused ? 60 : stackOrder,
        left: (displayPosition?.x ?? panel.x) + panel.width * (1 - displayScale) / 2 + 2 * displayScale,
        top: (displayPosition?.y ?? panel.y) + panel.height * (1 - displayScale) / 2 + 2 * displayScale,
        width: (panel.width - 4) * displayScale, height: (panel.height - 4) * displayScale }}>
      <TracingImageControls image={reference} editing={tracingEditing} bounds={{ width: panel.width - 4,height: panel.height - 4 }}
        canvasScale={canvasScale} onPreview={setTracingPreview} corners={corners} focused={focused} displayScale={displayScale}
        onEditingChange={editing => onTracingEditingChange(panel.id, editing)}
        onCommit={image => onTracingImageChange(panel.id, image)} />
    </View>;

  return (
    <>
    {focusedPaper}
    <View
      testID="panel-container"
      pointerEvents={interactive && !hidden ? 'box-none' : 'none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.panelContainer,
        transparentBackground && styles.transparentPanel,
        {
          left: displayPosition?.x ?? panel.x,
          top: displayPosition?.y ?? panel.y,
          transform: [{ scale: displayScale }],
          opacity: hidden ? 0 : 1,
          width: panel.width,
          height: panel.height,
          zIndex: stackOrder,
          elevation: 3 + stackOrder,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          shadowOpacity: 0,
          borderStyle: 'solid',
          borderWidth: PANEL_BORDER_WIDTH,
        },
      ]}
    >
      {/* 1. 패널 내부 캔버스: Draw mode includes PencilKit’s pen, eraser and lasso tools */}
      {!focused && <Svg pointerEvents="none" style={{ position: 'absolute', left: -2, top: -2, zIndex: 0 }} width={panel.width} height={panel.height}
        viewBox={`0 0 ${panel.width} ${panel.height}`}>
        <Polygon testID="panel-paper" points={shapePoints} fill={transparentBackground ? 'none' : '#FFFFFF'} />
      </Svg>}
      <PanelSurface pointerEvents="box-none" clipContent={!!reference} polygonPoints={corners} style={styles.canvasWrapper}>
        {reference && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View testID={`panel-reference-image-frame-${panel.id}`} style={{ position: 'absolute', left: reference.x, top: reference.y,
            width: reference.width, height: reference.height, opacity: referenceVisible ? reference.opacity : 0, transform: [{ rotate: `${reference.rotation}deg` }] }}>
            <Image testID={`panel-reference-image-${panel.id}`} source={{ uri: reference.uri }} resizeMode="stretch"
              style={{ width: reference.width * referenceRenderScale,
                height: reference.height * referenceRenderScale,
                transformOrigin: 'top left', transform: [{ scale: 1 / referenceRenderScale }] }} />
          </View>
        </View>}
        <PencilKitView
          style={StyleSheet.absoluteFill}
          isDrawingActive={isDrawingOrEditing && !editingReference}
          drawingTool="pen"
          panelId={panel.id}
          selectionTimestamp={selectionTimestamp}
          renderScale={focused ? Math.max(1, canvasScale) : 1}
          polygonPoints={corners}
          shapeFrame={nativeShapeFrame}
          drawingData={panel.drawingData}
          transparentBackground={true}
          onDrawingChange={(e) => {
            if (onDrawingUpdate) {
              onDrawingUpdate(panel.id, e.nativeEvent.drawingData, e.nativeEvent.geometry);
            }
          }}
        />

        {!isDrawingOrEditing && !editingReference && <View style={StyleSheet.absoluteFill} {...movePR.panHandlers} />}
      </PanelSurface>

      {!focused && panelControls}

    </View>
    {panelOutline}
    <View pointerEvents={interactive && !hidden ? 'box-none' : 'none'}
      accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[StyleSheet.absoluteFill, { zIndex: 90, opacity: hidden ? 0 : 1 }]}>
      {/* 4. 리사이즈 핸들 */}
      {mode === 'layout' && !editingReference && !reshaping && (
        <View accessibilityRole="button" accessibilityLabel="Resize or reshape panel" onAccessibilityTap={toggleReshaping} accessibilityHint="Drag to resize. Tap to reshape this corner." style={[styles.resizeHandle, { bottom: undefined, right: undefined, left: panel.x + 2 + corners[handleIndex].x * (panel.width - 4) - 14, top: panel.y + 2 + corners[handleIndex].y * (panel.height - 4) - 14 }]} {...resizePR.panHandlers}>
          <View style={styles.resizeKnob} />
        </View>
      )}
      {mode === 'layout' && !editingReference && reshaping && <PanelCornerHandle
        panel={{ ...panel, corners }} offset={{ x: panel.x + 2, y: panel.y + 2 }} side={handleSide} scale={canvasScale} otherPanels={otherPanels} sheetBounds={sheetBounds}
        onPreview={setShapePreview} onCommit={value => {
          Promise.resolve(onShapeChange?.(panel.id, value))
            .finally(() => setShapePreview(current => current === value ? null : current));
        }} onClose={() => setReshaping(false)} />}
    </View>
    {focused && panelControls}
    {referenceControls}
    </>
  );
};

const styles = StyleSheet.create({
  borderMenu: { position: 'absolute', top: 42, left: 0, width: 44, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#93B4ED', padding: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  borderOption: { alignItems: 'center', justifyContent: 'center', padding: 5, borderRadius: 8 },
  importing: { opacity: 0.5 },
  transparentPanel: { backgroundColor: 'transparent', shadowOpacity: 0 },
  transparentCanvas: { backgroundColor: 'transparent' },
  panelContainer: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  canvasWrapper: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 1,
    borderRadius: 1,
  },
  topBar: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 60,
  },
  circleButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#94A3B8',
    borderWidth: 1.25,
    boxShadow: [
      { offsetX: 0, offsetY: 2, blurRadius: 3, color: 'rgba(0,0,0,0.28)' },
      { offsetX: 0, offsetY: 0, blurRadius: 9, spreadDistance: 4, color: 'rgba(255,255,255,0.95)' },
    ],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 2,
  },
  resizeHandle: {
    position: 'absolute',
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  resizeKnob: {
    width: 14 * PANEL_ICON_SCALE * 1.2,
    height: 14 * PANEL_ICON_SCALE * 1.2,
    borderRadius: 7 * PANEL_ICON_SCALE * 1.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
