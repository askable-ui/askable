"use client"

import { useState } from "react"
import { MousePointer, MousePointerClick, Pointer, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AskableBannerProps {
  className?: string
}

export function AskableBanner({ className }: AskableBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className={`border-b border-border bg-gradient-to-r from-chart-1/5 via-transparent to-chart-3/5 ${className}`}>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex flex-1 items-center gap-6">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-chart-1" />
            <span className="text-sm font-medium text-foreground">askable-ui enabled</span>
          </div>
          
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary">
                <MousePointer className="h-3.5 w-3.5" />
              </div>
              <span>Hover to preview</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary">
                <MousePointerClick className="h-3.5 w-3.5" />
              </div>
              <span>Click to select</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary">
                <Pointer className="h-3.5 w-3.5" />
              </div>
              <span>Button to ask AI</span>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground lg:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span>Selected elements appear in chat sidebar</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}
