/* Environment Lab inside the Bluehaven 3D town.
   Rules live in lab-engine.js. This file draws them: a smooth terrain with a sunken canal, toon-shaded town,
   the rats' underground world, holes, orders, learning maps, and the side panel. */
(function () {
'use strict';
window.attachAgentsView = function ({ T, city, sim, bot, rat, pedestrians, CX, CZ, tiles, buildings, sites }) {
  const L = window.BluehavenLab, R = L.RULES, $ = id => document.getElementById(id), U = 1 / R.cellSize, VZ = 1.6; // terrain heights are drawn ×1.6 so hills read clearly
  const oldTerrain = BluehavenTerrain.create(sim.world);
  const W = L.TOWN.W, H = L.TOWN.H, N = W * H, SUB = 4;
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%', secs = v => v == null ? '—' : Math.round(v) + ' s';
  const ACTIVE = { waiting: 1, assigned: 1, carrying: 1 };
  const app = { enabled: true, running: false, tab: 'sim', view: 'split', layer: 'surface', selected: null, selPane: 'surface', cell: null };
  window.labApp = app; window.agentsApp = app; // the legacy city-life loop pauses while the lab is on
  const scene = city.parent;

  /* ================= toon ("3D rendered as 2D") look for the whole town ================= */
  const gradient = new T.DataTexture(new Uint8Array([88, 88, 88, 255, 150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 4, 1, T.RGBAFormat);
  gradient.minFilter = gradient.magFilter = T.NearestFilter; gradient.needsUpdate = true;
  const toon = (color, extra = {}) => new T.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
  const PALETTE = { '#ffffff': '#fbf6ec', '#f5f7fc': '#ece3d3', '#b8c9e3': '#6d8fc6', '#1d4d90': '#22457f', '#2c5a99': '#2d5c9c',
    '#e1e7f1': '#ebe5d9', '#d3dced': '#dcd5c6', '#bccce5': '#c7bca8', '#f8fafc': '#fbf6ec', '#9bbfea': '#8cc9de', '#9ab8e0': '#e9b45a',
    '#776b83': '#7d6e86', '#e6a7bd': '#eba7b9', '#27314b': '#27314b', '#ecc4a9': '#f0c7a4', '#95c4ff': '#9fd3ff' };
  const converted = new Map(), foliage = ['#86bf7d', '#76b175', '#98c987', '#6fa86f'];
  const skipToon = new Set();
  function toToon(m) {
    if (converted.has(m)) return converted.get(m);
    const hex = '#' + m.color.getHexString(), c = PALETTE[hex] || hex, extra = {};
    if (hex === '#2c5a99') { extra.emissive = new T.Color('#173a6e'); extra.emissiveIntensity = .35; }
    const t = toon(c, extra); t.side = m.side; t.transparent = m.transparent; t.opacity = m.opacity; converted.set(m, t); return t;
  }
  function inside(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
  const actors = [bot, rat, ...[...pedestrians.values()].map(p => p.group)];
  let treeIndex = 0;
  city.traverse(o => {
    if (o.isLineSegments && o.material?.isLineBasicMaterial) { o.material.color.set('#2e4a78'); o.material.opacity = .42; return; }
    if (!o.isMesh || !o.material?.isMeshStandardMaterial) return;
    const p = o.geometry?.parameters, isSphere = o.geometry?.type === 'SphereGeometry', white = o.material.color.getHexString() === 'ffffff';
    if (isSphere && white && p && p.radius >= .18 && !actors.some(a => inside(o, a))) { o.material = toon(foliage[treeIndex++ % foliage.length]); o.scale.multiplyScalar(1.18); return; }
    o.material = toToon(o.material);
  });
  for (const l of scene.children) {
    if (l.isHemisphereLight) { l.color.set('#eef4ff'); l.groundColor.set('#cdbb9c'); l.intensity = 1.55; }
    if (l.isDirectionalLight) { l.color.set('#fff3df'); l.intensity = 2.35; l.position.set(-34, 58, 18); l.shadow.radius = 3; l.shadow.bias = -.0006; l.shadow.normalBias = .02; }
  }
  { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#dbe8f7'); grd.addColorStop(.55, '#eef2f4'); grd.addColorStop(1, '#f6efe2'); g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; scene.background = tx; }

  /* ================= panel ================= */
  const style = document.createElement('style');
  style.textContent = `
  .lab-panel{position:fixed;right:16px;top:92px;z-index:10;width:380px;max-height:calc(100dvh - 168px);overflow:auto;padding:14px;background:#fffdf8f7;border:1px solid #d9d2c3;border-radius:14px;box-shadow:0 6px 26px #3a2e1a1a;font-size:13px;color:#1f3a63}
  .lab-panel[hidden]{display:none}.lab-panel h3{font-size:15px;margin:2px 0 8px}.lab-panel h4{font-size:13px;margin:12px 0 6px;color:#1e4f86}
  .lab-panel p{font-size:12px;line-height:1.5;margin:6px 0;color:#5b6f8a}
  .lab-tabs{display:flex;gap:4px;margin-bottom:10px}.lab-tabs button{flex:1;font-size:12.5px;padding:7px 4px;border-radius:9px}
  .lab-tabs button[aria-selected=true]{background:#1f4f8f;color:#fff;border-color:#1f4f8f}
  .lab-panel button,.lab-panel select,.lab-panel input{font-size:12.5px;padding:5px 8px;border-radius:8px}
  .lab-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}.lab-row label{display:inline-flex;gap:4px;align-items:center;font-size:12.5px}
  .seg{display:inline-flex;border:1.5px solid #c9d3e2;border-radius:9px;overflow:hidden}.seg button{border:0;border-radius:0;background:#fff}.seg button[aria-pressed=true]{background:#1f4f8f;color:#fff}
  .lab-metrics{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin:8px 0}.lab-metrics div{background:#f1ede4;border-radius:8px;padding:6px 7px}
  .lab-metrics small{display:block;font-size:10.5px;color:#6a7a90}.lab-metrics strong{font-size:16px;font-variant-numeric:tabular-nums}
  .lab-lin{font-size:11px;color:#6a7a90;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lab-orders{display:grid;gap:3px;font-size:11.5px}.lab-order{display:grid;grid-template-columns:1fr 70px 34px;gap:6px;align-items:center}
  .lab-order .b{height:6px;background:#e7e1d4;border-radius:4px;overflow:hidden}.lab-order .b i{display:block;height:100%;background:#f0a020}.lab-order.low .b i{background:#e2573b}
  .lab-order .t{text-align:right;font-variant-numeric:tabular-nums;color:#5b6f8a}
  .lab-panel .primary-btn{background:#ffcb45;border:2px solid #e9b22b;color:#5e4413;font-weight:650}
  .lab-log{list-style:none;padding:0;margin:0;max-height:170px;overflow:auto;font-size:11.5px}.lab-log li{padding:3px 0;border-bottom:1px solid #eee8dc}
  .lab-inspect{font-size:12px;line-height:1.65}.lab-inspect code{background:#f1ede4;padding:0 4px;border-radius:4px}
  .lab-legend{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;color:#5b6f8a;margin:4px 0}.lab-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px}
  .lab-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.lab-tools button[aria-pressed=true]{background:#1f4f8f;color:#fff;border-color:#1f4f8f}
  .lab-warn{color:#c2410c;font-size:12px}.lab-ok{color:#15803d;font-size:12px}
  .lab-chart{position:relative}.lab-chart svg{width:100%;height:150px;display:block}.lab-tip{position:absolute;pointer-events:none;background:#1f3a63;color:#fff;font-size:11px;padding:5px 7px;border-radius:7px;white-space:nowrap;display:none;z-index:3}
  .lab-table{width:100%;border-collapse:collapse;font-size:11.5px}.lab-table th,.lab-table td{padding:4px;border-bottom:1px solid #eee8dc;text-align:left;font-variant-numeric:tabular-nums}
  .lab-table tbody tr{cursor:pointer}.lab-table tr.sel{background:#fff1cf}.lab-table tr:hover{background:#f7f3ea}
  .pill{font-size:10.5px;padding:1px 6px;border-radius:999px;background:#e3f4e8;color:#15803d}.pill.no{background:#eeeae2;color:#7a879a}
  .lab-split{position:absolute;inset:0;pointer-events:none;z-index:2}.lab-split .div{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:linear-gradient(#ffffffee,#ffffffaa);box-shadow:0 0 0 1px #d6cdb9}
  .lab-split .tag{position:absolute;top:96px;padding:7px 12px;border-radius:11px;background:#fffdf8f2;border:1.5px solid #ddd3c0;font:600 13px system-ui;color:#1f3a63}
  .lab-split .tag small{display:block;font-weight:400;color:#6a7a90;font-size:11.5px}
  .lab-split .tag.S{left:16px;border-left:5px solid #5f9e5a}.lab-split .tag.U{border-left:5px solid #8a5a2b}
  .lab-panel.collapsed{width:auto;max-height:none;overflow:visible}.lab-panel.collapsed>*:not(:first-child){display:none}.lab-panel.collapsed h3{display:none}
  .lab-rules ul{padding-left:17px;margin:6px 0;font-size:12px;line-height:1.55}
  @media(max-width:700px){.lab-panel{right:8px;left:8px;width:auto;top:auto;bottom:8px;max-height:46dvh}.lab-split .tag{top:150px;font-size:11px}}
  `;
  document.head.appendChild(style);
  const oldPanel = $('agentPanel'), panel = document.createElement('div'); panel.id = 'agentPanel'; panel.className = 'lab-panel'; oldPanel.replaceWith(panel);
  panel.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center"><h3>Environment Lab</h3><button id="labCollapse">Hide ›</button></div>
  <div class="lab-tabs" role="tablist"><button data-tab="sim">Simulate</button><button data-tab="evolve">Evolve</button><button data-tab="build">Build</button><button data-tab="rules">Rules</button></div>
  <section data-pane="sim">
    <div class="lab-row"><span class="seg" id="labView"><button data-v="split">Surface | Underground</button><button data-v="surface">Surface</button><button data-v="under">Underground</button></span></div>
    <div class="lab-row"><label>Surface layer <select id="labLayer"><option value="surface">Terrain & town</option><option value="robotMap">Robot learning map</option><option value="ratMap">Rat learning map</option><option value="elev">Elevation & slope</option></select></label></div>
    <div class="lab-legend" id="labLegend"></div>
    <h4>Town</h4>
    <div class="lab-row"><b id="labName"></b></div><div class="lab-lin" id="labLin"></div>
    <div class="lab-row"><label>Seed <input type="number" id="labSeed" value="12" min="0" style="width:72px"></label><button id="labGen">Generate</button><button id="labRand" title="Random seed">🎲</button><button id="labOrig">Original town</button><button id="labEdit">Edit</button></div>
    <div class="lab-row"><label>Order seed <input type="number" id="labOrderSeed" value="7" min="1" style="width:60px"></label><label><input type="checkbox" id="labLearning" checked> Robots learn & avoid rats</label></div>
    <div class="lab-metrics"><div><small>Success</small><strong id="mSr">—</strong></div><div><small>Avg delivery</small><strong id="mAv">—</strong></div><div><small>Done/stolen/late</small><strong id="mDs">0/0/0</strong></div><div><small>Holes open·dug·plugged</small><strong id="mHo">0·0·0</strong></div></div>
    <div class="lab-orders" id="labOrders"></div><p id="labFoot"></p>
    <h4>Inspect</h4><div class="lab-inspect" id="labInspect">Click a dog, rat, pedestrian or any cell — on the surface or underground.</div>
    <h4>Events</h4><ol class="lab-log" id="labLog"></ol>
  </section>
  <section data-pane="evolve" hidden>
    <p>Each epoch generates and evaluates one environment: epoch 0 comes from the seed, every later epoch mutates the best town so far. Fitness = success rate × 100 − average delivery time / 10. A fitter town replaces the best.</p>
    <div class="lab-row"><label>Seed <input type="number" id="evoSeed" value="12" min="1" style="width:70px"></label><label>Epochs <input type="number" id="evoEpochs" value="12" min="2" max="60" style="width:56px"></label><label>Runs/map <select id="evoRuns"><option>1</option><option selected>2</option><option>3</option></select></label></div>
    <div class="lab-row"><label>Hill relief (m) <input type="number" id="evoRelief" value="8" min="0" max="16" style="width:56px"></label><button id="evoStart" class="primary-btn">Run evolution</button><button id="evoStop" disabled>Stop</button></div>
    <p id="evoStatus"></p>
    <div class="lab-chart"><h4>Delivery success rate</h4><svg id="evoChartS"></svg><div class="lab-tip"></div></div>
    <div class="lab-chart"><h4>Average delivery time (lower is better)</h4><svg id="evoChartT"></svg><div class="lab-tip"></div></div>
    <table class="lab-table"><thead><tr><th>#</th><th>Change</th><th>Success</th><th>Time</th><th>Stolen</th><th>Late</th><th></th></tr></thead><tbody id="evoTable"></tbody></table>
    <div class="lab-row"><button id="evoLoad" class="primary-btn">Load into town</button><button id="evoToBuild">Edit in Build</button><button id="evoRegen">New seed & rerun</button></div>
  </section>
  <section data-pane="build" hidden>
    <p>Click the 3D town to paint. Raising a building cell raises its whole pad. Earth-coloured ground marks slopes over 20%, which robots cannot climb (people up to 45%, rats any).</p>
    <h4>Terrain</h4><div class="lab-tools" data-group="t"></div>
    <h4>Ground & underground</h4><div class="lab-tools" data-group="g"></div>
    <h4>Buildings</h4><div class="lab-tools" data-group="b"></div>
    <div class="lab-row"><label>Brush <select id="bBrush"><option value="0">1 cell</option><option value="1" selected>3 × 3</option><option value="2">5 × 5</option></select></label>
      <label>View <select id="bLayer"><option value="surface">Surface</option><option value="elev">Elevation</option><option value="under">Underground</option></select></label></div>
    <h4>Start from</h4>
    <div class="lab-row"><button id="bOriginal">Original town</button><label>Seed <input type="number" id="bSeed" value="3" min="1" style="width:64px"></label><button id="bGen">Generate</button><button id="bRand" title="Random seed">🎲</button></div>
    <div class="lab-row"><label>Relief (m) <input type="number" id="bRelief" value="8" min="0" max="16" style="width:52px"></label><label>Restaurants <input type="number" id="bRest" value="5" min="1" max="10" style="width:52px"></label></div>
    <div class="lab-row"><button id="bExport">Export JSON</button><label style="cursor:pointer"><input type="file" id="bImport" accept=".json,application/json" hidden><span style="border:1.5px solid #c9d3e2;border-radius:8px;padding:5px 8px;background:#fff">Import JSON</span></label><button id="bEval">Quick evaluate</button></div>
    <div class="lab-row"><button id="bRun" class="primary-btn">Run this town</button></div>
    <div id="bCheck"></div><div id="bEvalOut" style="font-size:12px"></div>
  </section>
  <section data-pane="rules" class="lab-rules" hidden>
    <h4>How the three agent types affect each other</h4><div id="labInfluence"></div><ul id="labInfluenceList"></ul>
    <h4>Rules</h4><ul>
      <li><b>Grid by grid.</b> Every agent moves one cell (N/E/S/W) at a time. A step takes 4 m ÷ speed × slope factor (uphill 1 + 3s, downhill 1 + 0.6s). Going between surface and underground only happens through a hole and takes 1.5 s.</li>
      <li><b>Rats</b> start in the nest under every restaurant (3 each). There are no holes at the start. A hungry rat that smells a restaurant within 6 cells uses the nearest hole, or digs one about 3 cells from the restaurant door. Above ground it hunts any meal-carrying dog within 3 cells.</li>
      <li><b>Pedestrians</b> start at the doors of 8 random houses and walk randomly. They see 4 cells, blocked by buildings and hills. They plug holes they see and shoo rats they touch; a shooed rat runs to the nearest hole or digs an emergency one.</li>
      <li><b>Delivery dogs</b> know the streets but not the rats. Rats and holes they see go into a shared learning map; while carrying a meal they route around it. A rat that touches a carrying dog steals the meal. Restaurant doorsteps are guarded.</li>
      <li><b>Orders</b> (20) appear over the first 600 s, each with a 240 s countdown. The countdown is shown and decides "late", but it is not a score penalty.</li>
      <li><b>Performance</b>: success rate = delivered ÷ (delivered + stolen + late); delivery time = delivered − ordered.</li>
    </ul><p>Full definitions: <a href="docs/semantic-model.md">docs/semantic-model.md</a></p>
  </section>`;
  const host = $('map'); host.style.position = 'relative';
  const splitUi = document.createElement('div'); splitUi.className = 'lab-split';
  splitUi.innerHTML = '<div class="div"></div><div class="tag S">Surface<small>terrain · town · deliveries</small></div><div class="tag U">Underground · rats’ world<small>soil · rock · tunnels · nests · holes</small></div>';
  host.appendChild(splitUi);

  /* ================= static town parts that follow the terrain ================= */
  const labRoot = new T.Group(); city.add(labRoot);
  const mats = { stone: toon('#f4efe4'), trim: toon('#9fb2d2'), rail: toon('#2c4f82'), found: toon('#d6ccb8'), water: toon('#7cc4da', { transparent: true, opacity: .88, emissive: new T.Color('#2c6f8a'), emissiveIntensity: .18 }) };
  const bridgeGroup = new T.Group(); labRoot.add(bridgeGroup);
  function tbox(parent, material, w, h, d, x, top, y) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), material); m.position.set(x - CX, top - h / 2, y - CZ); m.receiveShadow = m.castShadow = true; parent.add(m); }
  function rails(piece, tile) {
    const { x, y } = tile;
    for (const side of [-1, 1]) {
      if (oldTerrain.at({ x: x + side, y })?.crossing === tile.crossing) continue;
      const edge = x + side * .46, low = oldTerrain.elevation({ x, y: y - .5 }, tile) + .32, high = oldTerrain.elevation({ x, y: y + .5 }, tile) + .32;
      const beam = new T.Mesh(new T.BoxGeometry(.055, .055, Math.hypot(1, high - low)), mats.rail); beam.position.set(edge - CX, (low + high) / 2, y - CZ); beam.rotation.x = -Math.atan2(high - low, 1); piece.add(beam);
      for (const end of [-.37, .37]) tbox(piece, mats.rail, .06, .34, .06, edge, oldTerrain.elevation({ x, y: y + end }, tile) + .33, y + end);
    }
  }
  function arch(piece, tile, deck) {
    const { x, y } = tile, bottom = deck - .12, p = new T.Shape();
    p.moveTo(-.5, -.35); p.lineTo(-.5, bottom); p.lineTo(.5, bottom); p.lineTo(.5, -.35); p.lineTo(.43, -.35); p.lineTo(.43, .1); p.bezierCurveTo(.43, .85, -.43, .85, -.43, .1); p.lineTo(-.43, -.35); p.closePath();
    const m = new T.Mesh(new T.ExtrudeGeometry(p, { depth: 1, bevelEnabled: false, curveSegments: 20 }), mats.stone); m.rotation.y = Math.PI / 2; m.position.set(x - .5 - CX, 0, y - CZ); m.castShadow = m.receiveShadow = true; piece.add(m);
  }
  for (const [, tile] of oldTerrain.cells) {
    const { x, y, kind } = tile;
    if (kind === 'stairs') { const d = 1 / oldTerrain.stepsPerCell; for (let s = 0; s < oldTerrain.stepsPerCell; s++) { const c = y - .5 + d * (s + .5), top = oldTerrain.elevation({ x, y: c }); tbox(bridgeGroup, mats.stone, 1, top + .3, d, x, top, c); tbox(bridgeGroup, mats.trim, 1, .018, d, x, top, c); } rails(bridgeGroup, tile); continue; }
    if (kind !== 'bridge') continue; const top = oldTerrain.elevation(tile); arch(bridgeGroup, tile, top); tbox(bridgeGroup, mats.trim, 1, .12, 1, x, top, y); rails(bridgeGroup, tile);
  }
  const canal = new T.Mesh(new T.PlaneGeometry(W, .98), mats.water); canal.rotation.x = -Math.PI / 2; canal.position.set(0, -.07, L.TOWN.canalRow - CZ); canal.receiveShadow = true; labRoot.add(canal);

  const pedGroups = [...pedestrians.values()].map(p => p.group);
  const skip = new Set([...tiles, ...buildings, ...sites, bot, rat, ...pedGroups, labRoot]);
  const liftables = [], sheets = [], tmpBox = new T.Box3(), tmpV = new T.Vector3();
  for (const o of [...city.children]) {
    if (skip.has(o)) continue;
    if (o.isGroup) { if (o.position.lengthSq() < 1e-6) { if (o.children.length > 20) for (const c of o.children) liftables.push(c); } else liftables.push(o); continue; }
    if (o.isMesh) { tmpBox.setFromObject(o).getSize(tmpV); if (Math.max(tmpV.x, tmpV.z) > 5 || tmpV.y < .07) { sheets.push(o); continue; } }
    if (o.isMesh || o.isSprite) liftables.push(o);
  }
  for (const o of [...liftables, ...buildings]) o.userData.baseY = o.position.y;

  /* ================= terrain heights ================= */
  function cellH(map, i) { const s = map.surface[i]; if (s === 'water' || s === 'bridge') return -.34; if (s === 'stairs') return 0; return map.elev[i] * U * VZ; }
  const smooth = t => t * t * (3 - 2 * t);
  function heightAt(map, x, y) { // smooth interpolation between cell centres: exact at centres, gentle slopes between
    const fx = Math.max(0, Math.min(W - 1, x)), fy = Math.max(0, Math.min(H - 1, y)), x0 = Math.min(W - 2, Math.floor(fx)), y0 = Math.min(H - 2, Math.floor(fy));
    const sx = smooth(fx - x0), sy = smooth(fy - y0), h = (i, j) => cellH(map, (y0 + j) * W + x0 + i);
    return (h(0, 0) * (1 - sx) + h(1, 0) * sx) * (1 - sy) + (h(0, 1) * (1 - sx) + h(1, 1) * sx) * sy;
  }
  let liftedFor = null, legacyHidden = false;
  function applyTown(map) {
    const lab = !!map;
    if (lab !== legacyHidden) { legacyHidden = lab; for (const t of tiles) t.visible = !lab; for (const s of sites) s.visible = !lab; for (const s of sheets) s.visible = !lab; }
    const key = map ? map._key : null; if (key === liftedFor) return; liftedFor = key;
    for (const b of buildings) { const blk = map?.blocks?.find(k => k.name === b.userData.name); b.position.y = b.userData.baseY + (blk ? map.elev[blk.y * W + blk.x] * U * VZ : 0); }
    for (const o of liftables) { o.getWorldPosition(tmpV); o.position.y = o.userData.baseY + (map ? Math.max(0, heightAt(map, tmpV.x + CX, tmpV.z + CZ)) : 0); }
  }

  /* ================= per-town visual layer ================= */
  const CLASS = { road: '#ebe4d6', grass: '#9ccb86', grassHigh: '#c2dd9c', pad: '#ddd5c4', bed: '#4f8aa0', dirt: '#c8a275' };
  const UNDER = { soil: ['#c99e6b', 0, -1], rock: ['#9a9da4', .14, -1], tunnel: ['#5a3d28', -.24, -1], nest: ['#d9813f', -.3, -1], water: ['#5fa7c4', -.36, -1] };
  const col = new T.Color(), col2 = new T.Color(), dummy = new T.Object3D();
  const templates = { robot: [bot], rat: [rat], person: pedGroups };
  const tagColors = { robot: '#285ca2', rat: '#8e5aa8', person: '#328d80' };
  function sprite(w, h, sw, sh) { const c = document.createElement('canvas'); c.width = w; c.height = h; const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; const s = new T.Sprite(new T.SpriteMaterial({ map: tx, depthTest: false })); s.scale.set(sw, sh, 1); s.renderOrder = 20; s.userData = { canvas: c, texture: tx }; return s; }
  function tagText(s, text, color) { if (s.userData.text === text) return; s.userData.text = text; const c = s.userData.canvas, ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#fffdf8f2'; ctx.beginPath(); ctx.roundRect(4, 4, c.width - 8, c.height - 8, 24); ctx.fill(); ctx.fillStyle = color; ctx.font = '600 ' + Math.round(c.height * .3) + 'px system-ui, Apple Color Emoji'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 24); s.userData.texture.needsUpdate = true; }
  function signText(s, text, bg) { const c = s.userData.canvas, ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(4, 4, c.width - 8, c.height - 8, 26); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '700 40px system-ui, Apple Color Emoji'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 30); s.userData.texture.needsUpdate = true; }
  function disposeSprite(s) { s.material.map.dispose(); s.material.dispose(); }
  function disposeTree(o) { o.traverse(c => { if (c.isSprite) disposeSprite(c); else if (c.geometry && !c.userData.shared) c.geometry.dispose(); }); }

  const terrainMat = toon('#ffffff', { vertexColors: true }), skirtMat = toon('#b58b5c'), overlayMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const underMat = toon('#ffffff'), unit = new T.BoxGeometry(.985, 1, .985); unit.userData = {};
  function makeVisual(key) {
    const v = { key, sim: null, map: null, acc: 0, models: new Map(), holes: new Map(), badges: new Map(), signs: [] };
    v.surface = new T.Group(); v.under = new T.Group(); labRoot.add(v.surface, v.under);
    v.terrain = null; v.overlay = null; v.skirt = null;
    v.found = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mats.found, 40); v.found.castShadow = v.found.receiveShadow = true; v.surface.add(v.found);
    v.slopes = new T.Group(); v.surface.add(v.slopes); v.holeGroup = new T.Group(); v.surface.add(v.holeGroup); v.signGroup = new T.Group(); v.surface.add(v.signGroup);
    v.agents = new T.Group(); labRoot.add(v.agents);
    v.underCells = new T.InstancedMesh(unit, underMat, N); v.underCells.castShadow = v.underCells.receiveShadow = true; v.under.add(v.underCells);
    v.underHoles = new T.Group(); v.under.add(v.underHoles); v.nestSigns = new T.Group(); v.under.add(v.nestSigns);
    v.underCells.setColorAt(0, col.set('#fff'));
    return v;
  }
  const V = { S: makeVisual('S'), E: makeVisual('E') }; app.V = V;
  const selRing = new T.Mesh(new T.RingGeometry(.62, .72, 40), new T.MeshBasicMaterial({ color: '#f0a020', side: T.DoubleSide, depthTest: false })); selRing.rotation.x = -Math.PI / 2; selRing.renderOrder = 9; labRoot.add(selRing);
  const cellMark = new T.Mesh(new T.RingGeometry(.42, .52, 4, 1, Math.PI / 4), new T.MeshBasicMaterial({ color: '#f0a020', side: T.DoubleSide, depthTest: false })); cellMark.rotation.x = -Math.PI / 2; cellMark.renderOrder = 9; labRoot.add(cellMark);

  function cellSlope(map, i) {
    const x = i % W, y = (i / W) | 0, flat = k => map.surface[k] === 'road' || map.surface[k] === 'grass'; if (!flat(i)) return 0; let m = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (flat(j)) m = Math.max(m, Math.abs(map.elev[j] - map.elev[i]) / R.cellSize); }
    return m;
  }
  function cellColor(map, i, maxE, out) {
    const s = map.surface[i];
    if (s === 'water' || s === 'bridge') return out.set(CLASS.bed);
    if (s === 'house' || s === 'restaurant') return out.set(CLASS.pad);
    if (s === 'grass') { out.set(CLASS.grass).lerp(col2.set(CLASS.grassHigh), Math.min(1, map.elev[i] / Math.max(4, maxE))); }
    else { out.set(CLASS.road); const x = i % W, y = (i / W) | 0; out.offsetHSL(0, 0, ((x + y) % 2 ? .012 : -.012)); }
    const sl = cellSlope(map, i); if (sl > R.robot.maxSlope) out.lerp(col2.set(CLASS.dirt), .65); else if (sl > .1) out.lerp(col2.set(CLASS.dirt), .25);
    return out;
  }
  function buildTerrain(v) {
    const m = v.map, nx = W * SUB + 1, ny = H * SUB + 1, pos = new Float32Array(nx * ny * 3), colr = new Float32Array(nx * ny * 3), idx = [];
    const maxE = Math.max(1, ...m.elev.filter((e, i) => m.surface[i] === 'road' || m.surface[i] === 'grass'));
    const cc = Array.from({ length: N }, (_, i) => cellColor(m, i, maxE, new T.Color()));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = -.5 + i / SUB, y = -.5 + j / SUB, k = j * nx + i;
      pos[k * 3] = x - CX; pos[k * 3 + 1] = heightAt(m, x, y); pos[k * 3 + 2] = y - CZ;
      const fx = Math.max(0, Math.min(W - 1, x)), fy = Math.max(0, Math.min(H - 1, y)), x0 = Math.min(W - 2, Math.floor(fx)), y0 = Math.min(H - 2, Math.floor(fy));
      // colours blend over a quarter cell so materials meet softly
      const bx = Math.max(0, Math.min(1, (fx - x0 - .38) / .24)), by = Math.max(0, Math.min(1, (fy - y0 - .38) / .24));
      const a = cc[y0 * W + x0], b = cc[y0 * W + x0 + 1], c = cc[(y0 + 1) * W + x0], d = cc[(y0 + 1) * W + x0 + 1];
      const hm = pos[k * 3 + 1] / (U * VZ), fr = hm - Math.floor(hm), contour = hm > .25 && (fr < .07 || fr > .93) ? .86 : 1;
      const grassy = (m.surface[Math.round(fy) * W + Math.round(fx)] === 'grass'), mottle = grassy ? 1 + .05 * Math.sin(x * 2.1 + Math.sin(y * 1.3) * 2) * Math.cos(y * 1.7 - x * .6) : 1;
      for (let ch = 0; ch < 3; ch++) { const g = ['r', 'g', 'b'][ch]; colr[k * 3 + ch] = ((a[g] * (1 - bx) + b[g] * bx) * (1 - by) + (c[g] * (1 - bx) + d[g] * bx) * by) * contour * mottle; }
    }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (v.terrain) { v.surface.remove(v.terrain, v.overlay, v.skirt); v.terrain.geometry.dispose(); v.overlay.geometry.dispose(); v.skirt.geometry.dispose(); }
    v.terrain = new T.Mesh(g, terrainMat); v.terrain.receiveShadow = true; v.terrain.castShadow = true; v.surface.add(v.terrain);
    const og = new T.BufferGeometry(); og.setAttribute('position', g.getAttribute('position')); og.setIndex(g.getIndex()); og.setAttribute('color', new T.BufferAttribute(new Float32Array(nx * ny * 4), 4));
    v.overlay = new T.Mesh(og, overlayMat); v.overlay.renderOrder = 4; v.overlay.visible = false; v.surface.add(v.overlay);
    // diorama skirt: the soil cut along the edge of the town
    const sp = [], base = -1.1, edge = (x, y) => [x - CX, heightAt(m, x, y), y - CZ];
    const ring = []; for (let i = 0; i < nx; i++) ring.push([-.5 + i / SUB, -.5]); for (let j = 1; j < ny; j++) ring.push([W - .5, -.5 + j / SUB]); for (let i = nx - 2; i >= 0; i--) ring.push([-.5 + i / SUB, H - .5]); for (let j = ny - 2; j > 0; j--) ring.push([-.5, -.5 + j / SUB]); ring.push(ring[0]);
    for (let k = 0; k < ring.length - 1; k++) { const p = edge(...ring[k]), q = edge(...ring[k + 1]); sp.push(...p, ...q, q[0], base, q[2], ...p, q[0], base, q[2], p[0], base, p[2]); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(new Float32Array(sp), 3)); sg.computeVertexNormals();
    v.skirt = new T.Mesh(sg, skirtMat); v.skirt.material.side = T.DoubleSide; v.surface.add(v.skirt);
  }
  function buildFoundations(v) {
    const m = v.map; let k = 0;
    for (const b of m.blocks || []) { const z = m.elev[b.y * W + b.x] * U * VZ; dummy.position.set(b.x + (b.w - 1) / 2 - CX, z - .8 + .04, b.y + (b.d - 1) / 2 - CZ); dummy.scale.set(b.w - .1, 1.6, b.d - .1); dummy.updateMatrix(); v.found.setMatrixAt(k++, dummy.matrix); }
    v.found.count = k; v.found.instanceMatrix.needsUpdate = true;
  }
  function buildSlopes(v) {
    disposeTree(v.slopes); v.slopes.clear(); const m = v.map, mat = new T.MeshBasicMaterial({ color: '#e0531f' });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const x2 = x + dx, y2 = y + dy; if (x2 >= W || y2 >= H) continue; const a = y * W + x, b = y2 * W + x2, ok = i => m.surface[i] === 'road' || m.surface[i] === 'grass';
      if (!ok(a) || !ok(b) || Math.abs(m.elev[b] - m.elev[a]) / R.cellSize <= R.robot.maxSlope) continue;
      const bar = new T.Mesh(new T.BoxGeometry(dx ? .07 : .8, .07, dx ? .8 : .07), mat); bar.position.set(x + dx * .5 - CX, heightAt(m, x + dx * .5, y + dy * .5) + .05, y + dy * .5 - CZ); v.slopes.add(bar);
    }
  }
  function underTop(sim, i) { return UNDER[sim.under[i]]?.[1] ?? 0; }
  function buildUnder(v) {
    const sim = v.sim;
    for (let i = 0; i < N; i++) {
      const k = sim.under[i], [c, top0, bottom] = UNDER[k] || UNDER.soil, x = i % W, y = (i / W) | 0, hn = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, rnd = hn - Math.floor(hn);
      const top = k === 'rock' ? top0 + rnd * .14 : k === 'soil' ? top0 + (rnd - .5) * .03 : top0;
      dummy.position.set(x - CX, (top + bottom) / 2, y - CZ); dummy.scale.set(1, top - bottom, 1); dummy.updateMatrix(); v.underCells.setMatrixAt(i, dummy.matrix);
      col.set(c); col.offsetHSL(0, 0, (rnd - .5) * (k === 'rock' ? .1 : .07)); v.underCells.setColorAt(i, col);
    }
    v.underCells.instanceMatrix.needsUpdate = true; v.underCells.instanceColor.needsUpdate = true; v.underKey = sim.under.join('');
    if (!v.footprintKey || v.footprintKey !== v.map._key) { // outlines of the buildings above, for orientation
      v.footprintKey = v.map._key; if (v.footprints) { v.under.remove(v.footprints); v.footprints.geometry.dispose(); }
      const pts = []; for (const b of v.map.blocks || []) { const x0 = b.x - .5 - CX, x1 = b.x + b.w - .5 - CX, z0 = b.y - .5 - CZ, z1 = b.y + b.d - .5 - CZ, yy = .16;
        pts.push(x0, yy, z0, x1, yy, z0, x1, yy, z0, x1, yy, z1, x1, yy, z1, x0, yy, z1, x0, yy, z1, x0, yy, z0); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      v.footprints = new T.LineSegments(g, new T.LineBasicMaterial({ color: '#4a2f1c', transparent: true, opacity: .55, depthTest: false })); v.footprints.renderOrder = 6; v.under.add(v.footprints);
    }
  }
  function buildSigns(v) {
    for (const s of v.signs) { s.parent.remove(s); disposeSprite(s); } v.signs = [];
    for (const r of v.sim.restaurants) {
      const blk = r.block; if (!blk) continue; const z = v.map.elev[blk.y * W + blk.x] * U * VZ, cx = blk.x + (blk.w - 1) / 2 - CX, cz = blk.y + (blk.d - 1) / 2 - CZ;
      const s = sprite(512, 112, 3.6, .79); signText(s, '🍜 ' + r.name.toUpperCase(), '#ee9b32'); s.position.set(cx, z + (blk.height || 2) + (blk.kind === 'clock' ? 3.2 : blk.kind === 'church' ? 2.4 : 1.25), cz); v.signGroup.add(s); v.signs.push(s);
      const n = sprite(512, 112, 3.2, .7); signText(n, '🐀 NEST · ' + r.name.toUpperCase(), '#a8622a'); n.position.set(cx, .9, cz); v.nestSigns.add(n); v.signs.push(n);
    }
  }
  function buildModels(v) {
    for (const [, m] of v.models) { v.agents.remove(m.model, m.name, m.bubble); disposeSprite(m.name); disposeSprite(m.bubble); }
    v.models.clear(); let k = 0;
    for (const a of v.sim.agents) {
      const list = templates[a.type], model = list[k++ % list.length].clone(true); model.visible = true;
      model.traverse(o => { if (o.isSprite) o.visible = false; });
      model.scale.setScalar(a.type === 'robot' ? 1.35 : a.type === 'rat' ? .62 : .95);
      const name = sprite(512, 128, 1.9, .47), bubble = sprite(512, 128, 2.2, .55); v.agents.add(model, name, bubble);
      const mesh = { model, name, bubble, legs: [] };
      if (a.type === 'robot') { mesh.legs = model.children.filter(o => o.isGroup); const pi = bot.children.findIndex(o => o.isMesh && o.geometry?.parameters?.height === .22 && o.position.y === .86); mesh.parcel = model.children[pi]; }
      model.userData.agentId = a.id; v.models.set(a.id, mesh);
    }
  }
  let mapSerial = 0;
  function simOptions() { const s = +$('labOrderSeed').value || 7; return { orderSeed: s, agentSeed: s + 4, learning: $('labLearning').checked }; }
  function loadVisual(v, map) {
    v.map = L.cloneMap(map); v.map._key = ++mapSerial; v.sim = new L.LabSim(v.map, simOptions()); v.acc = 0;
    buildTerrain(v); buildFoundations(v); buildSlopes(v); buildUnder(v); buildSigns(v); buildModels(v);
    for (const g of [v.holeGroup, v.underHoles]) { disposeTree(g); g.clear(); } v.holes.clear();
    for (const [, b] of v.badges) { v.signGroup.remove(b); disposeSprite(b); } v.badges.clear();
  }

  const holeMat = toon('#2a1a0e'), rimMat = toon('#8a5a2b'), plugMat = toon('#a7adb6'), beamMat = new T.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: .35, depthWrite: false });
  function syncHoles(v) {
    const sim = v.sim, want = new Map();
    for (const [i, h] of sim.holes) want.set('h' + i, { i, h, kind: 'hole' });
    for (const p of sim.plugLog) if (sim.time - p.at < 40) want.set('p' + (p.y * W + p.x) + '@' + p.at, { i: p.y * W + p.x, h: p, kind: 'plug' });
    for (const [k, rec] of v.holes) if (!want.has(k)) { for (const g of rec) { g.parent.remove(g); disposeTree(g); } v.holes.delete(k); }
    for (const [k, o] of want) {
      if (v.holes.has(k)) continue; const g = new T.Group(), top = heightAt(v.map, o.h.x, o.h.y), parts = [g];
      if (o.kind === 'hole') {
        const d = new T.Mesh(new T.CircleGeometry(.27, 20), holeMat); d.rotation.x = -Math.PI / 2; d.position.y = .03; g.add(d);
        const rim = new T.Mesh(new T.TorusGeometry(.29, .06, 6, 20), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = .035; g.add(rim);
        for (let s = 0; s < 4; s++) { const clod = new T.Mesh(new T.SphereGeometry(.07, 6, 5), rimMat); const a = s * 1.7 + o.i; clod.position.set(Math.cos(a) * .42, .04, Math.sin(a) * .42); g.add(clod); }
        const u = new T.Group(), ut = underTop(sim, o.i);
        const ring = new T.Mesh(new T.TorusGeometry(.3, .06, 6, 20), rimMat); ring.rotation.x = Math.PI / 2; ring.position.y = ut + .02; u.add(ring);
        const beam = new T.Mesh(new T.CylinderGeometry(.22, .3, 1.6, 14, 1, true), beamMat); beam.position.y = ut + .8; u.add(beam);
        u.position.set(o.h.x - CX, 0, o.h.y - CZ); v.underHoles.add(u); parts.push(u);
      } else { const c = new T.Mesh(new T.CylinderGeometry(.27, .31, .08, 14), plugMat); c.position.y = .04; g.add(c); }
      g.position.set(o.h.x - CX, top, o.h.y - CZ); v.holeGroup.add(g); v.holes.set(k, parts);
    }
  }
  function badge(v, o) {
    let s = v.badges.get(o.id);
    if (!s) { s = sprite(256, 160, 1.9, 1.19); v.signGroup.add(s); v.badges.set(o.id, s); const blk = o.house.block; s.position.set(blk.x + (blk.w - 1) / 2 - CX, v.map.elev[blk.y * W + blk.x] * U * VZ + (blk.height || 2) + (blk.kind === 'clock' ? 3.4 : 1.35), blk.y + (blk.d - 1) / 2 - CZ); }
    const left = Math.max(0, o.deadline - v.sim.time), f = left / R.order.patience, text = o.id + '|' + Math.ceil(left) + '|' + o.status;
    if (s.userData.text === text) return; s.userData.text = text;
    const c = s.userData.canvas, ctx = c.getContext('2d'); ctx.clearRect(0, 0, 256, 160);
    ctx.fillStyle = '#fffdf8f0'; ctx.beginPath(); ctx.roundRect(6, 6, 244, 148, 30); ctx.fill();
    ctx.lineWidth = 12; ctx.strokeStyle = '#ebe4d6'; ctx.beginPath(); ctx.arc(70, 80, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = f < .25 ? '#e2573b' : '#f0a020'; ctx.beginPath(); ctx.arc(70, 80, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
    ctx.fillStyle = '#1f3a63'; ctx.font = '700 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.ceil(left), 70, 82);
    ctx.textAlign = 'left'; ctx.font = '700 30px system-ui'; ctx.fillText(o.id, 128, 58); ctx.font = '500 24px system-ui'; ctx.fillStyle = '#5b6f8a';
    ctx.fillText(o.status === 'carrying' ? '🛵 on way' : o.status === 'assigned' ? '🍜 pickup' : '⏳ waiting', 128, 104);
    s.userData.texture.needsUpdate = true;
  }
  function syncBadges(v) {
    const act = new Set(v.sim.orders.filter(o => ACTIVE[o.status]).map(o => o.id));
    for (const [id, s] of v.badges) if (!act.has(id)) { v.signGroup.remove(s); disposeSprite(s); v.badges.delete(id); }
    for (const o of v.sim.orders) if (ACTIVE[o.status]) badge(v, o);
  }
  function syncOverlay(v) {
    const layer = app.layer, sim = v.sim, show = layer !== 'surface'; v.overlay.visible = show; v.slopes.visible = layer === 'elev'; if (!show) return;
    const m = v.map, maxE = Math.max(1, ...m.elev.filter((e, i) => m.surface[i] === 'road' || m.surface[i] === 'grass'));
    const rgba = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const s = m.surface[i], ground = s === 'road' || s === 'grass'; let r = 0, g = 0, b = 0, a = 0;
      if (layer === 'robotMap') { const val = sim.fleet.risk[i] + sim.fleet.holeField[i]; if (sim.fleet.knownHoles.has(i)) { r = .72; g = .07; b = .07; a = .9; } else if (val > .05) { r = .9; g = .2; b = .18; a = Math.min(.75, val / 3); } }
      else if (layer === 'ratMap') { const f = sim.colony.food[i], d = sim.colony.danger[i]; if (f > .05 && f >= d) { r = .98; g = .65; b = .1; a = Math.min(.75, f / 3); } else if (d > .05) { r = .2; g = .4; b = .95; a = Math.min(.75, d / 3); } }
      else if (layer === 'elev' && ground) { const t = m.elev[i] / maxE; r = .92 - .82 * t; g = .96 - .55 * t; b = .94 - .5 * t; a = .72; }
      rgba.set([r, g, b, a], i * 4);
    }
    const attr = v.overlay.geometry.getAttribute('color'), nx = W * SUB + 1, ny = H * SUB + 1, arr = attr.array;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = Math.max(0, Math.min(W - 1, Math.round(-.5 + i / SUB - .001))), y = Math.max(0, Math.min(H - 1, Math.round(-.5 + j / SUB - .001))), k = (j * nx + i) * 4, c = (y * W + x) * 4;
      arr[k] = rgba[c]; arr[k + 1] = rgba[c + 1]; arr[k + 2] = rgba[c + 2]; arr[k + 3] = rgba[c + 3];
    }
    attr.needsUpdate = true;
  }
  function surfaceY(v, p) {
    const xi = Math.max(0, Math.min(W - 1, Math.round(p.x))), yi = Math.max(0, Math.min(H - 1, Math.round(p.y))), s = v.map.surface[yi * W + xi];
    if (s === 'stairs' || s === 'bridge') return oldTerrain.elevation({ x: p.x, y: p.y }) ?? 0;
    return Math.max(heightAt(v.map, p.x, p.y), -.05);
  }
  function placeAgents(v, pane, now) {
    const sim = v.sim;
    for (const a of sim.agents) {
      const m = v.models.get(a.id); if (!m) continue; const p = sim.pos(a);
      const show = pane === 'surface' ? p.layer === 'surface' : a.type === 'rat' && p.layer === 'under';
      let y;
      if (pane === 'surface') y = surfaceY(v, p) + (a.move && a.move.fl !== a.move.tl ? (p.layer === 'surface' ? -.35 * (1 - Math.abs(p.f - .5) * 2) : 0) : 0);
      else { const xi = Math.round(p.x), yi = Math.round(p.y); y = underTop(sim, yi * W + xi) + (a.move && a.move.fl !== a.move.tl ? .5 * (1 - Math.abs(p.f - .5) * 2) : 0); }
      m.model.visible = show; m.model.position.set(p.x - CX, y, p.y - CZ); m.model.rotation.y = -a.heading - Math.PI / 2;
      const moving = !!a.move && a.move.fl === a.move.tl;
      if (moving) m.model.position.y += Math.abs(Math.sin(now * .012)) * .025;
      m.legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(now * .013 + (i % 2) * Math.PI) * .4 : 0);
      if (m.parcel) m.parcel.visible = a.carrying;
      const sel = a.id === app.selected;
      m.name.visible = show && (a.type === 'robot' || sel);
      if (m.name.visible) tagText(m.name, a.type === 'robot' ? a.id + (a.carrying ? ' · 🍱 ' + a.order?.id : a.order ? ' · → ' + a.order.id : '') : a.id, tagColors[a.type]);
      m.name.position.set(p.x - CX, y + (a.type === 'robot' ? 1.75 : a.type === 'rat' ? .95 : 1.65), p.y - CZ);
      m.bubble.visible = show && a.iconUntil > sim.time && !!a.icon;
      if (m.bubble.visible) { tagText(m.bubble, a.icon, a.type === 'robot' ? '#c0466b' : a.type === 'rat' ? '#9a5a22' : '#2b7d70'); m.bubble.position.set(p.x - CX, m.name.position.y + (m.name.visible ? .6 : 0), p.y - CZ); }
    }
  }
  function syncSlow(v) { syncHoles(v); syncBadges(v); syncOverlay(v); if (v.sim.under.join('') !== v.underKey) buildUnder(v); }

  /* ================= Simulate tab ================= */
  function refreshSim(force) {
    const v = V.S, m = v.sim.summary();
    $('labName').textContent = v.map.name; $('labLin').textContent = (v.map.lineage || []).join(' → '); $('labLin').title = $('labLin').textContent;
    if (force && v.map.seed != null) $('labSeed').value = v.map.seed;
    $('mSr').textContent = pct(m.successRate); $('mAv').textContent = secs(m.avgTime); $('mDs').textContent = m.delivered + '/' + m.stolen + '/' + m.timeout; $('mHo').textContent = m.holesOpen + '·' + m.holesDug + '·' + m.holesPlugged;
    const act = v.sim.orders.filter(o => ACTIVE[o.status]).sort((a, b) => a.deadline - b.deadline).slice(0, 6);
    $('labOrders').innerHTML = act.map(o => { const left = Math.max(0, o.deadline - v.sim.time), f = left / R.order.patience;
      return '<div class="lab-order' + (f < .25 ? ' low' : '') + '"><span>' + o.id + ' · ' + o.house.name + ' · ' + (o.status === 'waiting' ? 'waiting' + (o.unreachable ? ' ⚠ unreachable' : '') : o.robot + (o.status === 'carrying' ? ' delivering' : ' to pickup')) + '</span><span class="b"><i style="width:' + Math.round(f * 100) + '%"></i></span><span class="t">' + Math.ceil(left) + 's</span></div>'; }).join('') || '<span style="color:#6a7a90">No active orders.</span>';
    const under = v.sim.rats.filter(r => r.layer === 'under').length;
    $('labFoot').textContent = 't = ' + Math.floor(m.time) + ' s · finished ' + m.finished + '/' + m.total + ' · rats ' + under + ' underground / ' + (v.sim.rats.length - under) + ' above · shoos ' + m.shoos + (m.done ? ' · ✅ round over' : '');
    $('labLog').innerHTML = v.sim.events.slice(0, 26).map(e => '<li>' + e.time.toFixed(0) + 's · ' + e.text + '</li>').join('');
    inspect();
  }
  function inspect() {
    const el = $('labInspect'), v = app.tab === 'build' ? V.E : V.S;
    if (app.selected) {
      const a = v.sim.agents.find(x => x.id === app.selected); if (!a) return;
      const kind = { robot: 'Delivery dog', rat: 'Rat', person: 'Pedestrian' }[a.type];
      el.innerHTML = '<b>' + a.id + '</b> · ' + kind + '<br>State <code>' + a.state + '</code>' + (a.busy > 0 ? ' · busy <code>' + a.busyKind + ' ' + a.busy.toFixed(1) + 's</code>' : '') + ' · layer <code>' + a.layer + '</code>' +
        '<br>Cell <code>' + a.x + ', ' + a.y + '</code> · elevation <code>' + v.map.elev[a.y * W + a.x].toFixed(1) + ' m</code> · walked <code>' + Math.round(a.distance) + ' m</code>' +
        (a.type === 'robot' ? '<br>Order <code>' + (a.order ? a.order.id + ' → ' + a.order.house.name : 'none') + '</code>' + (a.carrying ? ' · carrying a meal' : '') : '') +
        (a.type === 'rat' ? '<br>Nest <code>' + a.home + '</code>' + (a.carrying ? ' · carrying a stolen meal' : '') : '');
      return;
    }
    if (!app.cell) return; const c = v.sim.describeCell(app.cell.x, app.cell.y);
    el.innerHTML = '<b>Cell (' + c.x + ', ' + c.y + ')</b><br>Surface <code>' + c.surface + '</code>' + (c.building ? ' · <code>' + c.building.name + '</code> (' + c.building.type + ')' : '') +
      '<br>Elevation <code>' + c.elevation.toFixed(1) + ' m</code> · steepest slope <code>' + Math.round(c.maxSlope * 100) + '%</code>' + (c.maxSlope > R.robot.maxSlope ? ' <span class="lab-warn">too steep for robots</span>' : '') +
      '<br>Underground <code>' + c.underground + '</code> · hole <code>' + (c.hole ? 'yes' : 'no') + '</code><br>Robot map: risk <code>' + c.robotRisk + '</code>' + (c.robotKnowsHole ? ' · known hole' : '') + '<br>Rat map: food <code>' + c.ratFood + '</code> · danger <code>' + c.ratDanger + '</code>';
  }
  function loadTown(map) { loadVisual(V.S, map); app.running = false; app.selected = null; app.cell = null; control(); refreshSim(true); }
  $('labGen').onclick = () => loadTown(L.generateMap(+$('labSeed').value || 0));
  $('labRand').onclick = () => { $('labSeed').value = 1 + Math.floor(Math.random() * 99999); $('labGen').onclick(); };
  $('labOrig').onclick = () => loadTown(L.townMap());
  $('labEdit').onclick = () => { loadVisual(V.E, V.S.map); setTab('build'); };
  for (const id of ['labOrderSeed', 'labLearning']) $(id).onchange = () => loadTown(V.S.map);

  function setTab(t) {
    app.tab = t; for (const b of panel.querySelectorAll('.lab-tabs button')) b.setAttribute('aria-selected', b.dataset.tab === t);
    for (const s of panel.querySelectorAll('[data-pane]')) s.hidden = s.dataset.pane !== t;
    if (t === 'build') { app.running = false; control(); buildCheck(); }
    if (t === 'evolve') evo.render();
    app.selected = null; app.cell = null;
  }
  panel.querySelectorAll('.lab-tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  function setView(v) { app.view = v; for (const b of panel.querySelectorAll('#labView button')) b.setAttribute('aria-pressed', b.dataset.v === v); }
  panel.querySelectorAll('#labView button').forEach(b => b.onclick = () => setView(b.dataset.v));
  const LEGEND = {
    surface: '<span><i style="background:#9ccb86"></i>lawn</span><span><i style="background:#ebe4d6;border:1px solid #d5cbb8"></i>paving</span><span><i style="background:#c8a275"></i>steep (&gt; 20%: robots can’t)</span><span><i style="background:#2a1a0e"></i>hole</span><span><i style="background:#a7adb6"></i>just plugged</span><span>🍜 restaurant · ⏱ order countdown</span>',
    robotMap: '<span><i style="background:#e6564c"></i>learned rat risk (stronger = higher)</span><span><i style="background:#b71212"></i>known hole</span>',
    ratMap: '<span><i style="background:#f9a61a"></i>food memory</span><span><i style="background:#3366f2"></i>danger memory</span>',
    elev: '<span>heights drawn ×1.6</span><span><i style="background:#eaf3f1"></i>low</span><span><i style="background:#186068"></i>high</span><span><i style="background:#e0531f"></i>slope &gt; 20%</span>',
  };
  const UNDER_LEGEND = '<br><span><i style="background:#c99e6b"></i>soil</span><span><i style="background:#5a3d28"></i>tunnel</span><span><i style="background:#d9813f"></i>nest</span><span><i style="background:#9a9da4"></i>rock</span><span><i style="background:#ffe6a8"></i>light through a hole</span>';
  $('labLayer').onchange = () => { app.layer = $('labLayer').value; $('labLegend').innerHTML = LEGEND[app.layer] + UNDER_LEGEND; };

  /* ================= header controls ================= */
  const previous = { play: $('play').onclick, step: $('step').onclick, reset: $('reset').onclick, speed: $('speed').onchange };
  const speedText = [...$('speed').options].map(o => o.textContent);
  function speed() { return $('speed').value === '160' ? 15 : $('speed').value === '1200' ? 1 : 4; }
  function control() {
    if (!app.enabled) return;
    $('play').textContent = app.running ? 'Pause' : 'Start'; $('step').disabled = app.running;
    const m = V.S.sim.summary();
    $('gameHud').textContent = 'Success ' + pct(m.successRate) + ' · Avg ' + secs(m.avgTime) + ' · ' + m.delivered + ' delivered, ' + m.stolen + ' stolen, ' + m.timeout + ' late';
    $('gameGoal').textContent = 'Environment Lab · ' + V.S.map.name + ' · t = ' + Math.floor(m.time) + ' s';
  }
  function setMode(enabled) {
    app.enabled = enabled; app.running = false; labRoot.visible = enabled; sim.pause(); document.body.classList.toggle('agents-mode', enabled);
    $('modeSwitch').textContent = enabled ? 'Position workshop' : 'Environment Lab'; panel.hidden = !enabled; splitUi.hidden = !enabled;
    [...$('speed').options].forEach((o, k) => o.textContent = enabled ? ['Normal 4×', 'Fast 15×', 'Slow 1×'][k] : speedText[k]);
    if (enabled) control(); else { applyTown(null); sim.setDestination(sim.navigation() || { x: sim.snapshot().x, y: sim.snapshot().y }); window.city3D?.sync(); }
  }
  $('modeSwitch').onclick = () => setMode(!app.enabled);
  $('play').onclick = () => { if (!app.enabled) return previous.play(); if (app.tab === 'build') setTab('sim'); if (V.S.sim.done) loadVisual(V.S, V.S.map); app.running = !app.running; control(); };
  $('step').onclick = () => { if (!app.enabled) return previous.step(); app.running = false; V.S.sim.step(5); control(); refreshSim(); };
  $('reset').onclick = () => { if (!app.enabled) return previous.reset(); loadTown(V.S.map); };
  $('speed').onchange = () => { if (!app.enabled) previous.speed(); };
  $('labCollapse').onclick = () => { const c = panel.classList.toggle('collapsed'); $('labCollapse').textContent = c ? '‹ Lab' : 'Hide ›'; };

  /* ================= Build ================= */
  const TOOLS = { t: [['raise', 'Raise +0.5 m'], ['lower', 'Lower −0.5 m'], ['smooth', 'Smooth'], ['zero', 'Level to 0 m']], g: [['lawn', 'Lawn'], ['pave', 'Pave'], ['rock', 'Rock (under)'], ['soil', 'Soil (under)']], b: [['restaurant', 'Make restaurant'], ['house', 'Make house']] };
  let tool = 'raise';
  for (const [g, list] of Object.entries(TOOLS)) panel.querySelector('[data-group="' + g + '"]').innerHTML = list.map(([k, n]) => '<button data-tool="' + k + '" aria-pressed="' + (k === tool) + '">' + n + '</button>').join('');
  panel.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { tool = b.dataset.tool; panel.querySelectorAll('[data-tool]').forEach(o => o.setAttribute('aria-pressed', o === b)); });
  function paint(cx, cy) {
    const m = L.cloneMap(V.E.map), r = tool === 'restaurant' || tool === 'house' ? 0 : +$('bBrush').value, done = new Set();
    const blockAt = (x, y) => m.blocks?.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.d);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x, s = m.surface[i], blk = blockAt(x, y);
      if (tool === 'restaurant' || tool === 'house') { if (blk) { blk.role = tool; L.paintBlocks(m); L.protectNests(m); } continue; }
      if (tool === 'rock' || tool === 'soil') { if (m.under[i] !== 'water') m.under[i] = tool; continue; }
      if (tool === 'lawn' && s === 'road') { m.surface[i] = 'grass'; continue; } if (tool === 'pave' && s === 'grass') { m.surface[i] = 'road'; continue; }
      if (s === 'water' || s === 'bridge' || s === 'stairs' || tool === 'lawn' || tool === 'pave') continue;
      const cells = blk ? (() => { const c = []; for (let yy = blk.y; yy < blk.y + blk.d; yy++) for (let xx = blk.x; xx < blk.x + blk.w; xx++) c.push(yy * W + xx); return c; })() : [i];
      const id = blk ? 'b' + blk.name : i; if (done.has(id)) continue; done.add(id);
      for (const j of cells) {
        if (tool === 'raise') m.elev[j] = Math.min(20, +(m.elev[j] + .5).toFixed(1));
        if (tool === 'lower') m.elev[j] = Math.max(0, +(m.elev[j] - .5).toFixed(1));
        if (tool === 'zero') m.elev[j] = 0;
        if (tool === 'smooth' && !blk) { const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H).map(([a, b]) => b * W + a).filter(k => m.surface[k] === 'road' || m.surface[k] === 'grass');
          m.elev[j] = +((m.elev[j] + nb.reduce((t, k) => t + m.elev[k], 0)) / (nb.length + 1)).toFixed(1); }
      }
    }
    if (m.lineage[m.lineage.length - 1] !== 'hand-built edits') m.lineage.push('hand-built edits'); if (!/ · edited$/.test(m.name)) m.name += ' · edited';
    loadVisual(V.E, m); buildCheck();
  }
  function buildCheck() {
    const s = V.E.sim, out = [];
    if (!L.walkConnected(V.E.map)) out.push('<div class="lab-warn">Streets are not all connected.</div>');
    if (!s.restaurants.length) out.push('<div class="lab-warn">Needs at least one restaurant.</div>');
    if (s.restaurants.length) { const reach = new Set([s.restaurants[0].door]), q = [s.restaurants[0].door];
      while (q.length) { const i = q.pop(); for (const j of s.neighbors(i)) if (!reach.has(j) && Number.isFinite(s.surfaceCost('robot', i, j, 1))) { reach.add(j); q.push(j); } }
      const bad = s.houses.filter(h => !reach.has(h.door)).length;
      out.push(bad ? '<div class="lab-warn">' + bad + ' house(s) unreachable for robots (slope).</div>' : '<div class="lab-ok">Every house is reachable for robots.</div>'); }
    out.push('<p>' + V.E.map.name + ' · ' + s.houses.length + ' houses · ' + s.restaurants.length + ' restaurants · ' + s.rats.length + ' rats · highest ground ' + Math.max(...V.E.map.elev.filter((e, i) => V.E.map.surface[i] === 'road' || V.E.map.surface[i] === 'grass')).toFixed(1) + ' m</p>');
    $('bCheck').innerHTML = out.join('');
  }
  $('bLayer').onchange = () => { };
  $('bOriginal').onclick = () => { loadVisual(V.E, L.townMap()); buildCheck(); };
  $('bGen').onclick = () => { loadVisual(V.E, L.generateMap(+$('bSeed').value || 1, { relief: +$('bRelief').value, restaurants: +$('bRest').value })); buildCheck(); };
  $('bRand').onclick = () => { $('bSeed').value = 1 + Math.floor(Math.random() * 99999); $('bGen').onclick(); };
  $('bExport').onclick = () => { const m = { ...V.E.map }; delete m._key; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/json' })); a.download = 'bluehaven-' + m.name.replace(/[^\w-]+/g, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $('bImport').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const m = JSON.parse(await f.text()); if (m.w !== W || m.h !== H || m.surface?.length !== N || m.elev?.length !== N || m.under?.length !== N) throw new Error('expected a ' + W + ' × ' + H + ' Bluehaven map'); m.lineage = m.lineage || ['imported']; loadVisual(V.E, m); buildCheck(); } catch (err) { $('bCheck').innerHTML = '<div class="lab-warn">Import failed: ' + err.message + '</div>'; } e.target.value = ''; };
  $('bEval').onclick = () => { $('bEvalOut').textContent = 'Evaluating…'; setTimeout(() => { const m = L.evaluate(V.E.map, { learning: $('labLearning').checked }); $('bEvalOut').innerHTML = '2 order sets · success <b>' + pct(m.successRate) + '</b> · avg delivery <b>' + secs(m.avgTime) + '</b> · stolen ' + m.stolen + ' · late ' + m.timeout + ' · holes dug ' + m.holesDug; }, 30); };
  $('bRun').onclick = () => { loadTown(V.E.map); setTab('sim'); };

  /* ================= Evolve ================= */
  const evo = {
    results: [], sel: null, timer: null, it: null,
    start() { this.stop(); this.results = []; this.sel = null; const runs = +$('evoRuns').value, base = +$('labOrderSeed').value || 7;
      this.it = L.evolve({ seed: +$('evoSeed').value || 1, epochs: Math.max(2, Math.min(60, +$('evoEpochs').value || 12)), relief: +$('evoRelief').value, orderSeeds: Array.from({ length: runs }, (_, k) => base + k), learning: $('labLearning').checked });
      $('evoStart').disabled = true; $('evoStop').disabled = false; this.next(); },
    next() { const r = this.it.next(); if (r.done) { this.stop(); const b = this.best(); $('evoStatus').textContent = 'Done · best is epoch ' + b + ' (' + pct(this.results[b].metrics.successRate) + ', ' + secs(this.results[b].metrics.avgTime) + ').'; return; }
      this.results.push(r.value); this.sel = this.results.length - 1; $('evoStatus').textContent = 'Evaluated ' + this.results.length + ' environment(s)…'; this.render(); this.timer = setTimeout(() => this.next(), 15); },
    stop() { clearTimeout(this.timer); $('evoStart').disabled = false; $('evoStop').disabled = true; },
    best() { let b = 0; this.results.forEach((r, k) => { if (r.metrics.fitness > this.results[b].metrics.fitness) b = k; }); return b; },
    render() {
      const res = this.results, b = res.length ? this.best() : -1;
      $('evoTable').innerHTML = res.map((r, k) => '<tr data-k="' + k + '" class="' + (k === this.sel ? 'sel' : '') + '"><td>' + r.epoch + (k === b ? '★' : '') + '</td><td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + r.map.lineage.join(' → ') + '">' + r.map.lineage[r.map.lineage.length - 1] + '</td><td>' + pct(r.metrics.successRate) + '</td><td>' + (r.metrics.avgTime == null ? '—' : Math.round(r.metrics.avgTime) + 's') + '</td><td>' + r.metrics.stolen + '</td><td>' + r.metrics.timeout + '</td><td><span class="pill' + (r.accepted ? '' : ' no') + '">' + (r.accepted ? 'kept' : 'dropped') + '</span></td></tr>').join('');
      panel.querySelectorAll('#evoTable tr').forEach(tr => tr.onclick = () => { this.sel = +tr.dataset.k; this.render(); });
      chart($('evoChartS'), res, r => r.metrics.successRate == null ? null : r.metrics.successRate * 100, r => r.bestMetrics.successRate * 100, v => Math.round(v) + '%', [0, 100]);
      chart($('evoChartT'), res, r => r.metrics.avgTime, r => r.bestMetrics.avgTime, v => Math.round(v) + 's');
      for (const id of ['evoLoad', 'evoToBuild']) $(id).disabled = this.sel == null;
    },
  };
  function chart(svg, res, cand, best, fmt, fixed) {
    const w = 360, h = 150, m = { l: 38, r: 8, t: 22, b: 20 }; svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    const vals = res.flatMap(r => [cand(r), best(r)]).filter(v => v != null);
    let lo = fixed ? fixed[0] : Math.min(...vals), hi = fixed ? fixed[1] : Math.max(...vals); if (!vals.length) { lo = 0; hi = 1; } if (hi - lo < 1) { hi += 1; lo -= 1; } if (!fixed) { const p = (hi - lo) * .15; lo = Math.max(0, lo - p); hi += p; }
    const n = Math.max(2, res.length), X = k => m.l + (w - m.l - m.r) * k / (n - 1), Y = v => m.t + (h - m.t - m.b) * (1 - (v - lo) / (hi - lo));
    let s = '';
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#ebe5d9"/><text x="' + (m.l - 5) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="10" fill="#5b6f8a">' + fmt(v) + '</text>'; }
    res.forEach((r, k) => { if (n <= 16 || k % Math.ceil(n / 10) === 0) s += '<text x="' + X(k) + '" y="' + (h - 5) + '" text-anchor="middle" font-size="10" fill="#5b6f8a">' + r.epoch + '</text>'; });
    const pts = res.map((r, k) => best(r) == null ? null : X(k) + ',' + Y(best(r))).filter(Boolean);
    if (pts.length) s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2f6fd0" stroke-width="2" stroke-linejoin="round"/>';
    res.forEach((r, k) => { const v = cand(r); if (v == null) return; s += '<circle cx="' + X(k) + '" cy="' + Y(v) + '" r="4" fill="' + (r.accepted ? '#2f6fd0' : '#fff') + '" stroke="' + (r.accepted ? '#fff' : '#8aa4c8') + '" stroke-width="2"/>'; });
    s += '<g font-size="10" fill="#1f3a63"><line x1="' + (w - 200) + '" x2="' + (w - 182) + '" y1="9" y2="9" stroke="#2f6fd0" stroke-width="2"/><text x="' + (w - 178) + '" y="12">best so far</text><circle cx="' + (w - 105) + '" cy="9" r="3.5" fill="#fff" stroke="#8aa4c8" stroke-width="2"/><text x="' + (w - 97) + '" y="12">epoch candidate</text></g>';
    s += '<line class="x" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#9fb2cc" stroke-dasharray="3 3" visibility="hidden"/>';
    svg.innerHTML = s;
    const tip = svg.parentElement.querySelector('.lab-tip'), x = svg.querySelector('.x');
    svg.onmousemove = e => { if (!res.length) return; const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * w / r.width, k = Math.max(0, Math.min(res.length - 1, Math.round((px - m.l) / ((w - m.l - m.r) / (n - 1))))), it = res[k];
      x.setAttribute('x1', X(k)); x.setAttribute('x2', X(k)); x.setAttribute('visibility', 'visible'); tip.style.display = 'block';
      tip.innerHTML = 'Epoch ' + it.epoch + ' · ' + (it.accepted ? 'kept' : 'dropped') + '<br>candidate ' + (cand(it) == null ? '—' : fmt(cand(it))) + ' · best ' + (best(it) == null ? '—' : fmt(best(it))) + '<br>' + it.map.lineage[it.map.lineage.length - 1];
      tip.style.left = Math.min(r.width - 190, X(k) / w * r.width + 10) + 'px'; tip.style.top = '40px'; };
    svg.onmouseleave = () => { tip.style.display = 'none'; x.setAttribute('visibility', 'hidden'); };
  }
  $('evoStart').onclick = () => evo.start(); $('evoStop').onclick = () => { evo.stop(); $('evoStatus').textContent = 'Stopped after ' + evo.results.length + ' environment(s).'; };
  $('evoRegen').onclick = () => { $('evoSeed').value = 1 + Math.floor(Math.random() * 99999); evo.start(); };
  $('evoLoad').onclick = () => { loadTown(evo.results[evo.sel].map); setTab('sim'); };
  $('evoToBuild').onclick = () => { loadVisual(V.E, evo.results[evo.sel].map); setTab('build'); };

  /* ================= influence diagram ================= */
  (function () {
    const NODES = { person: [80, 50, 'Pedestrian', '#328d80'], hole: [290, 50, 'Hole', '#5a3d28'], robot: [80, 230, 'Delivery dog', '#285ca2'], rat: [290, 230, 'Rat', '#8e5aa8'] };
    const E = [['person', 'hole', 'plug', 0], ['rat', 'hole', 'dig / use', 0], ['person', 'rat', 'shoo', 0, false, .3], ['rat', 'robot', 'steal meal', 24], ['robot', 'rat', 'meal scent', 24], ['person', 'robot', 'dog yields', 0], ['robot', 'hole', 'learn & avoid', 0, true, .72]];
    let s = '<svg viewBox="0 0 370 280" style="width:100%" role="img" aria-label="Influence diagram between pedestrians, rats, delivery dogs and holes"><defs><marker id="labAr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#5b6f8a"/></marker></defs>';
    for (const [a, b, label, bend, dash, lt = .5] of E) {
      const [x1, y1] = NODES[a], [x2, y2] = NODES[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const sx = x1 + ux * 50, sy = y1 + uy * 26, ex = x2 - ux * 54, ey = y2 - uy * 28, mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
      s += '<path d="M' + sx + ' ' + sy + ' Q' + (2 * mx - (sx + ex) / 2) + ' ' + (2 * my - (sy + ey) / 2) + ' ' + ex + ' ' + ey + '" fill="none" stroke="#5b6f8a" stroke-width="1.5" marker-end="url(#labAr)"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      const tx = sx + (ex - sx) * lt - uy * bend, ty = sy + (ey - sy) * lt + ux * bend;
      s += '<text x="' + tx + '" y="' + (ty + 4) + '" text-anchor="middle" font-size="11" fill="#1f3a63" stroke="#fff" stroke-width="4" paint-order="stroke">' + label + '</text>';
    }
    for (const [x, y, name, c] of Object.values(NODES)) s += '<rect x="' + (x - 50) + '" y="' + (y - 18) + '" width="100" height="36" rx="11" fill="' + c + '"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">' + name + '</text>';
    $('labInfluence').innerHTML = s + '</svg>';
    const nm = { person: 'Pedestrian', rat: 'Rat', robot: 'Delivery dog', hole: 'Hole' };
    $('labInfluenceList').innerHTML = L.INFLUENCES.map(f => '<li><b>' + nm[f.from] + ' → ' + nm[f.to] + '</b> (' + f.kind + '): ' + f.effect + '</li>').join('');
  })();

  /* ================= start ================= */
  loadVisual(V.S, L.generateMap(12)); loadVisual(V.E, L.townMap());
  setTab('sim'); setView('split'); $('labLayer').onchange(); setMode(true); refreshSim(true);

  let slowAt = 0, uiAt = 0, viewport = null;
  function panes() {
    if (app.tab === 'build') return [{ v: V.E, pane: $('bLayer').value === 'under' ? 'under' : 'surface' }];
    return app.view === 'split' ? [{ v: V.S, pane: 'surface' }, { v: V.S, pane: 'under' }] : [{ v: V.S, pane: app.view }];
  }
  function chosenAgent() {
    const v = app.tab === 'build' ? V.E : V.S, a = app.selected && v.sim.agents.find(x => x.id === app.selected);
    if (a) { const p = v.sim.pos(a); return { x: p.x, y: p.y }; } const d = v.sim.robots[0]; return d ? { x: d.x, y: d.y } : { x: CX, y: CZ };
  }
  const hiddenInUnder = () => [...buildings, ...liftables];
  function pass(v, pane, now) {
    for (const k of ['S', 'E']) { V[k].surface.visible = V[k] === v && pane === 'surface'; V[k].under.visible = V[k] === v && pane === 'under'; V[k].agents.visible = V[k] === v; }
    const savedLayer = app.layer; if (app.tab === 'build') app.layer = $('bLayer').value === 'elev' ? 'elev' : 'surface';
    if (v.overlayLayer !== app.layer) { v.overlayLayer = app.layer; syncOverlay(v); }
    app.layer = savedLayer;
    applyTown(v.map); bridgeGroup.visible = canal.visible = pane === 'surface';
    placeAgents(v, pane, now);
    const a = app.selected && app.selPane === pane && v.sim.agents.find(x => x.id === app.selected);
    selRing.visible = !!a && v.models.get(a.id)?.model.visible; if (selRing.visible) selRing.position.copy(v.models.get(a.id).model.position).add(tmpV.set(0, .06, 0));
    const c = app.cell && app.cell.pane === pane; cellMark.visible = !!c;
    if (c) cellMark.position.set(app.cell.x - CX, (pane === 'surface' ? heightAt(v.map, app.cell.x, app.cell.y) : underTop(v.sim, app.cell.y * W + app.cell.x)) + .07, app.cell.y - CZ);
    if (pane === 'under') for (const o of hiddenInUnder()) { o.userData.pv = o.visible; o.visible = false; }
  }
  function unpass(pane) { if (pane === 'under') for (const o of hiddenInUnder()) o.visible = o.userData.pv; }
  function splitWidth(full) {
    if (panel.hidden || panel.classList.contains('collapsed') || window.innerWidth < 900) return full;
    const hr = host.getBoundingClientRect(), pr = panel.getBoundingClientRect(); return Math.max(full * .5, Math.min(full, pr.left - hr.left - 10));
  }
  let lastNow = 0;
  return {
    active: () => app.enabled, selected: chosenAgent, engine: null, encounterView: () => null,
    frame(now, dt) {
      lastNow = now;
      if (app.running && app.tab !== 'build') {
        const v = V.S; if (!v.sim.done) { v.acc += dt * speed(); let n = 0; while (v.acc >= R.tick && !v.sim.done && n++ < 400) { v.sim.tick(); v.acc -= R.tick; } }
        if (v.sim.done) { app.running = false; control(); }
      }
      if (now - slowAt > 250) { slowAt = now; for (const { v } of panes()) { syncSlow(v); v.overlayLayer = app.layer; } }
      if (now - uiAt > 300) { uiAt = now; if (app.tab !== 'build') refreshSim(); else inspect(); control(); }
      splitUi.style.display = app.tab !== 'build' && app.view === 'split' ? '' : 'none';
      if (viewport) { splitUi.querySelector('.div').style.left = viewport.half + 'px'; splitUi.querySelector('.tag.U').style.left = (viewport.half + 14) + 'px'; }
      return { agent: chosenAgent(), closeup: null };
    },
    render(renderer, scene, camera) {
      const size = renderer.getSize(new T.Vector2()), list = panes();
      if (list.length === 1) { viewport = null; pass(list[0].v, list[0].pane, lastNow); renderer.render(scene, camera); unpass(list[0].pane); return; }
      const half = Math.floor(splitWidth(size.x) / 2), left = camera.left, right = camera.right, aspect = half / size.y;
      camera.left = -camera.top * aspect; camera.right = camera.top * aspect; camera.updateProjectionMatrix();
      renderer.setScissorTest(true);
      list.forEach(({ v, pane }, k) => { pass(v, pane, lastNow); renderer.setViewport(k * half, 0, half, size.y); renderer.setScissor(k * half, 0, half, size.y); renderer.render(scene, camera); unpass(pane); });
      renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
      viewport = { half, width: size.x, left: -camera.top * aspect, right: camera.top * aspect };
      camera.left = left; camera.right = right; camera.updateProjectionMatrix();
    },
    hide() { labRoot.visible = false; applyTown(null); },
    pick(ray, ev) {
      const list = panes(); let { v, pane } = list[0];
      if (list.length === 2 && ev && viewport) {
        const px = ev.fx * viewport.width; if (px >= 2 * viewport.half) return false; const right = px >= viewport.half; ({ v, pane } = list[right ? 1 : 0]);
        const fx = (px - (right ? viewport.half : 0)) / viewport.half, l = ev.camera.left, r = ev.camera.right;
        ev.camera.left = viewport.left; ev.camera.right = viewport.right; ev.camera.updateProjectionMatrix();
        ray.setFromCamera(new T.Vector2(fx * 2 - 1, -ev.fy * 2 + 1), ev.camera);
        ev.camera.left = l; ev.camera.right = r; ev.camera.updateProjectionMatrix();
      }
      pass(v, pane, lastNow); labRoot.updateMatrixWorld(true);
      let cell = null;
      try {
        if (app.tab !== 'build') {
          const hits = ray.intersectObjects([...v.models.values()].map(m => m.model).filter(m => m.visible), true);
          if (hits.length) { let o = hits[0].object; while (o && !o.userData.agentId) o = o.parent; if (o) { app.selected = o.userData.agentId; app.selPane = pane; app.cell = null; inspect(); return true; } }
        }
        const target = pane === 'surface' ? v.terrain : v.underCells, hit = ray.intersectObject(target, false)[0]; if (!hit) return false;
        cell = pane === 'surface' ? { x: Math.max(0, Math.min(W - 1, Math.round(hit.point.x + CX))), y: Math.max(0, Math.min(H - 1, Math.round(hit.point.z + CZ))) } : { x: hit.instanceId % W, y: (hit.instanceId / W) | 0 };
      } finally { unpass(pane); }
      if (app.tab === 'build') { paint(cell.x, cell.y); return true; }
      app.selected = null; app.cell = { ...cell, pane }; inspect(); return true;
    },
  };
};
})();
