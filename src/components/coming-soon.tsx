import { Construction } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <Construction className="text-muted-foreground size-10" />
          <h2 className="text-lg font-semibold">{feature}</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Esta sección se construye en la siguiente fase del proyecto. Por
            ahora, ya tienes la estructura base, autenticación y dashboard listos.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
