# Fabric Pass — Ideas

<!-- One "## [STATUS] [<owner>] IDEA-NNN — Title" section per idea.
     Statuses: DRAFT → TODO → TAKEN → DONE. Terminal: DROPPED, PARKED.
     Owner required for DRAFT/TAKEN/DONE; omitted for TODO; retained for DROPPED/PARKED.
     Identifier is a bare login (no prefix); the registry uses the value verbatim.
     Body must fit in a single "Idea:" line by default; pad only when the simple
     form genuinely won't carry the information, otherwise split into multiple ideas.
     Format and rules: .claude/skills/ideas/SKILL.md -->

## [DRAFT] [vzhuman] IDEA-000 — Improve profile view & editing logic
Idea:
Default the profile form to a locked, view-only mode instead of always-editable, to avoid accidental edits. A pencil-icon "Edit" button ("Modify profile" hint), top-right of the form on the same line as the "Contributor Profile" title, switches it into edit mode — today's always-editable behavior, unchanged autosave, unchanged title. A "Save" button, shown only in edit mode, switches the form back to view-only mode.

Expected outcome:
- View-only mode is the default on load; fields aren't editable and provider links can't be changed until Edit is pressed.
- Edit button (pencil icon + "Modify profile" hint) sits top-right, same line as the title, and switches to edit mode.
- Save button (edit mode only) switches back to view-only mode.
- Pressing Save enforces the mandatory fields — Name and Email must be filled in, or Save is blocked and the contributor is prompted to fill them in.

By: vzhuman · 2026-07-31

## [TODO] IDEA-001 — Dedicated profile page
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

By: frontgeeks · 2026-07-31
By: vzhuman · 2026-07-31

## [TODO] IDEA-002 — Review of the database–git data exchange process
Idea: Review how data flows between the Postgres database and git (the cf-internal registry sync): what is exported, what is imported back, and whether the process holds up.
By: frontgeeks · 2026-07-31

## [TODO] IDEA-003 — Root user configured via env by GitHub ID
Idea: A root user for the app, designated by GitHub ID through an environment variable.
By: frontgeeks · 2026-07-31

## [DRAFT] [vzhuman] IDEA-004 — Public contributor profile view
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

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-005 — Contributor search on Main page
Idea:
A search box on the Main page for finding other contributors, opening the matching one in the profile view (IDEA-004).

Expected outcome:
- Matches against name, email, GitHub username, GitHub email, Discord username, and Telegram username.
- Live results appear once 3–4+ characters are typed, capped at the 5 best matches.
- Selecting a result opens that contributor's profile view (IDEA-004).

Notes:
Depends on IDEA-004 for the destination page.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-006 — Community rules & policies on Main page
Idea:
A section on the Main page listing Constructor Fabric's community-wide rules and policies, most likely as links into the public governance repository's markdown documents, possibly alongside links to individual tracks' own policies.

Expected outcome:
- A visible list of policy/rules links on the Main page.
- Each link points at a markdown document in the governance repository.

Notes:
Open question, not yet decided: does a link navigate straight to the document (e.g. on GitHub), or open it rendered inside this app, in a new tab, with a link back to the source repository?
Track-specific policy links, if any, are out of scope until IDEA-007's track directory exists to hang them off of.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-007 — Track directory on Main page
Idea:
A directory of Constructor Fabric's tracks (Studio, Insight, Gears — with Gears Core/OSS/BSS/FrontX/Mobile as sub-tracks —, Research, Governance), each with a summary, its leaders and their roles, and links to its repositories.

Expected outcome:
- Every track (and sub-track) shows: a short summary of what it's about, its leaders with role (Product Manager, Architect, Developer, Researcher, etc.), and its repositories, each with a short description and a link to its issue tracker.

Notes:
Proposed addition, beyond what was asked — confirm before including: a link to the track's own community/discussion channel (e.g. its Discord channel), and a short "how to get involved" pointer. Both are cheap to add alongside the rest of this directory and squarely useful for a new contributor.
Roadmap diagrams (IDEA-008) and call schedules (IDEA-009) build on this directory rather than being part of it.
Depends on IDEA-010 for the underlying tracks data — nothing to display until that exists.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-008 — Track roadmap diagrams
Idea:
A roadmap diagram for each track, shown on its entry in the track directory (IDEA-007).

