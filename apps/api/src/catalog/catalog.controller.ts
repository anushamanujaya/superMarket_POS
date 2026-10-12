import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth.types';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import {
  categoryCreate,
  CategoryCreate,
  categoryUpdate,
  CategoryUpdate,
  productCreate,
  ProductCreate,
  productQuery,
  ProductQuery,
  productUpdate,
  ProductUpdate,
} from './catalog.schemas';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('categories')
  @RequirePermissions('catalog.read')
  categories(@CurrentUser() u: AuthUser) {
    return this.svc.listCategories(u);
  }

  @Post('categories')
  @RequirePermissions('catalog.write')
  createCategory(@CurrentUser() u: AuthUser, @Body(new ZodPipe(categoryCreate)) b: CategoryCreate) {
    return this.svc.createCategory(u, b);
  }

  @Patch('categories/:id')
  @RequirePermissions('catalog.write')
  updateCategory(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(categoryUpdate)) b: CategoryUpdate,
  ) {
    return this.svc.updateCategory(u, id, b);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @RequirePermissions('catalog.write')
  deleteCategory(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteCategory(u, id);
  }

  @Get('uoms')
  @RequirePermissions('catalog.read')
  uoms() {
    return this.svc.uoms();
  }

  @Get('tax-classes')
  @RequirePermissions('catalog.read')
  taxClasses(@CurrentUser() u: AuthUser) {
    return this.svc.taxClasses(u);
  }

  @Get('products')
  @RequirePermissions('catalog.read')
  products(@CurrentUser() u: AuthUser, @Query(new ZodPipe(productQuery)) q: ProductQuery) {
    return this.svc.listProducts(u, q);
  }

  @Get('products/by-barcode/:code')
  @RequirePermissions('catalog.read')
  byBarcode(@CurrentUser() u: AuthUser, @Param('code') code: string) {
    return this.svc.byBarcode(u, code);
  }

  @Get('products/:id')
  @RequirePermissions('catalog.read')
  product(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getProduct(u, id);
  }

  @Post('products')
  @RequirePermissions('catalog.write')
  createProduct(@CurrentUser() u: AuthUser, @Body(new ZodPipe(productCreate)) b: ProductCreate) {
    return this.svc.createProduct(u, b);
  }

  @Patch('products/:id')
  @RequirePermissions('catalog.write')
  updateProduct(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(productUpdate)) b: ProductUpdate,
  ) {
    return this.svc.updateProduct(u, id, b);
  }

  @Delete('products/:id')
  @HttpCode(204)
  @RequirePermissions('catalog.write')
  deleteProduct(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteProduct(u, id);
  }
}
