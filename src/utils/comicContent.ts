import { ComicPage } from '../types/comic';

// Native JSON serialization may change object key order; page/panel array
// order remains significant because it defines reading and stacking order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) { return value.map(canonical); }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().filter(key => object[key] !== undefined)
      .map(key => [key, canonical(object[key])]));
  }
  return value;
}

export const sameComicPages = (a: ComicPage[], b: ComicPage[]) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
