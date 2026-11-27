import { NativeEventEmitter, NativeModules } from 'react-native';

export interface ProStatus {
  isPro: boolean;
  canPurchase: boolean;
  displayPrice: string;
  productId: string;
  appVersion: string;
  developerName: string;
  purchaseIssue?: string;
}
export interface PurchaseResult extends ProStatus {
  outcome: 'purchased' | 'cancelled' | 'pending' | 'restored' | 'redeemed';
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
  redeem: (): Promise<PurchaseResult> => native?.redeem ? native.redeem()
    : Promise.reject(new Error('Code redemption is available in the iPad app.')),
  showManual: (): Promise<void> => native?.showManual ? native.showManual()
    : Promise.reject(new Error('The quick guide is available in the iPad app.')),
  subscribe: (listener: (status: ProStatus) => void) => {
    if (!native) { return () => {}; }
    const subscription = new NativeEventEmitter(native).addListener('CraftoonProChanged', listener);
    return () => subscription.remove();
  },
};
