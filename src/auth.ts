import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        totp: { label: "Código 2FA", type: "text" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        })
        if (!user || !user.password) return null
        if (!user.active) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        // Si 2FA está activo, validar el TOTP. Si no llegó, indicar que se requiere.
        if (user.twoFactorEnabled) {
          if (!parsed.data.totp || !parsed.data.totp.trim()) {
            // Devolvemos null para que NextAuth muestre "credenciales inválidas".
            // El flujo de login en el form sabe pedir el código si detecta cuenta con 2FA.
            return null
          }
          const { verifyTotpCode } = await import("@/lib/totp")
          const ok = await verifyTotpCode(user.id, parsed.data.totp.trim())
          if (!ok) return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          customerId: user.customerId,
          tokenVersion: user.tokenVersion,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Overrideo session para validar tokenVersion contra DB en cada request.
    // Esto permite "revocar todas las sesiones" incrementando tokenVersion.
    async session({ session, token }) {
      if (!session.user) return session
      session.user.id = token.id as string
      session.user.role = token.role as "ADMIN" | "AGENT" | "CLIENT"
      session.user.customerId = (token.customerId as string | null) ?? null
      session.user.tokenVersion = (token.tokenVersion as number) ?? 0

      // Check de tokenVersion: si el usuario revocó sesiones, su token actual queda inválido.
      // Lo hacemos cada N segundos para no consultar DB en cada request.
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true, active: true, role: true, customerId: true },
          })
          if (!dbUser || !dbUser.active || dbUser.tokenVersion !== session.user.tokenVersion) {
            // Sesión inválida — el cliente recibirá una sesión "vacía"
            return { ...session, user: undefined as never }
          }
          // Refrescar role/customer si cambiaron sin re-login
          session.user.role = dbUser.role
          session.user.customerId = dbUser.customerId
        } catch {
          // Si la DB no responde, dejamos pasar para no romper el sitio
        }
      }
      return session
    },
  },
})
