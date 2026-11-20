import React from 'react';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { PANEL_ICON_SCALE } from './panelIconSizing';
import type { PanelBorderStyle } from '../types/comic';

export function PanelBorderIcon({ value, color = '#149C92', size = 23 * PANEL_ICON_SCALE, mixed = false }: { value: PanelBorderStyle; color?: string; size?: number; mixed?: boolean }) {
  if (mixed) return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Line x1={3} y1={5} x2={21} y2={5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    {/* Match the solid line's visible ends, including its round caps. */}
    {[2.1, 9.7, 17.3].map(x => <Rect key={x} x={x} y={11.1} width={4.6} height={1.8} fill={color} />)}
    {[3, 6.6, 10.2, 13.8, 17.4, 21].map(x => <Circle key={x} cx={x} cy={19} r={0.9} fill={color} />)}
  </Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={3} y={4} width={18} height={16} rx={1} fill="none" stroke={color} strokeWidth={1.8}
      strokeDasharray={value === 'solid' ? undefined : value === 'dashed' ? '5 3' : '1 3'}
      strokeLinecap={value === 'dotted' ? 'round' : 'butt'} opacity={value === 'none' ? 0.45 : 1} />
    {value === 'none' && <Line x1={3} y1={22} x2={21} y2={2} stroke={color} strokeWidth={2} />}
  </Svg>;
}
