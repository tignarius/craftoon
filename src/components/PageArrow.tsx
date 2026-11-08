import React from 'react';
import { StyleSheet, View } from 'react-native';

export function PageArrow({ direction, color = '#64748B' }: {
  direction: 'left' | 'right'; color?: string;
}) {
  return <View style={[styles.triangle, direction === 'left'
    ? [styles.left, { borderRightColor: color }]
    : [styles.right, { borderLeftColor: color }]]} />;
}
const styles = StyleSheet.create({
  left: { borderRightWidth: 10 },
  right: { borderLeftWidth: 10 },
  triangle: { width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7,
    borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});
