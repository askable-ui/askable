"use client"

import { useState } from "react"
import { CircleIcon, MousePointer, MousePointerClick, Pointer, X } from "lucide-react"
import {
  useAskable,
  useAskableRegionCapture,
  useAskableTextSelectionCapture,
} from "@askable-ui/react"
import { Button } from "@/components/ui/button"

function round(value: number) {
  return Math.round(value)
}

function boundsLabel(bounds: { x: number; y: number; width: number; height: number }) {
  return `${round(bounds.width)}x${round(bounds.height)} at ${round(bounds.x)},${round(bounds.y)}`
}

export function AskableInteractionToolbar() {
  const { ctx } = useAskable({ inspector: true })
  const [status, setStatus] = useState("Use a tool to send explicit page context to the chat.")

  function pauseImplicitFocus() {
    ctx.unobserve()
  }

  function resumeImplicitFocus() {
    if (typeof document !== "undefined") {
      ctx.observe(document, { events: ["click", "hover", "focus"] })
    }
  }

  const region = useAskableRegionCapture({
    ctx,
    includeViewport: true,
    source: { app: "analytics-dashboard-demo" },
    onCapture(packet, selection) {
      const label = `${selection.shape} selection: ${boundsLabel(selection.bounds)}`
      ctx.push(
        {
          capture: packet.capture.mode,
          gesture: packet.capture.gesture ?? selection.shape,
          shape: selection.shape,
          bounds: selection.bounds,
          ...(selection.radius ? { radius: round(selection.radius) } : {}),
          ...(selection.points ? { points: selection.points.length } : {}),
        },
        label,
      )
      setStatus(label)
      resumeImplicitFocus()
    },
    onCancel() {
      setStatus("Selection cancelled.")
      resumeImplicitFocus()
    },
  })

  const text = useAskableTextSelectionCapture({
    ctx,
    source: { app: "analytics-dashboard-demo" },
    onCapture(packet, selection) {
      ctx.push(
        {
          capture: packet.capture.mode,
          gesture: packet.capture.gesture ?? "programmatic",
          length: selection.text.length,
          ...(selection.bounds ? { bounds: selection.bounds } : {}),
        },
        selection.text,
      )
      setStatus(`Sent ${selection.text.length} selected characters to chat context.`)
      resumeImplicitFocus()
    },
    onCancel() {
      setStatus("Text selection cancelled.")
      resumeImplicitFocus()
    },
  })

  const active = region.active || text.active

  function startTextSelection() {
    pauseImplicitFocus()
    text.start({
      dedupe: false,
      once: true,
      intent: "answer using this highlighted text",
    })
    setStatus("Highlight text on the page to send it as explicit context.")
  }

  function startRegion(shape: "region" | "circle" | "lasso", intent: string) {
    pauseImplicitFocus()
    region.start({ shape, intent })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/70 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startRegion("region", "answer using this selected page region")}
        >
          <MousePointerClick className="h-3.5 w-3.5" />
          Region
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => startRegion("circle", "answer using this circled area")}
        >
          <CircleIcon className="h-3.5 w-3.5" />
          Circle
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => startRegion("lasso", "answer using this lassoed area")}
        >
          <Pointer className="h-3.5 w-3.5" />
          Lasso
        </Button>
        <Button variant="outline" size="sm" onClick={startTextSelection}>
          <MousePointer className="h-3.5 w-3.5" />
          Text selection
        </Button>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              region.cancel()
              text.cancel()
              resumeImplicitFocus()
            }}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{status}</p>
    </div>
  )
}
