---
name: Project overview
description: Stack, modules, and conventions for com_brasper_backofice
type: project
---

Vue 3 + Vite + TypeScript + Pinia + Tailwind 4 backoffice for Brasper currency exchange (PE/BR).

**Why:** Admin panel for managing bank accounts, transactions, rates, commissions, coupons, users.

**How to apply:** All components use `<script setup lang="ts">` (Composition API). Modules follow DDD layering: domain/models → application/use_cases → infrastructure/adapters → presentation/(bodies|controllers|components).

Modules: auth, calculator, comisiones, contabilidad, cuentas-bancarias, cupones, dashboard, home-banner, tasas, transacciones.
Empty stubs (future): accounts/, transactions/, user/.

Shared infra: `@/interface/api/client.ts` (axios), `@/interface/infrastructure/services` (Domain URLs), `@/interface/infrastructure/logger` (createLoggerWithContext).
