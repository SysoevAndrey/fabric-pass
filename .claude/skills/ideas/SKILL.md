---
name: ideas
description: Use before any substantive work in fabric-pass — proposing, planning, specifying, implementing, testing, or reviewing — and whenever the user signals intent to take, do, or start something («возьму», «сделаю», «начну», «давай сделаем»), or when ideas.md is discussed. Treats ideas/ideas.md as the source of truth: every entry's owner is a human (no prefix), claim-then-push before code, split before padding. Trigger on «ideas», «ideas.md», «что делаем дальше», «next», «кто делает», «owner», «claim», «кто взял».
---

# Ideas registry

`ideas/ideas.md` is the shared registry of project ideas and of who is working on
what. Several people collaborate on this repo through git; the file is the
single place to check before building anything. The push is the lock: a claim
only counts once it is on GitHub.

## Identifiers

Every owner and originator in the registry is a human. There are no prefixes
in identifiers — they are bare logins.

```text
<identifier>
```

Examples: `vzhuman`, `frontgeeks`, `lobster40`.

The skill itself must never write an `agent:` prefix or a `human:` prefix in a
heading, body, example, or commit message. If you see one, it is a bug in the
file or in a legacy entry and must be removed before any other action.

### How to determine the local identifier

Read the first non-empty value, in this order, and stop:

1. `.author` in the repository root (one identifier per line; first line wins).
   `.author` is per-checkout state; it is listed in `.gitignore` so each clone
   can pick its own owner without touching the registry.
2. `git config user.name` from the working repo.
3. `git config user.email` from the working repo.
4. If none yields a value, stop and ask the user for the identifier — do not
   invent one.

Use the same identifier for the registry (headings, originator) and for the
commit author within a single check-out. Whatever the source returns is the
identifier; it is written into the registry verbatim, with no prefix added.

## File format

One `## ` section per idea. The heading carries status, owner, ID, and title:

```markdown
## [STATUS] [<owner>] IDEA-NNN — Short title
```

Rules:

- `STATUS` is one of `DRAFT`, `TODO`, `TAKEN`, `DONE`, `DROPPED`, `PARKED`.
- `<owner>` is required for `DRAFT`, `TAKEN`, and `DONE`. Omitted for
  `TODO`. Retained for `DROPPED` and `PARKED`.
- `IDEA-NNN` is permanent and never reused. New entries take the next number.
- Titles stay one short line; details go in the body.

Examples:

```markdown
## [DRAFT] [lobster40] IDEA-017 — Add organization invitations
By: frontgeeks · 2026-07-31

## [TODO] IDEA-018 — Add audit-log export

## [TAKEN] [frontgeeks] IDEA-018 — Add audit-log export

## [DONE] [vzhuman] IDEA-018 — Add audit-log export
Idea: Export the audit log to JSON or CSV for compliance reviews.
Expected outcome: Operators can pull the last 90 days of audit events from the admin UI or CLI.
Result: PR #184
By: frontgeeks · 2026-07-31
By: lobster40 · 2026-08-01
```

## Idea body — keep it small

**Default.** Most ideas fit in a single line:

```markdown
Idea: <one or two sentences: what and why.>
```

That is the whole body. Use it whenever "what" and "why" fit in a sentence or
two.

### Expanded body (opt-in, only when needed)

If the idea genuinely needs more — non-obvious constraints, acceptance
criteria, links, or coordination notes — use this template instead:

```markdown
Idea:
<one or two sentences: what and why.>

Expected outcome:
What should be true when the idea is complete.

Notes:
Constraints, open questions, links, or implementation context.

Task: <GitHub issue URL of the idea's project task — see "Project tasks">

Result:
PR, commit, specification, or other completion reference. Required for DONE.
```

### Split, don't pad

If the description would need the expanded form just to cram in multiple
unrelated changes, the idea is too big. Before recording it:

1. Split it into one idea per independently deliverable change.
2. Each child idea must itself fit the simple body.
3. The parent idea, if it's only a grouping, is dropped; cross-link via Notes
   if you need to point between siblings.

An oversized idea that can't be split is a signal to discuss it as a draft
first, not to record it as one big `DRAFT`.

### Attribution

A `By:` line records who proposed the idea and when. It lives at the end of
the body. The first line is frozen when the idea is written — to add another
author, append to it (e.g. `By: frontgeeks, lobster40 · 2026-08-01`).

A `Task:` line holds the URL of the idea's project task (see "Project
tasks"). It sits immediately before the `By:` lines, in the simple and the
expanded body alike.

