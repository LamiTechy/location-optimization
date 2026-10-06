# Location Optimization System — MAPOLY Navigator

A campus navigation web application: **Location Optimization System (a case
study of Moshood Abiola Polytechnic, Abeokuta — MAPOLY)**.

Students and staff pick two places on campus and the app returns the shortest
walking route with distance, estimated walking time and turn-by-turn steps,
drawn on an OpenStreetMap map. It also supports live walking navigation,
favourites, route history, feedback and an admin console for editing the
campus walkway graph.

---

## 1. Features

| Area | What works |
| --- | --- |
| Authentication | Register / login / logout, JWT session cookie, bcrypt password hashing, rate limiting |
| Roles | `student`, `staff`, `visitor`, `admin` — middleware + route handlers both check the role |
| Search | Typo-tolerant search of 26 seeded campus places (`lib`, `lbrary`, `hstel` all work) |
| Routing | Dijkstra shortest path over a hand-built walkway graph (26 places → 40 nodes, 75 edges) with distance, ETA and turn-by-turn directions |
| GPS start | "From my location": the nearest graph node is snapped and the first/last leg is measured separately |
| Map | Leaflet + OpenStreetMap behind a swappable `MapAdapter` contract, no API key needed |
| Live navigation | Geolocation watch, step highlighting, off-route re-routing (≥ 15 m deviation), arrival detection, progress banner |
| User features | Favourites, route history (re-open any past route), preferences (avoid stairs, walking speed, theme), feedback with star rating |
| Admin console | `/admin` — stats + graph health, place CRUD, **map editor** (nodes/edges on the map), user roles, feedback review |
| Accessibility | Keyboard/ARIA-labelled forms, prefers dark theme, avoid-stairs routing option, mobile-first layout with bottom tab bar |

## 2. Tech stack

- **Next.js 16 (App Router, Turbopack) + React 19 + TypeScript**
- **Tailwind CSS v4** design tokens (`app/globals.css`)
- **Postgres**: Neon (production) via `@neondatabase/serverless` + Drizzle ORM;
  embedded **PGlite** for running locally with no database server
- **Leaflet / react-leaflet** (OpenStreetMap tiles)
- **Auth**: `jose` (JWT), `bcryptjs`, custom middleware, double-submit CSRF
- **Validation**: `zod` on every API input
- **Tests**: `vitest` (pure-function routing/geo suite) + `db:verify` (database checks)

## 3. Quick start

```bash
npm install
cp .env.example .env          # then edit the values
npm run db:migrate            # create tables
npm run db:seed               # 26 places, 40 nodes, 75 edges, accounts
npm run dev
```

Open http://localhost:3000.

### Run it with no Postgres at all (used during development)

```bash
# in .env
DB_DRIVER=pglite
```

`npm run db:migrate` / `db:seed` / `dev` then use the embedded database in
`.pglite-data/` (git-ignored). Production always uses the Neon driver —
the PGlite path is loaded dynamically and is excluded from the build.

