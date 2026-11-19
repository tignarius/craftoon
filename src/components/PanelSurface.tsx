import { requireNativeComponent, ViewProps } from 'react-native';
import type { PanelCorners } from '../types/comic';

// Clips the reference image, PencilKit tiles and layout touch surface together.
// A native shape mask avoids offscreen snapshots or resampling live ink.
export const PanelSurface = requireNativeComponent<ViewProps & { polygonPoints: PanelCorners; clipContent?: boolean }>('CraftoonPanelClip');
