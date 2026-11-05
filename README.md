# Bluehaven · Spatial Agents

**Live simulation:** https://quiestqi.github.io/Spatial-AI-10-8-2026/

3 delivery dogs, 5 rats and 8 pedestrians explore the same blue-and-white town with separate goals, finite vision and private spatial memory.

## Run

Open `index.html` locally in a WebGL-enabled browser. The engine, models and scripts are bundled. No build, account or internet connection is needed. Optionally serve this folder with `python3 -m http.server 8000`.

Press **Start** to run all actors. **Pause** freezes every actor and all timers, **Step** advances .65 simulation seconds, and **Reset** restores all scores, knowledge and initial meals. Normal / Fast / Slow controls simulation speed.

## Encounters and scoring

- Every dog starts with **3 meals**. Its score counts completed deliveries.
- Dog + pedestrian: **hearts and speed ×1.6 for 6 seconds**.
- Rat + dog: **steal 1 carried meal**. Previously completed deliveries remain credited.
- Pedestrian + rat: **fist/SHOO icon and 5 seconds of rat escape**.
- Each pair must separate and pass a **6-second cooldown** before another encounter. Boosts refresh instead of stacking. An empty bag never drops below zero.
- Empty dogs route to a discovered restaurant and refill to 3 meals so the simulation continues.

Three example buttons reset the round and place relevant actors close together. The real proximity/occlusion rules still produce the interaction. They do not write a fake success event.

## Knowledge and collective behavior

Select any K-, R- or P- agent in the menu, or click a model. Every agent has a **120° vision cone with 6-unit range**, blocked by buildings. It independently remembers roads, obstacles, services and recently seen actors. Navigation searches only that private remembered map and explores unknown frontiers when needed.

The panel's minimap always displays the selected agent's knowledge. **Vision cone** shows current sensing. **Selected knowledge only** limits the 3D map to discovered cells/buildings and currently visible actors. **All paths** overlays trajectories (only the selected history in private mode). **Landmark heat** compares independently discovered service landmarks across agents. Individual dog scores and recent encounter events remain visible.

Definitions, thresholds and assignment mapping: [docs/agents-assignment.md](docs/agents-assignment.md).

## Original workshop

The toolbar's **Position workshop** button opens the preserved original game: automatic deliveries, charging, distance inspection, camera controls, Rat jumping and the earlier Above/Between/front/back/Into/Out of/Toward/Over examples. Use **Spatial agents** to return to the new assignment.

Above remains a live position state. Over requires a verified trajectory crossing Rat with clearance and landing on the far side. New autonomous dogs reserve landing points, lift before horizontal crossing and keep wall/body clearance.

## Tests

```
node tests/city-life.cjs
node tests/spatial.cjs
node tests/agents.cjs
```

The new tests cover the exact population and inventories, private/occluded perception, lack of hidden routes, love boosts, theft accounting and contact cooldowns, actual escape movement, deliveries/refill, deterministic replay/reset and 240 simulated seconds of wall/body clearance and meal conservation. The original delivery, city-life and Position/Movement tests remain included.

`tests/agents-browser.cjs` tests actual Chromium/WebGL behavior, the three demos, pause/reset, private knowledge, paths/heat, mobile layout and return to the original Above/Over demo. Install Playwright separately to rerun (`npm install --no-save playwright`), then run it from this folder. Set `CHROME_PATH` if needed. Browser reports and screenshots are in `docs/`.

## Submission materials

- `docs/agents-*.png`: current agent gameplay, all three interactions, private knowledge, mobile and legacy screenshots.
- `docs/agents-assignment.md`: rules, assignment coverage and demonstration steps.
- `docs/agents-browser-report.json` and `docs/agents-test-results.txt`: verification records.
- Existing `Bluehaven-Position-Movement*.pptx` files and `rat-crossing.gif` describe the earlier Position + Movement assignment; they are retained as earlier workshop materials, not a new Spatial Agents presentation.

Add actual student/team names when submitting. The account handle **quiestqi** is a repository credit. Post screenshots or a short recording with the simulation URL to the class assignment thread yourself.

Source town and earlier workshop base: https://github.com/Wanerrrrr/Spatial-AI-10-8-2026 at `29f36266769c5b5b76ee00026026cfc07c3ce0f6`. The modified game publishes in the user's confirmed repository https://github.com/quiestqi/Spatial-AI-10-8-2026 . See THIRD_PARTY_LICENSES.txt for the bundled 3D engine license.
