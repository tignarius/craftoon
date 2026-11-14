import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Image,
  ActivityIndicator,
} from 'react-native';
import { ComicPanel, PanelMode, TracingImage } from '../types/comic';
import { TracingImageControls } from './TracingImageControls';
import { Image as ImageIcon, Move, Pen, Trash2 } from 'lucide-react-native';
import { PencilKitView } from '../../PencilKitView';

const MODE_STYLE = {
  layout: { border: '#4ECDC4', icon: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.2)' },
  draw:   { border: '#FF8C42', icon: '#FF8C42', bg: 'rgba(255, 140, 66, 0.2)' },
  null:   { border: '#1E293B', icon: '#1E293B', bg: 'transparent' },
};

interface PanelProps {
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
  onResize: (id: string, newSize: { width: number; height: number }) => void;
  onDelete: (id: string) => void;
  onDoubleTap: (id: string) => void;
  onDrawingUpdate?: (id: string, drawingData: string) => void;
}

const PANEL_GAP = 16;
const SNAP_THRESHOLD = 18;
const WORKSPACE_PADDING = 12;
const PANEL_BORDER_WIDTH = 2;
const ACTIVE_BORDER_WIDTH = 3;
const RESIZE_HANDLE_SIZE = 28;
// The active outline is independent of the fixed layout border.
const RESIZE_HANDLE_OFFSET = ACTIVE_BORDER_WIDTH / 2 - PANEL_BORDER_WIDTH - RESIZE_HANDLE_SIZE / 2;

