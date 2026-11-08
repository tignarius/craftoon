import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Mail, Printer } from 'lucide-react-native';
import { ModeInfoButton } from './ModeInfoButton';
import { AppMode } from '../access/accessPolicy';
import { iconColors, screenChrome } from './screenChrome';

interface ScreenHeaderProps {
  mode?: AppMode;
  pageCount?: number;
  onPrint?: () => void;
  onEmail?: () => void;
  emailLabel?: string;
  emailDisabled?: boolean;
  emailing?: boolean;
  printLabel?: string;
  printDisabled?: boolean;
  printing?: boolean;
  children?: React.ReactNode;
  center?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function ScreenHeader({ mode, pageCount, onPrint,
  printLabel = 'Print comic', printDisabled = false, printing = false,
  onEmail, emailLabel = 'Email selected comic', emailDisabled = false, emailing = false, children, center, trailing }: ScreenHeaderProps) {
  const [headerWidth, setHeaderWidth] = useState(0);
  const [navigationWidth, setNavigationWidth] = useState(0);
  const [actionsWidth, setActionsWidth] = useState(0);
  const [centerWidth, setCenterWidth] = useState(0);
  // Keep the controls centered on the page, independently of either icon group.
  // A second row avoids overlap in narrower iPad / Split View windows.
  const stacked = !!center && headerWidth > 0 &&
    Math.max(navigationWidth, actionsWidth) + centerWidth / 2 + 28 > headerWidth / 2;
  return <SafeAreaView style={screenChrome.safeHeader}>
    <View style={[screenChrome.header, stacked && styles.stacked]}
      onLayout={event => setHeaderWidth(event.nativeEvent.layout.width)}>
      <View style={styles.navigation} onLayout={event => setNavigationWidth(event.nativeEvent.layout.width)}>
        {mode && <><ModeInfoButton mode={mode} pageCount={pageCount} /><View style={styles.modeDivider} /></>}
        {children}
      </View>
      {center && <View style={[styles.center, stacked && styles.centerBelow]} pointerEvents="box-none">
        <View onLayout={event => setCenterWidth(event.nativeEvent.layout.width)}>{center}</View>
      </View>}
      <View style={styles.actions} onLayout={event => setActionsWidth(event.nativeEvent.layout.width)}>
      {onEmail && <TouchableOpacity accessibilityRole="button" accessibilityLabel={emailLabel}
        accessibilityHint={emailDisabled ? 'Select a comic to email' : 'Attach this comic as a PDF to an email'}
        accessibilityState={{ disabled: emailDisabled || emailing, busy: emailing }}
        disabled={emailDisabled || emailing} onPress={onEmail} activeOpacity={0.7} style={screenChrome.action}>
        {emailing ? <ActivityIndicator color={iconColors.email} /> : <Mail size={22} color={iconColors.email} />}
      </TouchableOpacity>}
      {onPrint && <TouchableOpacity accessibilityRole="button" accessibilityLabel={printLabel}
        accessibilityHint={printDisabled ? 'Select a comic to print' : 'Print this comic'}
        accessibilityState={{ disabled: printDisabled || printing, busy: printing }}
        disabled={printDisabled || printing} onPress={onPrint} activeOpacity={0.7} style={screenChrome.print}>
        {printing ? <ActivityIndicator color={iconColors.print} /> : <Printer size={22} color={iconColors.print} />}
      </TouchableOpacity>}
      {trailing}
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  modeDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 6 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, height: 56, alignItems: 'center', justifyContent: 'center' },
  centerBelow: { top: 56, height: 44 },
  stacked: { height: 100, paddingBottom: 44 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
