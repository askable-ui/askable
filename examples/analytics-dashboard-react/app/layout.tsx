import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Askable',
  description: 'Context-aware AI assistant',
  icons: {
    icon: '/avatar.png',
    apple: '/avatar.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
