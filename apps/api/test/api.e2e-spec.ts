import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

const PASSWORD = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!';
let app: INestApplication;
const prisma = new PrismaClient();
const http = () => request(app.getHttpServer());

async function login(email: string) {
  const r = await http().post('/auth/login').send({ email, password: PASSWORD }).expect(200);
  return r.body as { accessToken: string; refreshToken: string };
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('auth', () => {
  it('rejects bad credentials with 401', async () => {
    await http().post('/auth/login').send({ email: 'owner@demo.lk', password: 'nope' }).expect(401);
  });

  it('rejects unauthenticated access', async () => {
    await http().get('/products').expect(401);
  });

  it('logs in and returns the permission set', async () => {
    const { accessToken } = await login('owner@demo.lk');
    const me = await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.permissions).toContain('catalog.write');
    expect(me.body.branchIds).toBe('ALL');
  });

  it('supports cashier PIN login', async () => {
    const r = await http()
      .post('/auth/pin-login')
      .send({ staffCode: 'C001', pin: '1234' })
      .expect(200);
    expect(r.body.accessToken).toBeTruthy();
    await http().post('/auth/pin-login').send({ staffCode: 'C001', pin: '9999' }).expect(401);
  });

  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const first = await login('manager@demo.lk');
    const second = await http()
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    // replaying the old token is theft: it fails and kills the new one too
    await http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    await http().post('/auth/refresh').send({ refreshToken: second.body.refreshToken }).expect(401);
  });

  it('writes login failures to the audit log', async () => {
    await http()
      .post('/auth/login')
      .send({ email: 'manager@demo.lk', password: 'bad' })
      .expect(401);
    const n = await prisma.auditLog.count({ where: { action: 'auth.password_failed' } });
    expect(n).toBeGreaterThan(0);
  });
});

describe('RBAC', () => {
  it('lets a cashier read but not write the catalog', async () => {
    const { accessToken } = await login('cashier1@demo.lk');
    const auth = { Authorization: `Bearer ${accessToken}` };
    await http().get('/products').set(auth).expect(200);
    await http()
      .post('/categories')
      .set(auth)
      .send({ name: { en: 'X' } })
      .expect(403);
  });
});

describe('catalog', () => {
  it('creates, finds by barcode, reprices (with history + audit), and soft-deletes', async () => {
    const { accessToken } = await login('manager@demo.lk');
    const auth = { Authorization: `Bearer ${accessToken}` };
    const sku = `T-${Date.now()}`;
    const code = `99${Date.now()}`;

    const [cats, uoms, taxes] = await Promise.all([
      http().get('/categories').set(auth),
      http().get('/uoms').set(auth),
      http().get('/tax-classes').set(auth),
    ]);

    const created = await http()
      .post('/products')
      .set(auth)
      .send({
        sku,
        name: { en: 'Test Item', si: 'පරීක්ෂණය' },
        categoryId: cats.body[0].id,
        uomId: uoms.body[0].id,
        taxClassId: taxes.body[0].id,
        priceMinor: 10000,
        barcodes: [{ code }],
      })
      .expect(201);
    const id = created.body.id as string;

    await http()
      .post('/products')
      .set(auth)
      .send({
        sku,
        name: { en: 'Dup' },
        categoryId: cats.body[0].id,
        uomId: uoms.body[0].id,
        taxClassId: taxes.body[0].id,
        priceMinor: 1,
      })
      .expect(409);

    const scan = await http().get(`/products/by-barcode/${code}`).set(auth).expect(200);
    expect(scan.body.variant.priceMinor).toBe(10000);

    await http()
      .post('/products')
      .set(auth)
      .send({
        sku: `${sku}-f`,
        name: { en: 'Float' },
        categoryId: cats.body[0].id,
        uomId: uoms.body[0].id,
        taxClassId: taxes.body[0].id,
        priceMinor: 10.5,
      })
      .expect(400);

    await http().patch(`/products/${id}`).set(auth).send({ priceMinor: 12500 }).expect(200);
    const hist = await prisma.priceHistory.findMany({ where: { variant: { productId: id } } });
    expect(hist).toHaveLength(1);
    expect([hist[0].oldMinor, hist[0].newMinor]).toEqual([10000, 12500]);
    expect(
      await prisma.auditLog.count({ where: { entityId: id, action: 'product.price_change' } }),
    ).toBe(1);

    await http().delete(`/products/${id}`).set(auth).expect(204);
    await http().get(`/products/${id}`).set(auth).expect(404);
    await http().get(`/products/by-barcode/${code}`).set(auth).expect(404);
  });

  it('searches products by name', async () => {
    const { accessToken } = await login('owner@demo.lk');
    const r = await http()
      .get('/products?q=Rice')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(r.body.total).toBeGreaterThanOrEqual(2);
  });
});
