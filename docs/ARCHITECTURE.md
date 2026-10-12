# Architecture & Design

## 0. Assumptions (change any of these and I'll adapt)

1. **LLM provider: Claude** (Anthropic) behind an `AiProvider` interface; OpenAI adapter can be added without touching tools.
2. **Remote:** `origin` = github.com/anushamanujaya/superMarket_POS. I commit locally per task and push per commit.
3. **Monorepo with pnpm workspaces** (+ Turborepo later). Python service lives in `apps/forecasting` with its own venv.
4. **Multi-tenancy:** one `Organization`, many `Branch`es. Every operational row carries `branchId`.
5. **Money:** `BigInt`/`Int` minor units (cents) + ISO currency code. Quantities are `Decimal(14,3)` (kg, litres, pcs).
6. **IDs:** `uuid` (v7 where possible) so offline terminals can mint IDs safely.
7. **Tax:** rules are rows (`TaxRate`, `TaxRule`), not constants. Invoice numbers come from a per-branch counter row locked in-transaction (gapless, immutable).
8. **LankaQR / SMS / WhatsApp:** built behind provider interfaces with sandbox/mock adapters; real gateway credentials are out of scope until you choose providers.
9. **Hardware (Tauri/ESC-POS/scales):** hardware abstraction layer is written and tested against simulators; real-device validation needs your devices (Phase 9).
10. **Scope reality:** this is a multi-month program. I will build it phase by phase; each phase merges to `main` only when it builds, lints, type-checks and tests pass.
11. **Phase 1 stack deviation:** none. Prisma 6, NestJS 11, Next.js 15.

## 1. Database schema (PostgreSQL / Prisma)

Conventions: `id uuid pk`, `createdAt`, `updatedAt`, `deletedAt?` (soft delete on master data only), `branchId` on operational tables, money `*Minor Int/BigInt`.

### Identity & access
| Table | Key fields / relations |
|---|---|
| Organization | name, baseCurrency, defaultLocale |
| Branch | orgId, code, name, address, timezone, currency, invoicePrefix |
| User | orgId, email?, phone?, passwordHash (argon2), pinHash?, locale, isActive, lastLoginAt |
| Role | orgId, name, isSystem |
| Permission | key (e.g. `sales.void`, `price.override`) |
| RolePermission | roleId, permissionId |
| UserRole | userId, roleId, branchId? (null = all branches) |
| RefreshToken | userId, tokenHash, deviceId, expiresAt, revokedAt |
| AuditLog | orgId, branchId?, userId?, actor (USER/AI/SYSTEM), action, entity, entityId, before/after JSON, ip, createdAt (append-only) |
| Attendance | userId, branchId, clockIn, clockOut |
| Setting | orgId, branchId?, key, value JSON |

### Catalog
| Table | Key fields |
|---|---|
| Category | orgId, parentId?, name (i18n JSON), sortOrder |
| Brand | orgId, name |
| UnitOfMeasure | code (pcs, kg, g, l, ml), baseUnit, factor, allowFraction |
| Product | orgId, sku, name (i18n JSON), categoryId, brandId?, uomId, type (STANDARD/WEIGHTED/BUNDLE/SERVICE), taxClassId, trackBatches, trackExpiry, trackSerial, isActive, imageUrl |
| ProductVariant | productId, sku, attributes JSON, costMinor, priceMinor |
| Barcode | variantId, code (unique per org), kind (EAN13/PLU/PRICE_EMBEDDED/INTERNAL), packQty |
| BundleItem | bundleProductId, componentVariantId, qty |
| BranchPrice | variantId, branchId, priceMinor, effectiveFrom/To |
| PriceHistory | variantId, branchId, oldMinor, newMinor, changedBy |
| TaxClass | orgId, name |
| TaxRate | orgId, name, code, ratePpm (parts per million), isCompound, inclusiveDefault, validFrom/To |
| TaxRule | taxClassId, taxRateId, branchId? |

### Inventory
| Table | Key fields |
|---|---|
| StockLevel | branchId, variantId, onHand, reserved (unique branch+variant) |
| StockBatch | branchId, variantId, batchNo, expiryDate, qtyRemaining, costMinor, grnLineId? |
| SerialNumber | variantId, serial, status, batchId? |
| StockMovement | branchId, variantId, batchId?, type (SALE/RETURN/GRN/ADJUST/TRANSFER_OUT/IN/WASTE/COUNT), qty (signed), refType, refId, reasonCode, userId, clientId (offline idempotency) |
| ReasonCode | kind (VOID/RETURN/ADJUST/WASTE/DISCOUNT), code, label i18n, requiresApproval |
| WastageRecord | branchId, variantId, batchId, qty, reasonCode, costMinor |
| Supplier | orgId, name, contact, paymentTerms, leadTimeDays |
| SupplierProduct | supplierId, variantId, supplierSku, lastCostMinor, moq |
| PurchaseOrder / PurchaseOrderLine | branchId, supplierId, status (DRAFT/APPROVED/SENT/PARTIAL/RECEIVED/CANCELLED), expectedAt, createdByAi |
| GoodsReceipt / GoodsReceiptLine | poId?, branchId, supplierId, batchNo, expiry, qty, costMinor |
| SupplierReturn / Line | supplierId, grnId, reason |
| StockTransfer / Line | fromBranchId, toBranchId, status (DRAFT/IN_TRANSIT/RECEIVED), createdByAi |
| StockTake / StockTakeLine | branchId, status, expectedQty, countedQty, variance |
| ReorderPolicy | branchId, variantId, reorderLevel, reorderQty, safetyStock, reviewPeriodDays |

