import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Grid2x2,
  FilePlus,
  Upload,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react-native';

interface HeaderProps {
  currentPageIndex: number;
  totalPages: number;
  onNewStory: () => void;
  onLoadStory: () => void;
  onSaveStory: () => void;
  onPrint: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPageIndex,
  totalPages,
  onNewStory,
  onLoadStory,
  onSaveStory,
  onPrint,
  onPrevPage,
  onNextPage,
  onAddPage,
}) => {
  return (
    <View style={styles.header}>
      {/* Left: Logo + Actions */}
      <View style={styles.headerLeft}>
        <View style={styles.logoGroup}>
          <View style={styles.logoIcon}>
            <Grid2x2 size={16} color="white" />
          </View>
          <Text style={styles.logoText}>Craftoon</Text>
        </View>

        <View style={styles.sep} />

        <View style={styles.actionGroup}>
          <TouchableOpacity style={styles.hBtn} onPress={onNewStory} activeOpacity={0.7}>
            <FilePlus size={20} color="#7F8C8D" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={onLoadStory} activeOpacity={0.7}>
            <Upload size={20} color="#7F8C8D" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={onSaveStory} activeOpacity={0.7}>
            <Download size={20} color="#7F8C8D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Center: Page Controls */}
      <View style={styles.pageGroup}>
        <TouchableOpacity
          style={[styles.pageBtn, currentPageIndex === 0 && styles.disabledBtn]}
          onPress={onPrevPage}
          disabled={currentPageIndex === 0}
        >
          <ChevronLeft size={18} color={currentPageIndex === 0 ? '#BDC3C7' : '#2C3E50'} />
        </TouchableOpacity>

        <Text style={styles.pageTxt}>
          {currentPageIndex + 1} / {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.pageBtn, currentPageIndex >= totalPages - 1 && styles.disabledBtn]}
          onPress={onNextPage}
          disabled={currentPageIndex >= totalPages - 1}
        >
          <ChevronRight size={18} color={currentPageIndex >= totalPages - 1 ? '#BDC3C7' : '#2C3E50'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addPageBtn} onPress={onAddPage} activeOpacity={0.7}>
          <Plus size={16} color="#1ABC9C" />
        </TouchableOpacity>
      </View>

      {/* Right: Print Button */}
      <TouchableOpacity style={styles.printBtn} onPress={onPrint} activeOpacity={0.7}>
        <Printer size={16} color="#1ABC9C" />
        <Text style={styles.printTxt}>Print</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8EDF2',
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  logoIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#1ABC9C',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#34495E',
    letterSpacing: -0.3,
  },
  sep: {
    width: 1,
    height: 26,
    backgroundColor: '#EDF2F7',
    marginRight: 14,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  hBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  pageGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageBtn: {
    padding: 4,
  },
  pageTxt: {
    fontSize: 13,
    color: '#34495E',
    fontWeight: '700',
    marginHorizontal: 8,
  },
  addPageBtn: {
    padding: 4,
    marginLeft: 4,
  },
  disabledBtn: {
    opacity: 0.3,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1ABC9C',
  },
  printTxt: {
    color: '#1ABC9C',
    fontWeight: '700',
    marginLeft: 6,
    fontSize: 14,
  },
});
