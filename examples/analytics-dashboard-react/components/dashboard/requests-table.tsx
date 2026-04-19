"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Search, ChevronDown } from "lucide-react"
import { Sparklines, SparklinesLine } from "@/components/dashboard/sparklines"

const tabs = ["Paths", "Referrer", "Bot Name"]

const requestsData = [
  { path: "/api/chat", requests: 292000, trend: [45, 52, 48, 61, 55, 67, 72] },
  { path: "/api/auth/session", requests: 156000, trend: [30, 35, 42, 38, 45, 50, 48] },
  { path: "/api/users", requests: 89000, trend: [20, 25, 28, 32, 30, 35, 38] },
  { path: "/api/products", requests: 67000, trend: [15, 18, 22, 20, 25, 28, 30] },
  { path: "/api/analytics", requests: 45000, trend: [10, 12, 15, 18, 16, 20, 22] },
]

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`
  }
  return num.toString()
}

export function RequestsTable() {
  const [activeTab, setActiveTab] = useState("Paths")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeTab === tab
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:w-64"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Request Path</TableHead>
              <TableHead className="text-right text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  Requests
                  <ChevronDown className="h-3 w-3" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requestsData.map((row) => (
              <TableRow key={row.path} className="border-border">
                <TableCell className="font-mono text-sm text-foreground">
                  {row.path}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className="font-medium text-foreground">
                      {formatNumber(row.requests)}
                    </span>
                    <Sparklines data={row.trend} width={60} height={20}>
                      <SparklinesLine color="oklch(0.6 0 0)" />
                    </Sparklines>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show 10</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">1 of 1</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
