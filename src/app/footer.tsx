/** Always shown, full page width like the header — see globals.css's
 * `.site-footer`/`.site-footer-inner` for how the two stay aligned. */
export function Footer() {
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
      </div>
    </footer>
  )
}