### Sales
| Table | Key fields |
|---|---|
| Terminal | branchId, name, deviceKey, lastSeenAt |
| Shift | terminalId, userId, openedAt, closedAt, openingFloatMinor, expectedCashMinor, countedCashMinor, varianceMinor |
| CashMovement | shiftId, type (IN/OUT/DRAWER_OPEN), amountMinor, reason |
| Sale | branchId, terminalId, shiftId, cashierId, customerId?, status (OPEN/HELD/COMPLETED/VOIDED), invoiceNo (unique per branch, null until complete), clientId (unique, offline), subtotal/discount/tax/total Minor, taxInclusive, completedAt |
| SaleLine | saleId, variantId, batchId?, qty, unitPriceMinor, discountMinor, taxMinor, taxRatePpm snapshot, weightGrams?, priceOverriddenBy? |
| SaleDiscount | saleId, lineId?, source (MANUAL/PROMO/COUPON/LOYALTY), promotionId?, amountMinor, approvedBy? |
| Payment | saleId, method (CASH/CARD/LANKAQR/BANK/STORE_CREDIT/GIFT_CARD), amountMinor, tenderedMinor, changeMinor, reference, status |
| Refund / RefundLine | saleId, reasonCode, approvedBy, amountMinor, restock |
| InvoiceSequence | branchId, year, lastNo (row-locked) |
| Receipt | saleId, kind, deliveredVia, deliveredAt |
| GiftCard | code, balanceMinor, expiresAt |

### Customers & promotions
| Table | Key fields |
|---|---|
| Customer | orgId, phone (unique), name, email, tierId, creditLimitMinor, balanceMinor |
| LoyaltyTier | name, minPoints, earnMultiplier |
| LoyaltyAccount / LoyaltyTxn | customerId, points, type (EARN/REDEEM/ADJUST/EXPIRE), saleId |
| LoyaltyRule | earnPerMinor, redeemValueMinor, minRedeem |
| CreditLedger | customerId, saleId?, deltaMinor, balanceAfter |
| Promotion | type (PCT/FIXED/BXGY/HAPPY_HOUR/COUPON/MARKDOWN), config JSON, startsAt, endsAt, branchScope, status (DRAFT/ACTIVE), createdByAi |
| Coupon | promotionId, code, maxUses, usedCount |

### Sync / AI / forecasting
| Table | Key fields |
|---|---|
| SyncChange | branchId, entity, entityId, op, version, payload, serverSeq (monotonic pull cursor) |
| ClientMutation | clientId (unique), terminalId, type, appliedAt, result (idempotency) |
| ForecastRun | modelVersion, trainedAt, scope |
| Forecast | branchId, variantId, date, p10, p50, p90, modelVersion |
| ForecastAccuracy | branchId, variantId, mape, wape, window, computedAt |
| CalendarEvent | date, kind (HOLIDAY/POYA/FESTIVAL/SCHOOL_TERM/PAYDAY), name, tags |
| ChatSession / ChatMessage | userId, branchId, channel (WEB/MOBILE/WHATSAPP), role, content, toolCalls JSON |
| AiActionDraft | sessionId, type (PO/TRANSFER/MARKDOWN/PROMO), payload JSON, preview JSON, status (PENDING/APPROVED/REJECTED/EXPIRED), approvedBy |
| Alert / Notification | kind, severity, branchId, payload, readAt |
| AnomalyEvent | kind, score, entityRef, details |

Key indexes: `Sale(branchId, completedAt)`, `SaleLine(variantId)`, `StockBatch(branchId, variantId, expiryDate)` (FEFO), `Barcode(orgId, code)` unique, `StockMovement(branchId, variantId, createdAt)`, `SyncChange(branchId, serverSeq)`, `Forecast(branchId, variantId, date)`.

## 2. Monorepo layout

