import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { ComicPanel, PanelMode } from '../types/comic';
import { MousePointer2, Pen, Edit3, Trash2 } from 'lucide-react-native';

const MODE_STYLE = {
  layout: { border: '#4ECDC4', icon: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.15)' },
  draw:   { border: '#FF8C42', icon: '#FF8C42', bg: 'rgba(255, 140, 66, 0.15)' },
  edit:   { border: '#9B59B6', icon: '#9B59B6', bg: 'rgba(155, 89, 182, 0.15)' },
  null:   { border: '#2C3E50', icon: '#2C3E50', bg: 'transparent' },
};

interface PanelProps {
  panel: ComicPanel;
  mode: PanelMode | undefined;
  onSelect: (id: string) => void;
  onModeChange: (id: string) => void;
  onMove: (id: string, newPos: { x: number; y: number }) => void;
  onResize: (id: string, newSize: { width: number; height: number }) => void;
  onDelete: (id: string) => void;
}

export const Panel: React.FC<PanelProps> = ({
  panel,
  mode,
  onSelect,
  onModeChange,
  onMove,
  onResize,
  onDelete,
}) => {
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const panelRef = useRef(panel);
  panelRef.current = panel;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const startPosRef = useRef({ x: panel.x, y: panel.y });
  const startSizeRef = useRef({ width: panel.width, height: panel.height });

  // Move responder for layout mode
  const movePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => modeRef.current === 'layout',
      onPanResponderGrant: () => {
        startPosRef.current = { x: panelRef.current.x, y: panelRef.current.y };
      },
      onPanResponderMove: (_, g) => {
        onMoveRef.current(panelRef.current.id, {
          x: Math.max(0, startPosRef.current.x + g.dx),
          y: Math.max(0, startPosRef.current.y + g.dy),
        });
      },
    })
  ).current;

  // Resize responder for bottom-right corner
  const resizePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => modeRef.current === 'layout',
      onPanResponderGrant: () => {
        startSizeRef.current = { width: panelRef.current.width, height: panelRef.current.height };
      },
      onPanResponderMove: (_, g) => {
        onResizeRef.current(panelRef.current.id, {
          width: Math.max(80, startSizeRef.current.width + g.dx),
          height: Math.max(80, startSizeRef.current.height + g.dy),
        });
      },
    })
  ).current;

  const styleConfig = MODE_STYLE[mode ?? 'null'];
  const borderColor = styleConfig.border;

  return (
    <View
      style={[
        styles.panel,
        {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
          borderColor,
          borderStyle: mode === 'layout' ? 'dashed' : 'solid',
          borderWidth: mode ? 2.5 : 2,
        },
      ]}
    >
      {/* If no mode active, tap to enter layout mode */}
      {!mode && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={0.95}
          onPress={() => onSelect(panel.id)}
        />
      )}

      {/* In layout mode: full drag overlay to move panel */}
      {mode === 'layout' && (
        <View style={StyleSheet.absoluteFill} {...movePR.panHandlers} />
      )}

      {/* Mode cycle icon button (top-right) */}
      {mode && (
        <View style={styles.topBar}>
          {mode === 'layout' && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(panel.id)}
              activeOpacity={0.75}
            >
              <Trash2 size={13} color="#EF4444" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.modeBtn, { backgroundColor: styleConfig.bg }]}
            onPress={() => onModeChange(panel.id)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {mode === 'layout' && <MousePointer2 size={15} color={styleConfig.icon} />}
            {mode === 'draw' && <Pen size={15} color={styleConfig.icon} />}
            {mode === 'edit' && <Edit3 size={15} color={styleConfig.icon} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Resize Handle in layout mode */}
      {mode === 'layout' && (
        <View style={styles.resizeHandle} {...resizePR.panHandlers}>
          <View style={styles.resizeKnob} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: 'transparent',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  topBar: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 30,
  },
  modeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
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
    bottom: -10,
    right: -10,
    width: 24,
    height: 24,
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
