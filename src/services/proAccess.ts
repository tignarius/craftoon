import { NativeEventEmitter, NativeModules } from 'react-native';

export interface ProStatus {
  isPro: boolean;
  canPurchase: boolean;
  displayPrice: string;
  productId: string;
  appVersion: string;
  developerName: string;
}
export interface PurchaseResult extends ProStatus {
  outcome: 'purchased' | 'cancelled' | 'pending' | 'restored';
}

const native = NativeModules.CraftoonPro;
const unavailable: ProStatus = {
  isPro: false, canPurchase: false, displayPrice: '', productId: '', appVersion: '', developerName: '',
};
export const proAccess = {
  getStatus: (): Promise<ProStatus> => native ? native.getStatus() : Promise.resolve(unavailable),
  purchase: (): Promise<PurchaseResult> => native ? native.purchase()
    : Promise.reject(new Error('Purchases are currently unavailable. Please try again later.')),
  restore: (): Promise<PurchaseResult> => native ? native.restore()
    : Promise.reject(new Error('Purchases are currently unavailable. Please try again later.')),
  subscribe: (listener: (status: ProStatus) => void) => {
    if (!native) { return () => {}; }
    const subscription = new NativeEventEmitter(native).addListener('CraftoonProChanged', listener);
    return () => subscription.remove();
  },
};
