import Link from "next/link"
import { FileQuestion, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="bg-muted text-muted-foreground mx-auto flex size-16 items-center justify-center rounded-full">
          <FileQuestion className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Página no encontrada</h1>
          <p className="text-muted-foreground text-sm">
            La página que buscás no existe o fue movida.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="size-4" />
              Volver al dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
