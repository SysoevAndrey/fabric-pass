# Fabric Pass — Ideas

<!-- One "## [STATUS] [<owner>] IDEA-NNN — Title" section per idea.
     Statuses: DRAFT → TODO → TAKEN → DONE. Terminal: DROPPED, PARKED.
     Owner required for DRAFT/TAKEN/DONE; omitted for TODO; retained for DROPPED/PARKED.
     Identifier is a bare login (no prefix); the registry uses the value verbatim.
     Body must fit in a single "Idea:" line by default; pad only when the simple
     form genuinely won't carry the information, otherwise split into multiple ideas.
     Format and rules: .claude/skills/ideas/SKILL.md -->

## [DONE] [frontgeeks] IDEA-000 — Improve profile view & editing logic
Idea:
Default the profile form to a locked, view-only mode instead of always-editable, to avoid accidental edits. A pencil-icon "Edit" button ("Modify profile" hint), top-right of the form on the same line as the "Contributor Profile" title, switches it into edit mode — today's always-editable behavior, unchanged autosave, unchanged title. A "Save" button, shown only in edit mode, switches the form back to view-only mode.

Expected outcome:
- View-only mode is the default on load; fields aren't editable and provider links can't be changed until Edit is pressed.
- Edit button (pencil icon + "Modify profile" hint) sits top-right, same line as the title, and switches to edit mode.
- Save button (edit mode only) switches back to view-only mode.
- Pressing Save enforces the mandatory fields — Name and Email must be filled in, or Save is blocked and the contributor is prompted to fill them in.

Result: PR https://github.com/constructorfabric/fabric-pass/pull/9 (merged; IDEA-000 landed as fd7537c)

Task: https://github.com/constructorfabric/fabric-pass/issues/1

By: vzhuman · 2026-07-31

## [DONE] [frontgeeks] IDEA-001 — Dedicated profile page
Idea:
The profile view/edit form becomes its own page, opened via "Profile" in the top-right menu, and closed via a new Close button (an "X" with a "Close" hint), placed near the Edit (pencil) button. A new static Main page (placeholder content only, "Main Form", for now) is what closing the Profile page returns to, shown in its already-saved state.

Expected outcome:
- Profile is a separate page from Main, reachable via the top-right menu's "Profile" item.
- A Close button (X icon, "Close" hint), near the Edit button, returns to Main.
- Main is a new, static page — for now just a placeholder reading "Main Form" — shown in its saved state after Profile is closed.
- On sign-in, Main is shown if the contributor's profile is considered complete; otherwise the Profile page opens directly in edit mode.
- View mode on the Profile page disallows editing any field and disallows linking/re-linking Telegram, Discord, or any other provider — those actions are edit-mode only.

Notes:
Depends on IDEA-000's view/edit mode split — "view mode disallows editing" only means something once that mode exists.

Result: PR https://github.com/constructorfabric/fabric-pass/pull/9 (merged; IDEA-001 landed as 353bf08)

Task: https://github.com/constructorfabric/fabric-pass/issues/2

By: frontgeeks · 2026-07-31
By: vzhuman · 2026-07-31

## [DONE] [frontgeeks] IDEA-002 — Review of the database–git data exchange process
Idea: Review how data flows between the Postgres database and git (the cf-internal registry sync): what is exported, what is imported back, and whether the process holds up.
Result: review report on the task issue — https://github.com/constructorfabric/fabric-pass/issues/3#issuecomment-5176740537 (single-writer model sound; main risks: export silently reverts admin edits after a missed/partial sync, and sync can clobber app-set aliases)
Task: https://github.com/constructorfabric/fabric-pass/issues/3
By: frontgeeks · 2026-07-31

## [DONE] [frontgeeks] IDEA-003 — Root user configured via env by GitHub ID
Idea: A root user for the app, designated by GitHub ID through an environment variable.
Result: PR https://github.com/constructorfabric/fabric-pass/pull/11
Task: https://github.com/constructorfabric/fabric-pass/issues/4
By: frontgeeks · 2026-07-31

## [DONE] [vzhuman] IDEA-004 — Public contributor profile view
Idea:
A read-only page for viewing another contributor's public details — reachable by direct link now, and from search once IDEA-005 lands. Merges in everything recorded under any of that contributor's aliases, not just the row that was opened.

