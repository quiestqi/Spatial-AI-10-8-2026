# Bluehaven: Spatial Agents

Simulation: https://quiestqi.github.io/Spatial-AI-10-8-2026/

## User's rules

- Exactly 3 delivery dogs, 5 rats and 8 pedestrians.
- Each dog starts with 3 meals. The score is its completed deliveries.
- Dog meets pedestrian within 1.05 units: hearts and speed ×1.6 for 6 simulation seconds. Multiple greetings refresh the expiry and do not multiply speed.
- Rat contacts dog within .90 units: remove exactly 1 carried meal and record 1 stolen meal. Completed delivery scores never decrease. Empty bags cannot be stolen from.
- Pedestrian meets rat within 1.15 units: show a fist / SHOO icon, the rat displays a running icon and follows an escape route for 5 seconds. A shoo takes priority over theft in the same step.
- Contact pairs must separate by an extra .55 units and pass a 6-second cooldown before re-triggering. This prevents frame-by-frame repeated theft, boosts or attacks from a sustained encounter.
- Empty dogs return to a discovered restaurant and refill to 3 meals. This is a continuation rule chosen to keep the simulation running.
- Rat warning jumps remain. New-mode dogs reserve a clear landing point, lift before crossing and land on the other side. A separate Over event requires actual relative crossing, height, proximity and landing checks. Original Above/Over demonstrations remain in Position workshop mode.

## Spatial-agent assignment mapping

1. Three agent types with distinct goals: dogs deliver/refill, rats seek food/escape, pedestrians visit shops and chase nearby rats.
2. Every agent begins with private, limited knowledge. They have 120-degree forward vision, range 6 units, and building occlusion. Contact is a local tactile reflex.
3. Individual maps distinguish unknown terrain, currently visible cells and remembered roads/obstacles. Other agents' maps do not enter planning.
4. Goals use only visible or remembered information. Dogs route to discovered customers/restaurants, rats pursue a dog seen within the last 4 seconds, and pedestrians visit discovered restaurants or chase a visible rat.
5. Route search runs only on the selected agent's remembered road cells. When the destination is unknown or not connected, the agent explores known frontiers and scans by turning. The true map enforces physical walls but never supplies an omniscient navigation route.
6. Discovered customers, restaurants, chargers and obstacles become persistent personal landmarks. Agents reuse remembered service locations. The panel shows discovered landmarks and the number of route plans that used this memory.
7. Agents avoid other bodies, yield and sidestep. Dogs reserve landing zones during jumps. All movement uses bounded physics integration with wall clearance.
8. The selection menu (or click a 3D actor) inspects an individual dog's, rat's or pedestrian's knowledge. The minimap always shows only that agent's memory. “Selected knowledge only” also limits the 3D town view and agent visibility. In that mode, path overlays show only the selected agent's history.
9. “All paths” overlays trajectories in dog blue, rat purple and pedestrian green. “Landmark heat” shows how many agents independently know each service landmark. Unknown selected cells stay hidden when individual knowledge mode is enabled.
10. Delivered/onboard/stolen counters and individual dog scores update live. Meal conservation is: initial 9 + total refills = onboard + delivered + stolen.

## Demo

Open the site and press Start. Choose K-01, R-01 or P-01 to inspect different maps.

- ♥ Speed boost: resets the round and places a dog beside a pedestrian. The actual proximity rule triggers the boost.
- 🍱 Steal a meal: resets the round and places a rat beside a loaded dog, with pedestrians farther away.
- 👊 Chase rat: resets the round and places a pedestrian beside a rat. The rat then plans and executes an escape route.

Demos use real contacts, not prewritten success events. They reset all scores and memories. Start/Pause freezes simulation time, cooldowns, boosts and all actors. Step advances .65 simulation seconds. Normal / Fast / Slow changes the rate of simulation time, not the contact rules. Reset restores 3/5/8 actors and all 9 initial meals.

Use “Position workshop” in the top toolbar to access the original delivery game, charging, distance queries and Position + Movement demonstrations. “Spatial agents” switches back.

## Verification and delivery

Run `node tests/city-life.cjs`, `node tests/spatial.cjs` and `node tests/agents.cjs`. The last test runs the actual town for 240 simulated seconds, checks every body against walls and other grounded actors, verifies meal conservation, and confirms autonomous deliveries and all interaction event types. It also covers private knowledge, occluded vision, unavailable hidden routes, contact cooldowns, escape movement, refill, determinism and reset.

`tests/agents-browser.cjs` covers actual Chromium/WebGL loading, all three demonstrations, pause/reset, agent selection, private knowledge, path/heat toggles, mobile layout and switching back to the legacy Above/Over demonstration. Install Playwright separately to rerun; set CHROME_PATH when needed. Browser screenshots and its report are in docs/.

Capture screenshots or a short video, then post the simulation URL and real team names to the course assignment thread. Account handle quiestqi is not a substitute for student names. This extension does not submit to Discord automatically.
