# Position + Movement: definitions and submission notes

Reference: uploaded `spai-workshop-position-movement.pdf`, Spatial AI + Computing, William Martin, Columbia GSAPP / School of Visual Arts. The brief requests at least three position notions, three movement notions, visible indicators, behaviors, diagrams, screenshots, an animated capture and a short deck with names and a simulation URL.

All distances below use 1 town cell = 1 world unit. Ground coordinates are x/y; z is height. Three.js uses x/z on the ground and y for height. Customer orientation is intrinsically fixed at south (+ground y), independent of the dog heading and camera.

| Relation | Real condition | Indicator / response |
|---|---|---|
| Above Rat | During a Rat interaction jump, dog foot/base height ≥ 1.05 and horizontal center distance to the actual moving Rat ≤ 0.70. Rat ears reach about 0.95. | Live ABOVE RAT label, vertical gold connector, state-entry event; clears after overlap or height ends. |
| Between buildings | Dog on a road, between two facing footprint edges, with transverse coordinate in the overlap of the footprints. Dog has .22 edge clearance; sampled corridor contains no intervening building. | Purple edge-to-dog-to-edge connector, building pair named in live state and event history. |
| In front of customer | Customer-to-dog vector dot fixed facing ≥ .65, lateral distance ≤ 1.15, total distance ≤ 3.5. | Green connector and live label; entering state recorded. |
| Behind customer | Same limits, dot fixed facing ≤ −.65. | Green connector and live label; entering state recorded. Sideways/aligned positions have neither label. |
| Into | Dog moves into a customer's walkable Delivery Zone, radius 1.5; enter below 1.42 for boundary hysteresis; grounded below .2. | Green zone boundary, event, temporary label/connector. Initial occupancy is not an entry. |
| Out of | Dog moves out beyond radius 1.58 from an already occupied zone; both sample positions walkable and grounded at detection. | Exit event with customer ID and temporary label. |
| Toward | Within 8 units and outside radius 1.5, actual displacement decreases distance by > 65% of displacement, at > .15 units/s. | Gold customer arrow, event; cooldown 1.8 s. No event for stationary or sideways motion. |
| Over Rat | Rat jump length ≥ 1.5; starts on approach side (< −.3), relative trajectory crosses 0 with height ≥ 1.05 and lateral offset ≤ .7, also has an Above sample, ends beyond +.3, travels ≥ 1.5, and lands below .2. | Gold sampled trail during flight; OVER RAT confirmation only after landing. Each jump ID yields at most one Over. |

Over uses sampled relative dog/rat coordinates projected on the jump direction. The zero crossing height is interpolated between adjacent samples; rat position is updated each frame. Above is a state evaluated independently. A nearby rat can trigger a stationary warning jump; that has no traversed path and cannot become Over. If the rat moves away, the observer rejects Over even if the original jump metadata says `over`.

The observer resets its previous sample, trail and crossing evidence after a frame gap longer than .2 s. A suspended or very slow tab therefore conservatively misses an event rather than inventing a crossing. Re-run the example in an active WebGL tab for recording. These are explicit geometric predicates with model-envelope thresholds, not learned recognition or full mesh collision detection.

Delivery Zones consist only of road points. Circle outlines are clipped at building footprints. Original navigation remains on the road grid, and selecting a building routes to its reachable exterior entrance. Customers do not rotate to face the dog, which would invalidate front/back comparisons.

Position triggers create named connectors and live labels on recognition. The customer zone and front/back conditions provide visual approach guidance; the original mission still controls meal pickup, delivery and charging. Toggling visualization does not change game behavior or predicate evaluation.

## Submission checklist

Implemented: 4 position types, 4 movement types, 3D indicators, event history, original gameplay, explicit customer frames, independent Above/Over logic, screenshots, actual animated capture, editable diagrams and short deck. Tests and a browser report are included.

Student names were not supplied: cover credit uses Wanerrrrr, identified as the repository account. Replace with actual names before class submission. Modified simulation is runnable locally. No GitHub push/deployment was performed; update the site and then paste the confirmed simulation and deck URLs into the workshop/assignment thread.