export const Panel: React.FC<PanelProps> = ({
  onImportTracingImage,
  importingTracingImage = false,
  stackOrder = 0,
  canvasScale = 1,
  panel,
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
  const [tracingPreview, setTracingPreview] = useState<TracingImage | null>(null);
  useEffect(() => { setTracingPreview(null); }, [panel.tracingImage, tracingEditing]);
  const reference = tracingPreview ?? panel.tracingImage;
  const referenceVisible = !!reference && reference.visible !== false;
  const clearCanvas = transparentBackground || referenceVisible;
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

  const startPosRef = useRef({ x: panel.x, y: panel.y });
  const startSizeRef = useRef({ width: panel.width, height: panel.height });

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
        if (modeRef.current !== 'layout') return false;
        return Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12;
      },
      onPanResponderGrant: () => {
        startPosRef.current = { x: panelRef.current.x, y: panelRef.current.y };
        isAlreadySelectedRef.current = modeRef.current === 'layout';
      },
      onPanResponderMove: (_, g) => {
        if (modeRef.current !== 'layout') return;
        if (!isAlreadySelectedRef.current) return;
        const dx = Math.abs(g.dx);
        const dy = Math.abs(g.dy);
        if (dx > 12 || dy > 12) {
          let targetX = startPosRef.current.x + g.dx / scaleRef.current;
          let targetY = startPosRef.current.y + g.dy / scaleRef.current;
          const activeGuides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];
          const myW = panelRef.current.width;
          const myH = panelRef.current.height;

          // 캔버스 여백 스냅
          if (Math.abs(targetX - WORKSPACE_PADDING) < SNAP_THRESHOLD) {
            targetX = WORKSPACE_PADDING;
            activeGuides.push({ type: 'vertical', pos: targetX });
          }
          if (Math.abs(targetY - WORKSPACE_PADDING) < SNAP_THRESHOLD) {
            targetY = WORKSPACE_PADDING;
            activeGuides.push({ type: 'horizontal', pos: targetY });
          }

          // 다른 패널들과의 자석 스냅
          for (const other of otherPanelsRef.current) {
            // X축 스냅
            if (Math.abs(targetX - other.x) < SNAP_THRESHOLD) {
              targetX = other.x;
              activeGuides.push({ type: 'vertical', pos: targetX });
            } else if (Math.abs(targetX - (other.x + other.width + PANEL_GAP)) < SNAP_THRESHOLD) {
              targetX = other.x + other.width + PANEL_GAP;
              activeGuides.push({ type: 'vertical', pos: targetX });
            } else if (Math.abs(targetX + myW - (other.x + other.width)) < SNAP_THRESHOLD) {
              targetX = other.x + other.width - myW;
              activeGuides.push({ type: 'vertical', pos: targetX + myW });
            } else if (Math.abs(targetX + myW - (other.x - PANEL_GAP)) < SNAP_THRESHOLD) {
              targetX = other.x - PANEL_GAP - myW;
              activeGuides.push({ type: 'vertical', pos: other.x - PANEL_GAP });
            }

            // Y축 스냅
            if (Math.abs(targetY - other.y) < SNAP_THRESHOLD) {
              targetY = other.y;
              activeGuides.push({ type: 'horizontal', pos: targetY });
            } else if (Math.abs(targetY - (other.y + other.height + PANEL_GAP)) < SNAP_THRESHOLD) {
              targetY = other.y + other.height + PANEL_GAP;
              activeGuides.push({ type: 'horizontal', pos: targetY });
            } else if (Math.abs(targetY + myH - (other.y + other.height)) < SNAP_THRESHOLD) {
              targetY = other.y + other.height - myH;
              activeGuides.push({ type: 'horizontal', pos: targetY + myH });
            } else if (Math.abs(targetY + myH - (other.y - PANEL_GAP)) < SNAP_THRESHOLD) {
              targetY = other.y - PANEL_GAP - myH;
              activeGuides.push({ type: 'horizontal', pos: other.y - PANEL_GAP });
            }
          }

          const bounds = sheetBoundsRef.current;
          const maxX = bounds ? Math.max(WORKSPACE_PADDING, bounds.width - WORKSPACE_PADDING - myW) : Infinity;
          const maxY = bounds ? Math.max(WORKSPACE_PADDING, bounds.height - WORKSPACE_PADDING - myH) : Infinity;
          targetX = Math.min(maxX, Math.max(WORKSPACE_PADDING, targetX));
          targetY = Math.min(maxY, Math.max(WORKSPACE_PADDING, targetY));

          onMoveRef.current(panelRef.current.id, { x: targetX, y: targetY });
          if (onGuidesChangeRef.current) {
            onGuidesChangeRef.current(activeGuides);
          }
        }
      },
      onPanResponderRelease: (_, g) => {
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
              // 미선택 상태에서 클릭 시 먼저 레이아웃 모드로 선택
              onSelectRef.current(panelRef.current.id);
            }
          }
        }
        isAlreadySelectedRef.current = false;
        if (onGuidesChangeRef.current) {
          onGuidesChangeRef.current([]);
        }
      },
    })
  ).current;

  // Layout mode: resize handle with magnetic snap
  const resizePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => modeRef.current === 'layout',
      onPanResponderGrant: () => {
        startSizeRef.current = { width: panelRef.current.width, height: panelRef.current.height };
      },
      onPanResponderMove: (_, g) => {
        let targetW = Math.max(80, startSizeRef.current.width + g.dx / scaleRef.current);
        let targetH = Math.max(80, startSizeRef.current.height + g.dy / scaleRef.current);
        const activeGuides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];

        const rightEdge = panelRef.current.x + targetW;
        const bottomEdge = panelRef.current.y + targetH;

        // 캔버스 우하단 여백 스냅
        if (sheetBoundsRef.current) {
          const maxW = sheetBoundsRef.current.width - WORKSPACE_PADDING;
          const maxH = sheetBoundsRef.current.height - WORKSPACE_PADDING;
          if (Math.abs(rightEdge - maxW) < SNAP_THRESHOLD) {
            targetW = maxW - panelRef.current.x;
            activeGuides.push({ type: 'vertical', pos: maxW });
          }
          if (Math.abs(bottomEdge - maxH) < SNAP_THRESHOLD) {
            targetH = maxH - panelRef.current.y;
            activeGuides.push({ type: 'horizontal', pos: maxH });
          }
        }

        // 다른 패널들과의 리사이즈 스냅
        for (const other of otherPanelsRef.current) {
          // 너비(오른쪽 끝) 스냅
          if (Math.abs(rightEdge - (other.x - PANEL_GAP)) < SNAP_THRESHOLD) {
            targetW = other.x - PANEL_GAP - panelRef.current.x;
            activeGuides.push({ type: 'vertical', pos: other.x - PANEL_GAP });
          } else if (Math.abs(rightEdge - (other.x + other.width)) < SNAP_THRESHOLD) {
            targetW = other.x + other.width - panelRef.current.x;
            activeGuides.push({ type: 'vertical', pos: other.x + other.width });
          } else if (Math.abs(rightEdge - other.x) < SNAP_THRESHOLD) {
            targetW = other.x - panelRef.current.x;
            activeGuides.push({ type: 'vertical', pos: other.x });
          }

          // 높이(아래쪽 끝) 스냅
          if (Math.abs(bottomEdge - (other.y - PANEL_GAP)) < SNAP_THRESHOLD) {
            targetH = other.y - PANEL_GAP - panelRef.current.y;
            activeGuides.push({ type: 'horizontal', pos: other.y - PANEL_GAP });
          } else if (Math.abs(bottomEdge - (other.y + other.height)) < SNAP_THRESHOLD) {
            targetH = other.y + other.height - panelRef.current.y;
            activeGuides.push({ type: 'horizontal', pos: other.y + other.height });
          } else if (Math.abs(bottomEdge - other.y) < SNAP_THRESHOLD) {
            targetH = other.y - panelRef.current.y;
            activeGuides.push({ type: 'horizontal', pos: other.y });
          }
        }

        targetW = Math.max(80, targetW);
        targetH = Math.max(80, targetH);
        onResizeRef.current(panelRef.current.id, { width: targetW, height: targetH });
        if (onGuidesChangeRef.current) {
          onGuidesChangeRef.current(activeGuides);
        }
      },
      onPanResponderRelease: () => {
        if (onGuidesChangeRef.current) {
          onGuidesChangeRef.current([]);
        }
      },
    })
  ).current;

  const styleConfig = MODE_STYLE[mode ?? 'null'];
  const isDraw = mode === 'draw';
  const isDrawingOrEditing = isDraw;

  return (
    <View
      style={[
        styles.panelContainer,
        transparentBackground && styles.transparentPanel,
        {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
          zIndex: stackOrder,
          elevation: 3 + stackOrder,
          borderColor: styleConfig.border,
          borderStyle: 'solid', // 모든 모드에서 점선 없이 깔끔한 실선 유지
          borderWidth: PANEL_BORDER_WIDTH,
        },
      ]}
    >
      {/* 1. 패널 내부 캔버스: Draw mode includes PencilKit’s pen, eraser and lasso tools */}
      <View style={[styles.canvasWrapper, clearCanvas && styles.transparentCanvas]}>
        {referenceVisible && reference && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image testID={`panel-reference-image-${panel.id}`} source={{ uri: reference.uri }} resizeMode="stretch"
            style={{ position: 'absolute',left: reference.x,top: reference.y,width: reference.width,height: reference.height,
              opacity: reference.opacity,transform: [{ rotate: `${reference.rotation}deg` }] }} />
        </View>}
        <PencilKitView
          style={StyleSheet.absoluteFill}
          isDrawingActive={isDrawingOrEditing && !tracingEditing}
          drawingTool="pen"
          panelId={panel.id}
          drawingData={panel.drawingData}
          transparentBackground={clearCanvas}
          onDrawingChange={(e) => {
            if (onDrawingUpdate) {
              onDrawingUpdate(panel.id, e.nativeEvent.drawingData);
            }
          }}
        />

      </View>

      <View pointerEvents="box-none" style={styles.referenceControls}>
        {panel.tracingImage && reference && onTracingImageChange && onTracingEditingChange && <TracingImageControls
          image={reference} editing={tracingEditing} bounds={{ width: panel.width - 4,height: panel.height - 4 }}
          canvasScale={canvasScale} onPreview={setTracingPreview}
          onEditingChange={editing => onTracingEditingChange(panel.id, editing)}
          onCommit={image => onTracingImageChange(panel.id, image)} />}
      </View>

      {/* Selection must not resize or shift the live PencilKit canvas. */}
      {mode && <View pointerEvents="none" style={[styles.selectedOutline, { borderColor: styleConfig.border }]} />}

      {/* 2. 레이아웃 모드/선택 상태일 때만 동작하는 이동 오버레이 */}
      {!isDrawingOrEditing && !tracingEditing && (
        <View style={StyleSheet.absoluteFill} {...movePR.panHandlers} />
      )}

      {/* 3. 모드 전환 및 삭제 툴 버튼들 */}
      {mode && (
        <View style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Panel mode: ${mode === 'draw' ? 'Draw' : 'Layout'}`}
            accessibilityHint="Switch between Layout and Draw. Use the lasso in the drawing palette to select strokes."
            style={[styles.modeBtn, { backgroundColor: styleConfig.bg }]}
            onPress={() => onModeChange(panel.id)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {mode === 'layout' && <Move size={15} color={styleConfig.icon} />}
            {mode === 'draw' && <Pen size={15} color={styleConfig.icon} />}
          </TouchableOpacity>

          {mode === 'layout' && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete panel"
              style={styles.deleteBtn}
              onPress={() => onDelete(panel.id)}
              activeOpacity={0.75}
            >
              <Trash2 size={13} color="#EF4444" />
            </TouchableOpacity>
          )}
          {mode === 'draw' && onImportTracingImage && <TouchableOpacity
            accessibilityRole="button" accessibilityLabel="Import panel reference image"
            accessibilityHint="Choose an image for this panel from Photos or Files"
            accessibilityState={{ disabled: importingTracingImage, busy: importingTracingImage }}
            disabled={importingTracingImage} onPress={() => onImportTracingImage(panel.id)}
            style={[styles.deleteBtn,styles.imageBtn,importingTracingImage && styles.importing]} activeOpacity={0.75}>
            {importingTracingImage ? <ActivityIndicator size="small" color="#EA8A23" />
              : <ImageIcon size={15} color="#EA8A23" />}
          </TouchableOpacity>}
        </View>
      )}

      {/* 4. 리사이즈 핸들 */}
      {mode === 'layout' && !tracingEditing && (
        <View style={styles.resizeHandle} {...resizePR.panHandlers}>
          <View style={styles.resizeKnob} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  imageBtn: { backgroundColor: '#FFF5E8',borderColor: '#FED7AA' },
  importing: { opacity: 0.5 },
  referenceControls: { position: 'absolute',top: 2,left: 2,right: 2,bottom: 2,overflow: 'hidden',zIndex: 45 },
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
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  selectedOutline: {
    position: 'absolute',
    top: -PANEL_BORDER_WIDTH,
    left: -PANEL_BORDER_WIDTH,
    right: -PANEL_BORDER_WIDTH,
    bottom: -PANEL_BORDER_WIDTH,
    borderWidth: ACTIVE_BORDER_WIDTH,
    borderRadius: 2,
    zIndex: 1,
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
  modeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: RESIZE_HANDLE_OFFSET,
    right: RESIZE_HANDLE_OFFSET,
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
  },
  resizeKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ECDC4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
