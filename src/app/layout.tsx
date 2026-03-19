'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '../components/Sidebar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const hideSidebar = pathname === '/login'

  return (
    <html>
      <body style={{ margin: 0 }}>
        {hideSidebar ? (
          children
        ) : (
          <div style={{ display: 'flex' }}>
            <Sidebar />
            <div style={{ flex: 1 }}>{children}</div>
          </div>
        )}
      </body>
    </html>
  )
}