import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet,
  TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Check, Glasses, LibraryBig, Sparkles, SquarePen, X } from 'lucide-react-native';
import { AppText as Text } from '../components/AppText';
import { proAccess, ProStatus } from '../services/proAccess';
import { AppMode, ProFeature } from './accessPolicy';

export const modeDetails = {
  canvas: { title: 'Canvas mode', color: '#EA8A23', tint: '#FFF5E8', icon: SquarePen },
  library: { title: 'Library mode', color: '#8B5CF6', tint: '#F3EDFF', icon: LibraryBig },
  reader: { title: 'Read mode', color: '#0D9488', tint: '#E8FAF6', icon: Glasses },
  welcome: { title: 'Welcome to Craftoon', color: '#8B5CF6', tint: '#F3EDFF', icon: Sparkles },
};
export interface InfoAnchor { x: number; y: number; width: number; height: number }
const initial: ProStatus = { isPro: false, canPurchase: false, displayPrice: '', productId: '', appVersion: '', developerName: '' };
const defaults = {
  status: initial, checking: false, infoOpen: false,
  requirePro: (_feature: ProFeature, _mode: AppMode) => false,
  openInfo: (_mode: AppMode, _anchor?: InfoAnchor, _pages?: number) => {},
};
const ProContext = createContext(defaults);
export const usePro = () => useContext(ProContext);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState(initial);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [panel, setPanel] = useState<{ mode: AppMode; anchor?: InfoAnchor; feature?: ProFeature; pages?: number } | null>(null);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (busyRef.current) { return; }
    const request = ++sequence.current;
    setChecking(true);
    try {
      const next = await proAccess.getStatus();
      if (mounted.current && request === sequence.current) { setStatus(next); }
    } catch {
      if (mounted.current && request === sequence.current) { setMessage('Could not check purchases. Please try again.'); }
    } finally {
      if (mounted.current && request === sequence.current) { setChecking(false); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = proAccess.subscribe(next => {
      sequence.current += 1;
      setStatus(next);
      setChecking(false);
    });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { refresh(); } });
    return () => { mounted.current = false; sequence.current += 1; unsubscribe(); subscription.remove(); };
  }, [refresh]);

  const transact = async (action: 'purchase' | 'restore' | 'redeem') => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    const request = ++sequence.current;
    setChecking(false);
    setBusy(true);
    setMessage('');
    try {
      const result = await proAccess[action]();
      if (!mounted.current) { return; }
      if (request === sequence.current) {
        setStatus(result);
        if (result.outcome === 'pending') { setMessage('Purchase awaiting approval. Pro will unlock once Apple confirms it.'); }
        if (result.outcome === 'restored' && !result.isPro) { setMessage('No Pro purchase was found for this Apple Account.'); }
      }
    } catch (error) {
      if (mounted.current) { setMessage(error instanceof Error ? error.message : 'Purchase could not be completed. Please try again.'); }
    } finally { busyRef.current = false; if (mounted.current) { setBusy(false); } }
  };
  const showManual = async () => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try { await proAccess.showManual(); }
    catch (error) {
      if (mounted.current) { setMessage(error instanceof Error ? error.message : 'Could not open the quick guide. Please try again.'); }
    } finally { busyRef.current = false; if (mounted.current) { setBusy(false); } }
  };
  const openInfo = (mode: AppMode, anchor?: InfoAnchor, pages?: number) => {
    setMessage(''); setPanel({ mode, anchor, pages });
  };
  const requirePro = (feature: ProFeature, mode: AppMode) => {
    if (status.isPro) { return true; }
    setMessage(''); setPanel({ mode, feature });
    return false;
  };
  return <ProContext.Provider value={{ status, checking, infoOpen: panel !== null, requirePro, openInfo }}>
    {children}
    <InfoPanel panel={panel} status={status} busy={busy} checking={checking} message={message}
      onClose={() => { if (!busyRef.current) { setPanel(null); } }} onRetry={refresh}
      onPurchase={() => transact('purchase')} onRestore={() => transact('restore')}
      onRedeem={() => transact('redeem')} onManual={showManual} />
  </ProContext.Provider>;
}

