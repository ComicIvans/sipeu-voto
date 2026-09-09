# Votaciones SIPEU — Agent Instructions

## Project Overview

Internal voting web app for **SIPEU** (Simulación del Parlamento Europeo en Canarias). One-off tool for ~30 people during a few days; optimise for speed and clarity over scalability.

Goals:

- Public pages (no login) for committees, plenary, votes, their status and results.
- Delegates log in with email + password, vote in their committee's votes and in plenary votes.
- Admins manage users (CSV import, password reset by email, suspension, photo moderation), committees, parliamentary groups and votes (open/close, options, result rules).
- Results are shown in three levels: totals, by parliamentary group, and per person (vote is public).
- Spanish only. No SEO (`noindex`). Dark mode supported.

---

## Tech Stack

- **Framework:** Nuxt 4 + Nitro server routes
- **UI:** Nuxt UI v4 + Tailwind CSS 4 (icons: `lucide`, `simple-icons`)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** `better-auth` (email + password, `admin` plugin for roles/bans), Drizzle adapter
- **Real-time:** Server-Sent Events via in-process EventEmitter (single instance only)
- **Email:** `nodemailer` (SMTP from env; logs to console when unconfigured)
- **Images:** `sharp` (avatars → 512×512 WebP)

---

## Repository Structure

```
app/
  components/       Vue components (VoteChart, VoteResults*, BallotPanel, admin/*)
  composables/      useAuth, useSSEConnection (+ useLiveRefresh), useFormatting, useApiError, useDragReorder, useFlip, useCountUp
  layouts/          default.vue (public/user) + admin.vue (UDashboard*)
  middleware/       auth.global.ts (protects /votar, /perfil, /admin)
  pages/            index, c/[slug], v/[id], login, votar/, perfil, admin/**
server/
  api/              Nitro routes: public, me/** (user), admin/** (admin), auth/[...all]
  middleware/       auth.ts (path-prefix guard for /api/admin and /api/me)
  plugins/          seed.ts (committees, groups, first admin), shutdown.ts, voteSchedule.ts (scheduled open/close)
  routes/           health.ts, avatars/[filename].ts (serves every stored image)
  utils/            auth, requireAuth, voteResults, password, mailer, images, settings, csvImport, sseManager…
  validation/       Zod schemas
  db/               schema.ts, index.ts
shared/
  constants/        links.ts, routes.ts, voteOptions.ts, icons.ts
  types/            api.ts (API response types shared by server and app), sseEvents.ts
  utils/            config.ts, countUp.ts, names.ts, votePresentation.ts, voteStatus.ts, voteSchedule.ts, winnerCalculation.ts
drizzle/            Migrations
tests/              unit/ (Vitest) and smoke.mjs (end to end against a running server)
ops/                migrate.mjs, start.mjs, backup.sh, restore.sh
deploy/nginx/       NGINX example
```

---

## Language & Content Rules

- All code and code comments in **English**.
- All user-facing text in **Spanish**, written inline (no i18n module).
- API error messages live in `server/utils/apiErrorMessages.ts`; throw with `apiError(status, key)`.

---

## Domain Rules

