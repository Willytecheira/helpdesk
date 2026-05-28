import { LifeBuoy } from "lucide-react"
import { LoginForm } from "./login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: "Iniciar sesión · Helpdesk",
}

export default function LoginPage() {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
            <LifeBuoy className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-none">Helpdesk</p>
            <p className="text-muted-foreground text-xs">Panel de operación</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>
              Ingresá con tu cuenta para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          <a href="/forgot-password" className="hover:text-foreground hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </p>
      </div>
    </div>
  )
}
