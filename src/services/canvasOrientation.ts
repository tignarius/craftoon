import { NativeModules, Platform } from 'react-native';
import { CanvasOrientation } from '../utils/canvasFormat';

export async function lockCanvasOrientation(orientation: CanvasOrientation | 'automatic'): Promise<void> {
  if (Platform.OS === 'ios') {
    await NativeModules.CraftoonLibrary.setCanvasOrientation(orientation);
  }
}
