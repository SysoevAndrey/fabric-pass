export function Collected() {
  return (
    <section className="collected">
      <h3>What this records</h3>

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
            <td>
              Your username and your numeric account id
            </td>
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
            <td>First name, last name, email, and company if you give one</td>
          </tr>
        </tbody>
      </table>

      <p className="collected-never">
        <strong>Nothing else is kept.</strong> No access tokens, no refresh tokens, no ID tokens, no avatars, and none of
        the names or email addresses a provider offers alongside them — those are read and discarded. The numeric ids
        are stored because usernames can be changed at any time, and without them a renamed account cannot be
        recognised later.
      </p>
    </section>
  )
}