Expected outcome:
- Shows a contributor's public details: name, company, and every linked account they (or an alias of theirs) have.
- Discord/Telegram: click to open the corresponding app's chat with that person.
- Email: click to open a mail client addressed to them.
- GitHub: click to open their GitHub profile.
- Fields sourced from any of the contributor's aliases are merged into one view, not shown only from the row that was clicked into.
- No edit affordances anywhere — this is never the signed-in contributor's own editable form.

Notes:
Feeds IDEA-005 (contributor search) as its destination page.
Visible only to `confirmed` contributors (both as search results and as viewable profiles) — a `draft` contributor is neither searchable nor has a viewable profile page yet.
Transfer to frontgeeks on 2026-08-05 was made in error and reverted the next day — vzhuman remains the owner. An `internal`-status-gating note added at the same time was also a mistake — this page is gated on `confirmed`, not a not-yet-existing `internal` status.

Result: commit af56e5b — https://github.com/constructorfabric/fabric-pass/commit/af56e5b

Task: https://github.com/constructorfabric/fabric-pass/issues/12

By: vzhuman · 2026-07-31

## [DONE] [vzhuman] IDEA-005 — Contributor search on Main page
Idea:
A search box on the Main page for finding other contributors, opening the matching one in the profile view (IDEA-004).

Expected outcome:
- Matches against name, email, GitHub username, GitHub email, Discord username, and Telegram username.
- Live results appear once 3–4+ characters are typed, capped at the 5 best matches.
- Selecting a result opens that contributor's profile view (IDEA-004).

Notes:
Depends on IDEA-004 for the destination page.
Only searches, and only returns, `confirmed` contributors — a `draft` contributor doesn't show up as a search result.
Transfer to frontgeeks on 2026-08-05 was made in error and reverted the next day — vzhuman remains the owner. An `internal`-status-gating note added at the same time was also a mistake — this searches `confirmed` contributors, not a not-yet-existing `internal` status.
Also matches LinkedIn name — not in the original list above, which predates LinkedIn linking (IDEA-024); leaving it out once LinkedIn existed would have read as a gap rather than a deliberate omission.

Result: commit af56e5b — https://github.com/constructorfabric/fabric-pass/commit/af56e5b

Task: https://github.com/constructorfabric/fabric-pass/issues/13

By: vzhuman · 2026-07-31

## [TODO] IDEA-006 — Community rules & policies on Main page
Idea:
A section on the Main page listing Constructor Fabric's community-wide rules and policies, most likely as links into the public governance repository's markdown documents, possibly alongside links to individual tracks' own policies.

Expected outcome:
- A visible list of policy/rules links on the Main page.
- Each link points at a markdown document in the governance repository.

Notes:
Open question, not yet decided: does a link navigate straight to the document (e.g. on GitHub), or open it rendered inside this app, in a new tab, with a link back to the source repository?
Track-specific policy links, if any, are out of scope until IDEA-007's track directory exists to hang them off of.
Approach: the list of links comes from IDEA-032's artifact-links registry (cf-internal `pass/`), not hardcoded or scraped from the governance repository directly — the registry holds the label and URL, the governance repository still holds the actual policy documents.
Depends on IDEA-032 for where these links are sourced from.

By: vzhuman · 2026-07-31

## [TODO] IDEA-007 — Track directory on Main page
Idea:
A directory of Constructor Fabric's tracks (Studio, Insight, Gears — with Gears Core/OSS/BSS/FrontX/Mobile as sub-tracks —, Research, Governance), each with a summary, its leaders and their roles, and links to its repositories.

Expected outcome:
- Every track (and sub-track) shows: a short summary of what it's about, its leaders with role (Product Manager, Architect, Developer, Researcher, etc.), and its repositories, each with a short description and a link to its issue tracker.

Notes:
Proposed addition, beyond what was asked — confirm before including: a link to the track's own community/discussion channel (e.g. its Discord channel), and a short "how to get involved" pointer. Both are cheap to add alongside the rest of this directory and squarely useful for a new contributor.
Roadmap diagrams (IDEA-008) and call schedules (IDEA-009) build on this directory rather than being part of it.
Depends on IDEA-010 for the underlying tracks data — nothing to display until that exists.
A track's entry can also surface its own artifact links (e.g. vision doc, contributing guide) from IDEA-032's registry, scoped to that track's slug — the same mechanism IDEA-006/008/009 use for their own links.
Depends on IDEA-032 for any artifact links shown alongside the rest of a track's entry.

By: vzhuman · 2026-07-31

