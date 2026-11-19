import React from 'react';
import { Image, ImageSourcePropType, StyleSheet } from 'react-native';

function StartMenuIcon({ size, source }: { size: number; source: ImageSourcePropType }) {
  const iconSize = size * 0.9 * 0.85;
  return <Image source={source} resizeMode="contain" fadeDuration={0} accessible={false}
    style={[styles.icon, { width: iconSize, height: iconSize }]} />;
}

export function CanvasMenuIcon({ size }: { size: number }) {
  return <StartMenuIcon size={size} source={require('../assets/canvas_menu.png')} />;
}

export function LibraryMenuIcon({ size }: { size: number }) {
  return <StartMenuIcon size={size} source={require('../assets/library_menu.png')} />;
}

const styles = StyleSheet.create({
  icon: { shadowColor: '#241847', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32, shadowRadius: 5 },
});
