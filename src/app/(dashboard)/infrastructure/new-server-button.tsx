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
import { ServerForm } from "./server-form"

type Option = { id: string; name: string }

export function NewServerButton({ customers }: { customers: Option[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuevo servidor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo servidor</DialogTitle>
        </DialogHeader>
        <ServerForm
          customers={customers}
          onDone={(id) => {
            setOpen(false)
            if (id) router.push(`/infrastructure/${id}`)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
