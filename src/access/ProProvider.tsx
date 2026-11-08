import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet,
  TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Check, Glasses, LibraryBig, Sparkles, SquarePen, X } from 'lucide-react-native';
import { AppText as Text } from '../components/AppText';
import { proAccess, ProStatus } from '../services/proAccess';
import { AppMode, FREE_PAGE_LIMIT, ProFeature, upgradeReasons } from './accessPolicy';

export const modeDetails = {
  canvas: { title: 'Canvas mode', description: 'Create panels, draw and arrange your story.', color: '#EA8A23', tint: '#FFF5E8', icon: SquarePen },
  library: { title: 'Library mode', description: 'Browse your saved comics and choose a story.', color: '#8B5CF6', tint: '#F3EDFF', icon: LibraryBig },
  reader: { title: 'Read mode', description: 'Enjoy your comic one page at a time.', color: '#0D9488', tint: '#E8FAF6', icon: Glasses },
  welcome: { title: 'Welcome to Craftoon', description: 'A little space for your big stories.', color: '#8B5CF6', tint: '#F3EDFF', icon: Sparkles },
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

  const transact = async (restore: boolean) => {
    if (busyRef.current) { return; }
    busyRef.current = true;
    const request = ++sequence.current;
    setChecking(false);
    setBusy(true);
    setMessage('');
    try {
      const result = await (restore ? proAccess.restore() : proAccess.purchase());
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
      onPurchase={() => transact(false)} onRestore={() => transact(true)} />
  </ProContext.Provider>;
}

function InfoPanel({ panel, status, busy, checking, message, onClose, onRetry, onPurchase, onRestore }: {
  panel: { mode: AppMode; anchor?: InfoAnchor; feature?: ProFeature; pages?: number } | null;
  status: ProStatus; busy: boolean; checking: boolean; message: string;
  onClose: () => void; onRetry: () => void; onPurchase: () => void; onRestore: () => void;
}) {
  const { width, height } = useWindowDimensions();
  if (!panel) { return null; }
  const mode = modeDetails[panel.mode];
  const Icon = mode.icon;
  const cardWidth = Math.min(360, width - 32);
  const top = Math.max(16, Math.min(panel.anchor ? panel.anchor.y + panel.anchor.height + 8 : 72, height - 280));
  const left = Math.max(16, Math.min(panel.anchor?.x ?? 16, width - cardWidth - 16));
  return <Modal visible transparent animationType="fade" supportedOrientations={['portrait', 'landscape']}
    onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close app information" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.card, { top, left, width: cardWidth, maxHeight: height - top - 32 }]} accessibilityViewIsModal>
        <View style={styles.heading}>
          <View style={[styles.modeBadge, { backgroundColor: mode.tint }]}><Icon size={22} color={mode.color} /></View>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>CURRENT MODE</Text>
            <Text accessibilityRole="header" style={styles.title}>{mode.title}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss app information" onPress={onClose}
            disabled={busy} style={styles.close}><X size={18} color="#64748B" /></TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.description}>{mode.description}</Text>
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionLabel}>YOUR EDITION</Text>
            <View style={styles.editionRow}>
              <Text style={styles.brand}>Craftoon</Text>
              <Text style={[styles.edition, status.isPro && styles.proEdition]}>{checking ? 'Checking…' : status.isPro ? 'Pro' : 'Free'}</Text>
            </View>
            {status.isPro ? <View style={styles.unlocked}><Check size={16} color="#059669" /><Text style={styles.success}>Pro unlocked · One-time purchase</Text></View> : <>
              <Text style={styles.feature}>{panel.feature ? upgradeReasons[panel.feature] : `Free includes up to ${FREE_PAGE_LIMIT} pages per comic.`}</Text>
              {panel.pages !== undefined && <Text style={styles.usage}>{panel.pages} / {FREE_PAGE_LIMIT} free pages</Text>}
            </>}
            <View style={styles.recoveryRow}>
              <Check size={14} color="#64748B" />
              <Text style={styles.recovery}>Automatic draft recovery is included in Free and Pro.</Text>
            </View>
          </View>
          {!status.isPro && <View style={styles.section}>
            <View style={styles.proCard}>
              <View style={styles.proHeading}>
                <Text accessibilityRole="header" style={styles.proTitle}>Craftoon Pro</Text>
                <Text style={styles.purchaseType}>ONE-TIME PURCHASE</Text>
              </View>
              {['More pages for every story', 'Save comics to your Library', 'PDF export, email and printing'].map(benefit =>
                <View key={benefit} style={styles.benefitRow}>
                  <Check size={15} color="#7C3AED" /><Text style={styles.benefit}>{benefit}</Text>
                </View>)}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buy Craftoon Pro"
                disabled={busy || checking || !status.canPurchase} onPress={onPurchase}
                accessibilityState={{ disabled: busy || checking || !status.canPurchase, busy }}
                style={[styles.buy, (busy || checking || !status.canPurchase) && styles.disabled]}>
                {busy || checking ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.buyText}>Unlock Pro{status.displayPrice ? ` · ${status.displayPrice}` : ''}</Text>}
              </TouchableOpacity>
              {!checking && !status.canPurchase && <Text style={styles.notice}>Purchases are currently unavailable. Please try again later.</Text>}
            </View>
          </View>}
          <View style={styles.section}>
            {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
            <View style={styles.links}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Restore purchases" disabled={busy || checking} onPress={onRestore} style={styles.linkButton}>
                <Text style={styles.link}>Restore purchases</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh purchases" disabled={busy || checking} onPress={onRetry} style={styles.linkButton}>
                <Text style={styles.link}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.aboutSection}>
            <Text accessibilityRole="header" style={styles.sectionLabel}>ABOUT CRAFTOON</Text>
            {!!status.developerName && <View style={styles.detailRow}><Text style={styles.detailLabel}>Developed by</Text><Text style={styles.detailValue}>{status.developerName}</Text></View>}
            {!!status.appVersion && <View style={styles.detailRow}><Text style={styles.detailLabel}>Version</Text><Text style={styles.detailValue}>{status.appVersion}</Text></View>}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.16)' },
  card: { position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0', shadowColor: '#334155', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
  content: { paddingBottom: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  headingText: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, color: '#94A3B8' },
  modeBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: '#0F172A' },
  close: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#64748B', marginBottom: 6 },
  description: { fontSize: 14, color: '#475569', lineHeight: 21 },
  editionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  edition: { color: '#475569', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: '700' },
  proEdition: { color: '#7C3AED', backgroundColor: '#F3E8FF' },
  feature: { fontSize: 14, color: '#334155', marginTop: 6, lineHeight: 20 },
  usage: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4 },
  recoveryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7 },
  recovery: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },
  proCard: { borderRadius: 12, padding: 12, backgroundColor: '#FAF8FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E9E1FA' },
  proHeading: { gap: 3, marginBottom: 9 },
  proTitle: { fontSize: 17, fontWeight: '700', color: '#32234F' },
  purchaseType: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8, color: '#8B7AA6' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  benefit: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },
  buy: { backgroundColor: '#7C3AED', minHeight: 44, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 6, paddingHorizontal: 10 },
  buyText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  notice: { fontSize: 12, color: '#64748B', lineHeight: 18, marginTop: 6 },
  message: { fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 6 },
  links: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  linkButton: { minHeight: 36, justifyContent: 'center' },
  link: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  aboutSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 4 },
  detailLabel: { fontSize: 12, color: '#64748B' },
  detailValue: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'right' },
  unlocked: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  success: { fontSize: 13, color: '#059669', flex: 1 },
});
