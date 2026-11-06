import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { AppText as Text } from './AppText';
import { ComicSticker } from '../types/comic';
import { Trash2, Move } from 'lucide-react-native';

interface StickerItemProps {
  sticker: ComicSticker;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ComicSticker>) => void;
  onDelete: (id: string) => void;
}

export const StickerItem: React.FC<StickerItemProps> = ({
  sticker,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  const initialPos = useRef({ x: sticker.x, y: sticker.y });

  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialPos.current = { x: sticker.x, y: sticker.y };
        onSelect(sticker.id);
      },
      onPanResponderMove: (_, gestureState) => {
        onUpdate(sticker.id, {
          x: Math.max(0, initialPos.current.x + gestureState.dx),
          y: Math.max(0, initialPos.current.y + gestureState.dy),
        });
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.container,
        {
          left: sticker.x,
          top: sticker.y,
          transform: [{ rotate: `${sticker.rotation}deg` }],
        },
      ]}
    >
      {isSelected && (
        <View style={styles.controlHeader} pointerEvents="box-none">
          <View style={styles.dragHandle} {...moveResponder.panHandlers}>
            <Move size={12} color="#FFFFFF" />
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(sticker.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.badge,
          sticker.bgColor !== 'transparent' && {
            backgroundColor: sticker.bgColor,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 14,
            borderWidth: isSelected ? 2 : 0,
            borderColor: '#1ABC9C',
          },
        ]}
        onPress={() => onSelect(sticker.id)}
        activeOpacity={0.8}
        {...(isSelected ? moveResponder.panHandlers : {})}
      >
        <Text
          style={[
            styles.text,
            { color: sticker.color, fontSize: sticker.fontSize },
            sticker.bgColor !== 'transparent' && styles.actionFont,
          ]}
        >
          {sticker.text}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 60,
  },
  controlHeader: {
    position: 'absolute',
    top: -26,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 99,
  },
  dragHandle: {
    backgroundColor: '#1ABC9C',
    padding: 4,
    borderRadius: 6,
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    padding: 4,
    borderRadius: 6,
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    textAlign: 'center',
  },
  actionFont: {
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
