import Link from "next/link"
import { LifeBuoy, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { hashToken } from "@/lib/tokens"
import { ResetForm } from "./reset-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Establecer contraseña" }

type Search = Promise<{ token?: string }>

export default async function ResetPage({ searchParams }: { searchParams: Search }) {
  const { token } = await searchParams
  let valid = false
  let userEmail: string | null = null
  let hasPasswordAlready = false

  if (token) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { email: true, password: true } } },
    })
    if (record && !record.usedAt && record.expiresAt >= new Date()) {
      valid = true
      userEmail = record.user.email
      hasPasswordAlready = !!record.user.password
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-none">Helpdesk</p>
            <p className="text-muted-foreground text-xs">
              {hasPasswordAlready ? "Nueva contraseña" : "Activar cuenta"}
            </p>
          </div>
        </div>

        <Card>
          {!token || !valid ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="text-destructive size-5" />
                  Link inválido
                </CardTitle>
                <CardDescription>
                  Este link es inválido, expiró o ya fue usado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/forgot-password">
                  <Button className="w-full">Pedir un nuevo link</Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>
                  {hasPasswordAlready ? "Establecer nueva contraseña" : "Activar cuenta"}
                </CardTitle>
                <CardDescription>
                  Para <strong>{userEmail}</strong>. Elegí una contraseña segura (mínimo 8 caracteres).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResetForm token={token!} />
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
