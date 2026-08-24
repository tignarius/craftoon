import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { PencilKitView } from '../../PencilKitView';
import { ComicPanelItem } from './ComicPanelItem';
import { SpeechBubbleItem } from './SpeechBubbleItem';
import { StickerItem } from './StickerItem';
import {
  ComicPanel,
  ComicBubble,
  ComicSticker,
  ToolType,
} from '../types/comic';

interface ComicWorkspaceProps {
  activeTool: ToolType;
  panels: ComicPanel[];
  bubbles: ComicBubble[];
  stickers: ComicSticker[];
  onUpdatePanels: (panels: ComicPanel[]) => void;
  onUpdateBubbles: (bubbles: ComicBubble[]) => void;
  onUpdateStickers: (stickers: ComicSticker[]) => void;
  onSelectTool: (tool: ToolType) => void;
}

export const ComicWorkspace: React.FC<ComicWorkspaceProps> = ({
  activeTool,
  panels,
  bubbles,
  stickers,
  onUpdatePanels,
  onUpdateBubbles,
  onUpdateStickers,
  onSelectTool,
}) => {
  const { width, height } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragCutRect, setDragCutRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const startCutPos = useRef<{ x: number; y: number } | null>(null);

  // Pan responder for drawing new comic panel rectangle
  const cutPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => activeTool === 'panel',
      onMoveShouldSetPanResponder: () => activeTool === 'panel',
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startCutPos.current = { x: locationX, y: locationY };
        setDragCutRect({ x: locationX, y: locationY, width: 0, height: 0 });
      },
      onPanResponderMove: (evt) => {
        if (!startCutPos.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const startX = startCutPos.current.x;
        const startY = startCutPos.current.y;

        const x = Math.min(startX, locationX);
        const y = Math.min(startY, locationY);
        const w = Math.abs(locationX - startX);
        const h = Math.abs(locationY - startY);

        setDragCutRect({ x, y, width: w, height: h });
      },
      onPanResponderRelease: () => {
        if (dragCutRect && dragCutRect.width > 40 && dragCutRect.height > 40) {
          const newPanel: ComicPanel = {
            id: `panel-${Date.now()}`,
            x: dragCutRect.x,
            y: dragCutRect.y,
            width: dragCutRect.width,
            height: dragCutRect.height,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          };
          onUpdatePanels([...panels, newPanel]);
          setSelectedId(newPanel.id);
          onSelectTool('select');
        }
        startCutPos.current = null;
        setDragCutRect(null);
      },
    })
  ).current;

  // Panel handlers
  const handlePanelUpdate = (id: string, updates: Partial<ComicPanel>) => {
    onUpdatePanels(panels.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handlePanelDelete = (id: string) => {
    onUpdatePanels(panels.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Bubble handlers
  const handleBubbleUpdate = (id: string, updates: Partial<ComicBubble>) => {
    onUpdateBubbles(bubbles.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleBubbleDelete = (id: string) => {
    onUpdateBubbles(bubbles.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Sticker handlers
  const handleStickerUpdate = (id: string, updates: Partial<ComicSticker>) => {
    onUpdateStickers(stickers.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleStickerDelete = (id: string) => {
    onUpdateStickers(stickers.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <View style={styles.container}>
      {/* 1. Underlying PencilKit Drawing Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents={activeTool === 'draw' ? 'auto' : 'none'}>
        <PencilKitView style={styles.pencilCanvas} />
      </View>

      {/* 2. Comic Overlay Layer (Panels, Bubbles, Stickers, Cut gestures) */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={activeTool === 'draw' ? 'none' : 'box-none'}
        {...(activeTool === 'panel' ? cutPanResponder.panHandlers : {})}
      >
        {/* Render Panels */}
        {panels.map((panel) => (
          <ComicPanelItem
            key={panel.id}
            panel={panel}
            isSelected={selectedId === panel.id && activeTool === 'select'}
            onSelect={(id) => setSelectedId(id)}
            onUpdate={handlePanelUpdate}
            onDelete={handlePanelDelete}
          />
        ))}

        {/* Render Creating/Dragging Panel preview */}
        {dragCutRect && (
          <View
            style={[
              styles.dragPreview,
              {
                left: dragCutRect.x,
                top: dragCutRect.y,
                width: dragCutRect.width,
                height: dragCutRect.height,
              },
            ]}
          />
        )}

        {/* Render Speech Bubbles */}
        {bubbles.map((bubble) => (
          <SpeechBubbleItem
            key={bubble.id}
            bubble={bubble}
            isSelected={selectedId === bubble.id && activeTool === 'select'}
            onSelect={(id) => setSelectedId(id)}
            onUpdate={handleBubbleUpdate}
            onDelete={handleBubbleDelete}
          />
        ))}

        {/* Render Stickers */}
        {stickers.map((sticker) => (
          <StickerItem
            key={sticker.id}
            sticker={sticker}
            isSelected={selectedId === sticker.id && activeTool === 'select'}
            onSelect={(id) => setSelectedId(id)}
            onUpdate={handleStickerUpdate}
            onDelete={handleStickerDelete}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  pencilCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  dragPreview: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#1ABC9C',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(26, 188, 156, 0.08)',
    borderRadius: 4,
  },
});
