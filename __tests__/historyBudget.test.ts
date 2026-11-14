import { boundHistory } from '../src/utils/historyBudget';
const entry = (drawingData: string, uri?: string) => ({ pages: [{ id: 'page', bubbles: [], panels: [{
  id: 'panel', x: 0, y: 0, width: 100, height: 100, drawingData,
  ...(uri ? { tracingImage: { uri, x: 0, y: 0, width: 100, height: 100, opacity: 0.35, rotation: 0 } } : {}),
}] }] });
test('unique old drawing payloads are dropped within the byte budget', () => {
  const entries = ['a', 'b', 'c', 'd'].map(value => entry(value.repeat(100)));
  expect(boundHistory(entries, 100, 450)).toEqual(entries.slice(-2));
});
test('shared photo and ink strings count once across history', () => {
  const entries = Array.from({ length: 50 }, () => entry('same-ink', 'image'.repeat(100)));
  expect(boundHistory(entries, 100, 1100)).toHaveLength(50);
});
test('current state and one undo survive even an oversized single document', () => {
  const entries = ['a', 'b', 'c'].map(value => entry(value.repeat(100)));
  expect(boundHistory(entries, 100, 10)).toEqual(entries.slice(-2));
});
test('small native handles retain up to 100 states without retaining stroke payloads', () => {
  const entries = Array.from({ length: 150 }, (_, i) => entry(`craftoon-ink:${i}`));
  expect(boundHistory(entries)).toEqual(entries.slice(-100));
});
