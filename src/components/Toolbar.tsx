import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Undo2,
  Redo2,
  Square,
  Pen,
  MessageCircle,
  Paintbrush,
  Eraser,
} from 'lucide-react-native';
import { ToolType } from '../types/comic';

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  bottomOffset?: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  onUndo,
  onRedo,
  bottomOffset = 24,
}) => {
  return (
    <View style={[styles.toolbar, { bottom: bottomOffset }]}>
      <TouchableOpacity style={styles.tBtn} onPress={onUndo} activeOpacity={0.7}>
        <Undo2 size={20} color="#7F8C8D" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tBtn} onPress={onRedo} activeOpacity={0.7}>
        <Redo2 size={20} color="#7F8C8D" />
      </TouchableOpacity>

      <View style={styles.tsep} />

      {/* Panel / Layout Cut Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'panel' && styles.tBtnActive]}
        onPress={() => onSelectTool('panel')}
        activeOpacity={0.7}
      >
        <Square size={21} color={currentTool === 'panel' ? '#2C3E50' : '#BDC3C7'} />
        {currentTool === 'panel' && <View style={styles.tDot} />}
      </TouchableOpacity>

      <View style={styles.tsep} />

      {/* PencilKit / Draw Pen Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'pen' && styles.tBtnActive]}
        onPress={() => onSelectTool('pen')}
        activeOpacity={0.7}
      >
        <Pen size={21} color={currentTool === 'pen' ? '#2C3E50' : '#BDC3C7'} />
        {currentTool === 'pen' && <View style={styles.tDot} />}
      </TouchableOpacity>

      {/* Speech Bubble Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'bubble' && styles.tBtnActive]}
        onPress={() => onSelectTool('bubble')}
        activeOpacity={0.7}
      >
        <MessageCircle size={21} color={currentTool === 'bubble' ? '#2C3E50' : '#BDC3C7'} />
        {currentTool === 'bubble' && <View style={styles.tDot} />}
      </TouchableOpacity>

      {/* Brush Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'brush' && styles.tBtnActive]}
        onPress={() => onSelectTool('brush')}
        activeOpacity={0.7}
      >
        <Paintbrush size={21} color={currentTool === 'brush' ? '#2C3E50' : '#BDC3C7'} />
        {currentTool === 'brush' && <View style={styles.tDot} />}
      </TouchableOpacity>

      {/* Eraser Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'eraser' && styles.tBtnActive]}
        onPress={() => onSelectTool('eraser')}
        activeOpacity={0.7}
      >
        <Eraser size={21} color={currentTool === 'eraser' ? '#2C3E50' : '#BDC3C7'} />
        {currentTool === 'eraser' && <View style={styles.tDot} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EDF2F7',
    zIndex: 999,
  },
  tsep: {
    width: 1,
    height: 24,
    backgroundColor: '#EDF2F7',
    marginHorizontal: 6,
  },
  tBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  tBtnActive: {
    backgroundColor: '#F8FFFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5F5EE',
  },
  tDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1ABC9C',
  },
});