Expected outcome:
- Each track in the directory shows, or links to, a roadmap diagram reflecting its current plan.

Notes:
Depends on IDEA-007 for the directory to attach to. Diagram source/format (static image, embedded tool, generated from a tracked file) is undecided.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-009 — Track meeting schedules
Idea:
Each track's recurring calls, shown on its entry in the track directory (IDEA-007): daily sync-up, regular community update/demo call, and regular planning call.

Expected outcome:
- Each track in the directory lists its daily sync-up schedule, its regular community call schedule (updates and demos), and its regular planning call schedule.

Notes:
Depends on IDEA-007 for the directory to attach to. Whether schedules link out to an external calendar or are entered/maintained here directly is undecided.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-010 — Tracks data & cf-internal sync
Idea:
A `tracks` concept in the database, mirrored to and from a new file in cf-internal (`pass/tracks.yaml`), following the same pattern as the existing contributors registry sync.

Expected outcome:
- Each track has: a name, a description, a list of repositories (each with its own short description and issue-tracker link — matching what IDEA-007 already promised to display), and up to five named leader slots — Product Manager, Architect, Developer, Quality, Researcher — each independently either empty or pointing at exactly one contributor.
- A contributor can hold a leader slot on more than one track at once (e.g. Architect on one track, Product Manager on another).
- Synced with cf-internal's `pass/tracks.yaml`, mirroring `pass/contributors.yaml`'s bidirectional, single-writer-per-field design.

Notes:
The per-repository description/issue-tracker-link fields go beyond the source request's bare "list of repositories" — added because IDEA-007 already promised to display them, and they need somewhere to live. Confirm before building.
Prerequisite for IDEA-007/008/009 (nothing to display until this data exists) and for IDEA-011's Track Admin role, IDEA-013's join requests, and IDEA-014's per-track membership.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-011 — Contributor roles: Contributor / Track Admin / Admin
Idea:
Three levels of access: Contributor (default), Track Admin (scoped to one or more specific tracks), and Admin (internally "Organization Admin," but just "Admin" in the UI).

Expected outcome:
- Every contributor is a plain Contributor by default.
- Admin is a global role, held by zero or more contributors.
- Track Admin is per-track, not global — a contributor can be Track Admin of more than one track at once, and a track can have more than one Track Admin.
- Admin and Track Admin unlock additional pages/page-sections beyond what a plain Contributor sees (specifics in IDEA-012 and IDEA-014).

Notes:
Depends on IDEA-010 for tracks to scope Track Admin against.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-012 — Admin: full contributor list with Confirm/Block
Idea:
A page, visible only to Admins, listing every contributor — unlike the plain-Contributor view, which only gets search (IDEA-005) with no full table. Admins can Confirm or Block a contributor from this list, changing their status.

Expected outcome:
- Admin-only page: the full contributor table, plus the same search as IDEA-005.
- Confirm and Block actions per row, each changing that contributor's status.

Notes:
`status` (draft/confirmed) is currently owned entirely by the cf-internal registry file — the app only ever reads it, never writes it (see README's "Contributors registry sync"). Confirm changing it from the app UI, and Block being a new status value at all, both need reconciling with that single-writer model before implementation: either this action becomes a second writer (and the sync direction for `status` has to change), or "Confirm"/"Block" here mean proposing a change that flows back out through the existing export instead of writing directly. Worth deciding before implementation.
Depends on IDEA-011 for the Admin role itself.

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-013 — Request to join a track
Idea:
A contributor can request to join a track from that track's page. The request is stored, synced to cf-internal, and visible to that track's Track Admin(s) (and to Admins).

Expected outcome:
- A "Request to join" action on a track's page (IDEA-007), available to any signed-in contributor.
- The request is persisted and synced into cf-internal alongside the rest of the tracks data (IDEA-010).
- Pending requests are visible to that track's Track Admin(s) and to Admins — see IDEA-014 for where they act on them.

Notes:
Depends on IDEA-010 (tracks must exist) and IDEA-007 (the track page this is requested from).

By: vzhuman · 2026-07-31

## [DRAFT] [vzhuman] IDEA-014 — Track Admin: member list & join-request review
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

