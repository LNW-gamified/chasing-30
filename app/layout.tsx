import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chasing 30',
  description: 'Personal MLB stadium tracker and trip planner',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