```
superMarket_POS/
├─ apps/
│  ├─ api/            NestJS: modules auth, rbac, catalog, sales, inventory, customers,
│  │                  promotions, staff, reports, sync, ai-chatbot, forecasting-client, hardware-events
│  │  └─ prisma/      schema.prisma, migrations/, seed/
│  ├─ web/            Next.js App Router PWA: /pos (till) and /admin (backoffice + chat)
│  ├─ desktop/        Tauri wrapper + native hardware commands
│  ├─ mobile/         Expo: stock-take, manager dashboard, chat, push
│  └─ forecasting/    FastAPI + Prophet/LightGBM, backtest, nightly retrain
├─ packages/
│  ├─ shared/         zod schemas, DTO types, money/tax/pricing pure functions
│  ├─ i18n/           en / si / ta message catalogs
│  ├─ hardware/       HAL interfaces + ESC/POS encoder + simulators
│  ├─ sync/           Dexie schema, outbox, sync client
│  └─ ai-tools/       tool definitions (zod in/out) shared by API and tests
├─ infra/             docker-compose.yml, Dockerfiles, nginx
├─ docs/              ARCHITECTURE.md, SYNC.md, API notes
├─ .github/workflows/ ci.yml
└─ .husky/, commitlint.config.cjs, CHANGELOG.md, .env.example
```

```
 [Web PWA / Tauri till] ──REST/WS──▶ [NestJS API] ──▶ PostgreSQL
   │  Dexie outbox ◀─sync─▶              │  ├─▶ Redis (cache, BullMQ)
 [Expo mobile] ───────────────────────────┤  ├─▶ [FastAPI forecasting]
                                          │  └─▶ AiProvider (Claude) ─ typed tools only
```

## 3. Chatbot tools (typed, zod-validated, read-only unless noted)

Every tool: `(ctx: {userId, role, branchIds}, input) → output`, permission-checked, audit-logged.

| Tool | Input | Output |
|---|---|---|
| getSalesByProduct | branchId?, from, to, productId?/categoryId?, groupBy(day/week/month), limit | rows[{key, qty, revenueMinor, marginMinor}] |
| getTopProducts | branchId?, from, to, metric(qty/revenue/margin), limit | rows[] |
| getSalesTrend | branchId?, from, to, granularity | series[{date, revenueMinor, txCount}] |
| compareSeasons | branchId?, eventName or rangeA, rangeB | {a, b, deltaPct, byCategory[]} |
| explainSalesChange | productId, periodA, periodB | {drivers[{factor, impact}], priceChanges, promos, stockoutDays} |
| getStockLevels | branchId?, productId?/categoryId?, belowReorderOnly? | rows[{variantId, onHand, reorderLevel, daysOfCover}] |
| getStockOutRisk | branchId?, horizonDays | rows[{variantId, projectedStockoutDate, p10p90, daysLeft}] |
| getExpiringBatches | branchId?, withinDays(3/7/14) | rows[{batchId, qty, expiry, costMinor, suggestedMarkdownPct}] |
| getDeadStock | branchId?, noSaleDays | rows[{variantId, onHand, valueMinor, lastSoldAt, suggestedAction}] |
| getOverstock | branchId?, coverDaysGt | rows[] |
| getWastage | branchId?, from, to, groupBy(reason/product/category) | rows[] |
| getForecast | branchId, productId, horizonDays | {points[{date,p10,p50,p90}], mape, modelVersion, features[]} |
| getSupplierLeadTimes | supplierId?, productId? | rows[{supplierId, avgLeadDays, reliabilityPct, priceTrend}] |
| suggestReorder | branchId, supplierId? | lines[{variantId, qty, formulaBreakdown}] using forecast over (lead+review)+safety−stock−incoming |
| suggestTransfers | orgId | rows[{from, to, variantId, qty}] |
| getShrinkage | branchId, period | rows[{variantId, expected, counted, flag}] |
| getSeasonalPlan | eventName | rows[{variantId, uplift, suggestedQty}] |
| getAnomalies | branchId?, from, to | rows[{kind, score, details}] |
| runReport (NL reports) | reportId enum + typed params | table + chart spec |
| **draftPurchaseOrder** (write) | supplierId, branchId, lines[] | AiActionDraft + preview (needs approval) |
| **draftStockTransfer** (write) | from, to, lines[] | AiActionDraft + preview |
| **draftMarkdown** (write) | batchIds[], pct | AiActionDraft + preview |
| **draftPromotion** (write) | promotion config | AiActionDraft + preview |

Write tools only create `AiActionDraft`; a separate `POST /ai/drafts/:id/approve` endpoint (human, permission-checked) executes.

## 4. Phase 1 scope (this branch: `phase-1-setup`)

1. Monorepo, TypeScript, ESLint, Prettier, Husky, lint-staged, commitlint, CI
2. docker-compose: Postgres, Redis
3. Prisma schema (identity + catalog + tax), initial migration, seed (roles/permissions, demo org/branch, sample SL products)
4. Auth: argon2 login, JWT access/refresh rotation, cashier PIN login, rate limiting, RBAC guard, audit log
5. Product & category CRUD, barcodes, Swagger
6. Next.js admin shell with login and product management (i18n en/si/ta scaffold)
