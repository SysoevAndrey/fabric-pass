import type { ReactNode } from 'react'
import { Brand } from './brand'
import './globals.css'

export const metadata = { title: 'Constructor Fabric — Fabric Pass' }

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