## Statuses

`DRAFT` → `TODO` → `TAKEN` → `DONE`. `DROPPED` and `PARKED` are terminal and
allowed from any status; the body keeps one sentence saying why.

- **DRAFT** — being shaped, not approved for implementation. May be edited,
  reviewed, split, or refined. Do not implement.
- **TODO** — approved and available to claim. No owner.
- **TAKEN** — claimed; only the listed owner works on it.
- **DONE** — expected outcome delivered. The body has a `Result` reference.
- **DROPPED** — won't do. Body keeps the why.
- **PARKED** — postponed. Body keeps the why.

## Project tasks — CF Board

Every actionable idea (`TODO` and beyond) has a companion task: a GitHub
issue in `constructorfabric/fabric-pass`, added to the org project **CF
Board** — https://github.com/orgs/constructorfabric/projects/52. The links
are always bidirectional: the issue body links to the idea, the idea body
carries a `Task:` line with the issue URL.

**One idea — one task, forever.** Before creating anything, look the idea up
on the board by title (`gh project item-list 52 --owner constructorfabric
--format json --jq '.items[] | {id, title, type: .content.type}'`). If an
item titled `IDEA-NNN — …` already exists in any form, never create a second
one — update the existing item (convert, retitle, reassign) instead.

- **Idea recorded as `DRAFT`** — create a **draft item** directly on the
  board (`gh project item-create`), same title convention, body linking to
  the idea. Draft items have no URL of their own, so the idea carries no
  `Task:` line yet.
- **Idea becomes `TODO`** — the task becomes a real issue in
  `constructorfabric/fabric-pass`, with **no assignee**. If a board draft
  exists, **convert it in place** — do not open a parallel issue:

  ```bash
  gh api graphql -f query='mutation($item: ID!, $repo: ID!) {
    convertProjectV2DraftIssueItemToIssue(input: {itemId: $item, repositoryId: $repo}) {
      item { content { ... on Issue { url } } } } }' \
    -F item=<PVTI_ item id> -F repo=<repository node id>
  ```

  (repo node id: `gh api repos/constructorfabric/fabric-pass --jq '.node_id'`.)
  Only when no draft exists, create the issue fresh and `gh project item-add`
  it. Title: `IDEA-NNN — <idea title>`. Body: a link to `ideas/ideas.md`
  naming the IDEA-NNN, plus the one-line idea. Add the `Task:` line to the
  idea now.
- **Idea is claimed (`TAKEN`) or transferred** — create the task first if it
  doesn't exist yet, and set the issue assignee to the owner's GitHub login.
  Claiming yourself → assign yourself; transfer → reassign to the new owner.
- **Release** (`TAKEN` → `TODO`) — keep the task, remove the assignee.
- **`DONE` / `DROPPED` / `PARKED`** — close the issue (for `DROPPED`/`PARKED`
  leave a closing comment with the one-sentence why).

**Board column follows the idea status.** After creating or updating an
item, set its `Status` field: `DRAFT` → **Backlog**, `TODO` → **Todo**,
`TAKEN` → **In Progress** — or **In Test** once its implementation PR is
open (see "Finishing"), `DONE`/`DROPPED`/`PARKED` → **Done** (and the
issue is closed). Reading it back the same way: an item moved to Todo/In
Progress/Done by a human on the board is a status signal for the sync below.

Commands:

```bash
gh issue create -R constructorfabric/fabric-pass \
  --title "IDEA-NNN — <title>" [--assignee <owner>] --body "<link to idea>"
gh project item-add 52 --owner constructorfabric --url <issue-url>
# set the column (Status option ids: Backlog 5b786606, Todo f75ad846,
# In Progress 47fc9ee4, In Test 09d0e0a8, Done 98236657):
gh project item-edit --id <PVTI_ item id> \
  --project-id PVT_kwDOERGOus4Be9CB \
  --field-id PVTSSF_lADOERGOus4Be9CBzhZTfQw \
  --single-select-option-id <option id>
```

Adding or updating the `Task:` line in `ideas.md` is a normal registry edit —
commit it separately from the claim commit (`ideas: link task for IDEA-NNN`)
and push.

### Board → registry sync

The sync is two-way: people also move tasks directly on CF Board, and the
registry must follow. As part of the pre-work check (next section), after
`git pull`, also read the board state of any idea you're about to touch
(`gh issue view <n>` / `gh project item-list 52 --owner constructorfabric`)
and reconcile:

