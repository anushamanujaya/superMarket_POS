import { z } from 'zod';

export const i18nName = z.object({
  en: z.string().min(1),
  si: z.string().optional(),
  ta: z.string().optional(),
});

export const categoryCreate = z.object({
  name: i18nName,
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
export const categoryUpdate = categoryCreate.partial();

const barcodeInput = z.object({
  code: z.string().min(1).max(64),
  kind: z.enum(['EAN13', 'PLU', 'PRICE_EMBEDDED', 'INTERNAL']).default('EAN13'),
});

export const productCreate = z.object({
  sku: z.string().min(1).max(64),
  name: i18nName,
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  uomId: z.string().uuid(),
  taxClassId: z.string().uuid(),
  type: z.enum(['STANDARD', 'WEIGHTED', 'BUNDLE', 'SERVICE']).default('STANDARD'),
  trackBatches: z.boolean().default(false),
  trackExpiry: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  /** Integer minor units (LKR cents). Never floats. */
  priceMinor: z.number().int().nonnegative(),
  costMinor: z.number().int().nonnegative().default(0),
  barcodes: z.array(barcodeInput).default([]),
});

export const productUpdate = productCreate
  .omit({ barcodes: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const productQuery = z.object({
  q: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CategoryCreate = z.infer<typeof categoryCreate>;
export type CategoryUpdate = z.infer<typeof categoryUpdate>;
export type ProductCreate = z.infer<typeof productCreate>;
export type ProductUpdate = z.infer<typeof productUpdate>;
export type ProductQuery = z.infer<typeof productQuery>;
