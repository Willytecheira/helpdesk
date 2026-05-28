import { cn } from "@/lib/utils"

type Props = {
  value: number
  max: number
  className?: string
  /** muestra una marca de meta cuando value/max < 1 pero hay desbordamiento posible */
  warn?: boolean
}

export function ProgressBar({ value, max, className, warn }: Props) {
  if (max <= 0) {
    return (
      <div className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}>
        <div className="bg-muted-foreground/30 h-full" style={{ width: "0%" }} />
      </div>
    )
  }
  const ratio = value / max
  const pct = Math.min(Math.max(ratio, 0), 1) * 100
  const over = ratio > 1
  const overflow = over ? Math.min((ratio - 1) * 100, 100) : 0

  const color = over
    ? "bg-destructive"
    : warn || ratio > 0.9
      ? "bg-amber-500"
      : ratio > 0.6
        ? "bg-emerald-500"
        : "bg-primary"

  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      {over && (
        <div
          className="bg-destructive/60 absolute top-0 right-0 h-full"
          style={{ width: `${overflow}%` }}
        />
      )}
    </div>
  )
}
