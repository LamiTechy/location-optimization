# The routing algorithm

How `MAPOLY Navigator` turns "take me from the gate to the library" into a
shortest walking path with turn-by-turn instructions.

Everything in this document lives in pure TypeScript under `lib/routing/` and
`lib/geo/`, so every idea below is unit-tested without a browser or a database
(`tests/*.test.ts`).

---

## 1. Problem statement

Given:

- a set of campus places (`locations`) with coordinates,
- a walkway network (nodes = junctions and place entrances, edges = footpaths),

find the **shortest walking path** between two places, and present it as
distance, walking time and a list of turns.

This is a classic **single-source shortest path** problem on a weighted
undirected graph, which is exactly Dijkstra's algorithm.

## 2. Graph model

### Data model (`db/schema.ts`)

| Table | Meaning |
| --- | --- |
| `locations` | a place (name, category, coordinates, `search_text`) |
| `nodes` | a routable point: either a junction (`location_id = null`) or a place entrance (`location_id` set) |
| `edges` | a walkway segment: `from_node`, `to_node`, `distance_m`, `path_type`, `is_bidirectional`, `is_active`, optional curved `geometry` |
| `graph_meta` | a single `version` counter used for cache invalidation |

Seeded campus graph: **26 locations → 40 nodes → 75 edges**, verified to be a
single connected component by `npm run db:verify`.

### In-memory shape (`lib/routing/graph.ts`)

`buildGraph()` converts the rows into two maps:

```ts
nodes: Map<id, { lat, lng, locationId, label }>
adjacency: Map<id, Arc[]>          // Arc = { edgeId, to, weight, pathType, geometry }
```

Rules applied while building:

1. **Inactive edges are dropped** (`is_active = false` = path closed for
   maintenance) — the admin can close a walkway without deleting it.
2. **`avoidStairs` drops `path_type = 'stairs'`** edges, producing a second
   graph layer for accessibility-aware routing.
3. **One-way edges** (`is_bidirectional = false`) only push one arc.
4. **Weight = stored `distance_m`**, falling back to a Haversine measurement
   between the two nodes when the column is empty, so a weight always exists.
5. Dangling references are skipped instead of throwing — bad admin data must
   never crash a route request.

### Why Dijkstra (and not A* or BFS)?

- **BFS** ignores weights → it would return the path with the fewest
  *segments*, not the shortest *distance*.
- **A\*** needs a heuristic (straight-line distance). It is correct here
  because Haversine is admissible, but with 40 nodes the pruning it buys is
  negligible while it adds a heuristic to explain and test.
- **Dijkstra** is optimal, easy to defend in a project report, and with a
  binary heap runs in `O((V + E) log V)` — microseconds for this graph.

Edge weights are metres of walking, so "shortest path" = "shortest walk",
which is what a student actually wants.

## 3. Endpoint resolution (`lib/services/routing.ts`)

Dijkstra can only start and end **at graph nodes**, so both endpoints are
resolved first:

```
location endpoint        -> its attached node (one node per place, seeded)
GPS endpoint             -> snapToNearestNode()  (lib/routing/snap.ts)
```

`snapToNearestNode` scans all nodes for the minimum Haversine distance and
flags the fix as `offCampus` when it exceeds `OFF_CAMPUS_SNAP_RADIUS_M`
(150 m) — the UI then warns instead of silently walking the user somewhere
nonsensical.

If a place somehow has no node of its own, it is snapped the same way and a
warning is added to the response (`"using the nearest junction"`).

## 4. Dijkstra with a binary heap (`lib/routing/dijkstra.ts`)

```
dijkstra(graph, start, end):
    if graph empty            -> EMPTY_GRAPH
    if start/end unknown      -> UNKNOWN_START / UNKNOWN_DESTINATION
    if start == end           -> path = [start], distance = 0

    dist[start] = 0
    heap.push({ id: start, d: 0 })

    while heap not empty:
        current = heap.pop()          // smallest tentative distance
        if current already settled: continue   // stale entry
        settle(current)

        if current == end: return reconstruct()   // early exit

        for each arc of current:
            candidate = dist[current] + arc.weight
            if candidate < dist[arc.to]:
                dist[arc.to]  = candidate
                prev[arc.to]  = { from: current, edgeId: arc.edgeId }
                heap.push({ id: arc.to, d: candidate })

    return NO_ROUTE
```

Implementation details worth marks:

- **`MinHeap<T>`** (`lib/routing/min-heap.ts`) is a hand-written binary heap
  (`bubbleUp` / `sinkDown`, `O(log n)` push and pop) — no dependency, and it is
  trivial to show on paper during a defence.
- **Early exit**: when the destination is *popped* (not when it is first
  reached) its distance is final, so the search stops there.
- **Stale-entry skip**: nodes may be pushed several times; the first pop of a
  node settles it and later heap copies are discarded.
- **No exceptions**: the result is a discriminated union
  (`{ ok: true, path, edges, distanceM } | { ok: false, code }`), which the
  route handler maps to `404 UNKNOWN_LOCATION`, `404 NO_ROUTE`, etc.