function InfoPanel({ panel, status, busy, checking, message, onClose, onRetry, onPurchase, onRestore, onRedeem, onManual }: {
  panel: { mode: AppMode; anchor?: InfoAnchor; feature?: ProFeature; pages?: number } | null;
  status: ProStatus; busy: boolean; checking: boolean; message: string;
  onClose: () => void; onRetry: () => void; onPurchase: () => void; onRestore: () => void;
  onRedeem: () => void; onManual: () => void;
}) {
  const { width, height } = useWindowDimensions();
  if (!panel) { return null; }
  const mode = modeDetails[panel.mode];
  const Icon = mode.icon;
  const cardWidth = Math.min(320, width - 32);
  const top = Math.max(16, Math.min(panel.anchor ? panel.anchor.y + panel.anchor.height + 8 : 72, height - 360));
  const left = Math.max(16, Math.min(panel.anchor?.x ?? 16, width - cardWidth - 16));
  const disabled = busy || checking;
  return <Modal visible transparent animationType="fade" supportedOrientations={['portrait', 'landscape']}
    onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close app information" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.card, { top, left, width: cardWidth, maxHeight: height - top - 16 }]} accessibilityViewIsModal>
        <View style={styles.heading}>
          <View style={[styles.modeBadge, { backgroundColor: mode.tint }]}><Icon size={20} color={mode.color} /></View>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>CURRENT MODE</Text>
            <Text accessibilityRole="header" style={styles.title}>{mode.title}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss app information" onPress={onClose}
            disabled={busy} style={styles.close}><X size={18} color="#64748B" /></TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open quick guide PDF"
            disabled={busy} onPress={onManual} style={styles.menuRow}>
            <Text style={styles.link}>Quick guide (PDF)</Text>
          </TouchableOpacity>
          <View style={styles.section}>
            <View style={styles.detailRow}>
              <Text style={styles.brand}>Craftoon</Text>
              <Text style={[styles.edition, status.isPro && styles.proEdition]}>{checking ? 'Checking…' : status.isPro ? 'Pro' : 'Free'}</Text>
            </View>
            {!!status.appVersion && <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Version</Text><Text style={styles.detailValue}>{status.appVersion}</Text>
            </View>}
          </View>
          <View style={styles.section}>
            {status.isPro ? <View style={styles.unlocked}>
              <Check size={16} color="#059669" /><Text style={styles.success}>Pro unlocked</Text>
            </View> : <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buy Craftoon Pro"
                disabled={disabled || !status.canPurchase} onPress={onPurchase}
                accessibilityState={{ disabled: disabled || !status.canPurchase, busy }}
                style={[styles.buy, (disabled || !status.canPurchase) && styles.disabled]}>
                {busy || checking ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.buyText}>Unlock Pro{status.displayPrice ? ` · ${status.displayPrice}` : ''}</Text>}
              </TouchableOpacity>
              {!checking && !status.canPurchase && <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchases unavailable</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh purchases"
                  disabled={busy} onPress={onRetry} style={styles.smallButton}><Text style={styles.smallLink}>Retry</Text></TouchableOpacity>
              </View>}
            </>}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Restore purchases" disabled={disabled}
              onPress={onRestore} style={styles.restore}><Text style={styles.smallLink}>Restore purchases</Text></TouchableOpacity>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enter activation code"
            accessibilityHint="Open Apple's secure code entry screen"
            accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onRedeem} style={styles.menuRow}>
            <Text style={styles.link}>Enter activation code</Text>
          </TouchableOpacity>
          {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
          <View style={styles.about}>
            <Text style={styles.detailLabel}>About Craftoon</Text>
            {!!status.developerName && <Text style={styles.detailValue}>{status.developerName}</Text>}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.16)' },
  card: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0', shadowColor: '#334155',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  headingText: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: '#94A3B8' },
  modeBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  close: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  menuRow: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 26 },
  brand: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  edition: { color: '#475569', backgroundColor: '#F1F5F9', paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 6, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: '#E2E8F0' },
  proEdition: { color: '#7C3AED', backgroundColor: '#F3E8FF', borderColor: '#7C3AED' },
  buy: { backgroundColor: '#7C3AED', minHeight: 44, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  buyText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  restore: { minHeight: 32, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  smallButton: { minHeight: 32, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  smallLink: { fontSize: 12, fontWeight: '500', color: '#7C3AED' },
  about: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F8FAFC' },
  detailLabel: { fontSize: 12, color: '#64748B' },
  detailValue: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: '#334155', textAlign: 'right' },
  message: { fontSize: 12, color: '#475569', lineHeight: 18, paddingHorizontal: 16, paddingVertical: 10 },
  unlocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 34 },
  success: { fontSize: 13, color: '#059669' },
});