- `users.role` is `admin` or `delegate`. Delegates must have a committee and a group (enforced in create/update/import). `users.banned` = suspended (no login, no vote, excluded from the census).
- A user is **eligible** for a vote when not banned, has a committee, and the vote is plenary (`committeeId = null`) or matches their committee. Admins vote too if they have a committee.
- Vote status (`shared/utils/voteStatus.ts`): `pending` (never opened), `open`, `closed`. Reopen keeps ballots; `reset` (closed only) deletes them; `duplicate` creates a pending copy.
- Optional schedule: `votes.opens_at` / `votes.closes_at`. `open` stays the only source of truth for whether a vote is open; the schedule is a hint applied by the ticker in `server/plugins/voteSchedule.ts` every 10s, inside one transaction under a `pg_advisory_xact_lock`. The rules live in `shared/utils/voteSchedule.ts` and the manual endpoints call the same functions: opening spends `opensAt` and drops a `closesAt` already in the past, closing clears both, and a window that elapsed while the app was down expires instead of opening the vote late. A scheduled open repeats `open.post.ts`'s preconditions and, when they fail, clears `opensAt` and logs once. Schedule fields are not in `LOCKED_VOTE_FIELDS`: they say nothing about what a ballot means.
- One ballot per user and vote (`ballots` unique index). Ballots snapshot `groupId`/`committeeId` at cast time; results group by the snapshot. Changing the ballot requires `votes.allowChange`; the ballot endpoint is transactional and idempotent (`server/api/me/votes/[id]/ballot.post.ts`).
- **Locked conditions**: once any ballot exists, `committeeId`, `minimumVotes`, `maxWinners`, `allowChange` and option meaning (label, `canWin`, add/remove) are frozen (`assertVoteConditionsEditable`). While the vote is **open** `options.put.ts` refuses every option change, colours and order included, and `visible` cannot go back to `false`. Name, description, colours, order and `showLiveResults` stay editable in the states where the rules above allow it.
- Census for participation = eligible now ∪ already voted, so rates never exceed 100%. It is recomputed on every read, so a closed vote's denominator still moves when someone is added to or suspended from its committee; the ballots and their counts never move.
- `votes.showLiveResults = false` hides totals/per-option data for non-admins while open. Admins always get `includeHidden` (detail, lists, `/api/me/votes`, committee pages).
- Images (user photos, group logos, committee covers) all go through `server/utils/images.ts` and share `${APP_DATA_DIR}/avatars`, so backups already cover them. `IMAGE_KINDS` holds the per-kind rules; the decoded format decides what is accepted, never the file name. Write the new file, store the reference, then delete the one it displaced (`replaceEntityImage`) — never the other way round, or a failed update leaves the row pointing at a deleted file. File names carry a random suffix so every replacement gets a fresh URL under the long cache header.
- The plenary has no `committees` row (its id is null throughout the API), so its cover lives in `app_settings` under `plenaryCover` and is served through the committee listing and detail. It keeps a fixed star for its icon, since there is no row to store one on. It has no `order` either: the only places it can take are the two ends of the list, and `plenaryFirst` (`POST /api/admin/plenary/position`) says which. In the admin it is dragged against the committees table as a whole and the half it is dropped on is the answer, so it can never end up between two committees.
- Committees and groups also carry an `icon`: a lucide name without the `i-lucide-` prefix, validated against the closed lists in `shared/constants/icons.ts`. Free text is not accepted, because an unknown name renders nothing at all rather than erroring (`fallbackToApi: false`). Unlike the cover, the icon travels inside `PublicCommittee` and `PublicGroup`: it is shown where no picture fits, such as the committee badge beside a person's name.
- Ordering is set by dragging, not by typing a number. `POST /api/admin/committees/reorder` and `.../groups/reorder` take the complete list of ids and refuse anything partial or repeated, because a drag only means something against the list the admin was looking at. `AdminReorderHandle` is the single control (grip plus up/down), `useDragReorder` drives the admin tables and the vote option editor keeps its own index-based copy of the same behaviour. The arrows are the keyboard path and are not optional. Nothing reorders under the pointer: the dragged row keeps its place with `.dragging-row` while a copy of it, built by `setRowDragImage`, rides under the cursor, and the target row gets `drop-before` / `drop-after`, inset shadows that paint without reflowing. The copy is a clone rather than the row itself, because handing the row to `setDragImage` and lifting it out would close its gap and shift the list at the moment of the grab.
- Users with ballots cannot be deleted (suspend instead); the check and the delete share a transaction that locks the user row, so a ballot cast at that moment cannot be swept away with them. Committees with members, votes or ballots pointing at them cannot be deleted, and neither can groups with members or ballots: `ballots.groupId`/`ballots.committeeId` are `ON DELETE RESTRICT` because they are the affiliation the vote was cast under. A `NULL` there means "voted with no group/committee", never "look up the current one". Slug `pleno` is reserved.
- Winners use `shared/utils/winnerCalculation.ts`, which returns `winnerIds` (options that definitely won) and `tiedIds` (options disputing the seats that are left) separately; `tie` is just `tiedOptionIds.length > 0`. With A=9, B=7, C=7 and `maxWinners: 2`, A wins and B and C are tied. Never treat a tied option as a winner (see README "Reglas de las votaciones"). Abstention defaults to `canWin: false`.

---

## Server/API Conventions

- Handlers: parse params, validate (Zod via `parseBody`), check auth, query DB, return `{ data }` (`{ data, meta }` for lists with extras). Extract to `server/utils/` when they grow.
- `/api/admin/**` and `/api/me/**` are protected by the global `server/middleware/auth.ts` (path-prefix guard). Handlers still call `requireUser` / `requireAdmin` / `getOptionalUser` when they need the user.
- `server/api/auth/[...all].ts` exposes only an allowlist of Better Auth paths (sign-in, sign-out, get-session, change-password, sessions). Password changes go through the client (`authClient.changePassword`) so the rotated cookie reaches the browser.
- Admin mutations on votes lock the vote row (`lockVote`) inside a transaction so they serialise with ballots.
- `GET /api/session` returns the current user (or `null`) with committee and group; always `Cache-Control: no-store`.
- Passwords: `createUserWithPassword` and `setUserPassword` in `server/utils/password.ts` write `accounts` rows directly with `hashPassword` from `better-auth/crypto`. Setting a password deletes the user's sessions.
- Every mutation that affects what people see calls `emitVoteChanged` or `emitContentChanged` (`server/utils/sseManager.ts`). Clients refetch on events; SSE payloads carry no data.
- Results are computed on demand in `server/utils/voteResults.ts` from `ballots`; there is no cached count column.
- Avatars are stored under `${APP_DATA_DIR}/avatars` and served by `server/routes/avatars/[filename].ts`. People upload their own through `/api/me/avatar`; admins upload and remove anyone's through `/api/admin/users/[id]/avatar`. Removing sets `photo_removed_at`, which is what asks the person for a new photo on their profile page; uploading clears it again.
- `GET /health` runs `SELECT 1`; requests with a non-loopback `X-Forwarded-For` get 404.

