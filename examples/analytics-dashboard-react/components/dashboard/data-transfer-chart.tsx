"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const data = [
  { time: "12h ago", outgoing: 800, incoming: 200 },
  { time: "10h ago", outgoing: 900, incoming: 250 },
  { time: "8h ago", outgoing: 1100, incoming: 300 },
  { time: "6h ago", outgoing: 950, incoming: 280 },
  { time: "4h ago", outgoing: 1200, incoming: 350 },
  { time: "2h ago", outgoing: 1000, incoming: 300 },
  { time: "Now", outgoing: 850, incoming: 250 },
]

export function DataTransferChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Fast Data Transfer
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-chart-1" />
            <span className="text-xs text-muted-foreground">Outgoing</span>
            <span className="text-xs font-medium text-foreground">102GB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span className="text-xs text-muted-foreground">Incoming</span>
            <span className="text-xs font-medium text-foreground">3GB</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="outgoing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="incoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.75 0.18 85)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.75 0.18 85)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.6 0 0)", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.6 0 0)", fontSize: 12 }}
                tickFormatter={(value) => `${value}MB`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.14 0 0)",
                  border: "1px solid oklch(0.25 0 0)",
                  borderRadius: "8px",
                  color: "oklch(0.95 0 0)",
                }}
              />
              <Area
                type="monotone"
                dataKey="outgoing"
                stroke="oklch(0.7 0.15 250)"
                strokeWidth={2}
                fill="url(#outgoing)"
              />
              <Area
                type="monotone"
                dataKey="incoming"
                stroke="oklch(0.75 0.18 85)"
                strokeWidth={2}
                fill="url(#incoming)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
