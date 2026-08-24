// PencilKitView.tsx
import React, { useRef, useEffect } from 'react';
import { requireNativeComponent, ViewProps, UIManager, findNodeHandle } from 'react-native';

// 1. 네이티브(맥) 쪽에 있는 'RNPencilKit'이라는 부품을 가져와라!
const RNPencilKit = requireNativeComponent('RNPencilKit');

interface PencilKitProps extends ViewProps {
    // 나중에 여기에 펜 색상, 지우개 모드 같은 기능을 추가할 수 있습니다.
}

export const PencilKitView: React.FC<PencilKitProps> = ({ style, ...props }) => {
    return <RNPencilKit style={[{ flex: 1, backgroundColor: '#ffffff' }, style]} {...props} />;
};
