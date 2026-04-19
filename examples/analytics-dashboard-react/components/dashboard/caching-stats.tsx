import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const cacheData = [
  { label: "Regional Cache", value: 85 },
  { label: "Global Cache", value: 72 },
]

export function CachingStats() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium text-foreground">
          Caching
        </CardTitle>
        <span className="text-xs text-muted-foreground">Hit Rate (%)</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cache Hits</span>
              <span className="text-sm font-medium text-foreground">94.5%</span>
            </div>
            {cacheData.map((cache) => (
              <div key={cache.label} className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {cache.label}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {cache.value}%
                  </span>
                </div>
                <Progress
                  value={cache.value}
                  className="h-1.5 bg-muted"
                />
              </div>
            ))}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cache Miss</span>
              <span className="text-sm font-medium text-foreground">5.5%</span>
            </div>
            <div className="relative">
              <Progress value={5.5} className="h-1.5 bg-muted" />
              <div
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground"
                style={{ left: "5.5%" }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
