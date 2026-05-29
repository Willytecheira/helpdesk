import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Crea (o actualiza la contraseña de) un usuario ADMIN para producción.
 * Uso:
 *   ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=secreto ADMIN_NAME="Tu Nombre" \
 *     npx tsx -r tsconfig-paths/register scripts/create-admin.ts
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? "Administrador"

  if (!email || !password) {
    console.error("❌ Definí ADMIN_EMAIL y ADMIN_PASSWORD")
    process.exit(1)
  }
  if (password.length < 8) {
    console.error("❌ La contraseña debe tener al menos 8 caracteres")
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: "ADMIN", active: true, name },
    create: { email, password: hash, role: "ADMIN", active: true, name },
  })

  console.log(`✅ Admin listo: ${user.email} (${user.id})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
