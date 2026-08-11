# Pulsely — project plan

## 1. Why this exists

The starting point is personal: I kept losing track of how much time tasks actually took versus what the backlog said. A kanban tells you _what_ needs doing and _what state it's in_, but nothing about how much work it actually cost — and editor heartbeats (WakaTime) tell you _how much time was spent coding_, but with no link back to a specific task or its status. Pulsely connects the two: a task sitting in "Today" and the minutes that actually went into it live in the same place.

## 2. Positioning

| Tool             | Kanban / statuses | Time tracking           | Editor heartbeats |
| ---------------- | ----------------- | ----------------------- | ----------------- |
| Linear / Todoist | ✅                | ❌                      | ❌                |
| Toggl Track      | ❌                | ✅ (manual)             | ❌                |
| WakaTime         | ❌                | ✅ (automatic)          | ✅                |
| **Pulsely**      | ✅                | ✅ (manual + automatic) | ✅                |

Pulsely doesn't compete head-on with any of the above — it sits at their intersection: a kanban that knows how much it actually cost to move a task to "Done", fed by data you're already generating while writing code.

## 3. User model

Multi-tenant, per-user. Every user has their own account (Supabase Auth) and sees only their own data — isolation enforced by Row Level Security in Postgres, not by application logic. No shared boards or teams in the MVP — deliberately deferred to the roadmap to keep scope tight.

**Auth**: magic link (the simplest login path) + Google OAuth (the same provider will later power the Google Calendar integration, so it's worth building once).

## 4. MVP scope

- **Kanban** — columns `Backlog` → `This Week` → `Today` → `Done`, moving tasks between statuses.
- **Manual time tracking** — start/stop timer per task, time log visible on the task.
- **WakaTime heartbeats ingest** — editor plugin (VSCode, JetBrains, …) pointed via `api_url` in `~/.wakatime.cfg` at the Pulsely endpoint instead of `api.wakatime.com`; heartbeats land in the database and get aggregated per project/task.
- **Time dashboard** — a simple view: how much time (manual + from heartbeats) went into a given task / day / week.

### Out of MVP (roadmap)

- Google Calendar integration (blocking calendar time based on tasks, or the reverse).
- Teams and shared boards.
- Notifications.
- Mobile app.

The roadmap is phased, with no hard dates — this is a side project built alongside other commitments, so a fixed schedule would just create false pressure.

## 5. Technical architecture

**Stack**: React (Vite), Supabase (Postgres + Auth + Realtime + RLS), TypeScript strict, Vitest + Playwright.

**No Edge Functions except one.** All CRUD (tasks, statuses, manual time entries) goes straight through Supabase's auto-generated REST/Realtime API from the client, secured by RLS. The one exception: the endpoint that accepts WakaTime heartbeats — wakatime-cli hits `POST /users/current/heartbeats.bulk` with `Authorization: Basic base64(apikey)` and a JSON array, a shape raw PostgREST can't replicate (different auth scheme, different path). This single Supabase Edge Function translates the request: decodes Basic Auth, maps the API key to a user, writes heartbeats to Postgres via the service role.

**Core entities** (conceptual level — detailed schema and migrations are a job for `/to-spec`):

- `task` — content, status (`backlog` / `this_week` / `today` / `done`), owner.
- `time_entry` — manual time entry: task, start, stop, source = manual.
- `heartbeat` — raw/aggregated WakaTime entry: task (matched by project/file), timestamp, source = wakatime.
- `ingest_token` — API key the user pastes into `~/.wakatime.cfg`, mapped to their account.

**Multi-tenancy**: RLS on every table — `auth.uid() = owner_id`, no exceptions on the application side.

## 6. Quality: TDD and Feature-Sliced Design

**FSD** as the directory structure:

```
src/
├── app/          # providers, routing, global styles
├── pages/        # board, dashboard
├── widgets/      # kanban-board, time-dashboard
├── features/     # move-task, start-timer, stop-timer, connect-wakatime
├── entities/     # task, time-entry, heartbeat
└── shared/       # ui-kit, api client, config
```

**TDD spotlight** — the places where logic is built test-first (the rest of the per-feature detail moves into separate `/tdd` sessions during implementation):

- Status transition rules (what's allowed, what isn't — e.g. can `done` be reverted).
- Heartbeat parser — mapping the raw WakaTime payload to the internal model (`heartbeat` → matched to a `task`).
- Time aggregation — summing `time_entry` + `heartbeat` per task/day/week.

## 7. Distribution

Default model: **self-host** — clone the repo, bring your own Supabase project, `.env` with keys. The README walks through the full setup step by step.

Optional, not required: a public demo on Vercel as a live link for the CV/portfolio — a decision to make closer to the end of the build, not a blocker for the MVP.

## 8. Open source

License: **MIT** (already in the repo). Fully public code from day one — that's the whole point of this project as a portfolio piece.

Briefly on the business model: no real monetization plan. The only forward-looking note is a hypothetical hosted "Pro tier" (paid hosting + integrations) as a possible direction if the project ever outgrew side-project status. That's a narrative touch, not a rollout plan.

## 9. Costs and maintenance

The Supabase free tier is enough for the entire development phase and single-person self-hosted use (500MB DB, request limits, the project pauses after a week of inactivity on the free tier — worth calling out in the README). Moving to a paid Supabase plan (Pro, from $25/mo) would only make sense with real traffic from a public demo. Hosting the frontend on Vercel's free tier covers demo needs at no extra cost.

## 10. Definition of "done" (CV-ready checklist)

- [ ] Tests (Vitest) passing on the core logic: status transitions, heartbeat parser, time aggregation.
- [ ] E2E tests (Playwright) cover the main path: log in → create a task → move it through statuses → start/stop the timer.
- [ ] A working demo (if published) or a clear, tested self-host guide.
- [ ] README with a GIF/screenshots, an architecture overview, and an FSD diagram.
- [ ] A minimum coverage threshold on domain logic (not UI).

## 11. Phased roadmap

**Phase 1 — core**: kanban + statuses + manual time tracking, auth (magic link + Google), RLS, tests on domain logic.

**Phase 2 — heartbeats**: ingest endpoint (Edge Function), WakaTime parser, matching heartbeats to tasks, time dashboard.

**Phase 3 — polish**: README, optional Vercel demo, checklist from section 10.

**Phase 4 — beyond MVP**: Google Calendar integration, teams, notifications, mobile.
