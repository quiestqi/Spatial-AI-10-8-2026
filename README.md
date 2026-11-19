# Bluehaven · Environment Lab

**Live simulation:** https://quiestqi.github.io/Spatial-AI-10-8-2026/ (after you publish this version)

Delivery dogs, rats and pedestrians share the 3D town of Bluehaven, drawn with toon (cel-shaded) materials on a real terrain. The Environment Lab is an environment-design tool: you generate or hand-build variations of the town, watch the surface and the rats' underground side by side, or let the computer evolve towns over epochs. Each town is scored by delivery success rate and delivery time.

## Run

Open `index.html` in a WebGL browser (no build, no internet needed), or serve the folder with `python3 -m http.server 8000`.

- **Start / Pause / Step / Reset** in the toolbar drive the simulation. Speed: Normal 4×, Fast 15×, Slow 1×.
- Drag to orbit, Shift-drag to pan, scroll to zoom. *Town view* resets the camera, *Find dog* follows the selected agent.
- **Position workshop** switches to the original delivery / charging / Position + Movement game. **Environment Lab** switches back.

## Lab panel

- **Simulate.** One town, shown as a split 3D view: the **surface** on the left (smooth terrain with hills, contour lines, lawns, a sunken canal and the toon-shaded town) and the rats' **underground** on the right (soil, rock, tunnels, nests, holes, and the outlines of the buildings above).
  - Switch to Surface or Underground alone. Surface layers: Terrain & town · Robot learning map · Rat learning map · Elevation & slope.
  - Pick any seed (0 = original town) or 🎲. The card shows success rate, average delivery time, delivered/stolen/late, holes, and the most urgent orders with countdown bars; every house with an order shows a countdown badge.
  - Click any dog, rat, pedestrian or cell, on the surface or underground, to inspect it.
- **Evolve** (automated option). Set a seed and a number of epochs; each epoch is one generated and evaluated environment. Charts show success rate and delivery time, and a table lists each mutation. Load any epoch into the town or into Build, or restart with a new seed.
- **Build.** Paint directly on the 3D town:
  - terrain raise / lower / smooth / level
  - lawn / pave, underground rock / soil
  - make a building a restaurant or a house

  Live checks show street connectivity and houses that robots can't reach. JSON export/import, *Quick evaluate*, *Run this town*.
- **Rules.** The influence diagram between the three agent types, plus the rule summary.

## What the agents do

- **Rats** start gathered in nests under the restaurants (3 each). There are no holes at first. A hungry rat that smells a restaurant within 6 cells uses the nearest hole or digs a new one. Above ground it steals the meal from any delivery dog it touches.
- **Pedestrians** start at random house doors and walk randomly. They plug every hole they see and shoo every rat they touch; a shooed rat runs for a hole or digs an emergency one.
- **Delivery dogs** know the streets but not the rats. Rats and holes they see go into a shared learning map, and while carrying a meal they route around it. They always yield to pedestrians.
- **Terrain.** Hills come with real slopes (dogs ≤ 20%, people ≤ 45%, rats any). Hills and buildings block sight. The underground layer 3 m down holds soil, rock, tunnels and nests, and the canal blocks tunnels.
- **Movement** is grid by grid: one cell (4 m) per step, with slope-dependent step time.
- **Orders:** 20 per round. Each house with an order shows a countdown badge (240 s). Running out marks the order late, which is a failure; the countdown is not otherwise a penalty.

Full definitions are in the semantic model: [docs/semantic-model.md](docs/semantic-model.md).

## Tests

```
node tests/lab.cjs        # Environment Lab engine (16 checks)
node tests/city-life.cjs  # original delivery game
node tests/spatial.cjs    # Position + Movement predicates
node tests/agents.cjs     # earlier spatial-agents engine (agents.js, kept for reference)
```

## Files

- `lab-engine.js`: deterministic rules, maps, seeds, mutations, evaluation and evolution (no DOM; runs in Node).
- `lab3d-view.js`: draws the lab in the original 3D town and builds the panel.
- `city3d.js`, `terrain.js`, `spatial.js`: the original town scene, canal/bridges and Position + Movement workshop.
- `docs/`: semantic model, earlier assignment notes, screenshots and decks.

Source town and earlier workshop base: https://github.com/Wanerrrrr/Spatial-AI-10-8-2026 at `29f36266769c5b5b76ee00026026cfc07c3ce0f6`. See THIRD_PARTY_LICENSES.txt for the bundled 3D engine license. Add real student/team names when submitting.
