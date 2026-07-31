---
name: ideas
description: Use before starting any substantive work in fabric-pass — a feature, a change, an experiment, or when the user says they'll take/do/start something («возьму», «сделаю», «начну», «давай сделаем») — and whenever ideas, ideas.md, or what to build next is discussed. Checks ideas/ideas.md for the idea's status and owner so collaborators never work on the same thing, records new ideas, claims an idea before implementation, and marks it done after.
---

# Ideas registry

`ideas/ideas.md` is the shared registry of project ideas and of who is working on
what. Several people collaborate on this repo through git; the file is the single
place to check before building anything. The push is the lock: a claim only counts
once it is on GitHub.

## File format

One `##` section per idea, with a metadata line right after the heading:

    ## 003 Short idea title
    **status:** in-progress · **owner:** dima · **by:** mckey · 2026-07-24

    Free-form description: what and why.

- The number is assigned once (max existing + 1) and never reused.
- **status** — see Statuses below.
- **owner** — who is doing (or intends to do) the idea; `—` when unclaimed.
  May be set at any status as a statement of intent; required for `in-progress`
  and `done`.
- **by** — who proposed the idea; **date** — when it was proposed. Both are set once
  and never change.
- Names are GitHub logins (`gh api user -q .login`; fallback `git config user.name`).
- No comment threads in the file — discussion outcomes are edited into the
  description; history lives in `git log ideas/ideas.md`.
- `dropped` and `parked` descriptions must keep one sentence saying why.

## Statuses

`proposed` → `approved` → `in-progress` → `done`; terminal `dropped` and `parked`
allowed from any status. `in-progress` requires an owner. Discussion is not a
status — a contested idea is edited in place.

## Before any substantive work — the check

1. `git pull` — the file is only meaningful when fresh.
2. Find the idea in `ideas/ideas.md` (quick overview: `grep -A1 '^## ' ideas/ideas.md`).
3. Report what you found:
   - **in-progress owned by someone else** — say who owns it and warn that starting
     means stepping on them. This is a warning, not a block: if the user insists,
     proceed, but suggest talking to the owner first.
   - **not in the file** — offer to add it: as `proposed`, or claimed directly if
     the user is starting on it now.
   - **dropped** — point at the recorded reason before re-opening it.

## Claiming an idea — starting work

1. `git pull`.
2. In the idea's metadata line set `**status:** in-progress` and `**owner:**` to
   your GitHub login.
3. Commit only this change — `ideas: NNN → in-progress (<owner>)` — and push
   **immediately**. An unpushed claim is invisible to everyone else.
4. Push rejected → `git pull --rebase`, then re-read the section: someone may have
   just claimed the same idea. If they did, stop and tell the user.

## Finishing

Set `**status:** done` (owner stays), add the PR or commit reference to the
description, commit
(`ideas: NNN → done`) and push. Same flow for `dropped` / `parked`, with the
one-sentence reason in the description.

## Stale claims

An `in-progress` idea with no related commits for about two weeks may be
re-claimed — but ask the current owner (or at least the user) before taking over.