- Task **assigned** on the board (or moved to **In Progress**), idea still
  `TODO` → set `[TAKEN] [<assignee>]` in the registry.
- Task **unassigned** (or moved back to **Todo**), idea `TAKEN` → release
  the idea back to `[TODO]`.
- Task **reassigned**, idea `TAKEN` by someone else → record a transfer to
  the new assignee.
- Task moved to **In Test**, idea `TAKEN` → consistent: it means the idea's
  implementation PR is open (see "Finishing"). No registry change.
- Task **closed** or moved to **Done**, idea not terminal → move the idea to
  `[DONE]` (take the `Result` from the issue) — or ask the human whether
  it's `DROPPED`/`PARKED` if no result is visible.
- Draft item moved out of **Backlog** to Todo → the idea is approved:
  set it to `[TODO]`, convert the draft to an issue, add the `Task:` line.

Each reconciliation is its own commit — `ideas: sync IDEA-NNN from board` —
pushed immediately. If board and registry changed in conflicting ways, stop
and ask the human instead of picking a side.

## Before any substantive work — the check

1. `git pull` — the file is only meaningful when fresh.
2. Find the idea in `ideas/ideas.md` (quick overview: `grep '^## ' ideas/ideas.md`).
3. Report what you found, in this exact shape:
   - `Claimed IDEA-NNN as <id>; beginning work.`
   - `Continuing IDEA-NNN, already owned by <id>.`
   - `Blocked: IDEA-NNN is TAKEN by <other-id>.`
   - `Blocked: IDEA-NNN is DRAFT and not approved for implementation.`
   - `Recorded IDEA-NNN as DRAFT; implementation has not started.`
   - `IDEA-NNN is DONE; a new follow-up idea is required.`

   Always state the idea ID, status, and owner before starting work.

If no matching item exists, offer to add the idea as `DRAFT` (or directly as
`TAKEN` if the user is claiming it now). Do not start work on an idea that is
not in the registry.

## Claiming an idea — starting work

1. `git pull`.
2. Confirm immediately before editing that the heading is still `[TODO]`.
3. Change only the heading: `[TODO]` → `[TAKEN] [<your-id>]`.
4. Commit only this change — `ideas: claim IDEA-NNN by <id>` — and push
   **immediately**. An unpushed claim is invisible to everyone else.
5. Push rejected → `git pull --rebase` and re-read the section. If someone has
   claimed it first, stop and tell the user.
6. Sync the project task (see "Project tasks"): create the issue if the idea
   doesn't have one yet, assign it to the new owner, and make sure the idea's
   `Task:` line points at it — that line lands in its own commit
   (`ideas: link task for IDEA-NNN`), pushed right after the claim.

The claim commit must contain no code, tests, or unrelated registry edits.

## Finishing

Implementation lands through a pull request, not a direct push to `main` —
only registry edits (claims, links, syncs, completions) go straight to `main`.

**When the implementation PR opens:**

1. Open the PR from the idea's branch (branch name `idea-NNN-<short-slug>`).
2. Move the linked task's board item to **In Test**. The idea itself stays
   `[TAKEN]` — the registry has no in-test status; the board column carries it.

**Only after the PR merges:**

1. `git pull` and verify the heading is still `[TAKEN]` by you.
2. Add the `Result` reference — the merged PR.
3. Set `[TAKEN]` → `[DONE]`, keeping the owner token.
4. Commit `ideas: complete IDEA-NNN` and push.
5. Close the linked project task and move its board item to **Done**
   (see "Project tasks").

A PR closed without merging is not a completion: the idea stays `[TAKEN]`
(or is released back to `[TODO]` — see below), and the board item goes back
to **In Progress**.

Same flow for `DROPPED` / `PARKED`: keep one sentence in the body that says
why, and close the task with that sentence as a comment.

## Releasing, transferring, stale claims

- **Release** — set `[TAKEN]` back to `[TODO]`, drop the owner token, add a
  short note about partial work, commit, push. Remove the assignee from the
  linked project task, keep the task open.
- **Transfer** — explicit agreement from old and new owners (or a human
  coordinator). Replace the owner while keeping `[TAKEN]`, record the transfer
  in the body, commit, push before the new owner starts. Reassign the linked
  project task to the new owner.
- **Stale** — a `TAKEN` idea with no related commits for ~14 days is a review
  trigger, not automatic permission to take it. A human coordinator moves the
  item back to `TODO`; the agent does not start until that push is on the
  remote branch.
