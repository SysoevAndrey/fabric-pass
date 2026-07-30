/** A checkmark, not text, is the first thing a visitor sees in this section —
 * "read as safe at a glance" means the shape of it has to say so before the
 * words do. */
function Tick() {
  return (
    <svg className="tick" viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
      <path d="M5.5 10.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Collected() {
  return (
    <section className="collected">
      <h3>What this collects</h3>

      <ul className="assurances">
        <li>
          <Tick /> Only public profile information is read — nothing more than any visitor could already see
        </li>
        <li>
          <Tick /> No access, refresh, or ID tokens are ever stored
        </li>
        <li>
          <Tick /> Signing in never authorizes this service to take any action on your accounts
        </li>
      </ul>
    </section>
  )
}
