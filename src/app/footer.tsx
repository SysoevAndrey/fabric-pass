/** Always shown, on both the sign-in page and the signed-in form — the
 * contact links live here instead of next to the title, so they don't
 * disappear once a contributor is past the first screen. */
export function Footer() {
  return (
    <footer className="site-footer">
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
    </footer>
  )
}
