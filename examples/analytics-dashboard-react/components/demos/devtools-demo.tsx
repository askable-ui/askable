"use client"

import { Askable } from "@askable-ui/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react"
import { AskableBanner } from "@/components/askable-banner"

const deployments = [
  {
    id: "dpl-abc123",
    branch: "main",
    commit: "feat: add user auth",
    status: "ready",
    time: "2m ago",
    duration: "45s",
  },
  {
    id: "dpl-def456",
    branch: "feature/payments",
    commit: "fix: stripe webhook",
    status: "building",
    time: "5m ago",
    duration: "...",
  },
  {
    id: "dpl-ghi789",
    branch: "fix/mobile-nav",
    commit: "fix: hamburger menu",
    status: "failed",
    time: "1h ago",
    duration: "32s",
  },
  {
    id: "dpl-jkl012",
    branch: "main",
    commit: "chore: update deps",
    status: "ready",
    time: "3h ago",
    duration: "52s",
  },
]

const errors = [
  {
    id: 1,
    message: "TypeError: Cannot read property 'map' of undefined",
    file: "/app/products/page.tsx",
    line: 42,
    count: 156,
    lastSeen: "5m ago",
  },
  {
    id: 2,
    message: "Error: Network request failed",
    file: "/lib/api.ts",
    line: 78,
    count: 89,
    lastSeen: "12m ago",
  },
  {
    id: 3,
    message: "Warning: Each child should have a unique 'key' prop",
    file: "/components/list.tsx",
    line: 15,
    count: 2341,
    lastSeen: "1h ago",
  },
]

const metrics = {
  cpu: 42,
  memory: 68,
  requests: 1247,
  latency: 45,
  uptime: 99.98,
  errors: 3,
}

const statusColors = {
  ready: "bg-green-500/10 text-green-500 border-green-500/20",
  building: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
}

const statusIcons = {
  ready: CheckCircle,
  building: RefreshCw,
  failed: AlertTriangle,
}

export function DevToolsDemo() {
  return (
    <div>
      <AskableBanner />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Developer Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click deployments, errors, or metrics to get AI-powered debugging assistance
          </p>
        </div>

      {/* System Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Askable meta={{ metric: "cpu", value: metrics.cpu, unit: "%" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">CPU</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{metrics.cpu}%</p>
              <Progress value={metrics.cpu} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "memory", value: metrics.memory, unit: "%" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Memory</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{metrics.memory}%</p>
              <Progress value={metrics.memory} className="mt-2 h-1" />
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "requests", value: metrics.requests, period: "last hour" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Requests</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{metrics.requests}</p>
              <p className="mt-1 text-xs text-muted-foreground">last hour</p>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "latency", value: metrics.latency, unit: "ms", target: 100 }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Latency</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{metrics.latency}ms</p>
              <p className="mt-1 text-xs text-green-500">p95</p>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "uptime", value: metrics.uptime, unit: "%" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Uptime</span>
              </div>
              <p className="mt-1 text-xl font-bold text-green-500">{metrics.uptime}%</p>
              <p className="mt-1 text-xs text-muted-foreground">30 days</p>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "error_rate", value: metrics.errors, severity: "warning" }}>
          <Card className="cursor-pointer border-orange-500/20 transition-all hover:border-orange-500/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Errors</span>
              </div>
              <p className="mt-1 text-xl font-bold text-orange-500">{metrics.errors}</p>
              <p className="mt-1 text-xs text-muted-foreground">active</p>
            </CardContent>
          </Card>
        </Askable>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deployments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Deployments</CardTitle>
            <Button variant="outline" size="sm">
              <Server className="mr-2 h-4 w-4" />
              Deploy
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {deployments.map((deployment) => {
              const StatusIcon = statusIcons[deployment.status as keyof typeof statusIcons]
              return (
                <Askable
                  key={deployment.id}
                  meta={{
                    deployment: deployment.id,
                    branch: deployment.branch,
                    commit: deployment.commit,
                    status: deployment.status,
                    duration: deployment.duration,
                  }}
                >
                  <div className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-all hover:border-foreground/20 hover:bg-card">
                    <StatusIcon
                      className={`h-5 w-5 ${
                        deployment.status === "ready"
                          ? "text-green-500"
                          : deployment.status === "building"
                          ? "animate-spin text-blue-500"
                          : "text-red-500"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{deployment.branch}</span>
                        <Badge
                          variant="outline"
                          className={statusColors[deployment.status as keyof typeof statusColors]}
                        >
                          {deployment.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{deployment.commit}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{deployment.time}</p>
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deployment.duration}
                      </p>
                    </div>
                  </div>
                </Askable>
              )
            })}
          </CardContent>
        </Card>

        {/* Errors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Errors</CardTitle>
            <Button variant="outline" size="sm">
              <Database className="mr-2 h-4 w-4" />
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.map((error) => (
              <Askable
                key={error.id}
                meta={{
                  error: error.message,
                  file: error.file,
                  line: error.line,
                  occurrences: error.count,
                  lastSeen: error.lastSeen,
                }}
              >
                <div className="cursor-pointer rounded-lg border border-border p-3 transition-all hover:border-red-500/30 hover:bg-red-500/5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-mono text-sm text-red-400">{error.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {error.file}:{error.line}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{error.count} occurrences</span>
                    <span className="text-muted-foreground">Last seen: {error.lastSeen}</span>
                  </div>
                </div>
              </Askable>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
