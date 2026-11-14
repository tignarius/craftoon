import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

const RNPencilKit = requireNativeComponent<any>('RNPencilKit');

interface PencilKitProps extends ViewProps {
  isDrawingActive?: boolean;
  drawingTool?: 'pen' | 'lasso';
  panelId?: string;
  drawingData?: string;
  transparentBackground?: boolean;
  onDrawingChange?: (event: { nativeEvent: { drawingData: string } }) => void;
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
