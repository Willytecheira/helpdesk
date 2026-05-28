# Helpdesk

Plataforma multi-cliente de soporte e implementación con asistencia de IA, inventario de servidores/Docker y dashboard ejecutivo.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Postgres 16** con `pgvector` (RAG)
- **Prisma 6** como ORM
- **Auth.js v5** (JWT + credentials)
- **Tailwind v4** + shadcn/ui
- **Anthropic Claude API** (próximas fases)
- Deploy en VPS con **Docker Compose**

## Estructura por fases

- ✅ **Fase 1** — Fundación: auth, schema completo, layout, dashboard con KPIs
- ⬜ Fase 2 — CRUD de clientes, productos, sistemas, servidores y contenedores + agente
- ⬜ Fase 3 — Helpdesk completo (tickets de soporte, comentarios, notificaciones)
- ⬜ Fase 4 — IA con RAG (chat Claude, embeddings, acciones sobre tickets)
- ⬜ Fase 5 — Tickets de implementación (presupuesto, fases, timeline)
- ⬜ Fase 6 — Dashboard avanzado (gráficos, alertas, métricas)

## Cómo arrancar

```bash
# 1. Levantar Postgres + pgvector + Adminer
docker compose up -d

# 2. Aplicar migraciones (ya aplicadas al inicializar)
npm run db:migrate

# 3. Cargar datos demo
npm run db:seed

# 4. Arrancar el dev server
npm run dev
```

App: http://localhost:3000
Adminer (DB UI): http://localhost:8080 — server: `postgres`, user: `helpdesk`, pass: `helpdesk_dev_password`, db: `helpdesk`

## Cuentas demo

| Rol     | Email                     | Password    |
| ------- | ------------------------- | ----------- |
| Admin   | admin@helpdesk.local      | admin123    |
| Agente  | soporte@helpdesk.local    | agent123    |
| Cliente | juan@acme.com             | client123   |

## Variables de entorno

Copia `.env.example` a `.env` y completa:

- `DATABASE_URL` — conexión a Postgres
- `AUTH_SECRET` — generar con `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` — necesario para Fase 4 (IA)
- `AGENT_API_TOKEN` — token compartido con el agente que reporta el estado de servidores

## Scripts

```bash
npm run dev          # servidor de desarrollo
npm run build        # build producción
npm run db:migrate   # nueva migración Prisma
npm run db:seed      # cargar datos demo
npm run db:studio    # abrir Prisma Studio
npm run db:reset     # reset DB (CUIDADO)
```
