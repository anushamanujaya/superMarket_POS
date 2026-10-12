import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CategoryCreate,
  CategoryUpdate,
  ProductCreate,
  ProductQuery,
  ProductUpdate,
} from './catalog.schemas';

const productInclude = {
  variants: { where: { deletedAt: null }, include: { barcodes: true } },
  category: true,
  uom: true,
} satisfies Prisma.ProductInclude;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───── categories ─────
  listCategories(u: AuthUser) {
    return this.prisma.category.findMany({
      where: { orgId: u.orgId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }

  async createCategory(u: AuthUser, d: CategoryCreate) {
    const c = await this.prisma.category.create({
      data: { orgId: u.orgId, name: d.name, parentId: d.parentId ?? null, sortOrder: d.sortOrder },
    });
    await this.audit.log({
      orgId: u.orgId,
      userId: u.id,
      action: 'category.create',
      entity: 'Category',
      entityId: c.id,
      after: c,
    });
    return c;
  }

  async updateCategory(u: AuthUser, id: string, d: CategoryUpdate) {
    const before = await this.mustCategory(u, id);
    const c = await this.prisma.category.update({ where: { id }, data: d });
    await this.audit.log({
      orgId: u.orgId,
      userId: u.id,
      action: 'category.update',
      entity: 'Category',
      entityId: id,
      before,
      after: c,
    });
    return c;
  }

  async deleteCategory(u: AuthUser, id: string) {
    const before = await this.mustCategory(u, id);
    const inUse = await this.prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse) throw new ConflictException('Category has products');
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      orgId: u.orgId,
      userId: u.id,
      action: 'category.delete',
      entity: 'Category',
      entityId: id,
      before,
    });
  }

  // ───── lookups ─────
  uoms() {
    return this.prisma.unitOfMeasure.findMany({ orderBy: { code: 'asc' } });
  }
  taxClasses(u: AuthUser) {
    return this.prisma.taxClass.findMany({ where: { orgId: u.orgId }, orderBy: { name: 'asc' } });
  }

  // ───── products ─────
  async listProducts(u: AuthUser, q: ProductQuery) {
    const where: Prisma.ProductWhereInput = {
      orgId: u.orgId,
      deletedAt: null,
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.q && {
        OR: [
          { sku: { contains: q.q, mode: 'insensitive' } },
          { name: { path: ['en'], string_contains: q.q } },
          { variants: { some: { barcodes: { some: { code: q.q } } } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async getProduct(u: AuthUser, id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, orgId: u.orgId, deletedAt: null },
      include: productInclude,
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  /** Scanner lookup: exact barcode match → product + variant. */
  async byBarcode(u: AuthUser, code: string) {
    const b = await this.prisma.barcode.findUnique({
      where: { orgId_code: { orgId: u.orgId, code } },
      include: { variant: { include: { product: { include: { uom: true } } } } },
    });
    if (!b || b.variant.deletedAt || b.variant.product.deletedAt) {
      throw new NotFoundException('Barcode not found');
    }
    return b;
  }

  async createProduct(u: AuthUser, d: ProductCreate) {
    await this.assertRefs(u, d.categoryId, d.taxClassId);
    try {
      const p = await this.prisma.product.create({
        data: {
          orgId: u.orgId,
          sku: d.sku,
          name: d.name,
          categoryId: d.categoryId,
          brandId: d.brandId ?? null,
          uomId: d.uomId,
          taxClassId: d.taxClassId,
          type: d.type,
          trackBatches: d.trackBatches,
          trackExpiry: d.trackExpiry,
          trackSerial: d.trackSerial,
          variants: {
            create: {
              sku: d.sku,
              priceMinor: d.priceMinor,
              costMinor: d.costMinor,
              isDefault: true,
              barcodes: { create: d.barcodes.map((b) => ({ ...b, orgId: u.orgId })) },
            },
          },
        },
        include: productInclude,
      });
      await this.audit.log({
        orgId: u.orgId,
        userId: u.id,
        action: 'product.create',
        entity: 'Product',
        entityId: p.id,
        after: p,
      });
      return p;
    } catch (e) {
      throw this.mapUnique(e);
    }
  }

  async updateProduct(u: AuthUser, id: string, d: ProductUpdate) {
    const before = await this.getProduct(u, id);
    if (d.categoryId || d.taxClassId) {
      await this.assertRefs(
        u,
        d.categoryId ?? before.categoryId,
        d.taxClassId ?? before.taxClassId,
      );
    }
    const { priceMinor, costMinor, ...productFields } = d;
    const variant = before.variants.find((v) => v.isDefault) ?? before.variants[0];
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: productFields });
        if (variant && (priceMinor !== undefined || costMinor !== undefined)) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: { priceMinor, costMinor },
          });
          if (priceMinor !== undefined && priceMinor !== variant.priceMinor) {
            await tx.priceHistory.create({
              data: {
                variantId: variant.id,
                oldMinor: variant.priceMinor,
                newMinor: priceMinor,
                changedBy: u.id,
              },
            });
          }
        }
      });
    } catch (e) {
      throw this.mapUnique(e);
    }
    const after = await this.getProduct(u, id);
    const action =
      priceMinor !== undefined && variant && priceMinor !== variant.priceMinor
        ? 'product.price_change'
        : 'product.update';
    await this.audit.log({
      orgId: u.orgId,
      userId: u.id,
      action,
      entity: 'Product',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  async deleteProduct(u: AuthUser, id: string) {
    const before = await this.getProduct(u, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      orgId: u.orgId,
      userId: u.id,
      action: 'product.delete',
      entity: 'Product',
      entityId: id,
      before,
    });
  }

  // ───── helpers ─────
  private async mustCategory(u: AuthUser, id: string) {
    const c = await this.prisma.category.findFirst({
      where: { id, orgId: u.orgId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  private async assertRefs(u: AuthUser, categoryId: string, taxClassId: string) {
    await this.mustCategory(u, categoryId);
    const tc = await this.prisma.taxClass.findFirst({ where: { id: taxClassId, orgId: u.orgId } });
    if (!tc) throw new NotFoundException('Tax class not found');
  }

  private mapUnique(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('SKU or barcode already exists');
    }
    return e;
  }
}
