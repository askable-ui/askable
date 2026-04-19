"use client"

import { Askable } from "@askable-ui/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Mail, Phone, Calendar, DollarSign, TrendingUp, Users, Target, Clock } from "lucide-react"
import { AskableBanner } from "@/components/askable-banner"

const leads = [
  {
    id: 1,
    name: "Acme Corporation",
    contact: "John Smith",
    email: "john@acme.com",
    value: 125000,
    stage: "negotiation",
    probability: 75,
    lastContact: "2 days ago",
  },
  {
    id: 2,
    name: "TechStart Inc",
    contact: "Sarah Lee",
    email: "sarah@techstart.io",
    value: 85000,
    stage: "proposal",
    probability: 50,
    lastContact: "1 week ago",
  },
  {
    id: 3,
    name: "Global Systems",
    contact: "Mike Johnson",
    email: "mike@globalsys.com",
    value: 250000,
    stage: "discovery",
    probability: 25,
    lastContact: "3 days ago",
  },
  {
    id: 4,
    name: "DataFlow Ltd",
    contact: "Emily Chen",
    email: "emily@dataflow.co",
    value: 175000,
    stage: "qualified",
    probability: 40,
    lastContact: "Today",
  },
]

const activities = [
  { type: "call", contact: "John Smith", company: "Acme Corp", time: "2 hours ago", note: "Discussed pricing options" },
  { type: "email", contact: "Sarah Lee", company: "TechStart", time: "5 hours ago", note: "Sent proposal deck" },
  { type: "meeting", contact: "Mike Johnson", company: "Global Systems", time: "Yesterday", note: "Initial discovery call" },
  { type: "email", contact: "Emily Chen", company: "DataFlow", time: "Yesterday", note: "Follow-up on requirements" },
]

const stageColors = {
  discovery: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  qualified: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  proposal: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  negotiation: "bg-green-500/10 text-green-500 border-green-500/20",
}

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
}

export function CrmDemo() {
  const totalPipeline = leads.reduce((sum, lead) => sum + lead.value, 0)
  const weightedPipeline = leads.reduce((sum, lead) => sum + (lead.value * lead.probability) / 100, 0)

  return (
    <div>
      <AskableBanner />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">CRM Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Click leads or activities to get AI-powered insights and recommendations
          </p>
        </div>

      {/* Pipeline Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Askable meta={{ metric: "total_pipeline", value: totalPipeline, leads: leads.length }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pipeline</p>
                  <p className="text-2xl font-bold text-foreground">${(totalPipeline / 1000).toFixed(0)}K</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "weighted_pipeline", value: weightedPipeline }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Weighted Pipeline</p>
                  <p className="text-2xl font-bold text-foreground">${(weightedPipeline / 1000).toFixed(0)}K</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "active_leads", value: leads.length }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Leads</p>
                  <p className="text-2xl font-bold text-foreground">{leads.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
        <Askable meta={{ metric: "quota_progress", value: 78, target: 500000 }}>
          <Card className="cursor-pointer transition-all hover:border-foreground/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Quota Progress</p>
                  <p className="text-2xl font-bold text-foreground">78%</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </Askable>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leads Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {leads.map((lead) => (
              <Askable
                key={lead.id}
                meta={{
                  lead: lead.name,
                  contact: lead.contact,
                  email: lead.email,
                  value: lead.value,
                  stage: lead.stage,
                  probability: lead.probability,
                  lastContact: lead.lastContact,
                }}
              >
                <div className="cursor-pointer rounded-lg border border-border p-4 transition-all hover:border-foreground/20 hover:bg-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-secondary text-foreground">
                          {lead.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">{lead.name}</h3>
                        <p className="text-sm text-muted-foreground">{lead.contact}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={stageColors[lead.stage as keyof typeof stageColors]}>
                      {lead.stage}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Deal Value</span>
                      <span className="font-medium text-foreground">${lead.value.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Win Probability</span>
                      <span className="font-medium text-foreground">{lead.probability}%</span>
                    </div>
                    <Progress value={lead.probability} className="h-2" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last contact: {lead.lastContact}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Mail className="mr-2 h-3 w-3" />
                      Email
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Phone className="mr-2 h-3 w-3" />
                      Call
                    </Button>
                  </div>
                </div>
              </Askable>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((activity, index) => {
              const ActivityIcon = activityIcons[activity.type as keyof typeof activityIcons]
              return (
                <Askable
                  key={index}
                  meta={{
                    activity: activity.type,
                    contact: activity.contact,
                    company: activity.company,
                    time: activity.time,
                    note: activity.note,
                  }}
                >
                  <div className="flex cursor-pointer gap-3 rounded-lg p-2 transition-all hover:bg-secondary/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{activity.contact}</p>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{activity.company}</p>
                      <p className="text-sm text-muted-foreground">{activity.note}</p>
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
