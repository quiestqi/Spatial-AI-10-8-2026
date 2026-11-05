# Bluehaven · Position + Movement

Publication target: https://quiestqi.github.io/Spatial-AI-10-8-2026/
Repository: https://github.com/quiestqi/Spatial-AI-10-8-2026

The capture/deck notes below describe the preparation snapshot before publication. GitHub Pages deployment status determines when this target serves the modified build.

Spatial AI + Computing workshop extension of https://github.com/Wanerrrrr/Spatial-AI-10-8-2026

Downloaded baseline: `29f36266769c5b5b76ee00026026cfc07c3ce0f6`.
Author credit: Wanerrrrr (repository account; replace with your class submission name).

## Run / 本地运行

Unzip and open `index.html` in Chrome, Edge or Firefox with WebGL enabled. Everything needed by the game is local: no build, account, API key or internet connection is needed. Optionally run `python3 -m http.server 8000` here and visit http://localhost:8000.

Start/Pause, Step, Reset, speed, automatic deliveries, charging, independent street life, distance queries, camera controls and the existing rat jump are preserved.

The **Position + Movement** panel has a **Show 3D relations** switch. It hides or shows indicators while detection and history continue. Collapse the panel via its heading. Green arrows show the customers' fixed south (+world y) facing; camera orbit does not change their frame. Purple lines show Between; gold shows the jump trajectory and movement; green outlines show Delivery Zones. Spatial history is separate from the mission log and resets with Reset.

## Reproduce the workshop / 演示

Examples reset the mission and place the dog at documented starting points. They do not force predicate results or freeze the rat. Use Normal or Slow speed for class demos.

1. **Rat crossing** → immediately **Step**: dog starts (16,21), jumps toward (16,19), with the rat initially (16,20). Above is visible near the apex; Over is recorded only after a verified crossing and landing. The rat continues roaming, so a delayed start can produce a jump with no Over. Reset/retry is intentional.
2. **Front / zone** → **Start**: walk from (16,22) to C1 at (16,18). See Toward, In front of and Into. Stop at the customer; Entering a building is never required.
3. **Behind** → **Start**: walk from (16,21) through C1's zone to (16,16). See Into, Out of and Behind.
4. **Between**: starts at (12,9), in the open gap between Market Houses and Post Office. Start walks north to (12,7).
5. **Auto deliveries** in Distance inspector → **Start** returns to the original autonomous mission. **Reset** restores its starting state.

Position is a live state; position history records when it becomes true. Movement records transitions or verified motion, never a label inferred only from an endpoint. Events include session time in seconds. The observer uses rendered positions on every animation frame, including actual airborne height and the moving rat's rendered location.

## Tests

From this folder:

```
node tests/city-life.cjs
node tests/spatial.cjs
```

Both pass. Original tests cover all three deliveries, charging, reset, continuous actor movement and building clearance. Spatial tests cover fixed customer frames, bounded front/back regions, open Between corridors, Above, zone entry/exit, Toward and successful Over; negative cases include stationary jumps, lateral misses, insufficient clearance, a moving rat that leaves the path, and missing samples.

A real Chromium/WebGL run also verified all eight relation types, 3D loading with no page errors, switching indicators and mobile layout. See `docs/browser-report.json`. Browser regression/recording is available in `tests/browser.cjs`; install Playwright separately if you wish to rerun it (`npm install --no-save playwright`). Set `CHROME_PATH` to your Chrome executable if necessary. Run it from this folder with `node tests/browser.cjs`; output goes to `docs/` and `.test-recording/`.

## Deliverables / 提交材料

- `docs/*.png`: browser screenshots, including mobile layout.
- `docs/rat-crossing.gif`: actual game recording with a verified crossing.
- `docs/Bluehaven-Position-Movement.pptx`: editable short deck with diagrams and an embedded animated GIF.
- `docs/assignment-notes.md`: definitions, thresholds and brief checklist.

This ZIP contains the modified build. **It has not been pushed or deployed.** The existing public site https://wanerrrrr.github.io/Spatial-AI-10-8-2026/ remains the original build until you upload the new files. For GitHub Pages, upload/replace `index.html`, `city3d.js`, `spatial.js`, `three.min.js` and the license file at the repository root. Upload `docs/` too if you want to share the deck and recording. Confirm the updated site before adding its URL to the assignment thread.

Before class submission, replace the repository handle with the actual student name(s) on the deck cover and add the confirmed published URL. The deck identifies the existing site as the source build, not the modified deployment.
