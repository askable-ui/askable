"use client"

import { useState } from "react"
import { AskableInspector } from "@askable-ui/react"
import { DashboardHeader } from "@/components/dashboard/header"
import { AnalyticsDemo } from "@/components/demos/analytics-demo"
import { EcommerceDemo } from "@/components/demos/ecommerce-demo"
import { CrmDemo } from "@/components/demos/crm-demo"
import { DevToolsDemo } from "@/components/demos/devtools-demo"
import { ChatSidebar } from "@/components/dashboard/chat-sidebar"

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState("analytics")

  return (
    <>
      <div className="flex h-screen flex-col bg-background">
        <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {activeTab === "analytics" && <AnalyticsDemo />}
            {activeTab === "ecommerce" && <EcommerceDemo />}
            {activeTab === "crm" && <CrmDemo />}
            {activeTab === "devtools" && <DevToolsDemo />}
          </main>
          <ChatSidebar />
        </div>
      </div>
    </>
  )
}
