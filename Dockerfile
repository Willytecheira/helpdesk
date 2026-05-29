# syntax=docker/dockerfile:1
# ---------- Etapa 1: dependencias ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- Etapa 2: build ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma necesita generar el cliente antes del build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ---------- Etapa 2b: migrator ----------
# Imagen liviana con TODAS las deps de Prisma (CLI + transitivas) para correr
# `prisma migrate deploy`. No bundlea Next; usa node_modules completos de deps.
FROM node:22-alpine AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- Etapa 3: runtime ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Output standalone + estáticos
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Carpeta de uploads persistente
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000

# Las migraciones las corre un contenedor "migrate" dedicado (ver compose).
# Acá sólo arrancamos el server standalone.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
