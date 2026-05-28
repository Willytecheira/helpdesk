import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getAnthropicConfig, getOpenAiConfig, getResendConfig } from "@/lib/integrations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Check = { ok: boolean; detail?: string; error?: string }

export async function GET() {
  // Requiere admin para no exponer metadata operativa al público
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const checks: Record<string, Check> = {}

  // 1. DB
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, detail: "Postgres responde" }
  } catch (e) {
    checks.database = { ok: false, error: e instanceof Error ? e.message : "unknown" }
  }

  // 2. pgvector
  try {
    const r = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `
    checks.pgvector = r.length > 0
      ? { ok: true, detail: "Extensión vector instalada" }
      : { ok: false, error: "Extensión vector no encontrada" }
  } catch (e) {
    checks.pgvector = { ok: false, error: e instanceof Error ? e.message : "unknown" }
  }

  // 3. Storage
  try {
    const { mkdir, stat } = await import("fs/promises")
    const path = await import("path")
    const dir = path.resolve(process.cwd(), "uploads")
    await mkdir(dir, { recursive: true })
    await stat(dir)
    checks.storage = { ok: true, detail: "uploads/ accesible" }
  } catch (e) {
    checks.storage = { ok: false, error: e instanceof Error ? e.message : "unknown" }
  }

  // 4. Anthropic configurado
  const ant = await getAnthropicConfig()
  checks.anthropic = ant.apiKey
    ? { ok: true, detail: `model: ${ant.model}` }
    : { ok: false, error: "No configurado (chat IA deshabilitado)" }

  // 5. OpenAI configurado
  const oa = await getOpenAiConfig()
  checks.openai_embeddings = oa.apiKey
    ? { ok: true, detail: `model: ${oa.embeddingModel}` }
    : { ok: false, error: "No configurado (RAG deshabilitado)" }

  // 6. Resend configurado
  const re = await getResendConfig()
  checks.resend = re.apiKey
    ? { ok: true, detail: `from: ${re.from}` }
    : { ok: false, error: "No configurado (emails deshabilitados)" }

  // Solo DB y pgvector son críticos
  const criticalOk = checks.database.ok && checks.pgvector.ok && checks.storage.ok

  return NextResponse.json(
    {
      status: criticalOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: criticalOk ? 200 : 503 }
  )
}
