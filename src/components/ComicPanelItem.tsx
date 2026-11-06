import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { AppText as Text } from './AppText';
import { ComicPanel } from '../types/comic';
import { Trash2, Move, PenTool } from 'lucide-react-native';

interface ComicPanelItemProps {
  panel: ComicPanel;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ComicPanel>) => void;
  onDelete: (id: string) => void;
}

export const ComicPanelItem: React.FC<ComicPanelItemProps> = ({
  panel,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const initialPos = useRef({ x: panel.x, y: panel.y });
  const initialSize = useRef({ width: panel.width, height: panel.height });

  // Pan responder for moving the panel
  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialPos.current = { x: panel.x, y: panel.y };
        onSelect(panel.id);
      },
      onPanResponderMove: (_, gestureState) => {
        onUpdate(panel.id, {
          x: Math.max(0, initialPos.current.x + gestureState.dx),
          y: Math.max(0, initialPos.current.y + gestureState.dy),
        });
      },
    })
  ).current;

  // Pan responder for resizing (bottom-right corner)
  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialSize.current = { width: panel.width, height: panel.height };
        onSelect(panel.id);
      },
      onPanResponderMove: (_, gestureState) => {
        onUpdate(panel.id, {
          width: Math.max(80, initialSize.current.width + gestureState.dx),
          height: Math.max(80, initialSize.current.height + gestureState.dy),
        });
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.panel,
        {
          left: panel.x,
          top: panel.y,
          width: panel.width,
          height: panel.height,
          borderWidth: panel.borderWidth,
          borderColor: isSelected ? '#1ABC9C' : panel.borderColor,
          borderRadius: panel.borderRadius,
        },
      ]}
    >
      {/* Top Header / Control overlay when selected */}
      {isSelected && (
        <View style={styles.controlHeader} pointerEvents="box-none">
          <View style={styles.dragHandle} {...moveResponder.panHandlers}>
            <Move size={14} color="#FFFFFF" />
            <Text style={styles.controlText}>Move</Text>
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(panel.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Tap area to select panel */}
      {!isSelected && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => onSelect(panel.id)}
          activeOpacity={0.9}
        />
      )}

      {/* Resize Handle (Bottom-Right Corner) */}
      {isSelected && (
        <View
          style={styles.resizeHandle}
          {...resizeResponder.panHandlers}
        >
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  controlHeader: {
    position: 'absolute',
    top: -34,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  dragHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  controlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    padding: 6,
    borderRadius: 8,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resizeKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1ABC9C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
