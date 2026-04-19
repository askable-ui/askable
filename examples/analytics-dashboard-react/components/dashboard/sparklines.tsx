"use client"

import { ReactNode } from "react"

interface SparklinesProps {
  data: number[]
  width?: number
  height?: number
  children?: ReactNode
}

interface SparklinesLineProps {
  color?: string
}

export function Sparklines({
  data,
  width = 100,
  height = 30,
  children,
}: SparklinesProps) {
  if (!data || data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      {children && typeof children === "object" && "props" in children ? (
        <polyline
          fill="none"
          stroke={(children as { props: SparklinesLineProps }).props.color || "currentColor"}
          strokeWidth={1.5}
          points={points}
        />
      ) : (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          points={points}
        />
      )}
    </svg>
  )
}

export function SparklinesLine({ color = "currentColor" }: SparklinesLineProps) {
  return null
}
