import React, { forwardRef } from 'react';
import {
  Platform, StyleSheet, Text as NativeText, TextInput as NativeTextInput,
  TextInputProps, TextProps,
} from 'react-native';

// React Native's iOS text renderer maps ui-rounded to the native rounded
// system design (SF Pro Rounded), including editable text and all weights.
export const APP_FONT_FAMILY = Platform.OS === 'ios' ? 'ui-rounded' : 'sans-serif-rounded';

// One font for app labels, page controls, captions, and editable comic text.
export const AppText = forwardRef<NativeText, TextProps>(({ style, ...props }, ref) => (
  <NativeText ref={ref} {...props} style={[style, styles.font]} />
));
AppText.displayName = 'AppText';

export const AppTextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => (
  <NativeTextInput ref={ref} {...props} style={[style, styles.font]} />
));
AppTextInput.displayName = 'AppTextInput';

const styles = StyleSheet.create({
  font: { fontFamily: APP_FONT_FAMILY },
});
