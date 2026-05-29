import type { NextAuthConfig } from "next-auth"

// Configuración edge-compatible: sin DB, sin bcrypt.
// Sólo callbacks/pages para que el middleware funcione en el Edge runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const isOnLogin = path.startsWith("/login")
      // Rutas siempre públicas
      if (
        path.startsWith("/api/auth") ||
        path.startsWith("/api/agent") ||
        path.startsWith("/api/health") ||
        path.startsWith("/api/cron") ||
        path.startsWith("/api/inbound") ||
        path.startsWith("/api/setup")
      ) {
        return true
      }
      const isPublicPage =
        isOnLogin ||
        path.startsWith("/forgot-password") ||
        path.startsWith("/reset-password")
      if (isPublicPage) {
        if (isLoggedIn && isOnLogin) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }
      return isLoggedIn
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.role = (user as { role?: string }).role
        token.customerId = (user as { customerId?: string | null }).customerId
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "ADMIN" | "AGENT" | "CLIENT"
        session.user.customerId = (token.customerId as string | null) ?? null
        session.user.tokenVersion = (token.tokenVersion as number) ?? 0
      }
      return session
    },
  },
  session: { strategy: "jwt" },
  providers: [], // se inyectan en auth.ts (no edge)
} satisfies NextAuthConfig
