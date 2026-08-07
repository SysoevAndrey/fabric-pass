import { DropletStatus } from './droplet-status'

/** Always shown, full page width like the header — see globals.css's
 * `.site-footer`/`.site-footer-inner` for how the two stay aligned.
 * IDEA-028's droplet status section is Admin-only — gated here, not inside
 * DropletStatus itself, so a non-admin never even triggers the (cached,
 * but still real) getDropletMetrics call. */
export async function Footer({ isAdmin }: { isAdmin: boolean }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <ul className="footer-links">
          <li>
            <a href="https://constructorfabric.org">Website →</a>
          </li>
          <li>
            <a href="mailto:contact@constructorfabric.org">Email →</a>
          </li>
          <li>
            <a href="https://github.com/constructorfabric">GitHub →</a>
          </li>
          <li>
            <a href="https://discord.gg/QWHtHGgEdq">Discord →</a>
          </li>
        </ul>
        <p className="footer-copyright">© 2026 Constructor Fabric Foundation</p>
        {isAdmin ? <DropletStatus /> : null}
      </div>
    </footer>
  )
}
