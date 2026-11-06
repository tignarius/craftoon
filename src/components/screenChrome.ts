import { StyleSheet } from 'react-native';

export const iconColors = {
  read: '#0D9488',
  library: '#8B5CF6',
  canvas: '#EA8A23',
  save: '#3B82F6',
  newComic: '#647ACB',
  print: '#1ABC9C',
  delete: '#DC2626',
};

export const screenChrome = StyleSheet.create({
  safeHeader: { backgroundColor: '#FFFFFF', zIndex: 100 },
  header: {
    height: 56, backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF2', zIndex: 100,
  },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  print: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#34495E', letterSpacing: -0.3 },
});
