import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Printer } from 'lucide-react-native';
import { iconColors, screenChrome } from './screenChrome';

interface ScreenHeaderProps {
  onPrint: () => void;
  printLabel?: string;
  printDisabled?: boolean;
  printing?: boolean;
  children?: React.ReactNode;
  center?: React.ReactNode;
}

export function ScreenHeader({ onPrint,
  printLabel = 'Print comic', printDisabled = false, printing = false, children, center }: ScreenHeaderProps) {
  return <SafeAreaView style={screenChrome.safeHeader}>
    <View style={screenChrome.header}>
      <View style={styles.navigation}>{children}</View>
      {center && <View style={styles.center} pointerEvents="box-none">{center}</View>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={printLabel}
        accessibilityHint={printDisabled ? 'Select a comic to print' : 'Print this comic'}
        accessibilityState={{ disabled: printDisabled || printing, busy: printing }}
        disabled={printDisabled || printing} onPress={onPrint} activeOpacity={0.7} style={screenChrome.print}>
        {printing ? <ActivityIndicator color={iconColors.print} /> : <Printer size={22} color={iconColors.print} />}
      </TouchableOpacity>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
