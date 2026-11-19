import React, { useRef } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';
import type { ComicPanel } from '../types/comic';
import { reshapePanelPoint, ShapeUpdate } from '../utils/panelSnap';
import { PANEL_ICON_SCALE } from './panelIconSizing';
import { panelCorners } from '../utils/panelGeometry';

export function PanelCornerHandle({ panel, offset = { x: 0, y: 0 }, side, scale, otherPanels = [], sheetBounds, onPreview, onCommit, onClose }: {
  panel: ComicPanel; offset?: { x: number; y: number }; side: 'left' | 'right'; scale: number; otherPanels?: ComicPanel[]; sheetBounds?: { width: number; height: number };
  onPreview: (update: ShapeUpdate | null) => void; onCommit: (update: ShapeUpdate) => void; onClose: () => void;
}) {
  const index = side === 'left' ? 3 : 2;
  const latest = useRef({ panel, side, scale, otherPanels, sheetBounds, onPreview, onCommit, onClose });
  latest.current = { panel, side, scale, otherPanels, sheetBounds, onPreview, onCommit, onClose };
  const start = useRef(panel);
  const gestureSide = useRef(side);
  const result = useRef<ShapeUpdate>({ x: panel.x, width: panel.width, height: panel.height, corners: panelCorners(panel) });
  const changed = () => Math.abs(result.current.x! - start.current.x) > 0.000001
    || Math.abs(result.current.width! - start.current.width) > 0.000001
    || result.current.corners!.some((point, i) => Math.abs(point.x - panelCorners(start.current)[i].x) > 0.000001 || Math.abs(point.y - panelCorners(start.current)[i].y) > 0.000001);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { gestureSide.current = latest.current.side; start.current = latest.current.panel; result.current = { x: start.current.x, width: start.current.width, height: start.current.height, corners: panelCorners(start.current) }; },
    onPanResponderMove: (_, g) => {
      result.current = reshapePanelPoint(start.current, gestureSide.current, g.dx / latest.current.scale, latest.current.otherPanels, latest.current.sheetBounds);
      latest.current.onPreview(result.current);
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) { latest.current.onPreview(null); latest.current.onClose(); }
      else if (changed()) { latest.current.onCommit(result.current); }
      else { latest.current.onPreview(null); }
    },
    onPanResponderTerminate: () => { if (changed()) { latest.current.onCommit(result.current); } else { latest.current.onPreview(null); } },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const point = panel.corners![index];
  return <View accessibilityRole="button" accessibilityLabel={`Reshape panel corner ${index + 1}`}
    onAccessibilityTap={onClose}
    accessibilityHint="Drag left or right, with light angle snaps every 15 degrees. Tap to return to rectangular resizing."
    style={{ position: 'absolute', left: offset.x + point.x * (panel.width - 4) - 14, top: offset.y + point.y * (panel.height - 4) - 14,
      width: 28, height: 28, zIndex: 90, alignItems: 'center', justifyContent: 'center' }}
    {...responder.panHandlers}>
    <Svg width={25 * PANEL_ICON_SCALE} height={25 * PANEL_ICON_SCALE} viewBox="0 0 28 28" pointerEvents="none">
      <Polygon points="8,5 20,5 24,22 4,22" fill="rgba(255,255,255,0.94)" stroke="#FFFFFF" strokeWidth={4.5} strokeLinejoin="round" />
      <Polygon points="8,5 20,5 24,22 4,22" fill="none" stroke="#3B82F6" strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={side === 'left' ? 4 : 24} cy={22} r={3} fill="#3B82F6" stroke="#FFFFFF" strokeWidth={1.5} />
    </Svg>
  </View>;
}
