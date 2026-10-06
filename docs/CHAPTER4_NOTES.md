# Chapter 4 notes — System implementation, testing and documentation

Working notes for the report chapter on how **Location Optimization System
(MAPOLY Navigator)** was implemented, how it was tested, and what a reviewer
should know. Every claim below is reproducible with a command.

---

## 4.1 Implementation environment

| Item | Choice |
| --- | --- |
| Runtime | Node.js 24, npm |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 (`@theme` design tokens in `app/globals.css`) |
| Database | Neon serverless Postgres (production) / PGlite embedded Postgres (local development) |
| ORM | Drizzle ORM + SQL migrations in `db/migrations/` |
| Maps | Leaflet + OpenStreetMap tiles behind a swappable `MapAdapter` interface |
| Authentication | JWT in an `HttpOnly` cookie (`jose`), bcrypt password hashing (`bcryptjs`) |
| Validation | Zod schemas for every API input (`lib/validators.ts`) |
| Testing | Vitest (unit), `db:verify` (database checks), scripted API and browser checks |

No API keys are needed at runtime: OpenStreetMap raster tiles are free, which
keeps the demo reproducible for examiners.

## 4.2 System architecture

```
Browser (App Router screens, client components)
   |  fetch, JSON envelope { ok: true, ... } | { ok: false, error: {code,message} }
middleware.ts  -- CSRF + session JWT + role gate + redirects
   |
route handlers (app/api/*)  -- zod validation, role re-check, status mapping
   |
lib/services/*  -- business logic (routing, users, locations, admin)
   |
lib/routing/* + lib/geo/*  -- pure algorithms (no I/O, unit tested)
   |
Drizzle -> Postgres (Neon or PGlite)
```

Design rules used throughout:

1. **Pure core, thin edges.** Algorithm code never touches the network, the
   database or React, so all of it is unit-testable.
2. **Never trust the middleware alone.** Every `/api/admin/*` handler calls
   `requireAdminRole()` again; role checks are enforced in two places.
3. **One response shape.** Success `{ ok: true, ... }`, failure
   `{ ok: false, error: { code, message } }` — the client only needs one
   error path (`lib/client/api.ts` throws `ApiError`).

## 4.3 Database implementation

Nine tables (`db/schema.ts`):

`users`, `locations`, `nodes`, `edges`, `graph_meta`, `route_history`,
`favourites`, `preferences`, `feedback` — plus four enums (`user_role`,
`location_category`, `path_type`, `user_theme`).

| Concern | Implementation |
| --- | --- |
| Schema changes | `npm run db:generate` (Drizzle Kit) → SQL in `db/migrations/` → `npm run db:migrate` |
| Sample data | `npm run db:seed`: 26 places, 14 junctions, 26 entrance nodes, 75 edges, 3 accounts; `-- --force` rebuilds the graph |
| Integrity evidence | `npm run db:verify` prints 9 PASS/FAIL checks (counts, coordinate sanity, one node per place, edge references, connectivity, admin account, real search query) |
| Search | `search_text` column maintained by the service layer; ILIKE match first, `pg_trgm` `word_similarity()` for typos |
| Cache coherence | `graph_meta.version` bumped by every node/edge edit; the in-memory graph cache compares the version first |

Relationships: `nodes.location_id → locations`, `edges.from_node/to_node → nodes`
(cascade delete), `route_history/favourites/feedback/preferences → users`
(cascade), all foreign keys declared in the schema and exercised by the
verification scripts.

## 4.4 Implemented interfaces

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | create account (409 on duplicate) |
| POST | `/api/auth/login` | session cookie (401 invalid, 429 rate limited) |
| POST | `/api/auth/logout` | clear session |
| GET | `/api/auth/me` | session + preferences |
| GET | `/api/locations` | directory (`category`, `q`, `ids`, `limit`) |
| GET | `/api/search` | autocomplete + typo suggestions |
| GET | `/api/nearest` | snap a GPS point to the graph |
| POST | `/api/route` | shortest path, steps, ETA, polyline |
| GET/PATCH | `/api/preferences` | avoid-stairs, walking speed, theme |
| GET/POST/DELETE | `/api/favourites` | saved places |
| GET/DELETE | `/api/history` | route history (one/all) |
| GET/POST | `/api/feedback` | ratings + comments |
| GET | `/api/admin/stats` | dashboard numbers + connectivity |
| GET/POST/PATCH/DELETE | `/api/admin/locations` | place CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/nodes` | junction CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/edges` | walkway CRUD |
| GET | `/api/admin/graph` | full graph for the map editor |
| GET/PATCH | `/api/admin/users` | roster + role changes |
| GET | `/api/admin/feedback` | all ratings |

Pages: `/`, `/login`, `/register`, `/dashboard`, `/navigate`, `/history`,
`/profile`, `/feedback`, `/admin`, `/admin/locations`, `/admin/graph`,
`/admin/users`, `/admin/feedback`.

## 4.5 Testing strategy and results

Four layers, each with its own command:

