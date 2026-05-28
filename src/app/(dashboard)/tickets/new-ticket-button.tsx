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
import { TicketForm } from "./ticket-form"

type Option = { id: string; name: string }
type SystemOpt = Option & { customerId: string }
type ServerOpt = Option & { customerId: string }

export function NewTicketButton({
  customers,
  systems,
  servers,
  agents,
  role,
  defaultCustomerId,
}: {
  customers: Option[]
  systems: SystemOpt[]
  servers: ServerOpt[]
  agents: Option[]
  role: "ADMIN" | "AGENT" | "CLIENT"
  defaultCustomerId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuevo ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
        </DialogHeader>
        <TicketForm
          customers={customers}
          systems={systems}
          servers={servers}
          agents={agents}
          role={role}
          defaultCustomerId={defaultCustomerId}
          onDone={(id) => {
            setOpen(false)
            if (id) router.push(`/tickets/${id}`)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
