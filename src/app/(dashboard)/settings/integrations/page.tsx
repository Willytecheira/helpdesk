import { Sparkles, Database, Mail, Info, Bot, Brain } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/page-header"
import {
  INTEGRATION_KEYS,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_FROM_ADDRESS,
} from "@/lib/integrations"
import { decryptString, maskSecret } from "@/lib/crypto"
import { IntegrationCard } from "./integration-card"
import {
  saveAnthropic,
  saveOpenai,
  saveResend,
  saveGoogle,
  saveDeepseek,
  testAnthropic,
  testOpenai,
  testResend,
  testGoogle,
  testDeepseek,
  clearAnthropic,
  clearOpenai,
  clearResend,
  clearGoogle,
  clearDeepseek,
} from "./actions"

export const metadata = { title: "Integraciones" }

const ANTHROPIC_MODELS = [
  { value: "claude-opus-4-7", label: "Opus 4.7" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-haiku-4-6", label: "Haiku 4.6" },
]

const OPENAI_EMBEDDING_MODELS = [
  { value: "text-embedding-3-small", label: "Small (1536d)" },
  { value: "text-embedding-3-large", label: "Large (3072d)" },
]

async function loadSetting(key: string) {
  return prisma.integrationSetting.findUnique({ where: { key } })
}

function decryptSafe(value: string | null, encrypted: boolean): string | null {
  if (!value) return null
  try {
    return encrypted ? decryptString(value) : value
  } catch {
    return null
  }
}

export default async function IntegrationsPage() {
  const [
    anthropicKeyRow,
    anthropicModelRow,
    openaiKeyRow,
    openaiModelRow,
    googleKeyRow,
    deepseekKeyRow,
    resendKeyRow,
    resendFromRow,
  ] = await Promise.all([
    loadSetting(INTEGRATION_KEYS.anthropicApiKey),
    loadSetting(INTEGRATION_KEYS.anthropicModel),
    loadSetting(INTEGRATION_KEYS.openaiApiKey),
    loadSetting(INTEGRATION_KEYS.openaiEmbeddingModel),
    loadSetting(INTEGRATION_KEYS.googleApiKey),
    loadSetting(INTEGRATION_KEYS.deepseekApiKey),
    loadSetting(INTEGRATION_KEYS.resendApiKey),
    loadSetting(INTEGRATION_KEYS.resendFrom),
  ])

  const anthropicKey = decryptSafe(anthropicKeyRow?.value ?? null, anthropicKeyRow?.encrypted ?? true)
  const openaiKey = decryptSafe(openaiKeyRow?.value ?? null, openaiKeyRow?.encrypted ?? true)
  const googleKey = decryptSafe(googleKeyRow?.value ?? null, googleKeyRow?.encrypted ?? true)
  const deepseekKey = decryptSafe(deepseekKeyRow?.value ?? null, deepseekKeyRow?.encrypted ?? true)
  const resendKey = decryptSafe(resendKeyRow?.value ?? null, resendKeyRow?.encrypted ?? true)
  const anthropicModel = anthropicModelRow?.value && !anthropicModelRow.encrypted
    ? anthropicModelRow.value
    : null
  const openaiModel = openaiModelRow?.value && !openaiModelRow.encrypted ? openaiModelRow.value : null
  const resendFrom = resendFromRow?.value && !resendFromRow.encrypted ? resendFromRow.value : null

  const anthropicEnv = !!process.env.ANTHROPIC_API_KEY
  const openaiEnv = !!process.env.OPENAI_API_KEY
  const googleEnv = !!process.env.GOOGLE_API_KEY
  const deepseekEnv = !!process.env.DEEPSEEK_API_KEY
  const resendEnv = !!process.env.RESEND_API_KEY

  const anthropicHasKey = !!anthropicKey || anthropicEnv
  const openaiHasKey = !!openaiKey || openaiEnv
  const googleHasKey = !!googleKey || googleEnv
  const deepseekHasKey = !!deepseekKey || deepseekEnv
  const resendHasKey = !!resendKey || resendEnv

  return (
    <div>
      <PageHeader
        title="Integraciones"
        description="Configurá las APIs de IA. Las claves se guardan encriptadas en la base de datos."
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="bg-muted/40 flex items-start gap-3 rounded-md border p-3 text-sm">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>
              Estas integraciones reemplazan a las variables de entorno. Si guardás una key
              acá, tiene prioridad sobre la del archivo <code className="text-xs">.env</code>.
            </p>
            <p className="text-muted-foreground text-xs">
              Las API keys se encriptan con AES-256-GCM antes de guardarse, usando una clave
              derivada de tu <code>AUTH_SECRET</code>.
            </p>
          </div>
        </div>

        <IntegrationCard
          title="Anthropic Claude"
          description="Modelo conversacional para el chat IA y respuestas en tickets."
          icon={<Sparkles className="size-4" />}
          hasKey={anthropicHasKey}
          maskedKey={anthropicKey ? maskSecret(anthropicKey) : ""}
          modelValue={anthropicModel ?? undefined}
          modelDefault={DEFAULT_ANTHROPIC_MODEL}
          modelOptions={ANTHROPIC_MODELS}
          envFallback={!anthropicKey && anthropicEnv}
          envHint="ANTHROPIC_API_KEY"
          lastVerifiedAt={anthropicKeyRow?.lastVerifiedAt ?? null}
          lastVerifiedOk={anthropicKeyRow?.lastVerifiedOk ?? null}
          lastVerifyError={anthropicKeyRow?.lastVerifyError ?? null}
          saveAction={saveAnthropic}
          testAction={testAnthropic}
          clearAction={clearAnthropic}
        />

        <IntegrationCard
          title="OpenAI (Embeddings)"
          description="Embeddings para la búsqueda semántica (RAG) sobre tickets y artículos KB. Opcional: sin esto, el chat funciona pero sin contexto de KB."
          icon={<Database className="size-4" />}
          hasKey={openaiHasKey}
          maskedKey={openaiKey ? maskSecret(openaiKey) : ""}
          modelLabel="Modelo de embeddings"
          modelValue={openaiModel ?? undefined}
          modelDefault={DEFAULT_EMBEDDING_MODEL}
          modelOptions={OPENAI_EMBEDDING_MODELS}
          envFallback={!openaiKey && openaiEnv}
          envHint="OPENAI_API_KEY"
          lastVerifiedAt={openaiKeyRow?.lastVerifiedAt ?? null}
          lastVerifiedOk={openaiKeyRow?.lastVerifiedOk ?? null}
          lastVerifyError={openaiKeyRow?.lastVerifyError ?? null}
          saveAction={saveOpenai}
          testAction={testOpenai}
          clearAction={clearOpenai}
        />

        <IntegrationCard
          title="Google (Gemini)"
          description="Modelos Gemini para el chat IA. El modelo se elige en cada agente."
          icon={<Bot className="size-4" />}
          hasKey={googleHasKey}
          maskedKey={googleKey ? maskSecret(googleKey) : ""}
          hideModel
          envFallback={!googleKey && googleEnv}
          envHint="GOOGLE_API_KEY"
          lastVerifiedAt={googleKeyRow?.lastVerifiedAt ?? null}
          lastVerifiedOk={googleKeyRow?.lastVerifiedOk ?? null}
          lastVerifyError={googleKeyRow?.lastVerifyError ?? null}
          saveAction={saveGoogle}
          testAction={testGoogle}
          clearAction={clearGoogle}
        />

        <IntegrationCard
          title="DeepSeek"
          description="Modelos DeepSeek (chat y reasoner) para el chat IA. El modelo se elige en cada agente."
          icon={<Brain className="size-4" />}
          hasKey={deepseekHasKey}
          maskedKey={deepseekKey ? maskSecret(deepseekKey) : ""}
          hideModel
          envFallback={!deepseekKey && deepseekEnv}
          envHint="DEEPSEEK_API_KEY"
          lastVerifiedAt={deepseekKeyRow?.lastVerifiedAt ?? null}
          lastVerifiedOk={deepseekKeyRow?.lastVerifiedOk ?? null}
          lastVerifyError={deepseekKeyRow?.lastVerifyError ?? null}
          saveAction={saveDeepseek}
          testAction={testDeepseek}
          clearAction={clearDeepseek}
        />

        <IntegrationCard
          title="Resend (Emails)"
          description="Notificaciones por email: tickets nuevos, comentarios, cambios de estado. El test envía un mail a tu cuenta."
          icon={<Mail className="size-4" />}
          hasKey={resendHasKey}
          maskedKey={resendKey ? maskSecret(resendKey) : ""}
          modelLabel="Dirección remitente (From)"
          modelValue={resendFrom ?? undefined}
          modelDefault={DEFAULT_FROM_ADDRESS}
          envFallback={!resendKey && resendEnv}
          envHint="RESEND_API_KEY"
          lastVerifiedAt={resendKeyRow?.lastVerifiedAt ?? null}
          lastVerifiedOk={resendKeyRow?.lastVerifiedOk ?? null}
          lastVerifyError={resendKeyRow?.lastVerifyError ?? null}
          saveAction={saveResend}
          testAction={testResend}
          clearAction={clearResend}
        />
      </div>
    </div>
  )
}
