"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LifeBuoy } from "lucide-react"

import { cn } from "@/lib/utils"
import { navigation } from "@/lib/navigation"

type Role = "ADMIN" | "AGENT" | "CLIENT"

type Props = {
  role: Role
  onNavigate?: () => void
  className?: string
}

export function SidebarContents({ role, onNavigate, className }: Props) {
  const pathname = usePathname()

  return (
    <div className={cn("bg-sidebar text-sidebar-foreground flex h-full flex-col", className)}>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <LifeBuoy className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Helpdesk</p>
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            v0.1
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navigation.map((section) => {
          const items = section.items.filter(
            (it) => !it.roles || it.roles.includes(role)
          )
          if (items.length === 0) return null
          return (
            <div key={section.label} className="mb-4">
              <p className="text-muted-foreground mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <p className="text-muted-foreground text-[11px]">
          {role === "ADMIN" && "Administrador"}
          {role === "AGENT" && "Técnico"}
          {role === "CLIENT" && "Cliente"}
        </p>
      </div>
    </div>
  )
}

export function AppSidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden h-svh w-64 shrink-0 border-r md:flex md:flex-col">
      <SidebarContents role={role} />
    </aside>
  )
}
