"use client"

import { useState, useEffect } from "react"
import { Send, Sparkles, X, Maximize2, Minimize2, Eye } from "lucide-react"
import { useAskable } from "@askable-ui/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  context?: string
  isContext?: boolean
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hi! I am your AI assistant powered by askable-ui. Click on any element to give me context about what you&apos;re looking at, then ask me questions!",
    timestamp: new Date(Date.now() - 60000),
  },
]

export function ChatSidebar() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showContext, setShowContext] = useState(true)
  
  const { promptContext } = useAskable({ inspector: true });

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
      context: promptContext || undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    if (promptContext) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: promptContext,
        timestamp: new Date(),
        isContext: true,
      }
      setMessages((prev) => [...prev, assistantMessage])
    }
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 w-14 rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/90"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </div>
    )
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-l border-border bg-card transition-all duration-300",
        isExpanded ? "w-80" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Askable AI</h3>
            <p className="text-xs text-muted-foreground">Context-aware assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(true)}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Context Panel - Main Feature Showcase */}
      <div className="border-b border-border">
        {promptContext ? (
          <div className="bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
                  <Eye className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-400">Context Captured</span>
                  <p className="text-xs text-emerald-400/70">AI can see this element</p>
                </div>
              </div>
              <button
                onClick={() => setShowContext(!showContext)}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                {showContext ? "Collapse" : "Expand"}
              </button>
            </div>
            {showContext && (
              <ContextPanel content={promptContext} />
            )}
          </div>
        ) : (
          <div className="bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                <Eye className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">No Element Selected</span>
                <p className="text-xs text-muted-foreground/70">Click any card or metric to capture context</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : ""
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-foreground text-background">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="max-w-[85%]">
                {message.context && message.role === "user" && (
                  <div className="mb-1 flex items-center gap-1 text-xs text-chart-1">
                    <Eye className="h-3 w-3" />
                    <span>with context</span>
                  </div>
                )}
                {message.isContext ? (
                  <ContextCard content={message.content} />
                ) : (
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <QuickAction onClick={() => setInput("What am I looking at?")}>
            Explain this
          </QuickAction>
          <QuickAction onClick={() => setInput("What actions can I take?")}>
            Suggest actions
          </QuickAction>
          <QuickAction onClick={() => setInput("Are there any issues?")}>
            Check for issues
          </QuickAction>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about what you see..."
            className="flex-1 border-muted bg-muted/50 text-sm"
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="h-9 w-9 shrink-0 bg-foreground text-background hover:bg-foreground/90"
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

function parseContext(content: string): Record<string, unknown> | string[] | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
  } catch {}
  const lines = content.split(/\s*—\s*/).filter(Boolean)
  return lines.length > 1 ? lines : null
}

function renderContextValue(value: unknown, tone: "panel" | "card" = "panel") {
  if (value !== null && typeof value === "object") {
    return (
      <pre
        className={cn(
          "whitespace-pre-wrap break-words rounded-md border p-2 text-xs leading-relaxed overflow-x-hidden",
          tone === "panel"
            ? "border-emerald-500/20 bg-background/60 text-foreground"
            : "border-emerald-500/20 bg-background/50 text-foreground"
        )}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span className="text-xs font-medium text-foreground break-words whitespace-pre-wrap">{String(value)}</span>
}

function ContextPanel({ content }: { content: string }) {
  const parsed = parseContext(content)

  if (parsed && !Array.isArray(parsed)) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-background/80 backdrop-blur p-3 space-y-2">
        {Object.entries(parsed).map(([key, val]) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400/70">{key.replace(/_/g, " ")}</span>
            {renderContextValue(val, "panel")}
          </div>
        ))}
      </div>
    )
  }

  if (Array.isArray(parsed)) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-background/80 backdrop-blur p-3 space-y-1.5">
        {parsed.map((line, i) => (
          <p key={i} className="text-xs text-foreground break-words">{line}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-background/80 backdrop-blur p-3">
      <p className="text-xs text-foreground break-words whitespace-pre-wrap">{content}</p>
    </div>
  )
}

function ContextCard({ content }: { content: string }) {
  const parsed = parseContext(content)
  const entries = parsed && !Array.isArray(parsed) ? Object.entries(parsed) : null
  const lines = Array.isArray(parsed) ? parsed : content.split(/\s*—\s*/).filter(Boolean)

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <Eye className="h-3 w-3" />
        <span>Selected element</span>
      </div>
      {entries ? (
        <div className="space-y-1.5">
          {entries.map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{key.replace(/_/g, " ")}</span>
              {renderContextValue(val, "card")}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-xs text-foreground break-words">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickAction({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {children}
    </button>
  )
}