| Layer | Command | Result |
| --- | --- | --- |
| Static analysis | `npm run lint`, `npm run typecheck` | 0 errors |
| Unit tests | `npm test` | **45 tests in 5 files passed** (geo, dijkstra, directions, snap, progress) |
| Database checks | `npm run db:verify` | **9/9 checks passed** |
| API integration (admin) | scripted HTTP suite | **31/31 checks passed** |
| Browser / UI | scripted Chrome checks | **27/27 checks passed** (admin) + 16/16 navigate + 12/12 history/profile/feedback |
| Production build | `npm run build` | exit 0, TypeScript passed, all routes emitted |

### Sample test cases

| # | Case | Expected | Actual |
| --- | --- | --- | --- |
| 1 | Route between two seeded places | 200, distance > 0, steps > 0 | 200, e.g. 444.6 m with steps |
| 2 | Start equals destination | 400 `VALIDATION_ERROR` | 400 |
| 3 | Unknown location id | 404 `UNKNOWN_LOCATION` | 404 |
| 4 | Anonymous call to `/api/admin/stats` | 401 | 401 |
| 5 | Student calls `POST /api/admin/nodes` | 403 `FORBIDDEN` | 403 |
| 6 | Student opens `/admin` | redirect to `/dashboard` | 307 |
| 7 | Duplicate edge between the same nodes | 400 | 400 |
| 8 | Node/edge edit | `graph_meta.version` increases | v20 → v25 |
| 9 | Delete a place | its graph node (and edges) removed, route still plans | `nodesRemoved: 1`, later route 200 |
| 10 | Role change to an invalid role | 400 | 400 |
| 11 | Search `lib` / `lbrary` / `hstel` | library result / suggestions | correct |
| 12 | Map editor renders graph | 40 markers, 75 walkway lines, no console errors | 40 markers, 75 paths |

### Observed performance (development mode, laptop)

- `next build`: ~68 s compile + ~60 s TypeScript (Turbopack).
- Graph load: first request builds the cache, later requests reuse it
  (`cacheHit: true`); graph GET ≈ 100 ms in dev, route ≈ 300 ms in dev
  (includes on-demand compilation of the route in Turbopack dev).
- Dijkstra itself on 40 nodes / 76 edges: sub-millisecond (pure unit test).

## 4.6 Security implementation

| Control | Where |
| --- | --- |
| Password hashing | bcrypt cost 12, dummy-hash compare when the email is unknown |
| Session | signed JWT (`HS256`), `HttpOnly`, `SameSite=Lax`, `Secure` in production |
| CSRF | SameSite cookie + Origin/Referer check + double-submit `mapoly_csrf` token (middleware) |
| Authorisation | middleware role gate **and** `requireAdminRole()` inside each admin handler |
| Input validation | Zod on every route/query/body; typed error issues returned to the client |
| Rate limiting | login: 5/15 min per email, 20/15 min per IP (in-memory, per instance) |
| Error hygiene | `handleRoute()` converts exceptions to `INTERNAL_ERROR` without stack traces |
| Secrets | validated by `lib/env.ts`; `.env` is git-ignored, `.env.example` committed |

## 4.7 Known limitations (report honestly)

1. **Placeholder coordinates.** Seeded positions are metric offsets from
   `CAMPUS_CENTER (7.1566, 3.3408)` — topologically correct, not surveyed.
   The admin **Map Editor** (`/admin/graph`) is the calibration tool: click the
   map to drop a node, attach it to a place, connect edges; every edit bumps
   `graph_meta.version` and invalidates the routing cache.
2. **`middleware.ts` deprecation.** Next.js 16 renamed the convention to
   `proxy.ts` and prints a warning during `next build`. The file is kept as
   `middleware.ts` because the specification requires a middleware-based
   authentication layer; migration is a codemod away
   (`npx @next/codemod@canary middleware-to-proxy .`).
3. **PGlite is development-only.** It is loaded dynamically, excluded from the
   production bundle (`serverExternalPackages`), and the data directory is
   git-ignored. Production always uses Neon over `DATABASE_URL`.
4. **In-memory rate limiting and graph cache** reset per server instance —
   correct but not shared across serverless instances.
5. **No offline support**: tiles and data require a connection; a service
   worker was out of scope.
6. **Feedback is not moderated**; ratings are stored with the author's name and
   shown to admins only.

## 4.8 Future work

- Real GPS survey of MAPOLY buildings and gates, then replace the seeded graph.
- Public-transport / accessibility layers (ramp-only routing) using the same
  `path_type` mechanism as stairs.
- Turn arrows on the map, floor plans inside buildings.
- Shared route links with a short-lived token instead of query parameters.
- Admin audit log of graph edits.

## 4.9 Documentation deliverables

| File | Contents |
| --- | --- |
| `README.md` | setup, environment, scripts, architecture, security, deployment |
| `docs/ALGORITHM.md` | shortest-path algorithm, data structures, complexity, ETA, live navigation |
| `docs/CHAPTER4_NOTES.md` | this chapter: implementation, testing evidence, limitations |
