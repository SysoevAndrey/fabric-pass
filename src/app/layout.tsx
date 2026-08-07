import type { ReactNode } from 'react'
import { findByGithubId } from '@/lib/contributors'
import { adminTrackIds, isAdmin } from '@/lib/roles'
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
  const admin = contributor ? isAdmin(contributor) : false
  // IDEA-014's nav link — shown for a global Admin (acts on every track) or
  // a Track Admin of at least one track; a plain Contributor never sees it.
  const isTrackAdmin = contributor && !admin ? (await adminTrackIds(contributor.githubId)).length > 0 : false
  const user =
    session.github && contributor
      ? { login: session.github.login, name: contributor.name ?? null, isAdmin: admin, isTrackAdmin: admin || isTrackAdmin }
      : null

  return (
    <html lang="en">
      <body>
        <Header user={user} />
        <main>{children}</main>
        <Footer isAdmin={admin} />
      </body>
    </html>
  )
}
