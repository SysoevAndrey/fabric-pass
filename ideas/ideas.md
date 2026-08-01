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

