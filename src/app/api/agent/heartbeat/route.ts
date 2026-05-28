import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getRequestIp, rateLimitResponse } from "@/lib/rate-limit"

const containerSchema = z.object({
  containerId: z.string().optional(),
  name: z.string().min(1),
  image: z.string().min(1),
  imageTag: z.string().optional().nullable(),
  status: z
    .enum(["RUNNING", "PAUSED", "EXITED", "RESTARTING", "CREATED", "DEAD", "UNKNOWN"])
    .default("UNKNOWN"),
  ports: z.unknown().optional(),
  labels: z.unknown().optional(),
  cpuPercent: z.number().nullable().optional(),
  memoryMb: z.number().nullable().optional(),
  startedAt: z.string().optional().nullable(),
})

const heartbeatSchema = z.object({
  cpuPercent: z.number().min(0).max(100).optional(),
  memoryPercent: z.number().min(0).max(100).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  loadAvg1: z.number().optional(),
  loadAvg5: z.number().optional(),
  loadAvg15: z.number().optional(),
  uptimeSeconds: z.number().int().nonnegative().optional(),
  dockerVersion: z.string().optional(),
  hostname: z.string().optional(),
  os: z.string().optional(),
  containers: z.array(containerSchema).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
})

function extractToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export async function POST(req: NextRequest) {
  // Rate limit: 60 heartbeats por minuto por IP (≈1 reporte por segundo)
  const ip = getRequestIp(req.headers)
  const rl = rateLimitResponse(ip, "agent", 60, 60_000)
  if (rl) return rl

  const token = extractToken(req)
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 })
  }

  const server = await prisma.server.findUnique({
    where: { agentToken: token },
    select: { id: true, customerId: true },
  })
  if (!server) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const data = parsed.data
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.serverHeartbeat.create({
      data: {
        serverId: server.id,
        cpuPercent: data.cpuPercent ?? null,
        memoryPercent: data.memoryPercent ?? null,
        diskPercent: data.diskPercent ?? null,
        loadAvg1: data.loadAvg1 ?? null,
        loadAvg5: data.loadAvg5 ?? null,
        loadAvg15: data.loadAvg15 ?? null,
        uptimeSeconds: data.uptimeSeconds ?? null,
        dockerVersion: data.dockerVersion ?? null,
        raw: data.raw as object | undefined,
      },
    })

    await tx.server.update({
      where: { id: server.id },
      data: {
        lastSeenAt: now,
        status: deriveServerStatus(data),
        os: data.os ?? undefined,
        hostname: data.hostname ?? undefined,
      },
    })

    if (data.containers) {
      for (const c of data.containers) {
        await tx.container.upsert({
          where: {
            serverId_name: { serverId: server.id, name: c.name },
          },
          create: {
            serverId: server.id,
            name: c.name,
            image: c.image,
            imageTag: c.imageTag ?? null,
            containerId: c.containerId ?? null,
            status: c.status,
            cpuPercent: c.cpuPercent ?? null,
            memoryMb: c.memoryMb ?? null,
            startedAt: c.startedAt ? new Date(c.startedAt) : null,
            ports: c.ports as object | undefined,
            labels: c.labels as object | undefined,
            lastSeenAt: now,
          },
          update: {
            image: c.image,
            imageTag: c.imageTag ?? null,
            containerId: c.containerId ?? undefined,
            status: c.status,
            cpuPercent: c.cpuPercent ?? null,
            memoryMb: c.memoryMb ?? null,
            startedAt: c.startedAt ? new Date(c.startedAt) : undefined,
            ports: c.ports as object | undefined,
            labels: c.labels as object | undefined,
            lastSeenAt: now,
          },
        })
      }

      // Marcar como UNKNOWN los contenedores que no fueron reportados en este heartbeat
      const reportedNames = data.containers.map((c) => c.name)
      await tx.container.updateMany({
        where: {
          serverId: server.id,
          name: { notIn: reportedNames },
          lastSeenAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
        data: { status: "UNKNOWN" },
      })
    }
  })

  return NextResponse.json({ ok: true, serverId: server.id, reportedAt: now })
}

function deriveServerStatus(
  data: z.infer<typeof heartbeatSchema>
): "ONLINE" | "DEGRADED" | "OFFLINE" | undefined {
  if (
    (data.cpuPercent ?? 0) > 95 ||
    (data.memoryPercent ?? 0) > 95 ||
    (data.diskPercent ?? 0) > 95
  ) {
    return "DEGRADED"
  }
  return "ONLINE"
}
