import React, { forwardRef } from 'react';
import {
  Platform, StyleSheet, Text as NativeText, TextInput as NativeTextInput,
  TextInputProps, TextProps,
} from 'react-native';

export const APP_FONT_FAMILY = Platform.OS === 'ios' ? 'Chalkboard SE' : 'sans-serif-rounded';

// One font for app labels, page controls, captions, and editable comic text.
export const AppText = forwardRef<NativeText, TextProps>(({ style, ...props }, ref) => (
  <NativeText ref={ref} {...props} style={[styles.rounded, style]} />
));
AppText.displayName = 'AppText';

export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => (
  <NativeTextInput ref={ref} {...props} style={[styles.rounded, style]} />
));
AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  rounded: { fontFamily: APP_FONT_FAMILY },
});
