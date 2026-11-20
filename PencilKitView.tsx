import React from 'react';
import type { PanelCorners, PanelInkGeometry } from './src/types/comic';
import { requireNativeComponent, ViewProps } from 'react-native';

const RNPencilKit = requireNativeComponent<any>('RNPencilKit');

interface PencilKitProps extends ViewProps {
  isDrawingActive?: boolean;
  drawingTool?: 'pen' | 'lasso';
  panelId?: string;
  selectionTimestamp?: number;
  renderScale?: number;
  polygonPoints?: PanelCorners;
  shapeFrame?: { x: number; y?: number; artworkLocked?: boolean; width: number; height: number; revision: number; preview: boolean; resizeInk?: boolean; warpInk?: boolean; corners?: PanelCorners;
    contentBounds?: { x: number; y: number; width: number; height: number } };
  drawingData?: string;
  transparentBackground?: boolean;
  onDrawingChange?: (event: { nativeEvent: { drawingData: string; geometry?: PanelInkGeometry } }) => void;
}

export const PencilKitView: React.FC<PencilKitProps> = ({
  style,
  isDrawingActive = false,
  drawingTool = 'pen',
  panelId,
  drawingData,
  transparentBackground = false,
  onDrawingChange,
  ...props
}) => {
  return (
    <RNPencilKit
      style={[{ flex: 1, backgroundColor: transparentBackground ? 'transparent' : '#ffffff' }, style]}
      transparentBackground={transparentBackground}
      isDrawingActive={isDrawingActive}
      drawingTool={drawingTool}
      panelId={panelId}
      drawingData={drawingData}
      onDrawingChange={onDrawingChange}
      {...props}
    />
  );
};
