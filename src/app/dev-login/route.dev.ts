import { NextResponse, type NextRequest } from 'next/server'
import { pool } from '@/lib/db'
import { env } from '@/lib/env'
import { getSession } from '@/lib/session'

// Local-only sign-in shortcut (IDEA-031): signs the browser in as an existing
// contributor row without going through any OAuth provider. Never committed.
//
// `?as=<github_login>` picks the row; both halves of the session's identity
// come from that row, so no identity is written into this file. Without the
// parameter it lists the local contributors to choose from — switching between
// an Admin, a confirmed contributor and a draft one is most of what this route
// is for.
//
// Three independent conditions all have to hold, so no single misconfiguration
// exposes it: a development build, an APP_URL that is itself a loopback origin,
// and a request that actually arrived at a loopback host. The Host check is
// what keeps it off the network — a dev server started with --hostname 0.0.0.0
// is reachable from the LAN, and the first two conditions alone would let
// anyone on that network sign in as any contributor.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function isLoopback(hostHeader: string | null): boolean {
  if (!hostHeader) return false
  // Strip the port, keeping bracketed IPv6 literals intact.
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(0, hostHeader.indexOf(']') + 1)
    : hostHeader.split(':')[0]
  return LOOPBACK_HOSTS.has(host.toLowerCase())
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

interface Row {
  github_id: string
  github_login: string
  name: string | null
  status: string
  is_admin: boolean
}

async function renderPicker(): Promise<NextResponse> {
  const { rows } = await pool.query<Row>(
    `SELECT github_id, github_login, name, status, is_admin
       FROM contributors
       ORDER BY is_admin DESC, status, github_login`,
  )

  const items = rows
    .map((row) => {
      const label = escapeHtml(row.name ?? row.github_login)
      const tags = [row.status, row.is_admin ? 'admin' : null].filter(Boolean).join(' · ')
      return `<li><a href="/dev-login?as=${encodeURIComponent(row.github_login)}">${label}</a>
        <small>${escapeHtml(row.github_login)} — ${escapeHtml(tags)}</small></li>`
    })
    .join('\n')

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>dev sign-in</title>
     <style>body{font:16px system-ui;margin:2rem;max-width:40rem}
       li{margin:.4rem 0}small{color:#666;margin-left:.5rem}</style>
     <h1>Sign in as</h1><ul>${items}</ul>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

export async function GET(request: NextRequest) {
  const allowed =
    process.env.NODE_ENV === 'development' &&
    isLoopback(new URL(env.APP_URL).host) &&
    isLoopback(request.headers.get('host'))

  if (!allowed) {
    return new NextResponse('Not found', { status: 404 })
  }

  const login = request.nextUrl.searchParams.get('as')
  if (!login) {
    return renderPicker()
  }

  const { rows } = await pool.query<Row>(
    'SELECT github_id, github_login FROM contributors WHERE lower(github_login) = lower($1)',
    [login],
  )
  const contributor = rows[0]
  if (!contributor) {
    return new NextResponse(`No contributor with github_login ${login}`, { status: 404 })
  }

  const session = await getSession()
  session.github = { id: contributor.github_id, login: contributor.github_login }
  await session.save()

  return NextResponse.redirect(new URL('/', env.APP_URL))
}
