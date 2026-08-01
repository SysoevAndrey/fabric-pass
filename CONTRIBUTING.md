# Contributing

Thanks for working on Fabric Pass. This page covers the bits that aren't in
[README.md](README.md): how to identify yourself to the tooling, and how the
ideas registry coordinates work between contributors.

## 1. Identify yourself with `.author`

Several collaborative skills in this repository — most importantly the ideas
registry — need a stable identifier for each contributor. The format is a bare
identifier (for example `vzhuman`, `frontgeeks`) — no prefix.

### Where to put it

Create a file named `.author` in the repository root with **only** your
identifier on the first line:

```text
vzhuman
```

There should be nothing else in the file — no comments, no extra lines, no
prefix. The registry uses the value verbatim.

`.author` is listed in [`.gitignore`](.gitignore), so each contributor keeps
their own copy in their own checkout. **Do not commit `.author`.** It is
per-checkout state, not shared configuration.

### If `.author` is missing

Tools fall back to your local git configuration, in this order:

1. `git config user.name`
2. `git config user.email`

If neither yields a value, the skill stops and asks you for the identifier.
The fallback exists so a freshly cloned repo works without setup; the file
exists so you can override git config when you want.

### Where this identifier is used

Today: the ideas registry at [`ideas/ideas.md`](ideas/ideas.md) — every
heading, originator, and commit reference resolves back to this identifier.
Tomorrow: anywhere a human's stable handle is needed in tooling output.

## 2. Claim work through the ideas registry

Before touching code, specs, tests, migrations, or CI for any non-trivial
change, the work must be in [`ideas/ideas.md`](ideas/ideas.md) and claimed by
you. The protocol is defined in
[`.claude/skills/ideas/SKILL.md`](.claude/skills/ideas/SKILL.md). The short
version:

1. `git pull` so the registry is fresh.
2. Find the idea. If it doesn't exist, add it as `DRAFT` (or claim directly as
   `TAKEN`).
3. Claim it: edit the heading to set status `TAKEN` with your identifier.
4. Commit **only** the registry change (`ideas: claim IDEA-NNN by <id>`) and
   push immediately. An unpushed claim is invisible to others.
5. Start implementation only after that push is visible on the shared branch.
6. When done, set the heading to `DONE`, add a `Result` reference, commit,
   push.

Each idea stays one short section. If an idea would need a long description,
split it before recording it — the skill prefers many small ideas over one
large one.

## 3. House style

- Match the surrounding code; don't add comments, types, or error shapes that
  don't already exist in the file you're editing.
- Before deleting or overwriting, look at the target — if what you find
  contradicts how the change was described, surface that instead of pushing
  through.
- Prefer dedicated file/search tools over ad-hoc shell commands.

## 4. Questions, blockers, coordination failures

If the registry is missing, conflicted, or can't be pushed, stop and tell the
person coordinating the change. Don't work around a broken registry with
local-only commits or unmerged branches — coordination through git only
works when the registry is the single shared source of truth.
