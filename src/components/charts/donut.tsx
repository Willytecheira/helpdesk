"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

type Slice = { name: string; value: number; label?: string }

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
]

export function Donut({
  data,
  height = 200,
  centerLabel,
}: {
  data: Slice[]
  height?: number
  centerLabel?: string
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0)
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              color: "var(--color-popover-foreground)",
              fontSize: "12px",
            }}
            formatter={(v, name) => {
              const num = Number(v) || 0
              return [`${num} (${Math.round((num / Math.max(total, 1)) * 100)}%)`, String(name)]
            }}
          />
          <Pie
            data={data}
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold">{total}</p>
        {centerLabel && <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{centerLabel}</p>}
      </div>
    </div>
  )
}

export function DonutLegend({ data }: { data: Slice[] }) {
  return (
    <ul className="space-y-1.5 text-xs">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: PALETTE[i % PALETTE.length] }}
          />
          <span className="flex-1 truncate">{d.label ?? d.name}</span>
          <span className="text-muted-foreground tabular-nums">{d.value}</span>
        </li>
      ))}
    </ul>
  )
}
