import { LifeBuoy } from "lucide-react"
import Link from "next/link"
import { ForgotForm } from "./forgot-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = { title: "Restablecer contraseña" }

export default function ForgotPage() {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-none">Helpdesk</p>
            <p className="text-muted-foreground text-xs">Restablecer contraseña</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recuperar acceso</CardTitle>
            <CardDescription>
              Te enviamos un link para restablecer tu contraseña.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            ← Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
