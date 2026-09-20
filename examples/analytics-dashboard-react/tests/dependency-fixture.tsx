import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Bar, BarChart, XAxis } from 'recharts'
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'

createRoot(document.getElementById('fixture')!).render(
  <>
    <ChartContainer
      id="dependency-test"
      style={{ width: '100%', height: 320 }}
      config={{ revenue: { label: 'Revenue', color: '#208050' }, orders: { label: 'Orders', color: '#287acc' } }}
    >
      <BarChart data={[{ month: 'Jan', revenue: 4000, orders: 240 }, { month: 'Feb', revenue: 3000, orders: 198 }]}>
        <XAxis dataKey="month" />
        <Bar dataKey="revenue" fill="#208050" isAnimationActive={false} />
        <Bar dataKey="orders" fill="#287acc" isAnimationActive={false} />
        <ChartLegend content={<ChartLegendContent />} />
        <ChartTooltip content={
          <ChartTooltipContent formatter={(value, name, _item, _index, payload) => (
            <span>{`${name}: ${value} (${payload.length} series)`}</span>
          )} />
        } />
      </BarChart>
    </ChartContainer>
    <Label htmlFor="account">Account</Label>
    <input id="account" />
    <Separator decorative={false} />
    <Toggle aria-label="Pin chart">Pin</Toggle>
    <div style={{ width: 160 }}>
      <AspectRatio ratio={16 / 9} data-testid="ratio">Preview</AspectRatio>
    </div>
    <ToastProvider duration={60000}>
      <Toast defaultOpen>
        <ToastTitle>Saved</ToastTitle>
        <ToastClose aria-label="Dismiss notification" />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  </>,
)