## [TODO] IDEA-008 — Track roadmap diagrams
Idea:
A roadmap diagram for each track, shown on its entry in the track directory (IDEA-007).

Expected outcome:
- Each track in the directory shows, or links to, a roadmap diagram reflecting its current plan.

Notes:
Depends on IDEA-007 for the directory to attach to. Diagram source/format (static image, embedded tool, generated from a tracked file) is undecided.
Approach: a diagram is a link into IDEA-032's artifact-links registry, pointing at wherever it's actually maintained (any repository under `constructorfabric`, or elsewhere) — this app never stores or generates the diagram itself, only the link to it.
Depends on IDEA-032 for where this link is sourced from.

By: vzhuman · 2026-07-31

## [TODO] IDEA-009 — Track meeting schedules
Idea:
Each track's recurring calls, shown on its entry in the track directory (IDEA-007): daily sync-up, regular community update/demo call, and regular planning call.

Expected outcome:
- Each track in the directory lists its daily sync-up schedule, its regular community call schedule (updates and demos), and its regular planning call schedule.

Notes:
Depends on IDEA-007 for the directory to attach to. Whether schedules link out to an external calendar or are entered/maintained here directly is undecided.
Approach: a schedule is a link into IDEA-032's artifact-links registry (e.g. to an external calendar or a scheduling doc), not data entered/maintained directly in this app — consistent with IDEA-006/008 using the same registry for their own links.
Depends on IDEA-032 for where this link is sourced from.

By: vzhuman · 2026-07-31

## [DONE] [vzhuman] IDEA-010 — Tracks data & cf-internal sync
Idea:
A `tracks` concept in the database, mirrored to and from a new file in cf-internal (`pass/tracks.yaml`), following the same pattern as the existing contributors registry sync.

Expected outcome:
- Each track has: a name, a description, a list of repositories (each with its own short description and issue-tracker link — matching what IDEA-007 already promised to display), and up to five named leader slots — Product Manager, Architect, Developer, Quality, Researcher — each independently either empty or pointing at exactly one contributor.
- A contributor can hold a leader slot on more than one track at once (e.g. Architect on one track, Product Manager on another).
- Synced with cf-internal's `pass/tracks.yaml`, mirroring `pass/contributors.yaml`'s bidirectional, single-writer-per-field design.

Notes:
The per-repository description/issue-tracker-link fields go beyond the source request's bare "list of repositories" — added because IDEA-007 already promised to display them, and they need somewhere to live. Confirm before building.
Prerequisite for IDEA-007/008/009 (nothing to display until this data exists) and for IDEA-011's Track Admin role, IDEA-013's join requests, and IDEA-014's per-track membership.
Pulled in as a direct prerequisite while implementing IDEA-011 — Track Admin has nothing to scope against otherwise. One-way sync only (file -> DB) — unlike contributors, nothing about a track is self-reported, so there's no export direction.

Result: commit 3cb589c — https://github.com/constructorfabric/fabric-pass/commit/3cb589c

Task: https://github.com/constructorfabric/fabric-pass/issues/16

By: vzhuman · 2026-07-31

## [DONE] [vzhuman] IDEA-011 — Contributor roles: Contributor / Track Admin / Admin
Idea:
Three levels of access: Contributor (default), Track Admin (scoped to one or more specific tracks), and Admin (internally "Organization Admin," but just "Admin" in the UI).

Expected outcome:
- Every contributor is a plain Contributor by default.
- Admin is a global role, held by zero or more contributors.
- Track Admin is per-track, not global — a contributor can be Track Admin of more than one track at once, and a track can have more than one Track Admin.
- Admin and Track Admin unlock additional pages/page-sections beyond what a plain Contributor sees (specifics in IDEA-012 and IDEA-014).

Notes:
Depends on IDEA-010 for tracks to scope Track Admin against.
Track Admin gates nothing yet — IDEA-014 (the page that would consult it) isn't built; the role and its data (track_admins) exist as groundwork, same as isRootUser was before this.

Result: commit 3cb589c — https://github.com/constructorfabric/fabric-pass/commit/3cb589c

Task: https://github.com/constructorfabric/fabric-pass/issues/14

By: vzhuman · 2026-07-31

## [DONE] [vzhuman] IDEA-012 — Admin: full contributor list with Confirm/Block
Idea:
A page, visible only to Admins, listing every contributor — unlike the plain-Contributor view, which only gets search (IDEA-005) with no full table. Admins can Confirm or Block a contributor from this list, changing their status.

