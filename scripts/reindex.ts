import "dotenv/config"
import { reindexAll } from "@/lib/ai-indexer"
import { embeddingsEnabled } from "@/lib/embeddings"

async function main() {
  if (!(await embeddingsEnabled())) {
    console.error(
      "❌ OpenAI no configurado. Pegá la API key en /settings/integrations o setea OPENAI_API_KEY."
    )
    process.exit(1)
  }

  console.log("🔁 Reindexando tickets y artículos de KB…")
  const stats = await reindexAll()
  console.log(`✅ Indexados ${stats.tickets} tickets, ${stats.kb} artículos.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
