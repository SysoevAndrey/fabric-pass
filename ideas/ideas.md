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

