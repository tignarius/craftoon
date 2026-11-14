import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity, View } from 'react-native';
import { ProProvider, usePro } from '../src/access/ProProvider';
import { ModeInfoButton } from '../src/components/ModeInfoButton';
import { proAccess } from '../src/services/proAccess';

jest.mock('lucide-react-native', () => {
  const icon = () => null;
  return { Check: icon, Glasses: icon, LibraryBig: icon, Sparkles: icon, SquarePen: icon, X: icon };
});
jest.mock('../src/services/proAccess', () => ({ proAccess: {
  getStatus: jest.fn(), purchase: jest.fn(), restore: jest.fn(), redeem: jest.fn(), showManual: jest.fn(), subscribe: jest.fn(() => () => {}),
} }));
const free = { isPro: false, canPurchase: true, displayPrice: 'CA$4.99', productId: 'com.craftoon.pro.unlock', appVersion: '1.0', developerName: 'Squareplayer' };
let renderer: ReactTestRenderer.ReactTestRenderer;
function Probe() {
  const { status, requirePro } = usePro();
  return <><Text testID="access">{status.isPro ? 'pro' : 'free'}</Text>
    <TouchableOpacity accessibilityLabel="Attempt save" onPress={() => requirePro('save', 'canvas')} />
    <ModeInfoButton mode="canvas" pageCount={3} /></>;
}
const button = (label: string) => renderer.root.findAllByType(TouchableOpacity).find(item => item.props.accessibilityLabel === label)!;
const access = () => renderer.root.findByProps({ testID: 'access' }).props.children;
beforeEach(async () => {
  jest.clearAllMocks();
  (proAccess.getStatus as jest.Mock).mockResolvedValue(free);
  (proAccess.purchase as jest.Mock).mockResolvedValue({ ...free, outcome: 'cancelled' });
  (proAccess.restore as jest.Mock).mockResolvedValue({ ...free, outcome: 'restored' });
  await act(async () => { renderer = ReactTestRenderer.create(<ProProvider><Probe /></ProProvider>); });
});
afterEach(async () => { await act(async () => renderer.unmount()); });

test('redemption only unlocks Pro after a verified entitlement, including later updates', async () => {
  (proAccess.redeem as jest.Mock).mockResolvedValueOnce({ ...free, outcome: 'redeemed' });
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Enter activation code').props.onPress());
  expect(proAccess.redeem).toHaveBeenCalledTimes(1);
  expect(access()).toBe('free');
  const listener = (proAccess.subscribe as jest.Mock).mock.calls[0][0];
  await act(async () => listener({ ...free, isPro: true }));
  expect(access()).toBe('pro');
});

test('redemption errors preserve Free access and show a useful message', async () => {
  (proAccess.redeem as jest.Mock).mockRejectedValueOnce(new Error('Code entry unavailable. Please try again.'));
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Enter activation code').props.onPress());
  expect(access()).toBe('free');
  expect(renderer.root.findAllByType(Text).some(item => item.props.children === 'Code entry unavailable. Please try again.')).toBe(true);
});

test('the PDF guide is available to Free users without starting a purchase', async () => {
  (proAccess.showManual as jest.Mock).mockResolvedValueOnce(undefined);
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Open quick guide PDF').props.onPress());
  expect(proAccess.showManual).toHaveBeenCalledTimes(1);
  expect(proAccess.purchase).not.toHaveBeenCalled();
  expect(access()).toBe('free');
});

test('repeated redemption taps open one sheet and a stale result cannot revoke Pro', async () => {
  let finish!: (value: object) => void;
  (proAccess.redeem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => button('Attempt save').props.onPress());
  const redeem = button('Enter activation code').props.onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = redeem(); await redeem(); });
  expect(proAccess.redeem).toHaveBeenCalledTimes(1);
  const listener = (proAccess.subscribe as jest.Mock).mock.calls[0][0];
  await act(async () => listener({ ...free, isPro: true }));
  await act(async () => { finish({ ...free, outcome: 'redeemed' }); await pending; });
  expect(access()).toBe('pro');
});

test('mode menu keeps essential actions and version without long feature explanations', async () => {
  const anchor = renderer.root.findByType(ModeInfoButton).findAllByType(View)[0].instance;
  anchor.measureInWindow = (callback: (x: number, y: number, width: number, height: number) => void) => callback(20, 30, 38, 38);
  await act(async () => button('About Canvas mode').props.onPress());
  const text = renderer.root.findAllByType(Text).map(item => item.props.children).flat().join(' ');
  expect(text).toContain('Squareplayer');
  expect(text).toContain('Free');
  expect(text).toContain('Version');
  expect(text).toContain('1.0');
  expect(text).toContain('Canvas mode');
  expect(button('Open quick guide PDF')).toBeDefined();
  expect(button('Enter activation code')).toBeDefined();
  expect(button('Restore purchases')).toBeDefined();
  expect(text).not.toContain('3 / 4');
  expect(text).not.toContain('Automatic draft recovery');
  expect(text).not.toContain('More pages for every story');
  expect(text).not.toContain('Create panels, draw and arrange your story.');
  expect(text).toContain('CA$4.99');
});

test('canceling purchase never unlocks Pro', async () => {
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Buy Craftoon Pro').props.onPress());
  expect(access()).toBe('free');
});

test('pending purchase stays Free until a verified entitlement update arrives', async () => {
  (proAccess.purchase as jest.Mock).mockResolvedValueOnce({ ...free, outcome: 'pending' });
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Buy Craftoon Pro').props.onPress());
  expect(access()).toBe('free');
  const listener = (proAccess.subscribe as jest.Mock).mock.calls[0][0];
  await act(async () => listener({ ...free, isPro: true }));
  expect(access()).toBe('pro');
  await act(async () => listener(free));
  expect(access()).toBe('free');
});

test('restore unlocks a prior purchase, and repeated purchase taps submit once', async () => {
  (proAccess.restore as jest.Mock).mockResolvedValueOnce({ ...free, isPro: true, outcome: 'restored' });
  await act(async () => button('Attempt save').props.onPress());
  await act(async () => button('Restore purchases').props.onPress());
  expect(access()).toBe('pro');
  const listener = (proAccess.subscribe as jest.Mock).mock.calls[0][0];
  await act(async () => listener(free));
  let finish!: (value: object) => void;
  (proAccess.purchase as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const buy = button('Buy Craftoon Pro').props.onPress;
  let pending!: Promise<void>;
  await act(async () => { pending = buy(); await buy(); });
  expect(proAccess.purchase).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ ...free, isPro: true, outcome: 'purchased' }); await pending; });
  expect(access()).toBe('pro');
});

test('a delayed purchase result cannot overwrite a newer entitlement update', async () => {
  let finish!: (value: object) => void;
  (proAccess.purchase as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => button('Attempt save').props.onPress());
  let pending!: Promise<void>;
  await act(async () => { pending = button('Buy Craftoon Pro').props.onPress(); });
  const listener = (proAccess.subscribe as jest.Mock).mock.calls[0][0];
  await act(async () => listener({ ...free, isPro: true }));
  await act(async () => { finish({ ...free, outcome: 'pending' }); await pending; });
  expect(access()).toBe('pro');
});
