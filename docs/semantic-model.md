# Bluehaven Environment Lab · Semantic Model

This document defines every entity, attribute, relation and rule used by the Environment Lab (`index.html` → `lab-engine.js` + `lab3d-view.js`). Every rule in the engine has a definition here. Default values come from `RULES` at the top of `lab-engine.js`. Identifiers in `code` are the field names used in the code.

The lab runs inside the original Bluehaven 3D town: the same 28 buildings, canal, arch bridges, delivery dogs, rats and pedestrians. The engine adds terrain (slopes and an underground layer), holes, orders with countdowns, learning maps and performance metrics.

---

## 1. Space and time: three physical dimensions + time

| Dimension | Definition | Unit |
|---|---|---|
| x, y | Grid cell. The town is 32 × 38 cells. (0, 0) is the north-west corner; x grows east, y grows south. | 1 cell = **4 m** (`cellSize`) |
| z (surface) | Ground elevation of each cell, `elev[i]` | metres, 0–20 |
| z (underground) | One underground cell lies directly below every surface cell, `groundDepth` = 3 m down | metres |
| t | Discrete simulation step `tick` = 0.5 s. A round lasts at most `maxTime` = 1200 s | seconds |

Every entity has a position `(x, y, layer, t)` with `layer ∈ {surface, under}`. In the 3D view, 1 scene unit = 1 cell = 4 m horizontally. Terrain heights are drawn ×1.6 so hills read clearly; the simulation itself uses the true metres. The screen is split in two: the **surface** (terrain, town, deliveries) on the left and the **underground** (the rats' world) on the right. The terrain is a smooth surface interpolated between cell centres, with 1 m contour lines, so every cell centre sits exactly at its `elev`.

---

## 2. Entities and attributes

### 2.1 Cell (two layers)

| Attribute | Values | Notes |
|---|---|---|
| `surface` | `road` (paving) · `grass` (lawn: open ground two or more cells from any building in the original town) · `house` · `restaurant` · `water` · `bridge` · `stairs` | road, grass, bridge and stairs are walkable. Houses and restaurants are building cells: not enterable, and they block sight. Water blocks everyone. |
| `elev` | 0–20 m, 0.1 m resolution | Ground height. Bridge decks are 4.32 m and stair cells 2.16 m above the canal banks. |
| `under` | `soil` · `rock` · `tunnel` · `nest` · `water` | Soil is diggable. Rock cannot be dug or crossed. A rat crossing soil turns it into a tunnel permanently. Nests are derived from restaurants. Nothing passes under the canal. |

Derived quantities:
- **Slope** `slope(a→b) = (elev[b] − elev[a]) / 4` (0.20 = 20%).
- **Diggable cell**: `surface ∈ {road, grass}` and the underground is not rock or water.

### 2.2 Building (block)
Each of the town's 28 buildings is one block (`name, x, y, w, d, kind, height`) with a `role`: `house` or `restaurant`. All cells of a block share one level ground pad.

| Attribute | Notes |
|---|---|
| `role` | The original town has 5 restaurants: North Bakery, East Arcade, Old Market, Corner Café, South Bakery. The other 23 are houses. Seeds, mutations and the editor can change roles. |
| `door` | The road cell at the middle of the south face; if that is not road, then the north face, then east, then west. |
| Restaurant → `nest` | The underground cells below a restaurant's footprint (except rock) become a rat nest. |
| Restaurant door | Guarded by staff: no theft can happen on that cell. |

### 2.3 Hole
`{x, y, by, at}` on a diggable surface cell. It connects that cell's surface and underground. **There are no holes at the start.** Rats dig holes and pedestrians plug them. Plugging removes the hole; the tunnel below stays.

### 2.4 Order

| Attribute | Notes |
|---|---|
| `house` / `restaurant` | The ordering house, and the restaurant whose door is closest (Manhattan) to the house door. |
| `createdAt` | 20 orders at seeded random times in [10, 600] s. |
| `deadline` | `createdAt + patience` (240 s): the end of the countdown. |
| `status` | `scheduled → waiting → assigned → carrying → delivered`, or it ends as `stolen` / `timeout`. |

### 2.5 Agents

Shared attributes: `id`, `type`, `x, y, layer`, `move` (the step in progress), `busy/busyKind` (an action in place), `state`, `heading`, `icon`, `trail`.

| Type | Count | Speed (m/s) | Senses | Max slope |
|---|---|---|---|---|
| Delivery dog `K-xx` | 4 | 1.8 (steps on lawn take ×1.15) | sight 3 cells, eye 0.8 m | 20% (stairs allowed) |
| Pedestrian `P-xx` | 8 | 1.2, chasing 1.9 | sight 4 cells, eye 1.6 m | 45% (stairs allowed) |
| Rat `R-xx` | 3 per restaurant | surface 1.45, fleeing 2.4, tunnel 1.2, digging soil 0.6 | smell 6 cells (restaurants); hunts carrying dogs within 3 cells | none |

### 2.6 Learning maps (two, each shared within its species)

| Map | Owner | Per cell | Updates | Forgetting |
|---|---|---|---|---|
| **Robot learning map** `fleet` | all delivery dogs | `risk`, `knownHoles`, `holeField` | Rat in sight: +0.5 on its cell, +0.25 on neighbours. Theft: +3/(1+d) within 2 cells. Hole in sight: added to `knownHoles`. A known hole seen to be gone: removed. `holeField` = Σ 2/(1+d) within 2 cells of each known hole. | `risk` half-life 400 s; known holes are only removed by seeing them gone |
| **Rat learning map** `colony` | all rats | `food`, `danger` | Smelling a carrying dog: +0.15 food on its cell. Successful theft: +3 food (1-cell radius). Shooed: +3 danger (1-cell radius). Finding its planned hole plugged: +1.5 danger. | half-life 400 s |

All values are capped at 6.

---

## 3. Relations

| Relation | Definition |
|---|---|
| `adjacent(a, b)` | 4-neighbourhood on the same layer |
| `below(surface cell) = under cell` | same (x, y) |
| `connects(hole)` | surface ↔ under at the hole's cell |
| `doorOf(building)`, `nestUnder(restaurant)` | see §2.2 |
| `occupies(agent)` | the start cell until halfway through a step, then the destination cell |
| `visible(agent, cell)` | Euclidean distance ≤ range + 0.5 and an unobstructed line of sight. The sight line runs from eye height above the agent's cell to 0.3 m above the target, and is blocked by any building cell or by ground rising above it (**hills hide things**). |
| `smells(rat, restaurant)` | distance from the rat to the restaurant's centre ≤ 6 cells, through the ground |
| `hunts(rat, dog)` | the dog is on the surface carrying a meal, distance ≤ 3 cells |
| `contact(a, b)` | both on the surface and the occupied cells are within Manhattan distance 1. Each pair re-arms after 5 s. |

---

## 4. Grid-by-grid movement

1. **Atomic steps.** An agent moves to one 4-neighbour cell, or changes layer in place. It can't change a step once started; it decides again on arrival.
2. **Step duration.**
   - Surface: `t = 4 m / v × (1 + 3·max(0, s) + 0.6·max(0, −s))`, where s is the step's slope. Dogs on lawn take ×1.15.
   - Underground: tunnel or nest takes 4 / 1.2 s. Soil takes 4 / 0.6 s, and the cell becomes a tunnel. Rock and water are impassable.
   - Changing layer (through a hole) takes 1.5 s.
3. **Passability**

| | road | lawn | building | water | stairs / bridge | slope limit | underground |
|---|---|---|---|---|---|---|---|
| Delivery dog | ✓ | ✓ (slower) | ✗ | ✗ | ✓ along the bridge (N–S) | 20% | ✗ |
| Pedestrian | ✓ | ✓ | ✗ | ✗ | ✓ along the bridge | 45% | ✗ |
| Rat | ✓ | ✓ | ✗ | ✗ | ✓ along the bridge | none | soil, tunnel, nest |

   Stairs and decks can only be entered from the cell north or south of them. Side steps are allowed only between cells of the same kind (deck to deck, stair to stair), as in the original town.
4. **Occupancy and yielding.** Agents can share cells. The one exception: **a delivery dog never steps into a pedestrian's current cell.** It waits 0.5 s and checks again; after 3 s of waiting it treats that cell as blocked and reroutes.
5. **Actions in place** (`busy`): pickup 4 s, plug 3 s, dig 6 s, emergency dig 4 s, rat rest 8–25 s.
6. **Path planning.** Every agent runs Dijkstra on the grid. Edge weights are the step durations above, multiplied by learning-map costs (§6).
7. **Determinism.** The same map, order seed and agent seed always reproduce the same round. A and B use the same seeds, which keeps comparisons fair.

---

## 5. Distribution rules

| Who | At the start | Afterwards |
|---|---|---|
| Delivery dogs (4) | at restaurant doors, round-robin | when idle, return to the nearest restaurant door |
| Pedestrians (8) | at the doors of 8 houses drawn uniformly **without replacement** | random walk with momentum: 70% keep direction, never reverse unless at a dead end |
| Rats (3 per restaurant) | **gathered in the nest under each restaurant**, with staggered rest timers (5–30 s) | surface only when hungry; go home after foraging or fleeing |
| Holes | **none** | dug by rats, plugged by pedestrians |
| Orders (20) | times and houses drawn from the order seed | see §8 |

---

## 6. Agent behaviour

### 6.1 Rat
```
nest (resting underground) ── rest over ──▶ restaurant within smell (6 cells)?
  no  → walk underground back to the nearest nest (gathering rule)
  yes → find the nearest existing hole within 6 cells of that restaurant (underground path ≤ 90 s)
        found     → walk to it underground → climb out → forage
        not found → choose a dig site → tunnel to it → dig 6 s → new hole → climb out → forage
forage (surface, 60 s): carrying dog within 3 cells → chase it; otherwise linger near the exit hole
        (drawn to food memory, away from danger memory, never on a restaurant doorstep)
   touch a carrying dog → steal the meal → return
   touched by a pedestrian → flee
   time up → return
return / flee: go to the nearest hole (fleeing: only holes reachable within 25 s) → climb down → home → nest
   no usable hole → dig an emergency hole on the spot (4 s); on rock, keep running away from the pedestrian
```
**Dig-site choice**: among diggable cells without a hole within 4 cells of the restaurant door, take the minimum of
`|Manhattan distance to the door − 3| + 2·danger − 1.5·food + noise(0–0.8)`.
On the surface, rat path costs are multiplied by (1 + 0.6·danger), so rats avoid places where they were chased.

### 6.2 Pedestrian
```
wander ── sees a rat on the surface ─▶ chase (1.9 m/s, up to 12 s; gives up if the rat goes underground or is already fleeing)
       ── sees a hole ───────────────▶ go to it → plug 3 s → hole removed → wander
touches a rat (Manhattan ≤ 1) → shoo: the rat flees, the pedestrian goes back to wandering
```
Seeing a rat beats seeing a hole. A shoo beats a theft in the same tick.

### 6.3 Delivery dog
```
idle (wait at the nearest restaurant door) ── assigned ──▶ toRestaurant ── at door ──▶ pickup 4 s ──▶ delivering ── at house door ──▶ delivered → idle
                                                                                        └ stolen / timeout → order failed → idle
```
- Knows the street map (like GPS) but **not where the rats are**. It learns them by sight.
- **While carrying a meal**, step cost = duration × (1 + 1.5·(risk + holeField) + 6·[cell next to a rat in sight right now]). When empty it only minimises time, because an empty dog can't be robbed.
- Touching a foraging rat that isn't already carrying food costs the meal, except on a restaurant doorstep.

---

## 7. How the three agent types affect each other

### 7.1 Direct influence matrix (row acts on column)

| acts on → | Delivery dog | Rat | Pedestrian | Hole (environment) |
|---|---|---|---|---|
| **Delivery dog** | none (may share cells) | a carried meal **attracts** foraging rats; is learned and avoided | none | seen holes go into the learning map and are avoided |
| **Rat** | **steals** the meal → order fails; the spot enters the robot map | shares the colony map | none | **digs** holes (6 s / emergency 4 s); turns soil into tunnels |
| **Pedestrian** | dogs **yield** (wait, then reroute) | **shoos** → the rat runs to a hole; the spot enters the rat danger map | none | **plugs** holes (3 s) |

### 7.2 Indirect chains (these emerge from the rules; none is scripted)
- A pedestrian plugs a hole → the next hungry rat finds no hole nearby and digs a new one, often somewhere else → the dogs' known hole is stale until a dog sees it.
- A pedestrian chases a rat → the rat dives into its hole → the hole is now in the pedestrian's sight → it gets plugged.
- Carrying dogs pass along a route → the rat food map remembers it → new holes and lingering spots shift toward that route → robot risk rises there → dogs reroute.
- Terrain: slopes over 20% stop dogs but not pedestrians or rats. Hills block sight, so pedestrians and dogs miss holes and rats behind them.
- Underground rock near a restaurant prevents digging there, so rats must surface farther away, which reduces theft pressure.
- The canal splits the rat population: tunnels cannot cross under it.

---

## 8. Orders and the order UI

- **Dispatch.** Each tick, waiting orders are handled oldest first. The nearest idle dog is assigned if it can reach the restaurant and the restaurant can reach the house. If no dog can, the order is flagged `unreachable` and retried after 5 s.
- **Countdown UI.** Every house with an active order shows a badge above its roof: order id, remaining seconds and a ring for the remaining fraction (red under 25%). The badge also shows ⏳ waiting / 🍜 pickup / 🛵 on the way. The side panel lists the five most urgent orders per map with bars.
- **The countdown is not a scoring criterion.** It adds no penalty and doesn't affect any decision. It only shows urgency, and when it reaches zero the order is marked `timeout`, which counts as a failure in §9.

---

## 9. Performance

| Metric | Definition |
|---|---|
| **Delivery success rate** | `delivered / (delivered + stolen + timeout)`. Stolen and late orders both count as failures. |
| **Delivery time** | `doneAt − createdAt` of each delivered order (includes waiting for a dog, pickup and travel). The average is reported. |
| Auxiliary | holes open / dug / plugged, shoos, yields, distance walked |
| Fitness (Evolve) | `success rate × 100 − average delivery time / 10`. Success rate dominates; time breaks ties. |

A round ends when all 20 orders are finished or at 1200 s; anything unfinished then counts as late.

---

## 10. Environments: seeds, building and evolution

### 10.1 Seeds (`generateMap(seed, {relief, restaurants})`)
Seed 0 is the original flat town. Any other seed keeps the same streets, buildings, canal and bridges, and adds:
1. **Hills**: two layers of value noise plus one Gaussian hill, scaled to [0, relief] (default 8 m). The height fades to 0 within 2–8 cells of the canal, so the banks and bridge landings stay level. Each building pad is flattened to its mean height.
2. **Restaurants**: 5 of the 28 buildings, spread out by farthest-point sampling.
3. **Underground**: rock where value noise > 0.66, soil elsewhere. Restaurant footprints are forced to soil (nests). Nothing lies under the water.

### 10.2 Mutations (`mutateMap`, 1–2 operations per variation)
terrain reshaped (50/50 blend with new hills) · terrain flattened 30% · restaurant moved to another building · new restaurant · restaurant closed (keeps ≥ 2) · underground rock or soil patch · lawn strip (only if the streets stay connected) · lawn paved. Every map keeps its `lineage`.

### 10.3 Build (editor)
Click the 3D town to paint. Tools:
- **Terrain:** raise/lower ±0.5 m, smooth, level to 0. Painting a building cell moves its whole pad.
- **Surface:** lawn / pave.
- **Underground:** rock / soil.
- **Buildings:** make restaurant / make house.

The editor checks street connectivity, the number of restaurants, and how many houses dogs cannot reach because of slopes. Maps export and import as JSON:
```json
{ "version": 2, "w": 32, "h": 38, "name": "…", "seed": 12, "lineage": ["seed 12", "…"],
  "blocks": [{ "name": "Town Hall", "x": 13, "y": 12, "w": 6, "d": 4, "kind": "clock", "height": 1.6, "role": "house" }, …],
  "surface": ["road" | "grass" | "house" | "restaurant" | "water" | "bridge" | "stairs", …],
  "elev": [metres, …], "under": ["soil" | "rock" | "water", …] }
```
The same format could carry measured data from a real place (a 4 m DEM, building footprints, a street raster).

### 10.4 Manual option
The player picks a seed (0 = original town) or 🎲, runs it, and watches the surface and the underground side by side. To compare towns, the player can generate another seed, hand-edit the town in Build, or load any epoch from Evolve. The order and agent seeds stay fixed, so runs of different towns are directly comparable.

### 10.5 Automated option (epochs)
`evolve()` hill-climbs:
- Epoch 0 comes from the seed.
- Each later epoch mutates the best town so far and evaluates it on 1–3 order seeds.
- A fitter town replaces the best.

**The number of epochs is the number of environments generated and evaluated.** The panel charts success rate and average delivery time per epoch (candidate dots plus a best-so-far line) and lists every epoch's change. Any epoch's town can be loaded into A or B, or opened in Build, and a new seed restarts the search.

---

## 11. Simplifications and measured results

- Dogs carry one order at a time and have no battery in the lab. The battery belongs to the original Position workshop.
- Sight is checked on grid samples, not exact geometry. There is no sight underground; rats rely on smell.
- **Learned avoidance**, measured on seeds 0–24 × 2 order sets with default parameters:

  | Robots learn & avoid | Stolen | Late | Success | Avg. delivery |
  |---|---|---|---|---|
  | on | 192 | 112 | **69.6%** | 101.0 s |
  | off | 225 | 97 | 67.8% | **95.6 s** |

  Learning cuts thefts by about 15% at the cost of about 5 s of detour per delivery. With a 240 s countdown the net effect is positive. The "Robots learn & avoid rats" switch reproduces this comparison.
- Towns differ a lot under identical rules. Over seeds 0–24 the success rate ranges from 42.5% (seed 18) to 87.5% (seed 24), and the original town scores 82.5%. Most of the spread comes from restaurant placement relative to houses and from hills that cut houses off from the dogs.

## 12. Parameters (`RULES`)

| Group | Values |
|---|---|
| global | W 32, H 38, cellSize 4 m, tick 0.5 s, maxTime 1200 s, groundDepth 3 m |
| robot | count 4, speed 1.8, eye 0.8, vision 3, maxSlope 0.20, grassFactor 1.15, riskWeight 1.5, prepTime 4, yieldLimit 3 |
| person | count 8, speed 1.2, chaseSpeed 1.9, eye 1.6, vision 4, maxSlope 0.45, plugTime 3, chaseGiveUp 12 |
| rat | perRestaurant 3, surfaceSpeed 1.45, fleeSpeed 2.4, tunnelSpeed 1.2, digSpeed 0.6, smell 6, huntRange 3, holeDigTime 6, emergencyDigTime 4, climbTime 1.5, rest 8–25, forageTime 60, digRadius 4, fleeMaxCost 25 |
| order | count 20, window 600, patience 240 |
| contact | range 1 (Manhattan), cooldown 5 |
| learn | robotHalfLife 400, ratHalfLife 400, riskCap 6 |
