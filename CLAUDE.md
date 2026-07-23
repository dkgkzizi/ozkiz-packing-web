@AGENTS.md

# Autonomous commit & deploy

The user has authorized committing and pushing to `main` (which auto-deploys via the
connected Vercel project) without asking for confirmation each time. When making
changes in this repo:
- Stage only the files relevant to the current change (never a broad `git add -A`) —
  this repo tends to accumulate unrelated WIP (e.g. `scratch/`, in-progress feature
  folders); leave those untouched unless the user is explicitly working on them.
- After verifying the change (typecheck/build, and a visual check for UI changes),
  commit, push to `main`, and confirm the Vercel deployment status before reporting
  back — don't just push and assume it succeeded.
- Still avoid destructive git operations (force-push, reset --hard, etc.) without
  explicit confirmation — this authorization covers routine commit+push+deploy only.
