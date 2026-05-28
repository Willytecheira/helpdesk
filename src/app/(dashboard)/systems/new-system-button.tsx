"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SystemForm } from "./system-form"

type Option = { id: string; name: string }

export function NewSystemButton({
  customers,
  products,
}: {
  customers: Option[]
  products: Option[]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuevo sistema
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo sistema</DialogTitle>
        </DialogHeader>
        <SystemForm
          customers={customers}
          products={products}
          onDone={(id) => {
            setOpen(false)
            if (id) router.push(`/systems/${id}`)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
