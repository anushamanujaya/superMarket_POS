import { describe, expect, it } from 'vitest';
import { productCreate } from './catalog.schemas';

const base = {
  sku: 'A',
  name: { en: 'A' },
  categoryId: crypto.randomUUID(),
  uomId: crypto.randomUUID(),
  taxClassId: crypto.randomUUID(),
  priceMinor: 100,
};

describe('productCreate schema', () => {
  it('accepts integer minor-unit prices', () => {
    expect(productCreate.safeParse(base).success).toBe(true);
  });
  it('rejects float prices', () => {
    expect(productCreate.safeParse({ ...base, priceMinor: 10.5 }).success).toBe(false);
  });
  it('rejects negative prices', () => {
    expect(productCreate.safeParse({ ...base, priceMinor: -1 }).success).toBe(false);
  });
});
