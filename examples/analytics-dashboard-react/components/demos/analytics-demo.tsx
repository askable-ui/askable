"use client"

import { Askable } from "@askable-ui/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingCart, Eye } from "lucide-react"
import { AskableBanner } from "@/components/askable-banner"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

const revenueData = [
  { month: "Jan", revenue: 4000, orders: 240 },
  { month: "Feb", revenue: 3000, orders: 198 },
  { month: "Mar", revenue: 5000, orders: 320 },
  { month: "Apr", revenue: 4500, orders: 280 },
  { month: "May", revenue: 6000, orders: 390 },
  { month: "Jun", revenue: 5500, orders: 350 },
  { month: "Jul", revenue: 7000, orders: 420 },
]

const trafficData = [
  { day: "Mon", visitors: 1200, pageViews: 4500 },
  { day: "Tue", visitors: 1400, pageViews: 5200 },
  { day: "Wed", visitors: 1100, pageViews: 4100 },
  { day: "Thu", visitors: 1600, pageViews: 5800 },
  { day: "Fri", visitors: 1800, pageViews: 6200 },
  { day: "Sat", visitors: 900, pageViews: 3200 },
  { day: "Sun", visitors: 750, pageViews: 2800 },
]

const metrics = [
  {
    title: "Total Revenue",
    value: "$45,231",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    meta: { metric: "revenue", value: "$45,231", delta: "+12.5%", period: "this month" },
  },
  {
    title: "Active Users",
    value: "2,350",
    change: "+8.2%",
    trend: "up",
    icon: Users,
    meta: { metric: "active_users", value: 2350, delta: "+8.2%", period: "this week" },
  },
  {
    title: "Orders",
    value: "1,247",
    change: "-3.1%",
    trend: "down",
    icon: ShoppingCart,
    meta: { metric: "orders", value: 1247, delta: "-3.1%", period: "this month" },
  },
  {
    title: "Page Views",
    value: "89.4K",
    change: "+24.3%",
    trend: "up",
    icon: Eye,
    meta: { metric: "page_views", value: "89.4K", delta: "+24.3%", period: "this week" },
  },
]

export function AnalyticsDemo() {
  return (
    <div>
      <AskableBanner />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click any metric or chart to give the AI context about what you&apos;re viewing
          </p>
        </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Askable key={metric.title} meta={metric.meta}>
            <Card className="cursor-pointer transition-all hover:border-foreground/20 hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  {metric.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={metric.trend === "up" ? "text-green-500" : "text-red-500"}>
                    {metric.change}
                  </span>
                  <span className="text-muted-foreground">vs last period</span>
                </div>
              </CardContent>
            </Card>
          </Askable>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Askable meta={{ chart: "revenue_trend", data: revenueData, period: "Jan-Jul 2024" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardHeader>
              <CardTitle className="text-lg">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.7 0.15 250)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
                    <XAxis dataKey="month" stroke="oklch(0.6 0 0)" fontSize={12} />
                    <YAxis stroke="oklch(0.6 0 0)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.14 0 0)",
                        border: "1px solid oklch(0.25 0 0)",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="oklch(0.7 0.15 250)"
                      fill="url(#colorRevenue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Askable>

        <Askable meta={{ chart: "weekly_traffic", data: trafficData, period: "This week" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardHeader>
              <CardTitle className="text-lg">Weekly Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" />
                    <XAxis dataKey="day" stroke="oklch(0.6 0 0)" fontSize={12} />
                    <YAxis stroke="oklch(0.6 0 0)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "oklch(0.14 0 0)",
                        border: "1px solid oklch(0.25 0 0)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="visitors" fill="oklch(0.75 0.18 85)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pageViews" fill="oklch(0.65 0.16 165)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Askable>
      </div>

      {/* Top Pages Table */}
      <Askable meta={{ table: "top_pages", description: "Most visited pages this week" }}>
        <Card className="mt-6 cursor-pointer transition-all hover:border-foreground/20">
          <CardHeader>
            <CardTitle className="text-lg">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Page</th>
                    <th className="pb-3 font-medium">Views</th>
                    <th className="pb-3 font-medium">Unique Visitors</th>
                    <th className="pb-3 font-medium">Bounce Rate</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { page: "/", views: "12,847", visitors: "8,234", bounce: "32%" },
                    { page: "/products", views: "8,432", visitors: "5,123", bounce: "28%" },
                    { page: "/pricing", views: "6,218", visitors: "4,891", bounce: "45%" },
                    { page: "/docs", views: "4,891", visitors: "3,456", bounce: "22%" },
                    { page: "/blog", views: "3,654", visitors: "2,789", bounce: "38%" },
                  ].map((row) => (
                    <tr key={row.page} className="border-b border-border/50">
                      <td className="py-3 font-mono text-foreground">{row.page}</td>
                      <td className="py-3 text-foreground">{row.views}</td>
                      <td className="py-3 text-foreground">{row.visitors}</td>
                      <td className="py-3 text-foreground">{row.bounce}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Askable>
      </div>
    </div>
  )
}
