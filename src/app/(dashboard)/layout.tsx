import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="bg-background flex min-h-svh">
      <KeyboardShortcuts />
      <AppSidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email!,
            role: session.user.role,
          }}
        />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
