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
  { time: "12h ago", requests: 1200, "2xx": 1150, "4xx": 40, "5xx": 10 },
  { time: "10h ago", requests: 1800, "2xx": 1720, "4xx": 60, "5xx": 20 },
  { time: "8h ago", requests: 2200, "2xx": 2100, "4xx": 80, "5xx": 20 },
  { time: "6h ago", requests: 1900, "2xx": 1820, "4xx": 60, "5xx": 20 },
  { time: "4h ago", requests: 2400, "2xx": 2300, "4xx": 80, "5xx": 20 },
  { time: "2h ago", requests: 2100, "2xx": 2000, "4xx": 80, "5xx": 20 },
  { time: "Now", requests: 1800, "2xx": 1720, "4xx": 60, "5xx": 20 },
]

export function RequestsChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Requests
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-chart-1" />
            <span className="text-xs text-muted-foreground">2XX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span className="text-xs text-muted-foreground">4XX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-chart-4" />
            <span className="text-xs text-muted-foreground">5XX</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2">
          <span className="text-2xl font-semibold text-foreground">289K</span>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="requests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0} />
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
                tickFormatter={(value) => `${value / 1000}K`}
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
                dataKey="2xx"
                stroke="oklch(0.7 0.15 250)"
                strokeWidth={2}
                fill="url(#requests)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
