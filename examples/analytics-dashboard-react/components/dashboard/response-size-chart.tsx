"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const data = [
  { time: "12h ago", size: 320 },
  { time: "10h ago", size: 380 },
  { time: "8h ago", size: 350 },
  { time: "6h ago", size: 420 },
  { time: "4h ago", size: 380 },
  { time: "2h ago", size: 340 },
  { time: "Now", size: 352 },
]

export function ResponseSizeChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Average Response Size
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-chart-1" />
          <span className="text-xl font-semibold text-foreground">352.7 kB</span>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                tickFormatter={(value) => `${value}kB`}
                domain={[200, 500]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.14 0 0)",
                  border: "1px solid oklch(0.25 0 0)",
                  borderRadius: "8px",
                  color: "oklch(0.95 0 0)",
                }}
              />
              <Line
                type="monotone"
                dataKey="size"
                stroke="oklch(0.7 0.15 250)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