### Demo accounts (created by `npm run db:seed`)

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@mapoly.edu.ng` | `ChangeMe123!` (from `ADMIN_PASSWORD`) |
| student | `student@mapoly.edu.ng` | `Campus2026!` |
| visitor | `visitor@mapoly.edu.ng` | `Campus2026!` |

Override the demo password with `SEED_DEMO_PASSWORD`.

## 4. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (React Compiler rules included) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (`tests/*.test.ts`) |
| `npm run db:migrate` | Apply `db/migrations/*.sql` |
| `npm run db:seed` | Seed graph + accounts (`-- --force` rebuilds the graph) |
| `npm run db:verify` | 9 database integrity checks (prints PASS/FAIL) |
| `npm run db:generate` | Generate migrations from `db/schema.ts` |
| `npm run db:studio` | Drizzle Studio |

## 5. Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes, unless `DB_DRIVER=pglite` | Neon connection string |
| `DB_DRIVER` | no | `pglite` = embedded local Postgres (dev only) |
| `JWT_SECRET` | yes | ≥ 16 chars, **≥ 32 in production** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seeding | Admin account created by `db:seed` |
| `NEXT_PUBLIC_APP_URL` | recommended | Absolute URL, used by the CSRF origin check |
| `SEED_DEMO_PASSWORD` | no | Password for the seeded demo accounts |

Environment is validated by `lib/env.ts` (zod) — the server refuses to start
with a bad configuration instead of failing at first request.

## 6. Project structure

```
app/
  (auth)/          login, register
  (app)/           dashboard, navigate, history, profile, feedback
  (app)/admin/     admin console: overview, places, graph, users, feedback
  api/             REST-style route handlers (envelope: { ok: true, ... })
middleware.ts      CSRF + session + role gate (see note below)
components/        app shell, navigate, map (adapter + Leaflet), admin, ui
db/                schema, migrations, seed, verify
lib/
  auth/            jwt, session, bcrypt, csrf, rate limit
  geo/             haversine, bearing, ETA
  routing/         graph, min-heap, dijkstra, snap, directions, progress
  services/        business logic used by route handlers
  validators.ts    zod schemas for every endpoint
tests/             vitest unit tests (algorithm-level)
docs/              ALGORITHM.md, CHAPTER4_NOTES.md
```

## 7. Architecture in one page

1. **`middleware.ts`** runs first: rejects cross-site mutations (Origin check +
   double-submit `mapoly_csrf` token), verifies the session JWT, redirects
   anonymous users and non-admins away from `/admin`, and 401s API calls.
2. **Route handlers** validate input with `zod`, re-check the session/role
   (never trust middleware alone), call a `lib/services/*` function and return
   the standard envelope `{ ok: true, ... }` or
   `{ ok: false, error: { code, message } }`.
3. **Routing service** (`lib/services/routing.ts`): resolve both endpoints →
   load the versioned graph cache → Dijkstra → snap the path into a polyline →
   build turn-by-turn steps → optionally record history.
4. **Client** (`components/navigate/NavigateScreen.tsx`): search box, map,
   bottom sheet, route summary, and live-navigation mode driven by
   `lib/routing/progress.ts` maths.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| API returns 500 and the console shows `Failed query ... [cause]: RuntimeError: Aborted()` | The local `.pglite-data` folder was damaged by an interrupted or force-killed dev server (WAL never flushed) | Stop the server, run `npm run db:reset`, start it again |
| `Missing or invalid CSRF token` on save/delete/logout | The request did not carry the double-submit header | Use `apiFetch(path, { method, json })`; mutations without a body still need the header (handled by `lib/client/api.ts`) |
| `EADDRINUSE` on port 3000 | A previous dev server is still running | Stop it (`Ctrl+C` in its terminal) and restart |

Rules for the local database:

- Stop the dev server with `Ctrl+C` — force-killing the `node` process skips
  PGlite's shutdown and can damage `.pglite-data`.
- Run `db:*` scripts only when no dev server is running: two processes writing
  the same data directory is how corruption starts.
- `npm run db:reset` = delete `.pglite-data` → migrate → seed → verify, and is
  always safe to re-run (it never touches Neon).

### Known notes

- **`middleware.ts` is deprecated in Next 16** (the file convention was renamed
  to `proxy.ts`). It is kept deliberately as `middleware.ts` because the
  coursework specification requires a middleware-based authentication layer;
  the file works today and prints a one-line deprecation warning on build.
- **Campus coordinates are placeholders** centred on
  `7.1566, 3.3408` (`lib/config.ts`). The admin **Map Editor**
  (`/admin/graph`) is the tool for calibrating real coordinates — every edit
  bumps `graph_meta.version`, which invalidates the routing cache.

## 8. Testing / verification

```bash
npm run lint && npm run typecheck   # static checks
npm test                            # algorithm tests
npm run db:verify                   # database integrity checks (9 checks)
```

`npm run db:verify` confirms what Chapter 3 of the report calls "the database
stores and retrieves data accurately": row counts, coordinate sanity, one node
per place, edge referential integrity, graph connectivity, admin account and a
real search query.

## 9. Deployment

1. Create a Neon database, copy the connection string into `DATABASE_URL`.
2. Set a strong `JWT_SECRET` (32+ chars) and `NEXT_PUBLIC_APP_URL`.
3. `npm run db:migrate && npm run db:seed`.
4. `npm run build && npm start` (or deploy to Vercel).
5. Change `ADMIN_PASSWORD` before seeding in a public environment.

## 10. Security summary

- Passwords hashed with bcrypt (cost 12); login timing masked with a dummy hash.
- Sessions are `HttpOnly`, `SameSite=Lax` JWT cookies; `Secure` in production.
- CSRF: SameSite cookies + Origin/Referer check + double-submit token.
- Role checks in middleware **and** in every admin handler.
- All inputs validated with `zod`; errors never leak stack traces.
- Login rate limiting per IP and per email (20 / 5 per 15 minutes).

See `docs/CHAPTER4_NOTES.md` for the design discussion and
`docs/ALGORITHM.md` for the routing algorithm.