**Complexity:** `O((V + E) log V)` time, `O(V + E)` memory.
Measured against the campus graph (V = 40, E = 76) this is sub-millisecond;
the dominant cost of a request is actually database I/O and graph loading,
which is why the graph is cached (section 8).

### Worked example

```
path:  [12, 14, 15, 9]          // node ids, start -> destination
edges: [31, 32, 40]             // edge ids between them
distanceM = 461.6               // sum of the three weights
durationMin = ceil(461.6 / 1.4 / 60) = 6 minutes   (1.4 m/s default speed)
```

## 5. From path to polyline

The path is converted to an ordered list of `[lat, lng]` vertices, inserting
the curved `geometry` points of each edge when present, plus the exact
endpoint coordinates (so the line starts at your feet, not at the junction).
The first and last legs (GPS → snapped node) are measured separately and
prepended/appended to the distance.

## 6. Turn-by-turn directions (`lib/routing/directions.ts`)

For every consecutive pair of path segments:

1. compute the **bearing** of each segment (`lib/geo/bearing.ts`, standard
   great-circle formula),
2. compute the **delta** between them (`bearingDelta`, always the smallest
   signed difference, so 350° → 10° is +20°, not −340°),
3. classify the delta:

| `|delta|` degrees | Instruction |
| --- | --- |
| ≤ 12 | "Continue" |
| ≤ 35 | "Slight left/right" |
| ≤ 110 | "Turn left/right" |
| ≤ 155 | "Turn sharp left/right" |
| > 155 | "Make a U-turn" |

Each step carries the distance to walk before the turn and the nearest named
place (e.g. *"Turn left at the Polytechnic Library"*) when one is within
`TURN_LABEL_RADIUS_M`. `path_type` changes are surfaced too — *"Go up the
stairs"* — which matters for the avoid-stairs feature.

## 7. ETA (`lib/geo/eta.ts`)

```
seconds = distanceM / speedMps          (default 1.4 m/s)
minutes = ceil(seconds / 60)            (never promise an early arrival)
```

The walking speed comes from the signed-in user's `preferences.walking_speed_mps`
(fast / normal / slow chips in Profile), so the same route shows a different
time for different users. Distances format as `640 m` / `1.2 km`, time as
`8 min` / `1 hr 5 min`.

## 8. Live navigation (`lib/routing/progress.ts`)

While the walker moves, `geolocation.watchPosition` feeds pure functions:

| Function | Job |
| --- | --- |
| `nearestPathIndex(path, point)` | index of the closest polyline vertex — `O(n)`, routes are short |
| `remainingDistance(path, i)` | metres left along the polyline from index `i` |
| `activeStepIndex(steps, cumulative, point, lookahead)` | which instruction to highlight — the last step already passed, or one within 20 m ahead, so the next turn lights up *before* you reach it |
| `deviationMeters(path, point)` | perpendicular distance to the route (`distanceToSegmentM`, local equirectangular projection) |
| `hasArrived(point, destination)` | inside `ARRIVAL_RADIUS_M` (15 m) |

Behaviour driven by those values:

- **Progress banner**: remaining distance + updated ETA after every fix.
- **Off-route handling**: deviation ≥ `REROUTE_DEVIATION_M` (30 m) triggers a
  re-plan from the current GPS position, throttled to once every 15 s.
- **Arrival**: arrival card, "Plan another route", and the trip is already in
  history.

## 9. Avoid-stairs fallback

If the user has "avoid stairs" on and `buildGraph(..., { avoidStairs: true })`
produces `NO_ROUTE`, the service **retries with stairs allowed** and returns
the route with a warning (`"no stair-free path exists — stairs included"`),
rather than failing. This is the classic "degrade gracefully" case in the
report.

## 10. Caching (`lib/services/graph-cache.ts`)

Loading 40 nodes + 75 edges per request is wasteful, so the graph is cached
**in memory keyed by `graph_meta.version`**:

```
request -> read version (1 cheap SELECT)
        -> version unchanged? reuse cached build
        -> changed? reload rows and rebuild both layers
```

Every admin node/edge edit calls `bumpGraphVersion()`, so the cache is
invalidated by data, not by time — no stale routes after a map edit, and no
unnecessary rebuilds. On a cold serverless start the cache simply does not
exist yet; correctness never depends on it.

## 11. Test coverage (`tests/`)

| File | Covers |
| --- | --- |
| `dijkstra.test.ts` | shortest path, start == end, unknown nodes, empty graph, unreachable destination, one-way edges |
| `geo.test.ts` | Haversine vs known distances, bearings, ETA rounding, formatting |
| `directions.test.ts` | turn classification thresholds, step distances, naming |
| `snap.test.ts` | nearest-node snapping, off-campus flag, distance-to-segment |
| `progress.test.ts` | progress index, remaining distance, active step, deviation, arrival |

Run with `npm test`; database-level assertions live in `npm run db:verify`.
