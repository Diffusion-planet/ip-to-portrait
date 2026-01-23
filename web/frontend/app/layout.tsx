import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IP to Portrait',
  description: 'Identity-preserving portrait generation with AI',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