Expected outcome:
- Admin-only page: the full contributor table, plus the same search as IDEA-005.
- Confirm and Block actions per row, each changing that contributor's status.

Notes:
`status` (draft/confirmed) is currently owned entirely by the cf-internal registry file — the app only ever reads it, never writes it (see README's "Contributors registry sync"). Confirm changing it from the app UI, and Block being a new status value at all, both need reconciling with that single-writer model before implementation: either this action becomes a second writer (and the sync direction for `status` has to change), or "Confirm"/"Block" here mean proposing a change that flows back out through the existing export instead of writing directly. Worth deciding before implementation.
Depends on IDEA-011 for the Admin role itself.
IDEA-021 (leave the community) hits this same single-writer question, from a different angle (self-service vs. admin-triggered) — worth deciding both together.
Decided: the app writes `status` directly (setContributorStatus) — simplest, matches the request literally. It folds back through the registry file on the next scheduled export; the accepted risk is a registry-file edit landing between an Admin's click and that export, which would overwrite the in-app change back on the following import. Blocked behaves exactly like draft everywhere status already gates something (search, public profile) — no additional restriction on signing in or editing your own profile.

Result: commit 3cb589c — https://github.com/constructorfabric/fabric-pass/commit/3cb589c

Task: https://github.com/constructorfabric/fabric-pass/issues/15

By: vzhuman · 2026-07-31

## [TODO] IDEA-013 — Request to join a track
Idea:
A contributor can request to join a track from that track's page. The request is stored, synced to cf-internal, and visible to that track's Track Admin(s) (and to Admins).

Expected outcome:
- A "Request to join" action on a track's page (IDEA-007), available to any signed-in contributor.
- The request is persisted and synced into cf-internal alongside the rest of the tracks data (IDEA-010).
- Pending requests are visible to that track's Track Admin(s) and to Admins — see IDEA-014 for where they act on them.

Notes:
Depends on IDEA-010 (tracks must exist) and IDEA-007 (the track page this is requested from).

By: vzhuman · 2026-07-31

## [TODO] IDEA-014 — Track Admin: member list & join-request review
Idea:
A page, visible to Track Admins (and Admins), listing the people assigned to their track(s) plus that track's pending join requests (IDEA-013), with Accept/Reject actions on requests.

Expected outcome:
- A Track Admin sees only the members and pending requests for the track(s) they admin, not every track.
- A Track Admin managing more than one track sees all of them, not just one.
- Accept/Reject actions on a pending join request.
- Admins have the same Accept/Reject capability as a Track Admin, but across every track rather than just their own — an Admin can act on behalf of any Track Admin.
- Search, same as the plain-Contributor and Admin views (IDEA-005 / IDEA-012), scoped to the Track Admin's own track(s).

Notes:
Depends on IDEA-011 (roles), IDEA-013 (the requests being reviewed), and IDEA-010 (tracks and their membership).

By: vzhuman · 2026-07-31

## [TODO] IDEA-015 — Onboarding checklist for new contributors
Idea:
A "getting started" checklist on the Main page for a contributor whose profile isn't yet complete, tying together pieces that already exist separately: fill in the profile, read the community policies, join a track.

Expected outcome:
- Shown to a signed-in contributor until their profile is considered complete (same completeness check as IDEA-001).
- Steps: complete profile (name + email — IDEA-000's mandatory fields), read community policies (IDEA-006), request to join a track (IDEA-013).
- Each step links straight to the relevant page/action; completed steps show as done.

Notes:
Depends on IDEA-000 (mandatory-field/completeness concept), IDEA-006 (policies), and IDEA-013 (join request) all existing first — this is a thin layer tying them together, not a new capability on its own.

By: vzhuman · 2026-07-31

## [TODO] IDEA-016 — Open-issue board across track repositories
Idea:
A board aggregating open, contributor-friendly issues (e.g. "good first issue") from every repository listed under every track, so a new contributor can find something to work on without hunting through each repo individually.

Expected outcome:
- Pulls open issues from the repositories listed in IDEA-010's tracks data, filtered to some contributor-friendly label convention.
- Shown somewhere reachable from Main — a dedicated section or its own page.
- Each issue links out to the real issue on GitHub (or wherever the repo is hosted).

Notes:
Depends on IDEA-010 for the repository list. Needs its own GitHub API access (rate limits, possibly a token) — worth scoping separately before committing to it.
Split from IDEA-015 rather than folded in — it's a materially different piece of engineering (external API integration) from the rest of the onboarding checklist.

By: vzhuman · 2026-07-31

## [TODO] IDEA-017 — Leave a track
Idea:
A contributor can remove themselves from a track they're a member of, from that track's page — the voluntary counterpart to IDEA-013's join request, distinct from being removed by an admin.

Expected outcome:
- A "Leave track" action on a track's page, shown only to a contributor who's currently a member of it.
- Takes effect immediately, no approval needed (unlike joining).
- Synced to cf-internal the same way membership changes from IDEA-013/014 are.

Notes:
Depends on IDEA-010 (track membership existing at all) and IDEA-013/014 (the membership this removes).

By: vzhuman · 2026-07-31

## [TODO] IDEA-018 — Volunteer for an open track leader slot
Idea:
A contributor can nominate themselves for one of a track's empty leader slots (Product Manager, Architect, Developer, Quality, Researcher — IDEA-010), the leadership counterpart to IDEA-013's membership join request.

Expected outcome:
- On a track's page, each empty leader slot shows a "Volunteer" action; filled slots don't show it.
- The nomination is visible to that track's Track Admin(s)/Admins for approval, the same way IDEA-013's join requests are (IDEA-014).

Notes:
Depends on IDEA-010 (leader slots) and IDEA-014 (the review surface this needs, extended to cover leader nominations alongside membership requests).

By: vzhuman · 2026-07-31

## [TODO] IDEA-019 — Notify a contributor when their join request is decided
Idea:
When a Track Admin (or Admin) accepts or rejects a join request (IDEA-013/014), the requesting contributor is told the outcome — currently nothing surfaces the decision back to them at all.

Expected outcome:
- Some visible signal to the requester once their request is accepted or rejected — at minimum, a status shown on the track's page or their own profile; email is a possible channel given Resend is already wired up, but not assumed here.

Notes:
Depends on IDEA-013/014 for the decision this reports. Notification channel (in-app only vs. also email) is undecided.

By: vzhuman · 2026-07-31

## [TODO] IDEA-020 — Discord announcements bell icon
Idea:
Announcements are posted to a Discord channel, not duplicated into this app. A bell icon somewhere in the UI reflects whether the signed-in contributor's linked Discord account has unread messages in that channel; clicking it opens the channel in Discord.

Expected outcome:
- A bell icon, visible when the contributor has linked Discord.
- Indicates unread state in the announcements channel for that contributor's account, if Discord's API can expose that for a linked account.
- Clicking it opens the announcements channel in Discord — no announcement content is ever rendered inside this app.

Notes:
Open question, needs research before committing to this shape: can Discord's API report per-channel unread state for an arbitrary linked account from a server-side integration, or only from a client the user is actually running? If not, this idea reduces to a plain static link to the channel with no unread indicator.

By: vzhuman · 2026-07-31

## [TODO] IDEA-021 — Leave the community (self-service)
Idea:
A contributor can remove themselves entirely. Their status becomes `left`, non-private fields get a `#left#ddmmyy-hhmmss` postfix, and private fields (Full Name, Email) are masked rather than deleted outright — e.g. "John Doe" → "J**** D****", "john.doe@gmail.com" → "j****@g****.com".

Expected outcome:
- A self-service "Leave the community" action, available to a signed-in contributor for their own row only.
- Sets `status` to a new `left` value.
- Full Name and Email are masked: each space-separated name part, and each of the email's local-part and domain-before-the-first-dot, becomes its first letter followed by four asterisks (matching the examples given); the rest of the email (the dot and TLD) is left intact.
- Non-private fields get a `#left#ddmmyy-hhmmss` postfix appended, timestamped to when they left.

Notes:
Open question from the request itself: which fields count as "non-private" for the postfix — GitHub username, Discord username, and company were suggested, but not confirmed.
Gap not covered by the request: Telegram phone number is on the contributor record and reads as at least as private as email — needs an explicit decision (masked like email, treated as non-private with a postfix, or cleared outright), not left implicit.
Masking rule above is my best reading of the two worked examples, not a formal spec — worth confirming against a few more real names/emails (short names, single-word emails, a domain with no dot before the TLD) before building it.
Written here as lowercase `left` to match the existing `draft`/`confirmed` convention (CONTRIBUTOR_STATUSES) rather than the literal uppercase `LEFT` — flag if uppercase is actually wanted.
Same single-writer concern as IDEA-012: `status` is currently owned by the cf-internal registry file, and this is a second, self-service writer to it.

By: vzhuman · 2026-07-31

## [TODO] IDEA-022 — Audit log for admin operations
Idea:
A record of every admin/Track-Admin action taken through the app — Confirm/Block (IDEA-012), Accept/Reject (IDEA-014) — so there's accountability for who changed what and when.

Expected outcome:
- Every such action is logged: who did it, to whom, what changed, and when.
- Visible to Admins (scope for Track Admins — their own tracks only, or none at all — undecided).

Notes:
Registry-file-driven changes (editing pass/contributors.yaml or pass/tracks.yaml directly) already have their own audit trail via git history — this idea covers only actions taken in-app, which don't.
Depends on IDEA-012/014 existing as the actions being logged.

By: vzhuman · 2026-07-31


## [DONE] [frontgeeks] IDEA-023 — Idempotent email confirmation link
Idea:
A confirmation link stops working the moment anything touches it once (confirmEmail consumes the token before checking anything), and every resend rotates the token, killing all previously sent emails. Real failure seen in production: contributor pressed Confirm twice, opened the newest email, got "That confirmation link is not valid" while the address was in fact confirmed by an earlier request (link scanner or double navigation). Fix: confirmEmail reports already-confirmed as success instead of invalid and no longer destroys the token on success; resendConfirmationEmail re-sends the existing unexpired token instead of rotating it.

Result: PR https://github.com/constructorfabric/fabric-pass/pull/6 (merged as d62d49c)

Task: https://github.com/constructorfabric/fabric-pass/issues/5

By: frontgeeks · 2026-08-03

## [DONE] [frontgeeks] IDEA-024 — LinkedIn on the contributor profile
Idea:
Add LinkedIn to the contributor profile alongside GitHub/Discord/Telegram, so community members can reach each other professionally. Open question: a linked account via OAuth like Discord/Telegram, or a typed profile-URL field — LinkedIn's OAuth (OpenID Connect) readily proves account ownership, but its API is restrictive, so the typed field may be the pragmatic start.

Notes:
Creating the LinkedIn application itself (developer-portal app, OAuth credentials for the deploy env) is a companion task owned by vzhuman: https://github.com/constructorfabric/fabric-pass/issues/8.

Result: PR https://github.com/constructorfabric/fabric-pass/pull/10 (merged; landed as 478867e..c97db50). Feature stays hidden on a deploy until LINKEDIN_CLIENT_ID/SECRET are both set (issue #8).

Task: https://github.com/constructorfabric/fabric-pass/issues/7

By: frontgeeks · 2026-08-04

## [DRAFT] [vzhuman] IDEA-025 — Staging environment for pre-merge verification
Idea:
A staging environment — a running deployment of the app, separate from production, so a change can be verified end-to-end (real Docker image, real Postgres, real OAuth sign-in, real Caddy/TLS) before it's merged to `main` and goes live.

Expected outcome:
- A change can be deployed somewhere real and clicked through — sign in, autosave, provider linking, email confirmation — before it reaches `pass.cfabric.org`.
- Staging never holds real contributor data and never touches the real cf-internal registry.

Recommended approach:
- A second, minimal droplet (~$6/mo, same 1 vCPU/1GB spec and hardening as production — see `cfabric-pass-setup.md`), at its own subdomain (e.g. `staging.pass.cfabric.org`), running the same Compose stack under a different `COMPOSE_PROJECT_NAME`.
- Its own, empty Postgres — never a copy of production data. If a test needs data, seed synthetic contributors, not real ones.
- Its own OAuth app registrations at GitHub/Discord/Telegram (and LinkedIn once IDEA-024 lands) — a redirect URL is bound to one exact domain (see the setup doc), so staging genuinely needs its own four app registrations, not a shared one. This is the real recurring cost of doing this properly.
- `RESEND_API_KEY` left unset on staging (confirmation emails log instead of send) unless someone specifically needs to test the email path, so test traffic doesn't burn Resend's send quota or deliverability reputation.
- `CONTRIBUTORS_EXPORT_SECRET`/`CONTRIBUTORS_SYNC_SECRET` left unset — staging should never write into or read from cf-internal's real `pass/contributors.yaml`.
- Deploy trigger: a second, near-identical GitHub Actions workflow that builds and deploys to the staging droplet on push to an open PR targeting `main` (or on manual `workflow_dispatch`), rather than a separate long-lived staging branch that can drift from `main`. Only one PR's changes live on staging at a time — a queue, not a blocker, for a team this size.

Notes:
Main cost/friction: doubles the monthly hosting bill and, more significantly, requires four more OAuth app registrations to create and keep in sync with production's redirect-URL pattern.
Alternative considered and rejected: a second stack on the *same* droplet. Production already needed a 2GB swap file just to run one stack comfortably (see the setup doc's Swap section) — a second concurrent Postgres+Next.js stack on the same 1GB box is a real OOM risk, not just an inconvenience.
Alternative considered and rejected: true per-PR ephemeral environments (a fresh subdomain per PR, torn down on merge). Doesn't fit this app's OAuth-gated design — every provider requires an exact, pre-registered redirect URL, so a genuinely ephemeral per-PR domain can't complete an OAuth flow without registering (and cleaning up) an app per PR, which is more overhead than it saves.

By: vzhuman · 2026-08-04

## [DONE] [vzhuman] IDEA-026 — Fix silently-broken redeploys from a full disk
Idea:
Production had been stuck 24 hours behind despite ~15 successful CI runs in between — every pull was failing with "no space left on device" (disk 99% full, 32 dangling images from five days of un-pruned deploys, 17.47GB reclaimable). The webhook logged the failure but nothing surfaced it, and the app container just kept serving whatever it already had, so the outage was invisible until someone actually compared "workflows completed" against "what's actually live."

Expected outcome:
- Disk freed and today's actual latest commit deployed to production immediately.
- The webhook prunes dangling images after every successful deploy, so this can't silently recur.

Result: commit eab2d08 (deploy/webhook/server.mjs) — https://github.com/constructorfabric/fabric-pass/commit/eab2d08

By: vzhuman · 2026-08-04

## [DRAFT] [vzhuman] IDEA-027 — Droplet operational metrics, sourced
Idea:
Expose the production droplet's CPU, RAM, disk usage, and disk I/O to the app server-side, so IDEA-028's footer section has something real to display.

Expected outcome:
- CPU, RAM, disk usage, and disk I/O utilization are readable from the app as percentages, refreshed periodically rather than fetched live on every page load.
- Disk usage is read as a current snapshot, not averaged — it moves slowly and steadily (today's IDEA-026 incident was a gradual fill, not a spike), so an hourly average would blur exactly the moment it matters, crossing a threshold.
- CPU, RAM, and disk I/O are averaged over the last hour — all three genuinely fluctuate minute to minute, and an hourly average smooths that noise without going so long (e.g. 24h) that a real, ongoing spike gets diluted into invisibility.

Notes:
Recommended source: DigitalOcean's Droplet Monitoring API, via a read-only DO API token (a new deploy secret, staged the same optional way as RESEND_API_KEY/LINKEDIN_CLIENT_ID). Open prerequisite to verify: DO's monitoring metrics require the `do-agent` installed on the droplet — unconfirmed whether it's already present on this one (not part of cfabric-pass-setup.md's server-base-setup steps).
Alternative considered and rejected: reading `/proc`, `/sys`, or Docker stats directly from inside the app container, which would need mounting host paths or the Docker socket into the app — the same "host-root-equivalent power" already flagged as a real risk for the webhook container (cfabric-pass-setup.md's Implementation notes under Step 6), and the app is the public-facing, larger-attack-surface service, not a narrow bearer-token-gated one. Calling out to the DO API instead keeps the app itself unprivileged.
Depends on nothing existing in this app yet; IDEA-028 depends on this.

By: vzhuman · 2026-08-04

## [DRAFT] [vzhuman] IDEA-028 — Admin-only droplet status section in the footer
Idea:
A section in the app's footer, visible only to Organization Admins, showing the production droplet's operational status — CPU, RAM, disk, and disk I/O (IDEA-027) — as four independent color-coded boxes (green/yellow/red), each with a hint on hover/tap showing its exact percentage.

Expected outcome:
- Only visible to a signed-in Admin (IDEA-011) — a plain Contributor or Track Admin never sees it.
- Four boxes: CPU, RAM, Disk, Disk I/O — each colored independently by its own value against its own threshold, not one blended overall status.
- Hovering (or tapping, on touch) a box shows its exact percentage.

Notes:
Suggested thresholds, not confirmed: green < 60%, yellow 60–85%, red > 85% — reasonable defaults, but worth agreeing on deliberately rather than treating these as settled.
Depends on IDEA-027 for real data to show, and IDEA-011 for the Admin role to gate on.

By: vzhuman · 2026-08-04

## [DONE] [vzhuman] IDEA-029 — Fix production 500 from a new required env var never added to the droplet
Idea:
IDEA-010/011/012's deploy (commit 3cb589c) added `TRACKS_SYNC_SECRET` as a required environment variable but the value was never added to the production droplet's `.env` before pushing — every request 500'd immediately after deploy, since `env.ts` validates the whole environment at module load and fails the entire app, not just the tracks routes, on one missing required variable.

Expected outcome:
- Production serving 200s again, with `TRACKS_SYNC_SECRET` actually present on the droplet.

Result: generated the secret directly on the droplet (`openssl rand -hex 32` appended to `/opt/fabric-pass/.env`) and force-recreated `app` — confirmed `/`, `/admin`, and `/profile` all back to 200 with no errors in `docker compose logs app`. Self-inflicted and caught within minutes of the deploy, not an independent discovery — recorded so the brief production 500 has a paper trail, and as a reminder: a new *required* env var needs to land on the target environment before the commit that requires it ships, not after.

By: vzhuman · 2026-08-05

## [TAKEN] [vzhuman] IDEA-030 — Wire up cf-internal's tracks.yaml and populate initial tracks
Idea:
IDEA-010 built the app-side one-way tracks sync (`/internal/tracks/sync`), but cf-internal never got the operational half: `pass/tracks.yaml` doesn't exist, the push-triggered workflow only watches `pass/contributors.yaml`, and `TRACKS_SYNC_SECRET` isn't set as a cf-internal Actions secret. This wires all three up and populates the initial set of real tracks (Studio, Insight, Gears, Gears BSS, Gears OSS, Research, Governance) with their leaders, admins, and repositories from the Constructor Fabric GitHub org.

Expected outcome:
- `pass/tracks.yaml` exists in cf-internal with the seven tracks above, repositories distributed across them, and descriptions drawn from constructorfabric.org.
- The workflow notifies fabric-pass on a `pass/tracks.yaml` push, same as contributors.
- `TRACKS_SYNC_SECRET` is set as a cf-internal Actions secret, matching the value already on the production droplet.
- The tracks table in production reflects the file after the first sync.

Task: https://github.com/constructorfabric/fabric-pass/issues/17

By: vzhuman · 2026-08-06

## [TAKEN] [frontgeeks] IDEA-031 — Local dev sign-in without OAuth
Idea: Signing in on a local checkout currently needs its own registrations at GitHub, Discord and Telegram, since each redirect URI must match `APP_URL` exactly — a route that puts an existing contributor's `github_id` straight into the session, refusing to run anywhere but a local development server, would let a developer reach the signed-in and Admin views without any of that.

Task: https://github.com/constructorfabric/fabric-pass/issues/18

By: frontgeeks · 2026-08-06

## [DRAFT] [vzhuman] IDEA-032 — Community & track artifact links registry (cf-internal pass/*.yaml)
Idea:
A one-way-synced registry file in cf-internal's `pass/` folder, alongside `tracks.yaml`/`contributors.yaml`, listing links to interesting artifacts — both community-wide (e.g. policies) and per-track (e.g. vision, roadmap, meeting schedule) — without storing the artifacts themselves. Each entry is a label plus a URL pointing at wherever the real content actually lives: the governance repository for community policies, any repository under the `constructorfabric` org for a track's vision or roadmap, an external calendar for a meeting schedule, and so on.

Expected outcome:
- A synced table (mirroring `tracks`' one-way, file → DB, "file is the whole set" design from IDEA-010) holding entries with at minimum a label, a URL, and a scope (community-wide, or a specific track's slug).
- IDEA-006 (community policies), IDEA-007 (per-track links), IDEA-008 (roadmap diagrams), and IDEA-009 (meeting schedules) all read from this one registry instead of each inventing its own storage.

Notes:
Split out as its own idea rather than folded into IDEA-006/008/009 individually — it's one shared mechanism, not four separate storage designs.
Schema beyond the shape above is undecided: whether "scope" is a free-form track slug or an enum, whether entries carry a category (policy/vision/roadmap/schedule/etc.) for filtering or grouping, and whether one registry file covers everything or splits by concern (e.g. `pass/artifacts.yaml` vs. per-category files) are all open.
Depends on IDEA-010 (`tracks.yaml` already exists) for the per-track scoping to key against.

By: vzhuman · 2026-08-06
