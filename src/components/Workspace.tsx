import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { Panel } from './Panel';
import { SpeechBubble } from './SpeechBubble';
import { PencilKitView } from '../../PencilKitView';
import { ComicPanel, ComicBubble, PanelMode, ToolType } from '../types/comic';

const NEXT_MODE: Record<string, PanelMode> = {
  layout: 'draw',
  draw: 'edit',
  edit: 'layout',
};

interface WorkspaceProps {
  panels: ComicPanel[];
  panelModes: Record<string, PanelMode>;
  bubbles: ComicBubble[];
  currentTool: ToolType;
  onAddPanel: (rect: { x: number; y: number; width: number; height: number }) => void;
  onUpdatePanel: (id: string, updates: Partial<ComicPanel>) => void;
  onDeletePanel: (id: string) => void;
  onModeChange: (id: string, mode: PanelMode) => void;
  onPanelSelect: (id: string) => void;
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
  onBackgroundTap,
  onAddBubble,
  onUpdateBubble,
  onDeleteBubble,
}) => {
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [creatingRect, setCreatingRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const startCutRef = useRef<{ x: number; y: number } | null>(null);
  const creatingRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const currentToolRef = useRef(currentTool);
  currentToolRef.current = currentTool;

  const panelModesRef = useRef(panelModes);
  panelModesRef.current = panelModes;

  const onAddPanelRef = useRef(onAddPanel);
  onAddPanelRef.current = onAddPanel;

  const onAddBubbleRef = useRef(onAddBubble);
  onAddBubbleRef.current = onAddBubble;

  const anyActiveMode = Object.values(panelModes).some(Boolean);
  const isDrawingActive =
    currentTool === 'pen' ||
    currentTool === 'brush' ||
    currentTool === 'eraser' ||
    Object.values(panelModes).includes('draw');

  // Workspace PanResponder to create panel cuts by dragging
  const workspacePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const hasActive = Object.values(panelModesRef.current).some(Boolean);
        return !hasActive && currentToolRef.current === 'panel';
      },
      onMoveShouldSetPanResponder: (_, g) => {
        const hasActive = Object.values(panelModesRef.current).some(Boolean);
        return (
          !hasActive &&
          currentToolRef.current === 'panel' &&
          (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6)
        );
      },

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startCutRef.current = { x: locationX, y: locationY };
        const initialRect = { x: locationX, y: locationY, width: 0, height: 0 };
        creatingRef.current = initialRect;
        setCreatingRect(initialRect);
      },

      onPanResponderMove: (evt) => {
        if (!startCutRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const startX = startCutRef.current.x;
        const startY = startCutRef.current.y;

        const x = Math.min(startX, locationX);
        const y = Math.min(startY, locationY);
        const w = Math.abs(locationX - startX);
        const h = Math.abs(locationY - startY);

        const updatedRect = { x, y, width: w, height: h };
        creatingRef.current = updatedRect;
        setCreatingRect(updatedRect);
      },

      onPanResponderRelease: () => {
        const rect = creatingRef.current;
        if (rect && rect.width > 30 && rect.height > 30) {
          onAddPanelRef.current(rect);
        } else if (currentToolRef.current === 'bubble' && startCutRef.current) {
          onAddBubbleRef.current(startCutRef.current);
        }
        startCutRef.current = null;
        creatingRef.current = null;
        setCreatingRect(null);
      },
    })
  ).current;

  // Handle mode cycle (layout -> draw -> edit -> layout)
  const handleModeChange = (id: string) => {
    const current = panelModes[id] || 'layout';
    const next = NEXT_MODE[current] || 'layout';
    onModeChange(id, next);
  };

  return (
    <View style={styles.workspace}>
      {/* 1. Underlying Native Apple PencilKit View */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isDrawingActive ? 'auto' : 'none'}
      >
        <PencilKitView style={styles.pencilCanvas} />
      </View>

      {/* 2. Interactive Workspace Overlay (Panels, Bubbles, Drag Create) */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isDrawingActive ? 'box-none' : 'auto'}
        {...(!anyActiveMode && currentTool === 'panel' ? workspacePR.panHandlers : {})}
      >
        {/* Render Comic Panels */}
        {panels.map((panel) => (
          <Panel
            key={panel.id}
            panel={panel}
            mode={panelModes[panel.id]}
            onSelect={onPanelSelect}
            onModeChange={handleModeChange}
            onMove={(id, pos) => onUpdatePanel(id, pos)}
            onResize={(id, size) => onUpdatePanel(id, size)}
            onDelete={onDeletePanel}
          />
        ))}

        {/* Drag creation preview */}
        {creatingRect && (
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
          />
        )}

        {/* Speech Bubbles */}
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
  workspace: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pencilCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  createPreview: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4ECDC4',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    borderRadius: 4,
  },
});
