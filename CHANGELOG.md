# Changelog

## v0.1.0 - Phase 1: setup, auth, catalog

- feat(web): add admin shell with login, i18n (en/si/ta), dark mode and product management (28717fd)
- fix(api): use swc for dev server so nest dependency injection metadata is emitted (6aa1f37)
- feat(catalog): add category and product crud with barcodes, price history and audit (dfebfd8)
- feat(auth): add password and pin login, rotating refresh tokens and permission guards (71c5c81)
- feat(api): scaffold nestjs app with config, prisma, audit and rbac primitives (fb07aa0)
- feat(db): add prisma schema for identity, rbac, audit, catalog and tax (df347e0)
