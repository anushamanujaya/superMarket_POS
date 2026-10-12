import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from '../src/common/permissions';

const prisma = new PrismaClient();

const UOMS = [
  { code: 'pcs', name: 'Piece', allowFraction: false },
  { code: 'kg', name: 'Kilogram', allowFraction: true },
  { code: 'g', name: 'Gram', allowFraction: true },
  { code: 'l', name: 'Litre', allowFraction: true },
  { code: 'ml', name: 'Millilitre', allowFraction: true },
];

const CATEGORIES: Record<string, { en: string; si: string; ta: string }> = {
  rice: { en: 'Rice & Grains', si: 'සහල් සහ ධාන්‍ය', ta: 'அரிசி மற்றும் தானியங்கள்' },
  dairy: { en: 'Dairy', si: 'කිරි නිෂ්පාදන', ta: 'பால் பொருட்கள்' },
  produce: { en: 'Fresh Produce', si: 'නැවුම් එළවළු සහ පළතුරු', ta: 'புதிய காய்கறிகள்' },
  bakery: { en: 'Bakery', si: 'බේකරි', ta: 'பேக்கரி' },
  household: { en: 'Household', si: 'ගෘහ භාණ්ඩ', ta: 'வீட்டுப் பொருட்கள்' },
  beverages: { en: 'Beverages', si: 'පාන', ta: 'பானங்கள்' },
};

// price in LKR cents (Rs 100.00 = 10000)
const PRODUCTS = [
  {
    sku: 'RICE-NAD-5',
    en: 'Nadu Rice 5kg',
    cat: 'rice',
    uom: 'pcs',
    price: 125000,
    cost: 108000,
    bc: '4791000000011',
    exp: false,
  },
  {
    sku: 'RICE-SAM-5',
    en: 'Samba Rice 5kg',
    cat: 'rice',
    uom: 'pcs',
    price: 142000,
    cost: 124000,
    bc: '4791000000028',
    exp: false,
  },
  {
    sku: 'SUGAR-1',
    en: 'White Sugar 1kg',
    cat: 'rice',
    uom: 'pcs',
    price: 28000,
    cost: 24500,
    bc: '4791000000035',
    exp: false,
  },
  {
    sku: 'DHAL-1',
    en: 'Red Dhal 1kg',
    cat: 'rice',
    uom: 'pcs',
    price: 39000,
    cost: 33000,
    bc: '4791000000042',
    exp: false,
  },
  {
    sku: 'MILK-400',
    en: 'Milk Powder 400g',
    cat: 'dairy',
    uom: 'pcs',
    price: 105000,
    cost: 92000,
    bc: '4791000000059',
    exp: true,
  },
  {
    sku: 'MILK-1L',
    en: 'Fresh Milk 1L',
    cat: 'dairy',
    uom: 'pcs',
    price: 38000,
    cost: 31000,
    bc: '4791000000066',
    exp: true,
  },
  {
    sku: 'YOG-80',
    en: 'Curd Pot 80g',
    cat: 'dairy',
    uom: 'pcs',
    price: 9000,
    cost: 6500,
    bc: '4791000000073',
    exp: true,
  },
  {
    sku: 'BUTTER-100',
    en: 'Butter 100g',
    cat: 'dairy',
    uom: 'pcs',
    price: 62000,
    cost: 54000,
    bc: '4791000000080',
    exp: true,
  },
  {
    sku: 'BREAD-LOAF',
    en: 'Sandwich Bread',
    cat: 'bakery',
    uom: 'pcs',
    price: 18000,
    cost: 14000,
    bc: '4791000000097',
    exp: true,
  },
  {
    sku: 'BUN-FISH',
    en: 'Fish Bun',
    cat: 'bakery',
    uom: 'pcs',
    price: 8000,
    cost: 5500,
    bc: '4791000000103',
    exp: true,
  },
  {
    sku: 'TOM-KG',
    en: 'Tomato (per kg)',
    cat: 'produce',
    uom: 'kg',
    price: 32000,
    cost: 22000,
    bc: '2000001',
    exp: true,
    type: 'WEIGHTED',
  },
  {
    sku: 'CARR-KG',
    en: 'Carrot (per kg)',
    cat: 'produce',
    uom: 'kg',
    price: 48000,
    cost: 36000,
    bc: '2000002',
    exp: true,
    type: 'WEIGHTED',
  },
  {
    sku: 'BAN-KG',
    en: 'Banana Ambul (per kg)',
    cat: 'produce',
    uom: 'kg',
    price: 42000,
    cost: 30000,
    bc: '2000003',
    exp: true,
    type: 'WEIGHTED',
  },
  {
    sku: 'COCO',
    en: 'Coconut',
    cat: 'produce',
    uom: 'pcs',
    price: 11000,
    cost: 8000,
    bc: '4791000000110',
    exp: false,
  },
  {
    sku: 'SOAP-LUX',
    en: 'Lux Soap 100g',
    cat: 'household',
    uom: 'pcs',
    price: 19000,
    cost: 15500,
    bc: '4791000000127',
    exp: false,
  },
  {
    sku: 'DET-SUR-1',
    en: 'Surf Excel 1kg',
    cat: 'household',
    uom: 'pcs',
    price: 78000,
    cost: 66000,
    bc: '4791000000134',
    exp: false,
  },
  {
    sku: 'TEA-250',
    en: 'Ceylon Tea 250g',
    cat: 'beverages',
    uom: 'pcs',
    price: 54000,
    cost: 45000,
    bc: '4791000000141',
    exp: false,
  },
  {
    sku: 'WATER-1L',
    en: 'Drinking Water 1L',
    cat: 'beverages',
    uom: 'pcs',
    price: 10000,
    cost: 7000,
    bc: '4791000000158',
    exp: false,
  },
  {
    sku: 'COLA-1L',
    en: 'Cola 1L',
    cat: 'beverages',
    uom: 'pcs',
    price: 29000,
    cost: 23000,
    bc: '4791000000165',
    exp: false,
  },
];

