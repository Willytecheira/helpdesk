import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { emailEnabled } from "@/lib/email"
import { UsersTable } from "./users-table"

export const metadata = { title: "Usuarios" }

export default async function UsersPage() {
  const me = await requireAdmin()

  const [users, customers, mailEnabled] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    emailEnabled(),
  ])

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Invitá a tu equipo y a tus clientes. Las invitaciones llegan por email con un link para activar la cuenta."
      />

      <div className="p-4 md:p-6">
        <Card>
          <CardContent>
            <UsersTable
              currentUserId={me.id}
              emailEnabled={mailEnabled}
              customers={customers}
              users={users.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                customerId: u.customerId,
                customerName: u.customer?.name ?? null,
                active: u.active,
                hasPassword: !!u.password,
                twoFactorEnabled: u.twoFactorEnabled,
                createdAt: u.createdAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
