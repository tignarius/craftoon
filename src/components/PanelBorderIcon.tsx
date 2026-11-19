import React from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import { PANEL_ICON_SCALE } from './panelIconSizing';
import type { PanelBorderStyle } from '../types/comic';

export function PanelBorderIcon({ value, color = '#149C92', size = 23 * PANEL_ICON_SCALE }: { value: PanelBorderStyle; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={3} y={4} width={18} height={16} rx={1} fill="none" stroke={color} strokeWidth={1.8}
      strokeDasharray={value === 'solid' ? undefined : value === 'dashed' ? '5 3' : '1 3'}
      strokeLinecap={value === 'dotted' ? 'round' : 'butt'} opacity={value === 'none' ? 0.45 : 1} />
    {value === 'none' && <Line x1={3} y1={22} x2={21} y2={2} stroke={color} strokeWidth={2} />}
  </Svg>;
}
