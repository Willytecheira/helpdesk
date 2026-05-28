import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ProfileInfoForm,
  ChangePasswordForm,
  RevokeSessionsButton,
} from "./profile-forms"
import { TotpCard } from "./totp-card"

export const metadata = { title: "Mi perfil" }

const roleLabel = { ADMIN: "Administrador", AGENT: "Técnico", CLIENT: "Cliente" } as const

export default async function ProfilePage() {
  const session = await requireUser()
  const me = await prisma.user.findUnique({
    where: { id: session.id },
    include: { customer: { select: { name: true } } },
  })
  if (!me) throw new Error("usuario no encontrado")

  return (
    <div>
      <PageHeader
        title="Mi perfil"
        description="Gestioná tu información, contraseña y seguridad."
      />

      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos personales</CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{roleLabel[me.role]}</Badge>
                {me.customer && <Badge variant="secondary">{me.customer.name}</Badge>}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileInfoForm me={{ name: me.name, email: me.email }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cambiar contraseña</CardTitle>
            <CardDescription>
              Al cambiarla, se cierran tus otras sesiones automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <TotpCard enabled={me.twoFactorEnabled} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sesiones activas</CardTitle>
            <CardDescription>
              Si perdiste o usaste un dispositivo prestado, cerrá todas las sesiones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevokeSessionsButton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
