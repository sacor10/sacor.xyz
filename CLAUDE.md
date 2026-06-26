# Project guidance for Claude

## Work directly on `main` for local changes

Make all local code changes directly on the `main` branch. Do **not** create
feature/working branches and do **not** open pull requests automatically.

- This applies to any change: features, fixes, refactors, config, hooks,
  scripts, docs, etc.
- Do not auto-spawn branches (including when using sub-agents). Stay on `main`.
- If a branch already exists for in-progress work, move the changes onto `main`
  and delete the stray branch.
- The user pushes `main` themselves when finished. Only open a PR if the user
  explicitly asks for one in that conversation.

Rationale: scattering work across many branches caused frequent merge conflicts.
Keeping everything on `main` avoids that.
