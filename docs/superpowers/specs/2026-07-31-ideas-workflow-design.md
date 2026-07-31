# Ideas Registry Workflow — Design

**Date:** 2026-07-31
**Status:** Approved

## Purpose

`ideas/ideas.md` is the shared registry of project ideas for the three (or more) people
working on fabric-pass. It tracks each idea from proposal to completion, and — critically —
records who is working on what, so two people never build the same thing or step on each
other. Before any substantive work, the file is checked; taking an idea into work is
recorded and pushed immediately.

## Scope

- One markdown file, `ideas/ideas.md`, synchronized through ordinary git pull/push
  to GitHub. All collaborators work through git + Claude Code.
- A project skill (`.claude/skills/ideas/SKILL.md`), shipped in the repo so every
  clone gets it, teaches Claude the check/claim/finish protocol.
- A short section in the root `CLAUDE.md` backs the skill up so the check happens
  even when the skill does not trigger.

### Non-goals

- No per-idea files, no index, no generated views — a single file is fine at this
  team size; splitting is the migration path if the file outgrows itself.
- No GitHub Issues integration.
- No hard enforcement (hooks, CI). The check is advisory: Claude warns when an idea
  is owned by someone else but never refuses to work.

## File format

One `##` section per idea. The heading is `## NNN Title`; the line after it carries
labeled metadata; then a free-form description. No comment threads in the file —
discussion outcomes are edited into the description, history lives in `git log`.

    ## 003 CSV export for admins
    **status:** in-progress · **owner:** dima · **by:** mckey · 2026-07-24

    Endpoint `/api/export.csv` behind an env-var token, streamed.

`owner` is who is doing (or intends to do) the idea — settable at any status as a
statement of intent, required for `in-progress`/`done`, `—` when unclaimed. `by` and
the date record who proposed the idea and when, set once. Names are GitHub logins.

Numbers are assigned once (max existing + 1) and never reused. `dropped` and `parked`
descriptions must keep one sentence saying why.

## Statuses

`proposed` → `approved` → `in-progress` → `done`; terminal `dropped` and `parked`
allowed from any status. `in-progress` requires an owner. Discussion is not a status —
a contested idea is edited in place.

## Coordination protocol

The push is the lock. Checking is soft; publishing a claim is the one hard rule,
because an unpushed claim is invisible to the other collaborators.

- **Check (before any substantive work):** `git pull`, find the idea, report status
  and owner. Owned by someone else → warn, don't block. Missing → offer to add it.
- **Claim:** set `in-progress — <git config user.name>`, commit that change alone
  (`ideas: NNN → in-progress (<owner>)`), push immediately. Push rejected →
  `pull --rebase`, re-check the section: someone may have claimed it first.
- **Finish:** set `done — <owner>`, add the PR/commit reference to the description,
  push. Same flow for `dropped`/`parked` with a one-sentence reason.
- **Stale claims:** `in-progress` with no related commits for ~2 weeks may be
  re-claimed after asking the owner.
