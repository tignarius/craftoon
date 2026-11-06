import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

const RNPencilKit = requireNativeComponent<any>('RNPencilKit');

interface PencilKitProps extends ViewProps {
  isDrawingActive?: boolean;
  drawingTool?: 'pen' | 'lasso';
  panelId?: string;
  drawingData?: string;
  onDrawingChange?: (event: { nativeEvent: { drawingData: string } }) => void;
}

export const PencilKitView: React.FC<PencilKitProps> = ({
  style,
  isDrawingActive = false,
  drawingTool = 'pen',
  panelId,
  drawingData,
  onDrawingChange,
  ...props
}) => {
  return (
    <RNPencilKit
      style={[{ flex: 1, backgroundColor: '#ffffff' }, style]}
      isDrawingActive={isDrawingActive}
      drawingTool={drawingTool}
      panelId={panelId}
      drawingData={drawingData}
      onDrawingChange={onDrawingChange}
      {...props}
    />
  );
};
