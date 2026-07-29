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
      <h3>What this records</h3>

      <ul className="assurances">
        <li>
          <Tick /> No access, refresh, or ID tokens are ever stored
        </li>
        <li>
          <Tick /> No avatars, and no names or email addresses read from a provider
        </li>
        <li>
          <Tick /> GitHub is asked for no permissions at all — just the public profile any visitor can already see
        </li>
      </ul>

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>What we ask it for</th>
            <th>What is stored</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              GitHub <span className="req">required</span>
            </td>
            <td>No scope at all — only your public profile, which any visitor can already read</td>
            <td>Your username and your numeric account id</td>
          </tr>
          <tr>
            <td>Telegram</td>
            <td>
              <code>openid profile</code>. Only if your account has no @username do we ask again for <code>phone</code>
            </td>
            <td>Your numeric account id, and your @username — or your phone number when there is no username</td>
          </tr>
          <tr>
            <td>Discord</td>
            <td>
              <code>identify</code>, which reads your profile without your email
            </td>
            <td>Your username and your numeric account id</td>
          </tr>
          <tr>
            <td>This form</td>
            <td>Nothing — you type it</td>
            <td>Name, email, and company if you give one</td>
          </tr>
        </tbody>
      </table>

      <p className="collected-never">
        The numeric ids above are stored because usernames can be changed at any time; without one, a renamed account
        could not be recognised later.
      </p>
    </section>
  )
}
