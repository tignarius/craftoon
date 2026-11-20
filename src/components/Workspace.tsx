import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { CANVAS_VIEW_INSET, expandCanvasToViewport, fitCanvas } from '../utils/canvasFormat';
import { AppText as Text } from './AppText';
import { Panel } from './Panel';
import { SpeechBubble } from './SpeechBubble';
import { createPanelInFreeSpace, snapCanvasEdgeX } from '../utils/panelCreation';
import { panelsCollide, panelFocusTransform, worldCorners } from '../utils/panelGeometry';
import { ComicPanel, ComicBubble, PanelMode, ToolType, TracingImage } from '../types/comic';

import { PANEL_CLOSE_GAP, PANEL_SNAP_GAPS, SNAP_THRESHOLD } from '../utils/panelMetrics';

function snapCoordinate(value: number, targets: number[]) {
  return targets.filter(target => Math.abs(target - value) < SNAP_THRESHOLD)
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0] ?? value;
}

const WORKSPACE_PADDING = 12; // 원고지 안쪽 최소 여백 (좌우/상하 균등한 중간값)

interface WorkspaceProps {
  onImportTracingImage?: (panelId: string) => void;
  importingTracingImage?: boolean;
  editingTracingPanelId?: string | null;
  onTracingEditingChange?: (panelId: string, editing: boolean) => void;
  onTracingImageChange?: (panelId: string, image: TracingImage | undefined) => void | Promise<void>;
  canvasSize: { width: number; height: number };
  onSheetBoundsChange: (bounds: { width: number; height: number }) => void;
  panels: ComicPanel[];
  panelModes: Record<string, PanelMode>;
  bubbles: ComicBubble[];
  currentTool: ToolType;
  onAddPanel: (rect: Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'>) => void;
  onUpdatePanel: (id: string, updates: Partial<ComicPanel>) => void;
  onCommitPanelGeometry?: (id: string, updates: Partial<ComicPanel>) => void;
  onGeometryInkChange?: (id: string, drawingData: string, geometry: import('../types/comic').PanelInkGeometry) => void;
  onDeletePanel: (id: string) => void;
  onModeChange: (id: string, mode: PanelMode) => void;
  onPanelSelect: (id: string) => void;
  onPanelDoubleTap: (id: string) => void;
  onBackgroundTap: () => void;
  onAddBubble: (pos: { x: number; y: number }) => void;
  onUpdateBubble: (id: string, updates: Partial<ComicBubble>) => void;
  onDeleteBubble: (id: string) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  onImportTracingImage,
  importingTracingImage = false,
  editingTracingPanelId,
  onTracingEditingChange,
  onTracingImageChange,
  canvasSize: documentCanvasSize,
  panels,
  panelModes,
  bubbles,
  currentTool,
  onAddPanel,
  onUpdatePanel,
  onCommitPanelGeometry = onUpdatePanel,
  onGeometryInkChange,
  onDeletePanel,
  onModeChange,
  onPanelSelect,
  onPanelDoubleTap,
  onBackgroundTap,
  onAddBubble,
  onUpdateBubble,
  onDeleteBubble,
  onSheetBoundsChange,
}) => {
  const windowSize = useWindowDimensions();
  const bottomClearance = windowSize.height >= windowSize.width ? 20 : 0;
  const [selectionTiming, setSelectionTiming] = useState<{ id: string; time: number } | null>(null);
  const markSelection = (id: string) => setSelectionTiming({ id, time: Date.now() });
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const canvasSize = useMemo(() => expandCanvasToViewport(documentCanvasSize, viewport), [documentCanvasSize, viewport]);
  const sheetBounds = canvasSize;
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const focusedPanel = panels.find(p => p.id === focusedPanelId && panelModes[p.id] === 'draw');
  const focus = focusedPanel ? panelFocusTransform(focusedPanel, viewport, canvasSize) : null;
  const scale = fitCanvas(canvasSize, viewport);
  useEffect(() => { if (!focusedPanel) { setFocusedPanelId(null); } }, [focusedPanel]);
  // Changing sibling order can detach/reinsert a live PencilKit view in Fabric.
  // Keep native siblings stable; only their explicit stacking values change.
  const panelStackOrder = new Map(panels.map((panel, index) => [panel.id, index]));
  const renderPanels = [...panels].sort((a, b) => a.id.localeCompare(b.id));
  useEffect(() => { onSheetBoundsChange(sheetBounds); }, [sheetBounds, onSheetBoundsChange]);

  const [creatingRect, setCreatingRect] = useState<Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'> | null>(null);

  // 스냅 가이드라인
  const [guides, setGuides] = useState<{
    type: 'vertical' | 'horizontal';
    pos: number;
  }[]>([]);

  const creationMovedRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const creatingRef = useRef<Pick<ComicPanel, 'x' | 'y' | 'width' | 'height' | 'corners'> | null>(null);
  const sheetBoundsRef = useRef(sheetBounds);
  sheetBoundsRef.current = sheetBounds;

  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  const focusRef = useRef(false);
  focusRef.current = !!focus;
  const currentToolRef = useRef(currentTool);
  currentToolRef.current = currentTool;

  const onAddPanelRef = useRef(onAddPanel);
  onAddPanelRef.current = onAddPanel;

  const onAddBubbleRef = useRef(onAddBubble);
  onAddBubbleRef.current = onAddBubble;

  const onBackgroundTapRef = useRef(onBackgroundTap);
  onBackgroundTapRef.current = onBackgroundTap;

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  // 패널들 뒤에 깔리는 순수 배경(Background) PanResponder
  // 패널 안쪽 터치에는 전혀 관여하지 않으므로, 펜슬 드로잉 시 모드가 절대 풀리지 않음!
  const backgroundPR = useRef(
    PanResponder.create({
      onPanResponderTerminationRequest: () => false,
      onStartShouldSetPanResponder: () => !focusRef.current,
      onMoveShouldSetPanResponder: (_, g) => {
        return !focusRef.current && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6);
      },

      onPanResponderGrant: (evt) => {
        creationMovedRef.current = false;
        setCreatingRect(null);
        const { locationX, locationY } = evt.nativeEvent;
        let startX = locationX;
        let startY = locationY;

        // 드래그 시작점 자석 스냅
        for (const p of panelsRef.current) {
          startX = snapCoordinate(startX, [p.x, ...PANEL_SNAP_GAPS.flatMap(gap => [p.x + p.width + gap, p.x - gap])]);
          startY = snapCoordinate(startY, [p.y, ...PANEL_SNAP_GAPS.flatMap(gap => [p.y + p.height + gap, p.y - gap])]);
        }

        // 캔버스 여백 안으로 시작점 클램핑
        const maxW = sheetBoundsRef.current.width - WORKSPACE_PADDING;
        const maxH = sheetBoundsRef.current.height - WORKSPACE_PADDING;
        startX = Math.max(WORKSPACE_PADDING, Math.min(maxW, startX));
        startY = Math.max(WORKSPACE_PADDING, Math.min(maxH, startY));
        if (!panelsRef.current.length) { startX = snapCanvasEdgeX(startX, sheetBoundsRef.current.width); }

        startPointRef.current = { x: startX, y: startY };
        const initialRect = { x: startX, y: startY, width: 0, height: 0 };
        creatingRef.current = initialRect;
      },

      onPanResponderMove: (evt) => {
        if (!startPointRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;

        if (Math.abs(locationX - startX) > 6 || Math.abs(locationY - startY) > 6) { creationMovedRef.current = true; }
        let endX = locationX;
        let endY = locationY;
        const activeGuides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];
        if (!panelsRef.current.length) {
          const snapped = snapCanvasEdgeX(endX, sheetBoundsRef.current.width);
          if (snapped !== endX) { activeGuides.push({ type: 'vertical', pos: snapped }); }
          endX = snapped;
        }

        // 드래그 끝점 자석 스냅
        for (const p of panelsRef.current) {
          const pLeft = p.x;
          const pRight = p.x + p.width;
          const pTop = p.y;
          const pBottom = p.y + p.height;

          const nextX = snapCoordinate(endX, [...PANEL_SNAP_GAPS.map(gap => pLeft - gap), pRight, pLeft]);
          const nextY = snapCoordinate(endY, [...PANEL_SNAP_GAPS.map(gap => pTop - gap), pBottom, pTop]);
          if (nextX !== endX) { activeGuides.push({ type: 'vertical', pos: nextX }); }
          if (nextY !== endY) { activeGuides.push({ type: 'horizontal', pos: nextY }); }
          endX = nextX;
          endY = nextY;
        }

        setGuides(activeGuides);

        const candidate = createPanelInFreeSpace({ x: startX, y: startY }, { x: endX, y: endY },
          panelsRef.current, sheetBoundsRef.current);
        // Hold the last valid shape when the pointer enters occupied space.
        // Keep it until the pointer returns to a valid free-side position.
        if (candidate && candidate.width > 50 && candidate.height > 50) {
          creatingRef.current = candidate;
          setCreatingRect(candidate);
        } else {
          setGuides([]);
        }
      },

      onPanResponderRelease: () => {
        const rect = creatingRef.current;

        if (rect && rect.width > 50 && rect.height > 50) {
          // 기존 어떤 패널과도 겹치지 않는지 확인 후 생성
          const fitted = rect;
          const collides = panelsRef.current.some((p) => panelsCollide(fitted, p, PANEL_CLOSE_GAP));
          if (!collides) {
            onAddPanelRef.current(fitted);
          }
        } else if (!creationMovedRef.current) {
          // 사각형 바깥(순수 배경)을 단순 클릭한 경우: 레이아웃 모드로 복귀
          if (startPointRef.current && currentToolRef.current === 'bubble') {
            onAddBubbleRef.current(startPointRef.current);
          } else {
            onBackgroundTapRef.current();
          }
        }

        startPointRef.current = null;
        creatingRef.current = null;
        setCreatingRect(null);
        setGuides([]);
      },
    })
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9', paddingBottom: bottomClearance }}>
    <View style={styles.workspaceContainer} onLayout={handleViewportLayout}>
      <View testID="workspace-zoom-frame" style={{ width: canvasSize.width * scale, height: canvasSize.height * scale }}>
      <View style={[styles.sheet, focusedPanel && styles.focusedSheet, { width: canvasSize.width, height: canvasSize.height,
        left: (canvasSize.width * scale - canvasSize.width) / 2,
        top: (canvasSize.height * scale - canvasSize.height) / 2, transform: [{ scale }] }]}>

        {/* LAYER 1: 패널들 뒤에 깔리는 순수 배경 캔버스 (빈 공간 터치 및 드래그 전용) */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={focusedPanel ? 'none' : 'auto'}
          {...backgroundPR.panHandlers}
        />

        {/* 안내 가이드 (영문) */}
        {panels.length === 0 && !creatingRect && (
          <View style={styles.emptyGuide} pointerEvents="none">
            <Text style={styles.emptyGuideTitle}>Draw your layout first!</Text>
          </View>
        )}

        {/* LAYER 2: 패널들 렌더링 (배경 위에 위치하므로 펜슬 드로잉 시 배경 핸들러가 절대 가로채지 않음!) */}
        <View style={styles.panelLayer} pointerEvents="box-none" collapsable={false}>
        {renderPanels.map((panel) => (
          <Panel
            key={panel.id}
            stackOrder={focusedPanel?.id === panel.id ? panels.length : panelStackOrder.get(panel.id)}
            panel={panel}
            selectionTimestamp={selectionTiming?.id === panel.id ? selectionTiming.time : 0}
            interactive={!focusedPanel || focusedPanel.id === panel.id}
            hidden={!!focusedPanel && focusedPanel.id !== panel.id}
            displayPosition={focusedPanel?.id === panel.id && focus ? {
              x: canvasSize.width / 2 - panel.width / 2 + (panel.x + panel.width / 2 - focus.centerX) * focus.scale / scale,
              y: canvasSize.height / 2 - panel.height / 2 + (panel.y + panel.height / 2 - focus.centerY) * focus.scale / scale,
            } : undefined}
            displayScale={focusedPanel?.id === panel.id && focus ? focus.scale / scale : 1}
            focused={focusedPanel?.id === panel.id}
            onToggleFocus={() => setFocusedPanelId(focusedPanelId === panel.id ? null : panel.id)}
            onShapeChange={(id, update) => onCommitPanelGeometry(id, update)}
            onBorderStyleChange={(id, borderStyle) => onUpdatePanel(id, { borderStyle })}
            onArtworkLockChange={(id, artworkLocked) => onCommitPanelGeometry(id, { artworkLocked })}
            mode={panelModes[panel.id]}
            otherPanels={panels.filter((p) => p.id !== panel.id)}
            sheetBounds={sheetBounds}
            canvasScale={focusedPanel?.id === panel.id && focus ? focus.scale : scale}
            onImportTracingImage={onImportTracingImage}
            importingTracingImage={importingTracingImage}
            tracingEditing={editingTracingPanelId === panel.id}
            onTracingEditingChange={onTracingEditingChange}
            onTracingImageChange={onTracingImageChange}
            onGuidesChange={setGuides}
            onSelect={id => { markSelection(id); onPanelSelect(id); }}
            onModeChange={(id) => {
              const current = panelModes[id] || 'layout';
              let next: PanelMode = 'layout';
              if (current === 'layout') next = 'draw';
              else next = 'layout';
              if (next === 'draw') { markSelection(id); }
              onModeChange(id, next);
            }}
            onMove={(id, pos) => onCommitPanelGeometry(id, pos)}
            onResize={(id, size) => onCommitPanelGeometry(id, size)}
            onDrawingUpdate={(id, drawingData, geometry) => {
              if (geometry && onGeometryInkChange) { onGeometryInkChange(id, drawingData, geometry); }
              else { onUpdatePanel(id, { drawingData }); }
            }}
            onDelete={onDeletePanel}
            onDoubleTap={id => { markSelection(id); onPanelDoubleTap(id); }}
          />
        ))}
        </View>

        {/* LAYER 3: 자석 스냅 가이드라인 (최상위) */}
        {(!focusedPanel ? guides : []).map((g, idx) =>
          g.type === 'vertical' ? (
            <View
              key={`g-v-${idx}`}
              style={[styles.snapGuideVertical, { left: g.pos }]}
              pointerEvents="none"
            />
          ) : (
            <View
              key={`g-h-${idx}`}
              style={[styles.snapGuideHorizontal, { top: g.pos }]}
              pointerEvents="none"
            />
          )
        )}

        {/* LAYER 4: 드래그 프리뷰 (실선 사각형) */}
        {!focusedPanel && creatingRect && creatingRect.width > 5 && creatingRect.height > 5 && (
          <Svg pointerEvents="none" testID="panel-creation-preview" style={StyleSheet.absoluteFill}
            width={canvasSize.width} height={canvasSize.height} viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}>
            <Polygon points={worldCorners(creatingRect).map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(14, 165, 233, 0.12)" stroke="#0284C7" strokeWidth={2} />
          </Svg>
        )}

        {/* LAYER 5: 말풍선 */}
        <View accessibilityElementsHidden={!!focusedPanel} importantForAccessibility={focusedPanel ? 'no-hide-descendants' : 'auto'} pointerEvents={focusedPanel ? 'none' : 'box-none'} style={[StyleSheet.absoluteFill, { zIndex: 20, opacity: focusedPanel ? 0 : 1 }]}>
        {bubbles.map((bubble) => (
          <SpeechBubble
            key={bubble.id}
            bubble={bubble}
            canvasScale={scale}
            isSelected={selectedBubbleId === bubble.id}
            onSelect={(id) => setSelectedBubbleId(id)}
            onUpdate={onUpdateBubble}
            onDelete={onDeleteBubble}
          />
        ))}
        </View>
      </View>
      </View>
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Keep panel stacking separate from guides, bubbles and their controls.
  panelLayer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  workspaceContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    paddingVertical: CANVAS_VIEW_INSET.vertical,
    paddingHorizontal: CANVAS_VIEW_INSET.horizontal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusedSheet: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, overflow: 'visible' },
  sheet: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  createPreview: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0284C7',
    borderStyle: 'solid',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderRadius: 2,
  },
  snapGuideVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    transform: [{ translateX: -0.5 }],
    backgroundColor: '#0EA5E9',
    borderWidth: 0.5,
    borderColor: '#0EA5E9',
    zIndex: 90,
  },
  snapGuideHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    transform: [{ translateY: -0.5 }],
    backgroundColor: '#0EA5E9',
    borderWidth: 0.5,
    borderColor: '#0EA5E9',
    zIndex: 90,
  },
  emptyGuide: {
    position: 'absolute',
    top: '42%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGuideTitle: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '700',
    color: '#9B8BB3',
    opacity: 0.35,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