async function main() {
  const devPassword = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!';

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { label: PERMISSIONS[key] },
      create: { key, label: PERMISSIONS[key] },
    });
  }
  for (const u of UOMS) {
    await prisma.unitOfMeasure.upsert({ where: { code: u.code }, update: u, create: u });
  }

  let org = await prisma.organization.findFirst({ where: { name: 'Demo Supermarket' } });
  org ??= await prisma.organization.create({ data: { name: 'Demo Supermarket' } });

  const branch = await prisma.branch.upsert({
    where: { orgId_code: { orgId: org.id, code: 'NEG' } },
    update: {},
    create: {
      orgId: org.id,
      code: 'NEG',
      name: 'Negombo',
      invoicePrefix: 'NEG',
      address: 'Negombo, Sri Lanka',
    },
  });

  // Roles
  const roleIds: Record<string, string> = {};
  for (const [name, perms] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name, isSystem: true },
    });
    roleIds[name] = role.id;
    const permRows = await prisma.permission.findMany({ where: { key: { in: perms } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permRows.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  // Users
  async function ensureUser(
    email: string | null,
    name: string,
    role: string,
    opts: { password?: string; pin?: string; staffCode?: string; branch?: boolean },
  ) {
    const where = email
      ? { orgId_email: { orgId: org!.id, email } }
      : { orgId_staffCode: { orgId: org!.id, staffCode: opts.staffCode! } };
    const user = await prisma.user.upsert({
      where,
      update: {},
      create: {
        orgId: org!.id,
        name,
        email,
        staffCode: opts.staffCode,
        passwordHash: opts.password ? await argon2.hash(opts.password) : null,
        pinHash: opts.pin ? await argon2.hash(opts.pin) : null,
      },
    });
    const branchId = opts.branch ? branch.id : null;
    const exists = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: roleIds[role], branchId },
    });
    if (!exists)
      await prisma.userRole.create({ data: { userId: user.id, roleId: roleIds[role], branchId } });
  }
  await ensureUser('owner@demo.lk', 'Demo Owner', 'Owner', { password: devPassword });
  await ensureUser('manager@demo.lk', 'Demo Manager', 'Manager', {
    password: devPassword,
    branch: true,
  });
  await ensureUser('cashier1@demo.lk', 'Nimal (Cashier)', 'Cashier', {
    password: devPassword,
    pin: '1234',
    staffCode: 'C001',
    branch: true,
  });

  // Tax: rates are data, not code. Rate below is a demo default; edit via settings.
  let vat = await prisma.taxRate.findFirst({ where: { orgId: org.id, code: 'VAT' } });
  vat ??= await prisma.taxRate.create({
    data: { orgId: org.id, code: 'VAT', name: 'VAT', ratePpm: 180_000 },
  });
  const taxClass = await prisma.taxClass.upsert({
    where: { orgId_name: { orgId: org.id, name: 'Standard' } },
    update: {},
    create: { orgId: org.id, name: 'Standard' },
  });
  await prisma.taxRule.upsert({
    where: { taxClassId_taxRateId: { taxClassId: taxClass.id, taxRateId: vat.id } },
    update: {},
    create: { taxClassId: taxClass.id, taxRateId: vat.id },
  });

  // Categories
  const catIds: Record<string, string> = {};
  for (const [k, name] of Object.entries(CATEGORIES)) {
    const found = await prisma.category.findFirst({
      where: { orgId: org.id, name: { path: ['en'], equals: name.en } },
    });
    catIds[k] = (found ?? (await prisma.category.create({ data: { orgId: org.id, name } }))).id;
  }

  // Products
  const uoms = Object.fromEntries(
    (await prisma.unitOfMeasure.findMany()).map((u) => [u.code, u.id]),
  );
  for (const p of PRODUCTS) {
    if (await prisma.product.findUnique({ where: { orgId_sku: { orgId: org.id, sku: p.sku } } }))
      continue;
    await prisma.product.create({
      data: {
        orgId: org.id,
        sku: p.sku,
        name: { en: p.en },
        categoryId: catIds[p.cat],
        uomId: uoms[p.uom],
        taxClassId: taxClass.id,
        type: (p.type as 'WEIGHTED' | undefined) ?? 'STANDARD',
        trackBatches: p.exp,
        trackExpiry: p.exp,
        variants: {
          create: {
            sku: p.sku,
            priceMinor: p.price,
            costMinor: p.cost,
            barcodes: { create: { orgId: org.id, code: p.bc, kind: p.type ? 'PLU' : 'EAN13' } },
          },
        },
      },
    });
  }
  console.log(`Seeded org ${org.name}: ${PRODUCTS.length} products, branch ${branch.code}`);
}

main().finally(() => prisma.$disconnect());
