import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

const metrics = [
  {
    label: "Total Requests",
    value: "289K",
    change: "+12.5%",
    trend: "up",
  },
  {
    label: "Avg Response Time",
    value: "145ms",
    change: "-8.2%",
    trend: "down",
  },
  {
    label: "Error Rate",
    value: "0.2%",
    change: "-15%",
    trend: "down",
  },
  {
    label: "Cache Hit Rate",
    value: "94.5%",
    change: "+2.1%",
    trend: "up",
  },
]

export function MetricsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">
                {metric.value}
              </span>
              <span
                className={`flex items-center text-xs font-medium ${
                  metric.trend === "up" && metric.label !== "Error Rate"
                    ? "text-chart-3"
                    : metric.trend === "down" && metric.label === "Error Rate"
                    ? "text-chart-3"
                    : metric.trend === "down"
                    ? "text-chart-3"
                    : "text-chart-4"
                }`}
              >
                {metric.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {metric.change}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
