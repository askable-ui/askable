"use client"

import {
  LayoutGrid,
  FileText,
  Code2,
  Layers,
  Globe,
  Zap,
  ImageIcon,
  RefreshCw,
  Settings,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const sidebarItems = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: FileText, label: "Notebooks", badge: "Internal" },
]

const computeItems = [
  { icon: Code2, label: "Vercel Functions" },
  { icon: Layers, label: "Edge Functions" },
  { icon: Globe, label: "External APIs" },
  { icon: Settings, label: "Middleware", badge: "Internal" },
  { icon: RefreshCw, label: "Data Cache", badge: "Internal" },
]

const edgeNetworkItems = [
  { icon: Globe, label: "Edge Requests" },
  { icon: Zap, label: "Fast Data Transfer" },
  { icon: ImageIcon, label: "Image Optimization" },
  { icon: RefreshCw, label: "ISR" },
]

const deploymentItems = [{ icon: Settings, label: "Build Diagnostics" }]

const earlyAccessItems = [{ icon: AlertCircle, label: "Errors" }]

function SidebarSection({
  title,
  items,
}: {
  title?: string
  items: { icon: React.ElementType; label: string; active?: boolean; badge?: string }[]
}) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              item.active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

export function DashboardSidebar() {
  return (
    <aside className="hidden w-64 border-r border-border bg-background p-4 lg:block">
      <SidebarSection items={sidebarItems} />
      <SidebarSection title="Compute" items={computeItems} />
      <SidebarSection title="Edge Network" items={edgeNetworkItems} />
      <SidebarSection title="Deployments" items={deploymentItems} />
      <SidebarSection title="Early Access" items={earlyAccessItems} />
    </aside>
  )
}
