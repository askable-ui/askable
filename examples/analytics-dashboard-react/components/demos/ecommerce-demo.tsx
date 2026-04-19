"use client"

import { Askable } from "@askable-ui/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Truck, CheckCircle, AlertCircle, Star, ShoppingBag } from "lucide-react"
import { AskableBanner } from "@/components/askable-banner"

const products = [
  {
    id: 1,
    name: "Wireless Headphones Pro",
    price: 299.99,
    stock: 45,
    sold: 1234,
    rating: 4.8,
    status: "active",
    image: "🎧",
  },
  {
    id: 2,
    name: "Smart Watch Series X",
    price: 449.99,
    stock: 12,
    sold: 892,
    rating: 4.6,
    status: "low-stock",
    image: "⌚",
  },
  {
    id: 3,
    name: "Premium Laptop Stand",
    price: 89.99,
    stock: 0,
    sold: 2156,
    rating: 4.9,
    status: "out-of-stock",
    image: "💻",
  },
  {
    id: 4,
    name: "USB-C Hub 7-in-1",
    price: 59.99,
    stock: 234,
    sold: 3421,
    rating: 4.7,
    status: "active",
    image: "🔌",
  },
]

const orders = [
  {
    id: "ORD-2024-001",
    customer: "Sarah Johnson",
    items: 3,
    total: 459.97,
    status: "delivered",
    date: "2024-01-15",
  },
  {
    id: "ORD-2024-002",
    customer: "Mike Chen",
    items: 1,
    total: 299.99,
    status: "shipped",
    date: "2024-01-16",
  },
  {
    id: "ORD-2024-003",
    customer: "Emily Davis",
    items: 2,
    total: 149.98,
    status: "processing",
    date: "2024-01-17",
  },
  {
    id: "ORD-2024-004",
    customer: "James Wilson",
    items: 5,
    total: 789.95,
    status: "pending",
    date: "2024-01-17",
  },
]

const statusIcons = {
  delivered: CheckCircle,
  shipped: Truck,
  processing: Package,
  pending: AlertCircle,
}

const statusColors = {
  delivered: "bg-green-500/10 text-green-500 border-green-500/20",
  shipped: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  processing: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  pending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

export function EcommerceDemo() {
  return (
    <div>
      <AskableBanner />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">E-commerce Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click products or orders to get AI insights about inventory and sales
          </p>
        </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Askable meta={{ metric: "today_sales", value: "$12,847", change: "+18%" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s Sales</p>
                  <p className="text-2xl font-bold text-foreground">$12,847</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "pending_orders", value: 23, priority: "high" }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold text-foreground">23</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "shipped_today", value: 45 }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Shipped Today</p>
                  <p className="text-2xl font-bold text-foreground">45</p>
                </div>
                <Truck className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "low_stock_items", value: 8, alert: true }}>
          <Card className="cursor-pointer border-orange-500/20 transition-all hover:border-orange-500/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock Items</p>
                  <p className="text-2xl font-bold text-orange-500">8</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.map((product) => (
              <Askable
                key={product.id}
                meta={{
                  product: product.name,
                  price: product.price,
                  stock: product.stock,
                  sold: product.sold,
                  rating: product.rating,
                  status: product.status,
                }}
              >
                <div className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-4 transition-all hover:border-foreground/20 hover:bg-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-2xl">
                    {product.image}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{product.name}</h3>
                      <Badge
                        variant="outline"
                        className={
                          product.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : product.status === "low-stock"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                        }
                      >
                        {product.status === "out-of-stock" ? "Out of Stock" : product.stock + " in stock"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">${product.price}</span>
                      <span>{product.sold} sold</span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {product.rating}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </Askable>
            ))}
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.map((order) => {
              const StatusIcon = statusIcons[order.status as keyof typeof statusIcons]
              return (
                <Askable
                  key={order.id}
                  meta={{
                    order_id: order.id,
                    customer: order.customer,
                    items: order.items,
                    total: order.total,
                    status: order.status,
                    date: order.date,
                  }}
                >
                  <div className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-4 transition-all hover:border-foreground/20 hover:bg-card">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <StatusIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-sm font-medium text-foreground">{order.id}</h3>
                        <Badge
                          variant="outline"
                          className={statusColors[order.status as keyof typeof statusColors]}
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {order.customer} • {order.items} items
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">${order.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{order.date}</p>
                    </div>
                  </div>
                </Askable>
              )
            })}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
