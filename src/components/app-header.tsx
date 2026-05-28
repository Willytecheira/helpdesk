"use client"

import Link from "next/link"
import { LogOut, User as UserIcon } from "lucide-react"
import { logoutAction } from "@/app/(dashboard)/logout-action"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { MobileNav } from "@/components/mobile-nav"
import { CommandPalette, CommandTrigger } from "@/components/command-palette"
import { NotificationsBell } from "@/components/notifications-bell"

type Props = {
  user: {
    name?: string | null
    email: string
    role: "ADMIN" | "AGENT" | "CLIENT"
    id: string
  }
}

function initials(name: string | null | undefined, email: string) {
  const source = name?.trim() || email
  const parts = source.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "?"
}

export function AppHeader({ user }: Props) {
  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 md:px-6">
      <MobileNav role={user.role} />
      <div className="flex-1">
        <CommandTrigger />
      </div>
      <CommandPalette role={user.role} />
      <NotificationsBell />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú usuario">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name ?? "Sin nombre"}</span>
              <span className="text-muted-foreground text-xs">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserIcon className="size-4" />
              <span>Mi perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form
            action={async () => {
              await logoutAction()
            }}
          >
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <LogOut className="size-4" />
                <span>Cerrar sesión</span>
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
