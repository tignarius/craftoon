import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { AppText as Text } from './AppText';
import {
  MousePointer2,
  Square,
  Pen,
  MessageCircle,
  Sparkles,
  LayoutGrid,
} from 'lucide-react-native';
import { ToolType } from '../types/comic';

interface ComicToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onOpenTemplates: () => void;
  onOpenStickers: () => void;
  onAddBubble: () => void;
}

export const ComicToolbar: React.FC<ComicToolbarProps> = ({
  activeTool,
  onSelectTool,
  onOpenTemplates,
  onOpenStickers,
  onAddBubble,
}) => {
  const tools = [
    {
      id: 'select' as ToolType,
      label: 'Select',
      icon: MousePointer2,
      onPress: () => onSelectTool('select'),
    },
    {
      id: 'panel' as ToolType,
      label: 'Cut Panel',
      icon: Square,
      onPress: () => onSelectTool('panel'),
    },
    {
      id: 'draw' as ToolType,
      label: 'PencilKit',
      icon: Pen,
      onPress: () => onSelectTool('draw'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.toolbarCard}>
        {/* Main interactive tools */}
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.toolBtn, isActive && styles.activeToolBtn]}
              onPress={t.onPress}
              activeOpacity={0.7}
            >
              <Icon size={20} color={isActive ? '#0D9488' : '#4B5563'} />
              <Text style={[styles.toolLabel, isActive && styles.activeToolLabel]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.divider} />

        {/* Bubble Tool */}
        <TouchableOpacity
          style={[styles.toolBtn, activeTool === 'bubble' && styles.activeToolBtn]}
          onPress={() => {
            onSelectTool('bubble');
            onAddBubble();
          }}
          activeOpacity={0.7}
        >
          <MessageCircle size={20} color={activeTool === 'bubble' ? '#0D9488' : '#4B5563'} />
          <Text style={[styles.toolLabel, activeTool === 'bubble' && styles.activeToolLabel]}>
            Bubble
          </Text>
        </TouchableOpacity>

        {/* Sticker Tool */}
        <TouchableOpacity
          style={[styles.toolBtn, activeTool === 'sticker' && styles.activeToolBtn]}
          onPress={() => {
            onSelectTool('sticker');
            onOpenStickers();
          }}
          activeOpacity={0.7}
        >
          <Sparkles size={20} color={activeTool === 'sticker' ? '#0D9488' : '#4B5563'} />
          <Text style={[styles.toolLabel, activeTool === 'sticker' && styles.activeToolLabel]}>
            Stickers
          </Text>
        </TouchableOpacity>

        {/* Template Presets */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={onOpenTemplates}
          activeOpacity={0.7}
        >
          <LayoutGrid size={20} color="#4F46E5" />
          <Text style={[styles.toolLabel, { color: '#4F46E5' }]}>
            Grids
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    pointerEvents: 'box-none',
  },
  toolbarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  toolBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 64,
  },
  activeToolBtn: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 3,
  },
  activeToolLabel: {
    color: '#0D9488',
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
});
