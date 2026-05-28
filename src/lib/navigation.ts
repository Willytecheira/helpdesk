import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  ServerCog,
  LifeBuoy,
  Rocket,
  BookOpen,
  Sparkles,
  Settings,
  Repeat,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  roles?: Array<"ADMIN" | "AGENT" | "CLIENT">
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    label: "General",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Asistente IA", href: "/ai", icon: Sparkles },
    ],
  },
  {
    label: "Negocio",
    items: [
      { title: "Clientes", href: "/customers", icon: Users, roles: ["ADMIN", "AGENT"] },
      { title: "Productos", href: "/products", icon: Package, roles: ["ADMIN", "AGENT"] },
      { title: "Sistemas", href: "/systems", icon: Boxes, roles: ["ADMIN", "AGENT"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Tickets", href: "/tickets", icon: LifeBuoy },
      { title: "Implementaciones", href: "/implementations", icon: Rocket, roles: ["ADMIN", "AGENT"] },
      { title: "Recurrentes", href: "/recurring", icon: Repeat, roles: ["ADMIN", "AGENT"] },
      { title: "Infraestructura", href: "/infrastructure", icon: ServerCog, roles: ["ADMIN", "AGENT"] },
      { title: "Base de conocimiento", href: "/kb", icon: BookOpen },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuarios", href: "/settings/users", icon: Users, roles: ["ADMIN"] },
      { title: "Integraciones", href: "/settings/integrations", icon: Settings, roles: ["ADMIN"] },
    ],
  },
]
