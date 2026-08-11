## Conventions

### File naming

Within a slice folder (entity/feature/widget), split by concern using a `<name>.<kind>.ts(x)` suffix instead of dumping everything in one file:

- `.hooks.ts` — React hooks
- `.data.ts` — TanStack Query queries/mutations
- `.types.ts` — TypeScript types/interfaces
- `.schema.ts` — Valibot validation schemas
- `.utils.ts` — pure helper functions

Example: `task-card.hooks.ts`, `task-card.data.ts`, `task-card.types.ts`.

## Agent skills

### Issue tracker

Issues are tracked on GitHub via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
