import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { AppText as Text } from './AppText';
import { Panel } from './Panel';
import { SpeechBubble } from './SpeechBubble';
import { ComicPanel, ComicBubble, PanelMode, ToolType } from '../types/comic';

const PANEL_GAP = 16;
const SNAP_THRESHOLD = 18;
const WORKSPACE_PADDING = 12; // 원고지 안쪽 최소 여백 (좌우/상하 균등한 중간값)

// 두 사각형 간의 충돌 검사
const checkCollision = (
  r1: { x: number; y: number; width: number; height: number },
  r2: { x: number; y: number; width: number; height: number },
  gap = PANEL_GAP
) => {
  return (
    r1.x + r1.width > r2.x - gap &&
    r1.x < r2.x + r2.width + gap &&
    r1.y + r1.height > r2.y - gap &&
    r1.y < r2.y + r2.height + gap
  );
};

interface WorkspaceProps {
  onSheetBoundsChange: (bounds: { width: number; height: number }) => void;
  panels: ComicPanel[];
  panelModes: Record<string, PanelMode>;
  bubbles: ComicBubble[];
  currentTool: ToolType;
  onAddPanel: (rect: { x: number; y: number; width: number; height: number }) => void;
  onUpdatePanel: (id: string, updates: Partial<ComicPanel>) => void;
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
  panels,
  panelModes,
  bubbles,
  currentTool,
  onAddPanel,
  onUpdatePanel,
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
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [sheetBounds, setSheetBounds] = useState<{ width: number; height: number }>({
    width: 900,
    height: 1200,
  });

  useEffect(() => { onSheetBoundsChange(sheetBounds); }, [sheetBounds, onSheetBoundsChange]);

  const [creatingRect, setCreatingRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // 스냅 가이드라인
  const [guides, setGuides] = useState<{
    type: 'vertical' | 'horizontal';
    pos: number;
  }[]>([]);

  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const creatingRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const sheetBoundsRef = useRef(sheetBounds);
  sheetBoundsRef.current = sheetBounds;

  const panelsRef = useRef(panels);
  panelsRef.current = panels;

  const currentToolRef = useRef(currentTool);
  currentToolRef.current = currentTool;

  const onAddPanelRef = useRef(onAddPanel);
  onAddPanelRef.current = onAddPanel;

  const onAddBubbleRef = useRef(onAddBubble);
  onAddBubbleRef.current = onAddBubble;

  const onBackgroundTapRef = useRef(onBackgroundTap);
  onBackgroundTapRef.current = onBackgroundTap;

  const handleSheetLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSheetBounds({ width, height });
    sheetBoundsRef.current = { width, height };
  };

  // 패널들 뒤에 깔리는 순수 배경(Background) PanResponder
  // 패널 안쪽 터치에는 전혀 관여하지 않으므로, 펜슬 드로잉 시 모드가 절대 풀리지 않음!
  const backgroundPR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => {
        return Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;
      },

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        let startX = locationX;
        let startY = locationY;

        // 드래그 시작점 자석 스냅
        for (const p of panelsRef.current) {
          if (Math.abs(startX - p.x) < SNAP_THRESHOLD) startX = p.x;
          else if (Math.abs(startX - (p.x + p.width + PANEL_GAP)) < SNAP_THRESHOLD)
            startX = p.x + p.width + PANEL_GAP;
          else if (Math.abs(startX - (p.x - PANEL_GAP)) < SNAP_THRESHOLD)
            startX = p.x - PANEL_GAP;

          if (Math.abs(startY - p.y) < SNAP_THRESHOLD) startY = p.y;
          else if (Math.abs(startY - (p.y + p.height + PANEL_GAP)) < SNAP_THRESHOLD)
            startY = p.y + p.height + PANEL_GAP;
          else if (Math.abs(startY - (p.y - PANEL_GAP)) < SNAP_THRESHOLD)
            startY = p.y - PANEL_GAP;
        }

        // 캔버스 여백 안으로 시작점 클램핑
        const maxW = sheetBoundsRef.current.width - WORKSPACE_PADDING;
        const maxH = sheetBoundsRef.current.height - WORKSPACE_PADDING;
        startX = Math.max(WORKSPACE_PADDING, Math.min(maxW, startX));
        startY = Math.max(WORKSPACE_PADDING, Math.min(maxH, startY));

