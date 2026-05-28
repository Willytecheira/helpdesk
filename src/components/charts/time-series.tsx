"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

type Point = { date: string; creados: number; resueltos: number }

export function TicketsTimeSeries({ data, height = 240 }: { data: Point[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="g-creados" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-resueltos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tickFormatter={(v: string) => format(parseISO(v), "dd MMM", { locale: es })}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            color: "var(--color-popover-foreground)",
            fontSize: "12px",
          }}
          labelFormatter={(v) => format(parseISO(String(v)), "EEEE dd MMM yyyy", { locale: es })}
        />
        <Area
          type="monotone"
          dataKey="creados"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#g-creados)"
          name="Creados"
        />
        <Area
          type="monotone"
          dataKey="resueltos"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          fill="url(#g-resueltos)"
          name="Resueltos"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
