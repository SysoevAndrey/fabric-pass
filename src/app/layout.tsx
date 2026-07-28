import type { ReactNode } from 'react'
import { Brand } from './brand'
import './globals.css'

export const metadata = { title: 'Constructor Fabric — Contributor Registry' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <Brand />
          {children}
        </main>
      </body>
    </html>
  )
}