---

## Database & Drizzle

- CUID2 primary keys (`text('id').primaryKey().$defaultFn(cuid)`), except Better Auth tables which receive their ids.
- Timestamps: `timestamp(..., { withTimezone: true, mode: 'date' })`; `updatedAt` uses `$onUpdate`.
- Hard deletes with `onDelete: 'cascade'` (votes → options/ballots, users → ballots/sessions).
- Migration workflow: edit `server/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. Never edit existing migrations.

---

## Frontend Conventions

- Auth state: `useAuth()` (`user`, `isAdmin`, `refresh`, `signIn`, `signOut`) backed by `useState` and `/api/session`. The global middleware loads it once per request.
- Live updates: `useLiveRefresh(refresh, filter?)` opens one SSE connection per page and calls `refresh` on relevant events, on reconnect and when the tab becomes visible again.
- Errors: `getApiErrorStatus` / `isNetworkError` (`useApiError.ts`). Pages throw 404 only on a real 404; network failures render `DataError` with retry or a "datos desactualizados" badge, and `useAuth.refresh` keeps the user on network errors.
- Times render on the reader's own clock (`useFormatting`). The server cannot know that timezone, so it renders `EVENT_TIME_ZONE` (`Atlantic/Canary`) and the browser corrects every timestamp on mount. Keep new timestamps going through `formatDateTime` / `formatTime` so they follow.
- Mutations: `$fetch` → toast via `useApiToast()` (`success` / `error(err, fallback)`) → `refresh()`.
- Confirmations and forms in modals use `useOverlay()` with `ConfirmModal`, `AdminUserFormModal`, `AdminVoteFormModal`, `AdminImportUsersModal`, `AdminPasswordResultsModal`.
- Use Nuxt UI semantic classes (`text-muted`, `bg-default`, `border-default`…) and the `sipeu` / `eu` palettes from `app/assets/css/main.css`.
- Group colours come from the database; option colours fall back to `DEFAULT_OPTION_COLORS`.
- Motion: keyframes and shared classes live in `app/assets/css/main.css` (`animate-fade-slide-up`, `stagger-list`, `motion-card`, `animate-pop-in`, `number-bump`, `page-*`). Page changes are animated by `app.pageTransition` in `nuxt.config.ts`, which is what the `page-*` classes are for.
- The `prefers-reduced-motion` block in `main.css` only reaches CSS. An animation driven from JavaScript — `element.animate`, a `requestAnimationFrame` loop — must call `prefersReducedMotion()` itself and skip, not shorten. `requestAnimationFrame` is also paused outright in a tab that is not being drawn, so nothing that has to finish may depend on it alone.
- Reordering slides rather than jumps: `animateFlip` (`useFlip.ts`) measures the rows, applies the change, then plays each row back from where it was. Rows are matched by `data-row-id`, not by node, because the list is replaced and the elements may be recycled.
- Baseline, not centre, when a flex row mixes fonts or text sizes. `items-center` centres the boxes, and two fonts put their baseline at a different height inside the same line box, so a `font-mono` count next to an `Inter` label lands ~1.5px off. Use `items-baseline` on the row and `self-center` on the icons and colour dots in it. Numbers use `font-mono tabular-nums`; `font-mono` is an unpinned system stack, so the offset varies by device and is not something a screenshot from one machine can rule out.

---

## Deployment

- `deploy.sh`: local Docker build → push to GHCR → SSH → `docker compose pull/up` for the `app` service → migrations.
- Anything the production compose file interpolates carries a `SIPEU_VOTO_` name, with the generic one as a fallback: `SIPEU_VOTO_IMAGE`, `SIPEU_VOTO_APP_PORT`, `SIPEU_VOTO_DATA_DIR`, `SIPEU_VOTO_TZ`. A server may read a `.env` shared with other projects as its root, and there a bare `IMAGE` or `APP_PORT` belongs to whoever wrote it last. Anything the containers need at runtime goes through `env_file` instead, which resolves next to the compose file and cannot be captured that way.
- Postgres 18 keeps its data in `/var/lib/postgresql` (not `/var/lib/postgresql/data`); the named volume mounts there.
- The app port is published on `127.0.0.1` only; NGINX is the public entrypoint (disable buffering for `/api/sse/`, block `/health`).
- Persist `/app/data` (avatars) with a bind mount. `ops/backup.sh` / `ops/restore.sh` cover DB + avatars.

## Tests

- `pnpm test`: Vitest unit tests (`tests/unit`): winner/tie rules, CSV parser, schedule rules, count-up easing.
- `pnpm test:smoke`: `tests/smoke.mjs` against a running server (creates and deletes its own fixtures). Run it against the production build before deploying.

---

## Commit Guidelines

Conventional Commits in English:

```
feat: add CSV import for users
fix: hide live results when vote is configured so
```

## Checklist

- UI text in Spanish; code in English.
- Mutations emit SSE events.
- New DB fields: migration generated and applied.
- `pnpm lint:fix`, `pnpm typecheck`, `pnpm test` pass; `pnpm test:smoke` passes against a running server.
