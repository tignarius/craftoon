import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Modal, SafeAreaView, ScrollView, useWindowDimensions,
  StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { AppText as Text } from './AppText';

interface Props {
  visible: boolean;
  name: string;
  saving: boolean;
  error: string | null;
  onChangeName: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SaveComicDialog({ visible, name, saving, error, onChangeName, onSave, onCancel }: Props) {
  const input = useRef<TextInput>(null);
  useEffect(() => {
    // Return keyboard focus after a failed save as well as on initial opening.
    if (visible && !saving) { input.current?.focus(); }
  }, [visible, saving]);
  const { width, height } = useWindowDimensions();
  // Freeze the card's anchor when opening. Reserve keyboard space up front,
  // keeping it as close to screen center as the docked keyboard allows.
  const layout = useRef({ visible: false, compact: false, top: 24 });
  if (visible && !layout.current.visible) {
    const compact = height < 500;
    const landscape = width > height;
    const keyboardSpace = compact ? height * 0.48
      : Math.min(landscape ? 440 : 400, height * (landscape ? 0.53 : 0.36));
    const cardHeight = compact ? 190 : 260;
    layout.current.compact = compact;
    layout.current.top = Math.max(compact ? 12 : 24,
      Math.min((height - cardHeight) / 2, height - keyboardSpace - cardHeight - 24) - (compact ? 0 : 48));
  }
  layout.current.visible = visible;
  const compact = layout.current.compact;
  return <Modal visible={visible} transparent animationType="fade"
    onShow={() => input.current?.focus()}
    onRequestClose={() => { if (!saving) { onCancel(); } }} supportedOrientations={['portrait', 'landscape']}>
    <SafeAreaView style={styles.overlay}>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent, { paddingTop: layout.current.top }]}
        automaticallyAdjustKeyboardInsets={false} automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="always" bounces={false}>
        <View style={[styles.card, compact && styles.compactCard]} accessibilityViewIsModal>
          <Text style={styles.title}>Save comic</Text>
          {!compact && <Text style={styles.description}>Choose a name for this comic.</Text>}
          <TextInput ref={input} accessibilityLabel="Comic name" style={[styles.input, compact && styles.compactInput]}
            value={name} onChangeText={onChangeName} editable={!saving} maxLength={80}
            autoFocus selectTextOnFocus autoCapitalize="none"
            autoCorrect={false} spellCheck={false} returnKeyType="done" submitBehavior="submit"
            onSubmitEditing={() => { if (!saving) { onSave(); } }} />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={[styles.actions, compact && styles.compactActions]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel saving comic"
              disabled={saving} onPress={onCancel} style={[styles.button, saving && styles.disabled]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirm save comic"
              accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
              onPress={onSave} style={[styles.button, styles.saveButton]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  content: { flexGrow: 1, padding: 24, alignItems: 'center' },
  compactContent: { padding: 12 },
  compactCard: { padding: 16 },
  compactInput: { marginTop: 10, minHeight: 44, paddingVertical: 6 },
  compactActions: { marginTop: 12 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', padding: 24, borderRadius: 20, backgroundColor: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  description: { fontSize: 15, marginTop: 8, marginBottom: 16, color: '#64748B' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, color: '#0F172A' },
  error: { color: '#DC2626', marginTop: 12, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  button: { minWidth: 88, minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  saveButton: { backgroundColor: '#0D9488' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancelText: { color: '#475569', fontSize: 16 },
  disabled: { opacity: 0.4 },
});
