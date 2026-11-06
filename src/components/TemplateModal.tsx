import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { AppText as Text } from './AppText';
import { ComicPanel } from '../types/comic';
import { LayoutGrid, X } from 'lucide-react-native';

interface TemplateModalProps {
  visible: boolean;
  onClose: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onApplyTemplate: (panels: ComicPanel[]) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  visible,
  onClose,
  canvasWidth,
  canvasHeight,
  onApplyTemplate,
}) => {
  const margin = 24;
  const gap = 16;
  const w = canvasWidth - margin * 2;
  const h = canvasHeight - margin * 2;

  const templates = [
    {
      name: '1 Panel (Full Page)',
      desc: 'Single full-bleed illustration',
      getPanels: (): ComicPanel[] => [
        {
          id: `panel-${Date.now()}-1`,
          x: margin,
          y: margin,
          width: w,
          height: h,
          borderWidth: 3,
          borderColor: '#111827',
          borderRadius: 4,
        },
      ],
    },
    {
      name: '2 Panels (Vertical Split)',
      desc: 'Top and bottom split layout',
      getPanels: (): ComicPanel[] => {
        const itemH = (h - gap) / 2;
        return [
          {
            id: `panel-${Date.now()}-1`,
            x: margin,
            y: margin,
            width: w,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-2`,
            x: margin,
            y: margin + itemH + gap,
            width: w,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
        ];
      },
    },
    {
      name: '2 Panels (Horizontal Split)',
      desc: 'Left and right side-by-side',
      getPanels: (): ComicPanel[] => {
        const itemW = (w - gap) / 2;
        return [
          {
            id: `panel-${Date.now()}-1`,
            x: margin,
            y: margin,
            width: itemW,
            height: h,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-2`,
            x: margin + itemW + gap,
            y: margin,
            width: itemW,
            height: h,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
        ];
      },
    },
    {
      name: '3 Panels (Webtoon / Classic)',
      desc: 'Large top shot + two bottom cuts',
      getPanels: (): ComicPanel[] => {
        const topH = (h - gap) * 0.55;
        const bottomH = (h - gap) * 0.45;
        const halfW = (w - gap) / 2;
        return [
          {
            id: `panel-${Date.now()}-1`,
            x: margin,
            y: margin,
            width: w,
            height: topH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-2`,
            x: margin,
            y: margin + topH + gap,
            width: halfW,
            height: bottomH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-3`,
            x: margin + halfW + gap,
            y: margin + topH + gap,
            width: halfW,
            height: bottomH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
        ];
      },
    },
    {
      name: '4 Panels (2x2 Grid)',
      desc: 'Balanced 4-panel comic strip',
      getPanels: (): ComicPanel[] => {
        const itemW = (w - gap) / 2;
        const itemH = (h - gap) / 2;
        return [
          {
            id: `panel-${Date.now()}-1`,
            x: margin,
            y: margin,
            width: itemW,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-2`,
            x: margin + itemW + gap,
            y: margin,
            width: itemW,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-3`,
            x: margin,
            y: margin + itemH + gap,
            width: itemW,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
          {
            id: `panel-${Date.now()}-4`,
            x: margin + itemW + gap,
            y: margin + itemH + gap,
            width: itemW,
            height: itemH,
            borderWidth: 3,
            borderColor: '#111827',
            borderRadius: 4,
          },
        ];
      },
    },
    {
      name: '4-Koma (Yon-koma Vertical)',
      desc: 'Traditional 4-panel vertical manga strip',
      getPanels: (): ComicPanel[] => {
        const itemH = (h - gap * 3) / 4;
        return [0, 1, 2, 3].map((i) => ({
          id: `panel-${Date.now()}-${i + 1}`,
          x: margin,
          y: margin + i * (itemH + gap),
          width: w,
          height: itemH,
          borderWidth: 3,
          borderColor: '#111827',
          borderRadius: 4,
        }));
      },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <LayoutGrid size={22} color="#1ABC9C" />
              <Text style={styles.headerTitle}>Comic Layout Templates</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Select a layout preset to instantly generate comic panels</Text>

          <ScrollView contentContainerStyle={styles.templateList} showsVerticalScrollIndicator={false}>
            {templates.map((tpl, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.templateCard}
                activeOpacity={0.8}
                onPress={() => {
                  onApplyTemplate(tpl.getPanels());
                  onClose();
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{tpl.name}</Text>
                </View>
                <Text style={styles.cardDesc}>{tpl.desc}</Text>
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
    maxWidth: 540,
    maxHeight: '80%',
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
  templateList: {
    gap: 12,
    paddingBottom: 8,
  },
  templateCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
});
