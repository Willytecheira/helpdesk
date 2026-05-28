"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
] as const

export function RangeSelector({ current }: { current: "7d" | "30d" | "90d" }) {
  const router = useRouter()
  const params = useSearchParams()
  const update = (value: string) => {
    const sp = new URLSearchParams(params.toString())
    sp.set("range", value)
    router.push(`?${sp.toString()}`)
  }
  return (
    <div className="bg-muted inline-flex rounded-md p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => update(o.value)}
          className={cn(
            "rounded px-3 py-1 font-medium transition-colors",
            current === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
