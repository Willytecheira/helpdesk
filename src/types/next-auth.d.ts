import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "ADMIN" | "AGENT" | "CLIENT"
      customerId: string | null
      tokenVersion: number
    } & DefaultSession["user"]
  }

  interface User {
    role?: "ADMIN" | "AGENT" | "CLIENT"
    customerId?: string | null
    tokenVersion?: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: "ADMIN" | "AGENT" | "CLIENT"
    customerId?: string | null
    tokenVersion?: number
  }
}
