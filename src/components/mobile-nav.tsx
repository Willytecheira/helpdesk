"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet"
import { SidebarContents } from "@/components/app-sidebar"

type Role = "ADMIN" | "AGENT" | "CLIENT"

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navegación</SheetTitle>
          <SheetDescription>Menú principal</SheetDescription>
        </SheetHeader>
        <SidebarContents role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
