import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { ComicSticker } from '../types/comic';

interface StickerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: Omit<ComicSticker, 'id' | 'x' | 'y'>) => void;
}

const STICKER_PRESETS = [
  { text: 'POW!', color: '#FFFFFF', bgColor: '#EF4444', fontSize: 24, rotation: -8 },
  { text: 'BOOM!', color: '#FEF08A', bgColor: '#DC2626', fontSize: 26, rotation: 6 },
  { text: 'ZOOM!', color: '#FFFFFF', bgColor: '#3B82F6', fontSize: 22, rotation: -12 },
  { text: 'WAAAH!', color: '#FFFFFF', bgColor: '#8B5CF6', fontSize: 20, rotation: 5 },
  { text: 'CRASH!', color: '#FFFFFF', bgColor: '#F97316', fontSize: 22, rotation: -6 },
  { text: 'BANG!', color: '#FFFFFF', bgColor: '#EA580C', fontSize: 24, rotation: 8 },
  { text: 'GASP!', color: '#1E293B', bgColor: '#FDE047', fontSize: 20, rotation: -4 },
  { text: 'OOF!', color: '#FFFFFF', bgColor: '#64748B', fontSize: 22, rotation: 4 },
  { text: '✨', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '💥', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '❤️', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '⚡', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '❓', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '❗', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '💡', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
  { text: '🔥', color: '#000000', bgColor: 'transparent', fontSize: 32, rotation: 0 },
];

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  visible,
  onClose,
  onSelectSticker,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={22} color="#F59E0B" />
              <Text style={styles.headerTitle}>Comic Stickers & SFX</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Tap a sticker or sound effect to place it on the comic</Text>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {STICKER_PRESETS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.stickerItem,
                  item.bgColor !== 'transparent' && {
                    backgroundColor: item.bgColor,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 14,
                    transform: [{ rotate: `${item.rotation}deg` }],
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  onSelectSticker(item);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.stickerText,
                    {
                      color: item.color,
                      fontSize: item.fontSize,
                    },
                    item.bgColor !== 'transparent' && styles.actionFont,
                  ]}
                >
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stickerItem: {
    minWidth: 70,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },
  stickerText: {
    fontWeight: '900',
    textAlign: 'center',
  },
  actionFont: {
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
