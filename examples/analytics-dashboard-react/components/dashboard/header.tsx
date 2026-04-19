"use client"

import Image from "next/image"
import { Bell, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const tabs = [
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "ecommerce", label: "E-commerce", icon: "cart" },
  { id: "crm", label: "CRM", icon: "users" },
  { id: "devtools", label: "DevTools", icon: "code" },
]

interface DashboardHeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function DashboardHeader({ activeTab, onTabChange }: DashboardHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
            <Image src="/avatar.png" alt="askable logo" width={28} height={28} className="object-cover" />
          </div>
          <span className="text-sm font-semibold text-foreground">askable</span>
          <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
            ui
          </span>
        </div>

        <nav className="hidden items-center md:flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon === "chart" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              )}
              {tab.icon === "cart" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              )}
              {tab.icon === "users" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
              {tab.icon === "code" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              )}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-chart-1" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Avatar className="h-7 w-7">
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback className="bg-chart-2 text-xs text-primary-foreground">
                  JD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
