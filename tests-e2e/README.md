# Playwright E2E

Tests de extremo a extremo del helpdesk.

## Requisitos

- Postgres corriendo (`docker compose up -d`)
- DB seedeada (`npm run db:seed`)

## Correr

```bash
# Modo headless (CI)
npm run test:e2e

# Modo UI interactivo
npm run test:e2e:ui

# Un solo archivo
npx playwright test tests-e2e/auth.spec.ts

# Modo headed (ver browser)
npx playwright test --headed
```

Playwright arranca `next dev` automáticamente. Si ya lo tenés corriendo, lo reutiliza.

## Cuentas usadas

- `admin@helpdesk.local` / `admin123` — la mayoría de tests
- `juan@acme.com` / `client123` — tests de aislamiento (próximos)

## Estructura

- `helpers.ts` — login/logout reusables
- `auth.spec.ts` — login/logout/forgot-password
- `navigation.spec.ts` — sidebar, Cmd+K, atajos
- `tickets.spec.ts` — listar, filtrar, comentar
- `kb.spec.ts` — listar, buscar, crear artículo
- `api.spec.ts` — endpoints públicos sin sesión
