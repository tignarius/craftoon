import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { ComicBubble } from '../types/comic';
import { Trash2 } from 'lucide-react-native';

interface SpeechBubbleProps {
  bubble: ComicBubble;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ComicBubble>) => void;
  onDelete: (id: string) => void;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  bubble,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const startPosRef = useRef({ x: bubble.x, y: bubble.y });
  const startSizeRef = useRef({ width: bubble.width, height: bubble.height });

  const movePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPosRef.current = { x: bubble.x, y: bubble.y };
        onSelect(bubble.id);
      },
      onPanResponderMove: (_, g) => {
        onUpdate(bubble.id, {
          x: Math.max(0, startPosRef.current.x + g.dx),
          y: Math.max(0, startPosRef.current.y + g.dy),
        });
      },
    })
  ).current;

  const resizePR = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startSizeRef.current = { width: bubble.width, height: bubble.height };
        onSelect(bubble.id);
      },
      onPanResponderMove: (_, g) => {
        onUpdate(bubble.id, {
          width: Math.max(90, startSizeRef.current.width + g.dx),
          height: Math.max(50, startSizeRef.current.height + g.dy),
        });
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.wrapper,
        {
          left: bubble.x,
          top: bubble.y,
          width: bubble.width,
          height: bubble.height,
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            borderColor: isSelected ? '#1ABC9C' : '#2C3E50',
          },
        ]}
      >
        <TextInput
          style={styles.textInput}
          value={bubble.text}
          onChangeText={(text) => onUpdate(bubble.id, { text })}
          onFocus={() => onSelect(bubble.id)}
          multiline
          placeholder="Speech..."
          placeholderTextColor="#A0AEC0"
        />

        {/* Tail */}
        <View style={styles.tail} />
      </View>

      {/* Controls on select */}
      {isSelected && (
        <>
          {/* Drag Handle Top Left */}
          <View style={styles.dragOverlay} {...movePR.panHandlers} />

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(bubble.id)}
            activeOpacity={0.75}
          >
            <Trash2 size={12} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Resize Handle */}
          <View style={styles.resizeHandle} {...resizePR.panHandlers}>
            <View style={styles.resizeKnob} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 50,
  },
  bubble: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  textInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#2C3E50',
    padding: 0,
  },
  tail: {
    position: 'absolute',
    bottom: -8,
    left: 20,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2C3E50',
  },
  dragOverlay: {
    position: 'absolute',
    top: -12,
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1ABC9C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 60,
  },
  deleteBtn: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 60,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
  },
  resizeKnob: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1ABC9C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
