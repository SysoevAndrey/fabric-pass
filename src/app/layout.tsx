import type { ReactNode } from 'react'
import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { Footer } from './footer'
import { Header } from './header'
import './globals.css'

export const metadata = { title: 'Constructor Fabric — Fabric Pass' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  // A session naming a github_id with no row (see README's "session outlives
  // its row") reads as signed-out here too — the page body already falls
  // back to its own sign-in prompt in that case, and the header agreeing
  // with it matters more than either guessing independently.
  const contributor = session.github ? await findByGithubId(session.github.id) : null
  const user = session.github && contributor ? { login: session.github.login, name: contributor.name ?? null } : null

  return (
    <html lang="en">
      <body>
        <Header user={user} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
