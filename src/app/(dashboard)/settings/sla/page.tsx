import { requireAdmin } from "@/lib/auth-helpers"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSlaConfig } from "@/lib/sla"
import { SlaForm } from "./sla-form"

export const metadata = { title: "SLA" }

export default async function SlaPage() {
  await requireAdmin()
  const config = await getSlaConfig()

  return (
    <div>
      <PageHeader
        title="SLA"
        description="Definí los tiempos de resolución esperados por prioridad."
      />
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempos de resolución</CardTitle>
            <CardDescription>
              Cuando el SLA está activo, cada ticket de soporte recibe una fecha de vencimiento.
              Los tickets vencidos o por vencer se marcan con un badge en la lista.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlaForm config={config} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
