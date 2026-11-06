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
} from 'lucide-react-native';
import { ToolType } from '../types/comic';

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  hasActivePanel?: boolean;
  isDrawingActive?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  onUndo,
  onRedo,
  hasActivePanel = false,
  isDrawingActive = false,
}) => {
  return (
    <View
      style={[
        styles.floatingBottomToolbar,
        isDrawingActive ? styles.toolbarTop : styles.toolbarBottom,
      ]}
    >
      {/* Undo / Redo */}
      <TouchableOpacity style={styles.tBtn} onPress={onUndo} activeOpacity={0.7}>
        <Undo2 size={21} color="#64748B" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tBtn} onPress={onRedo} activeOpacity={0.7}>
        <Redo2 size={21} color="#64748B" />
      </TouchableOpacity>

      <View style={styles.tsep} />

      {/* Panel / Layout Cut Tool (핵심 도구: 드래그해서 칸 만들기) */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'panel' && styles.tBtnActive]}
        onPress={() => onSelectTool('panel')}
        activeOpacity={0.7}
      >
        <Square size={22} color={currentTool === 'panel' ? '#0F172A' : '#94A3B8'} />
        {currentTool === 'panel' && <View style={styles.tDot} />}
      </TouchableOpacity>

      <View style={styles.tsep} />

      {/* Pencil / Draw Tool */}
      <TouchableOpacity
        style={[
          styles.tBtn,
          currentTool === 'pen' && styles.tBtnActive,
          !hasActivePanel && styles.tBtnDisabled,
        ]}
        onPress={() => onSelectTool('pen')}
        activeOpacity={0.7}
      >
        <Pen size={21} color={currentTool === 'pen' ? '#0F172A' : hasActivePanel ? '#64748B' : '#CBD5E1'} />
        {currentTool === 'pen' && <View style={styles.tDot} />}
      </TouchableOpacity>

      {/* Speech Bubble Tool */}
      <TouchableOpacity
        style={[styles.tBtn, currentTool === 'bubble' && styles.tBtnActive]}
        onPress={() => onSelectTool('bubble')}
        activeOpacity={0.7}
      >
        <MessageCircle size={22} color={currentTool === 'bubble' ? '#0F172A' : '#94A3B8'} />
        {currentTool === 'bubble' && <View style={styles.tDot} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingBottomToolbar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 999,
  },
  toolbarBottom: {
    bottom: 28,
  },
  toolbarTop: {
    top: 68,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderColor: '#0D9488',
    borderWidth: 1.5,
  },
  tsep: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 6,
  },
  tBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  tBtnActive: {
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tBtnDisabled: {
    opacity: 0.5,
  },
  tDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0F172A',
  },
});
