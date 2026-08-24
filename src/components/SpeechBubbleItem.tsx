import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { ComicBubble } from '../types/comic';
import { Trash2, Move } from 'lucide-react-native';

interface SpeechBubbleItemProps {
  bubble: ComicBubble;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ComicBubble>) => void;
  onDelete: (id: string) => void;
}

export const SpeechBubbleItem: React.FC<SpeechBubbleItemProps> = ({
  bubble,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const initialPos = useRef({ x: bubble.x, y: bubble.y });
  const initialSize = useRef({ width: bubble.width, height: bubble.height });

  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialPos.current = { x: bubble.x, y: bubble.y };
        onSelect(bubble.id);
      },
      onPanResponderMove: (_, gestureState) => {
        onUpdate(bubble.id, {
          x: Math.max(0, initialPos.current.x + gestureState.dx),
          y: Math.max(0, initialPos.current.y + gestureState.dy),
        });
      },
    })
  ).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialSize.current = { width: bubble.width, height: bubble.height };
        onSelect(bubble.id);
      },
      onPanResponderMove: (_, gestureState) => {
        onUpdate(bubble.id, {
          width: Math.max(100, initialSize.current.width + gestureState.dx),
          height: Math.max(60, initialSize.current.height + gestureState.dy),
        });
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.bubbleWrapper,
        {
          left: bubble.x,
          top: bubble.y,
          width: bubble.width,
          height: bubble.height,
        },
      ]}
    >
      {/* Move / Delete Header when selected */}
      {isSelected && (
        <View style={styles.controlHeader} pointerEvents="box-none">
          <View style={styles.dragHandle} {...moveResponder.panHandlers}>
            <Move size={12} color="#FFFFFF" />
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(bubble.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Bubble Container */}
      <View
        style={[
          styles.bubbleBox,
          {
            borderColor: isSelected ? '#1ABC9C' : '#1F2937',
            backgroundColor: bubble.backgroundColor || '#FFFFFF',
          },
        ]}
      >
        <TextInput
          style={[styles.textInput, { fontSize: bubble.fontSize, color: bubble.color }]}
          value={bubble.text}
          onChangeText={(text) => onUpdate(bubble.id, { text })}
          onFocus={() => onSelect(bubble.id)}
          multiline
          placeholder="Type dialogue..."
          placeholderTextColor="#9CA3AF"
        />

        {/* Comic Speech Tail */}
        <View style={styles.tail} />
      </View>

      {/* Resize Handle */}
      {isSelected && (
        <View style={styles.resizeHandle} {...resizeResponder.panHandlers}>
          <View style={styles.resizeKnob} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleWrapper: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 50,
  },
  bubbleBox: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 2.5,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  textInput: {
    width: '100%',
    textAlign: 'center',
    fontWeight: '700',
    padding: 0,
  },
  tail: {
    position: 'absolute',
    bottom: -10,
    left: 24,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1F2937',
  },
  controlHeader: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  dragHandle: {
    backgroundColor: '#1ABC9C',
    padding: 5,
    borderRadius: 6,
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    padding: 5,
    borderRadius: 6,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resizeKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1ABC9C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