        startPointRef.current = { x: startX, y: startY };
        const initialRect = { x: startX, y: startY, width: 0, height: 0 };
        creatingRef.current = initialRect;
      },

      onPanResponderMove: (evt) => {
        if (!startPointRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;

        let endX = locationX;
        let endY = locationY;
        const activeGuides: { type: 'vertical' | 'horizontal'; pos: number }[] = [];

        // 드래그 끝점 자석 스냅
        for (const p of panelsRef.current) {
          const pLeft = p.x;
          const pRight = p.x + p.width;
          const pTop = p.y;
          const pBottom = p.y + p.height;

          if (Math.abs(endX - (pLeft - PANEL_GAP)) < SNAP_THRESHOLD) {
            endX = pLeft - PANEL_GAP;
            activeGuides.push({ type: 'vertical', pos: endX });
          } else if (Math.abs(endX - pRight) < SNAP_THRESHOLD) {
            endX = pRight;
            activeGuides.push({ type: 'vertical', pos: endX });
          } else if (Math.abs(endX - pLeft) < SNAP_THRESHOLD) {
            endX = pLeft;
            activeGuides.push({ type: 'vertical', pos: endX });
          }

          if (Math.abs(endY - (pTop - PANEL_GAP)) < SNAP_THRESHOLD) {
            endY = pTop - PANEL_GAP;
            activeGuides.push({ type: 'horizontal', pos: endY });
          } else if (Math.abs(endY - pBottom) < SNAP_THRESHOLD) {
            endY = pBottom;
            activeGuides.push({ type: 'horizontal', pos: endY });
          } else if (Math.abs(endY - pTop) < SNAP_THRESHOLD) {
            endY = pTop;
            activeGuides.push({ type: 'horizontal', pos: endY });
          }
        }

        setGuides(activeGuides);

        let rawX = Math.min(startX, endX);
        let rawY = Math.min(startY, endY);
        let rawW = Math.abs(endX - startX);
        let rawH = Math.abs(endY - startY);

        // 캔버스 바깥으로 나가지 않도록 강제 (Canvas Boundary Clamping)
        const sheetW = sheetBoundsRef.current.width - WORKSPACE_PADDING;
        const sheetH = sheetBoundsRef.current.height - WORKSPACE_PADDING;

        rawX = Math.max(WORKSPACE_PADDING, rawX);
        rawY = Math.max(WORKSPACE_PADDING, rawY);

        let clampedW = Math.min(rawW, sheetW - rawX);
        let clampedH = Math.min(rawH, sheetH - rawY);

        // 기존 패널과의 충돌 방지 (남은 공간 계산)
        const isDraggingRight = endX >= startX;
        const isDraggingDown = endY >= startY;

        for (const other of panelsRef.current) {
          if (isDraggingRight && other.x > startX) {
            const yOverlaps =
              rawY + clampedH > other.y - PANEL_GAP && rawY < other.y + other.height + PANEL_GAP;
            if (yOverlaps) {
              const maxAllowedW = Math.max(0, other.x - PANEL_GAP - startX);
              clampedW = Math.min(clampedW, maxAllowedW);
            }
          }

          if (isDraggingDown && other.y > startY) {
            const xOverlaps =
              rawX + clampedW > other.x - PANEL_GAP && rawX < other.x + other.width + PANEL_GAP;
            if (xOverlaps) {
              const maxAllowedH = Math.max(0, other.y - PANEL_GAP - startY);
              clampedH = Math.min(clampedH, maxAllowedH);
            }
          }
        }

        const candidateRect = {
          x: rawX,
          y: rawY,
          width: clampedW,
          height: clampedH,
        };

        creatingRef.current = candidateRect;
        setCreatingRect(candidateRect);
      },

      onPanResponderRelease: () => {
        const rect = creatingRef.current;

        if (rect && rect.width > 50 && rect.height > 50) {
          // 기존 어떤 패널과도 겹치지 않는지 확인 후 생성
          const collides = panelsRef.current.some((p) => checkCollision(rect, p, PANEL_GAP / 2));
          if (!collides) {
            onAddPanelRef.current(rect);
          }
        } else {
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
    <View style={styles.workspaceContainer}>
      <View
        style={styles.sheet}
        onLayout={handleSheetLayout}
      >
        {/* LAYER 1: 패널들 뒤에 깔리는 순수 배경 캔버스 (빈 공간 터치 및 드래그 전용) */}
        <View
          style={StyleSheet.absoluteFill}
          {...backgroundPR.panHandlers}
        />

        {/* 안내 가이드 (영문) */}
        {panels.length === 0 && !creatingRect && (
          <View style={styles.emptyGuide} pointerEvents="none">
            <Text style={styles.emptyGuideTitle}>Draw your layout first!</Text>
          </View>
        )}

        {/* LAYER 2: 패널들 렌더링 (배경 위에 위치하므로 펜슬 드로잉 시 배경 핸들러가 절대 가로채지 않음!) */}
        {panels.map((panel) => (
          <Panel
            key={panel.id}
            panel={panel}
            mode={panelModes[panel.id]}
            otherPanels={panels.filter((p) => p.id !== panel.id)}
            sheetBounds={sheetBounds}
            onGuidesChange={setGuides}
            onSelect={onPanelSelect}
            onModeChange={(id) => {
              const current = panelModes[id] || 'layout';
              let next: PanelMode = 'layout';
              if (current === 'layout') next = 'draw';
              else if (current === 'draw') next = 'edit';
              else next = 'layout';
              onModeChange(id, next);
            }}
            onMove={(id, pos) => onUpdatePanel(id, pos)}
            onResize={(id, size) => onUpdatePanel(id, size)}
            onDrawingUpdate={(id, drawingData) => onUpdatePanel(id, { drawingData })}
            onDelete={onDeletePanel}
            onDoubleTap={onPanelDoubleTap}
          />
        ))}

        {/* LAYER 3: 자석 스냅 가이드라인 (최상위) */}
        {guides.map((g, idx) =>
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
        {creatingRect && creatingRect.width > 5 && creatingRect.height > 5 && (
          <View
            style={[
              styles.createPreview,
              {
                left: creatingRect.x,
                top: creatingRect.y,
                width: creatingRect.width,
                height: creatingRect.height,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* LAYER 5: 말풍선 */}
        {bubbles.map((bubble) => (
          <SpeechBubble
            key={bubble.id}
            bubble={bubble}
            isSelected={selectedBubbleId === bubble.id}
            onSelect={(id) => setSelectedBubbleId(id)}
            onUpdate={onUpdateBubble}
            onDelete={onDeleteBubble}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  workspaceContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    flex: 1,
    width: '100%',
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
