/* Bluehaven Environment Lab · deterministic grid-by-grid engine.
   Semantic model: docs/semantic-model.md. No DOM access; runs in the browser and in Node. */
(function (root) {
'use strict';

/* ---------- Rules (all distances in cells, 1 cell = cellSize metres; time in seconds) ---------- */
const RULES = Object.freeze({
  W: 32, H: 38, cellSize: 4, tick: 0.5, maxTime: 1200, groundDepth: 3,
  robot:  { count: 4, speed: 1.8, eye: 0.8, vision: 3, maxSlope: 0.20, grassFactor: 1.15, riskWeight: 1.5, prepTime: 4, yieldLimit: 3 },
  person: { count: 8, speed: 1.2, chaseSpeed: 1.9, eye: 1.6, vision: 4, maxSlope: 0.45, plugTime: 3, chaseGiveUp: 12 },
  rat:    { perRestaurant: 3, surfaceSpeed: 1.45, fleeSpeed: 2.4, tunnelSpeed: 1.2, digSpeed: 0.6, smell: 6, huntRange: 3,
            holeDigTime: 6, emergencyDigTime: 4, climbTime: 1.5, restMin: 8, restMax: 25, forageTime: 60, digRadius: 4, fleeMaxCost: 25 },
  order:  { count: 20, window: 600, patience: 240 },
  contact:{ cooldown: 5, range: 1 },
  learn:  { robotHalfLife: 400, ratHalfLife: 400, riskCap: 6 },
});

/* Who changes whom. Used by the UI diagram and the semantic model document. */
const INFLUENCES = [
  { from: 'person', to: 'rat',   kind: 'shoo',  effect: 'Contact (Manhattan ≤ 1) → the rat flees to the nearest hole and goes underground; rats mark the spot as dangerous.' },
  { from: 'person', to: 'hole',  kind: 'plug',  effect: 'A hole in sight → the person walks over and plugs it in 3 s. Robots drop it from their map once they see it is gone.' },
  { from: 'rat',    to: 'robot', kind: 'steal', effect: 'Contact with a robot carrying a meal → the meal is stolen and the order fails; robots mark the spot as risky.' },
  { from: 'rat',    to: 'hole',  kind: 'dig',   effect: 'Smells a restaurant and no hole nearby → digs one (6 s). Chased with no hole in reach → emergency hole (4 s).' },
  { from: 'robot',  to: 'rat',   kind: 'scent', effect: 'A robot carrying a meal within 4 cells → a foraging rat hunts it; rats remember the spot as food.' },
  { from: 'person', to: 'robot', kind: 'yield', effect: 'Robots never step into a pedestrian’s cell: they wait, and reroute after 3 s.' },
  { from: 'robot',  to: 'hole',  kind: 'avoid', effect: 'Robots remember holes and rats they have seen and route around them while carrying a meal.' },
];

/* ---------- Utilities ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const WALKABLE = { road: true, grass: true, bridge: true, stairs: true };
const BUILDING = { house: true, restaurant: true };
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const euclid = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, topK = k[0], topV = v[0], lastK = k.pop(), lastV = v.pop();
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lastK) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lastK; v[i] = lastV;
    }
    return [topK, topV];
  }
}

/* ---------- Maps: the Bluehaven town and its seeded variations ---------- */
const TOWN_BLOCKS = [{"name":"Harbor Offices","x":2,"y":1,"w":4,"d":4,"kind":"glass","height":4.2},{"name":"Maple Apartments","x":8,"y":1,"w":4,"d":4,"kind":"apartments","height":2.8},{"name":"Blueglass Tower","x":14,"y":1,"w":4,"d":4,"kind":"glass","height":5.4},{"name":"Station Hotel","x":20,"y":1,"w":4,"d":4,"kind":"apartments","height":3.6},{"name":"Workshop Row","x":26,"y":1,"w":4,"d":4,"kind":"warehouse","height":1.6},{"name":"North Bakery","x":2,"y":7,"w":4,"d":3,"kind":"shop","height":1.5},{"name":"Market Houses","x":8,"y":7,"w":4,"d":3,"kind":"rowhouse","height":1.7},{"name":"Post Office","x":14,"y":7,"w":4,"d":3,"kind":"civic","height":1.8},{"name":"Hilltop Homes","x":20,"y":7,"w":4,"d":3,"kind":"rowhouse","height":1.8},{"name":"Foundry Hall","x":26,"y":7,"w":4,"d":3,"kind":"warehouse","height":1.6},{"name":"St. Blue Chapel","x":2,"y":12,"w":4,"d":3,"kind":"church","height":1.5},{"name":"Garden Terrace","x":7,"y":12,"w":4,"d":3,"kind":"rowhouse","height":1.9},{"name":"Town Hall","x":13,"y":12,"w":6,"d":4,"kind":"clock","height":1.6},{"name":"Library House","x":21,"y":12,"w":4,"d":3,"kind":"civic","height":1.8},{"name":"Cedar Row","x":26,"y":12,"w":4,"d":3,"kind":"rowhouse","height":1.6},{"name":"Willow Homes","x":2,"y":17,"w":4,"d":3,"kind":"rowhouse","height":1.8},{"name":"East Arcade","x":21,"y":17,"w":4,"d":3,"kind":"shop","height":1.5},{"name":"Corner Apartments","x":26,"y":17,"w":4,"d":3,"kind":"apartments","height":3.0},{"name":"Bell Chapel","x":26,"y":22,"w":4,"d":3,"kind":"church","height":1.6},{"name":"Old Market","x":2,"y":23,"w":4,"d":3,"kind":"market","height":1.4},{"name":"Birch Lane","x":2,"y":28,"w":4,"d":3,"kind":"rowhouse","height":1.7},{"name":"Corner Caf\u00e9","x":7,"y":27,"w":4,"d":4,"kind":"shop","height":1.5},{"name":"Clock House","x":21,"y":23,"w":4,"d":3,"kind":"clock","height":1.5},{"name":"Elm Apartments","x":21,"y":28,"w":4,"d":3,"kind":"apartments","height":2.7},{"name":"Rose Terrace","x":26,"y":28,"w":4,"d":3,"kind":"rowhouse","height":1.9},{"name":"Station House","x":13,"y":28,"w":6,"d":4,"kind":"station","height":1.5},{"name":"South Studios","x":2,"y":33,"w":4,"d":3,"kind":"glass","height":3.3},{"name":"South Bakery","x":26,"y":33,"w":4,"d":3,"kind":"shop","height":1.8}];
const TOWN = { W: 32, H: 38, canalRow: 20, bridges: [7, 8, 9, 15, 16, 17], bridgeDeck: 4.32, stairsTop: 2.16,
  restaurants: ['North Bakery', 'East Arcade', 'Old Market', 'Corner Café', 'South Bakery'] };
const STRUCT = { bridge: true, stairs: true };

function blankMap(w = RULES.W, h = RULES.H) {
  return { version: 2, w, h, name: 'Blank', seed: null, lineage: ['blank'], blocks: null,
    surface: Array(w * h).fill('grass'), elev: Array(w * h).fill(0), under: Array(w * h).fill('soil') };
}
function cloneMap(m) {
  return { version: 2, w: m.w, h: m.h, name: m.name, seed: m.seed, lineage: [...(m.lineage || [])],
    blocks: m.blocks ? m.blocks.map(b => ({ ...b })) : null,
    surface: m.surface.slice(), elev: m.elev.slice(), under: m.under.slice() };
}
function paintBlocks(m) { // keep building cells in sync with each block's role
  if (!m.blocks) return;
  for (const b of m.blocks) for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) m.surface[y * m.w + x] = b.role;
}
function flattenBlocks(m) { // every building stands on a level pad
  if (!m.blocks) return;
  for (const b of m.blocks) {
    let sum = 0, n = 0; for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) { sum += m.elev[y * m.w + x]; n++; }
    const z = Math.round(sum / n * 10) / 10; for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) m.elev[y * m.w + x] = z;
  }
}
function protectNests(m) {
  const rest = i => m.surface[i] === 'restaurant';
  m.surface.forEach((s, i) => { if (!rest(i)) return; const x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of [[0, 0], ...DIRS]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && m.under[ny * m.w + nx] === 'rock') m.under[ny * m.w + nx] = 'soil'; } });
}
/* The original town: paved streets, 28 buildings, the canal with two stair-and-arch bridges. Flat. */
function townMap() {
  const m = blankMap(TOWN.W, TOWN.H); m.name = 'Bluehaven'; m.seed = 0; m.lineage = ['Bluehaven original'];
  m.surface.fill('road');
  m.blocks = TOWN_BLOCKS.map(b => ({ ...b, role: TOWN.restaurants.includes(b.name) ? 'restaurant' : 'house' }));
  paintBlocks(m);
  // Open ground two or more cells from any building is lawn, except the canal banks and the paved paths to the bridges.
  const isBuilding = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && (m.surface[y * m.w + x] === 'house' || m.surface[y * m.w + x] === 'restaurant');
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (Math.abs(y - TOWN.canalRow) <= 1 || (TOWN.bridges.includes(x) && Math.abs(y - TOWN.canalRow) <= 7)) continue;
    let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isBuilding(x + dx, y + dy)) { near = true; break; }
    if (!near) m.surface[y * m.w + x] = 'grass';
  }
  const r = TOWN.canalRow;
  for (let x = 0; x < m.w; x++) {
    const bridge = TOWN.bridges.includes(x);
    m.surface[r * m.w + x] = bridge ? 'bridge' : 'water'; m.under[r * m.w + x] = 'water';
    if (bridge) { m.elev[r * m.w + x] = TOWN.bridgeDeck; for (const y of [r - 1, r + 1]) { m.surface[y * m.w + x] = 'stairs'; m.elev[y * m.w + x] = TOWN.stairsTop; } }
  }
  return m;
}
function valueNoise(rng, w, h, scale) {
  const gx = Math.ceil(w / scale) + 2, gy = Math.ceil(h / scale) + 2, g = [];
  for (let i = 0; i < gx * gy; i++) g.push(rng());
  const s = t => t * t * (3 - 2 * t), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = s(fx - ix), ty = s(fy - iy);
    const a = g[iy * gx + ix], b = g[iy * gx + ix + 1], c = g[(iy + 1) * gx + ix], d = g[(iy + 1) * gx + ix + 1];
    out.push(a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
  }
  return out;
}
/* Hills rise away from the canal; the canal banks and bridge landings stay level at 0 m. */
function hillField(rng, w, h, relief) {
  const n1 = valueNoise(rng, w, h, 8), n2 = valueNoise(rng, w, h, 4);
  const hx = rng() * w, hy = rng() < 0.5 ? rng() * 12 + 2 : rng() * 12 + 24, hr = 5 + rng() * 4;
  const raw = n1.map((v, i) => { const x = i % w, y = (i / w) | 0; return 0.55 * v + 0.25 * n2[i] + 0.7 * Math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * hr * hr)); });
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return raw.map((v, i) => { const y = (i / w) | 0, t = Math.max(0, Math.min(1, (Math.abs(y - TOWN.canalRow) - 2) / 6)), mask = t * t * (3 - 2 * t);
    return Math.round(((v - lo) / (hi - lo || 1)) * relief * mask * 10) / 10; });
}
function applyTerrain(m, field) {
  m.surface.forEach((s, i) => { if (!STRUCT[s] && s !== 'water') m.elev[i] = field[i]; });
  flattenBlocks(m);
}
function walkConnected(m) { // every paved / lawn / bridge cell reachable from every other
  const ok = i => WALKABLE[m.surface[i]], cells = []; m.surface.forEach((s, i) => { if (ok(i)) cells.push(i); });
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) { const i = q.pop(), x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue; const j = ny * m.w + nx; if (ok(j) && !seen.has(j)) { seen.add(j); q.push(j); } } }
  return seen.size === cells.length;
}
const roadsConnected = walkConnected;
function pickRestaurants(m, rng, n) {
  const blocks = m.blocks, chosen = [], center = b => ({ x: b.x + b.w / 2, y: b.y + b.d / 2 });
  chosen.push(blocks[Math.floor(rng() * blocks.length)]);
  while (chosen.length < Math.min(n, blocks.length)) {
    let best = null, score = -1;
    for (const b of blocks) { if (chosen.includes(b)) continue; const d = Math.min(...chosen.map(c => manhattan(center(b), center(c)))) + rng() * 10; if (d > score) { score = d; best = b; } }
    chosen.push(best);
  }
  for (const b of blocks) b.role = chosen.includes(b) ? 'restaurant' : 'house';
  paintBlocks(m);
}
/* Seed 0 = the original flat town. Any other seed = the same town with seeded hills, underground rock and restaurant choice. */
function generateMap(seed, opts = {}) {
  seed = seed >>> 0; const m = townMap();
  if (!seed) return m;
  const rng = mulberry32(seed * 2654435761 + 1), relief = opts.relief ?? 8;
  applyTerrain(m, hillField(rng, m.w, m.h, relief));
  pickRestaurants(m, rng, opts.restaurants ?? 5);
  const rock = valueNoise(rng, m.w, m.h, 4);
  m.under = m.under.map((u, i) => u === 'water' ? 'water' : rock[i] > 0.66 ? 'rock' : 'soil');
  protectNests(m);
  m.seed = seed; m.name = 'Bluehaven · seed ' + seed; m.lineage = ['seed ' + seed];
  return m;
}

const MUTATIONS = {
  relief(m, rng) { const max = Math.max(2, ...m.surface.map((s, i) => STRUCT[s] ? 0 : m.elev[i])), f = hillField(rng, m.w, m.h, max);
    applyTerrain(m, m.elev.map((v, i) => Math.round((v * 0.5 + f[i] * 0.5) * 10) / 10)); return 'terrain reshaped'; },
  flatten(m) { applyTerrain(m, m.elev.map(v => Math.round(v * 0.7 * 10) / 10)); return 'terrain flattened 30%'; },
  moveRestaurant(m, rng) {
    const rest = m.blocks.filter(b => b.role === 'restaurant'), houses = m.blocks.filter(b => b.role === 'house'); if (!rest.length || !houses.length) return null;
    const from = rest[Math.floor(rng() * rest.length)], to = houses[Math.floor(rng() * houses.length)];
    from.role = 'house'; to.role = 'restaurant'; paintBlocks(m); protectNests(m); return 'restaurant moved ' + from.name + ' → ' + to.name;
  },
  addRestaurant(m, rng) { const houses = m.blocks.filter(b => b.role === 'house'); if (houses.length < 15) return null; const b = houses[Math.floor(rng() * houses.length)]; b.role = 'restaurant'; paintBlocks(m); protectNests(m); return 'new restaurant ' + b.name; },
  removeRestaurant(m, rng) { const rest = m.blocks.filter(b => b.role === 'restaurant'); if (rest.length < 3) return null; const b = rest[Math.floor(rng() * rest.length)]; b.role = 'house'; paintBlocks(m); return 'restaurant closed ' + b.name; },
  rockPatch(m, rng) {
    const cx = Math.floor(rng() * m.w), cy = Math.floor(rng() * m.h), r = 1 + Math.floor(rng() * 2), kind = rng() < 0.6 ? 'rock' : 'soil';
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.under[y * m.w + x] !== 'water') m.under[y * m.w + x] = kind;
    protectNests(m); return 'underground ' + kind + ' @' + cx + ',' + cy;
  },
  lawn(m, rng) {
    for (let t = 0; t < 30; t++) {
      const x = Math.floor(rng() * m.w), y = Math.floor(rng() * m.h), horiz = rng() < 0.5, cells = [];
      for (let k = 0; k < 3; k++) { const xx = x + (horiz ? k : 0), yy = y + (horiz ? 0 : k); if (xx < m.w && yy < m.h && m.surface[yy * m.w + xx] === 'road') cells.push(yy * m.w + xx); }
      if (cells.length < 2) continue; cells.forEach(i => m.surface[i] = 'grass');
      if (walkConnected(m)) return 'lawn +' + cells.length + ' @' + x + ',' + y; cells.forEach(i => m.surface[i] = 'road');
    }
    return null;
  },
  pave(m, rng) { const g = []; m.surface.forEach((s, i) => s === 'grass' && g.push(i)); if (!g.length) return null; const i = g[Math.floor(rng() * g.length)]; m.surface[i] = 'road'; return 'lawn paved @' + (i % m.w) + ',' + ((i / m.w) | 0); },
};
function mutateMap(map, seed) {
  const rng = mulberry32((seed >>> 0) * 40503 + 17), m = cloneMap(map), names = Object.keys(MUTATIONS), done = [];
  const count = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < count * 5 && done.length < count; k++) { const r = MUTATIONS[names[Math.floor(rng() * names.length)]](m, rng); if (r) done.push(r); }
  if (!m.surface.includes('restaurant') || !walkConnected(m)) return cloneMap(map);
  m.lineage.push(done.join(' + ')); m.name = (map.name || 'map').replace(/ · v\d+$/, '') + ' · v' + (m.lineage.length - 1); m.seed = map.seed;
  return m;
}

/* ---------- Simulation ---------- */
class LabSim {
  constructor(map, { orderSeed = 7, agentSeed = 11, learning = true } = {}) {
    this.learning = learning;
    this.map = cloneMap(map); this.w = map.w; this.h = map.h; this.n = map.w * map.h;
    this.orderSeed = orderSeed; this.agentSeed = agentSeed;
    this.reset();
  }
  idx(x, y) { return y * this.w + x; }
  P(i) { return { x: i % this.w, y: (i / this.w) | 0 }; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  walkable(i) { return !!WALKABLE[this.map.surface[i]]; }
  slope(a, b) { return (this.map.elev[b] - this.map.elev[a]) / RULES.cellSize; }
  neighbors(i) { const { x, y } = this.P(i), out = []; for (const [dx, dy] of DIRS) if (this.inside(x + dx, y + dy)) out.push(this.idx(x + dx, y + dy)); return out; }
  diggable(i) { const s = this.map.surface[i]; return (s === 'road' || s === 'grass') && this.under[i] !== 'rock' && this.under[i] !== 'water'; }

  deriveBuildings() {
    this.buildings = [];
    const doorFor = cells => { // prefer the middle of the south face, then north, east, west
      const set = new Set(cells), xs = cells.map(i => i % this.w), ys = cells.map(i => (i / this.w) | 0);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mx = Math.floor((x0 + x1 + 1) / 2), my = Math.floor((y0 + y1 + 1) / 2);
      const tries = [[mx, y1 + 1], [mx - 1, y1 + 1], [mx, y0 - 1], [mx - 1, y0 - 1], [x1 + 1, my], [x0 - 1, my]];
      for (const [x, y] of tries) if (this.inside(x, y) && this.map.surface[this.idx(x, y)] === 'road') return this.idx(x, y);
      for (const i of cells) for (const j of this.neighbors(i)) if (!set.has(j) && this.diggableSurface(j)) return j;
      return null;
    };
    if (this.map.blocks) {
      for (const b of this.map.blocks) {
        const cells = []; for (let y = b.y; y < b.y + b.d; y++) for (let x = b.x; x < b.x + b.w; x++) cells.push(this.idx(x, y));
        const door = doorFor(cells);
        this.buildings.push({ id: b.name, name: b.name, type: b.role, cells, i: cells[0], x: b.x + (b.w - 1) / 2, y: b.y + (b.d - 1) / 2, block: b, door, doorP: door == null ? null : this.P(door) });
      }
    } else {
      this.map.surface.forEach((s, i) => {
        if (!BUILDING[s]) return; const door = doorFor([i]);
        this.buildings.push({ id: (s === 'restaurant' ? 'R' : 'H') + i, name: (s === 'restaurant' ? 'Restaurant ' : 'House ') + (i % this.w) + ',' + ((i / this.w) | 0), type: s, cells: [i], i, ...this.P(i), door, doorP: door == null ? null : this.P(door) });
      });
    }
    this.buildingAt = new Map(); for (const b of this.buildings) for (const c of b.cells) this.buildingAt.set(c, b);
    this.restaurants = this.buildings.filter(b => b.type === 'restaurant' && b.door != null);
    this.houses = this.buildings.filter(b => b.type === 'house' && b.door != null);
    this.restaurantDoors = new Set(this.restaurants.map(r => r.door));
    this.nests = new Set();
    for (const r of this.restaurants) for (const j of r.cells) if (this.under[j] !== 'rock' && this.under[j] !== 'water') { this.under[j] = 'nest'; this.nests.add(j); }
  }
  diggableSurface(i) { const s = this.map.surface[i]; return s === 'road' || s === 'grass'; }
  reset() {
    this.under = this.map.under.slice();
    this.deriveBuildings();
    this.time = 0; this.done = false; this.events = []; this.serial = 0;
    this.holes = new Map(); this.plugLog = []; this.contacts = new Map();
    this.stats = { holesDug: 0, holesPlugged: 0, shoos: 0, thefts: 0, yields: 0 };
    this.rng = mulberry32(this.agentSeed * 9301 + 49297);
    // Learning maps. Robots share a fleet map; rats share a colony map.
    this.fleet = { risk: new Float32Array(this.n), holeField: new Float32Array(this.n), knownHoles: new Set(), sightings: 0 };
    this.colony = { food: new Float32Array(this.n), danger: new Float32Array(this.n) };
    this.makeOrders(); this.spawn();
    return this;
  }

  makeOrders() {
    const rng = mulberry32(this.orderSeed * 7919 + 13), O = RULES.order, times = [];
    for (let k = 0; k < O.count; k++) times.push(10 + rng() * (O.window - 10));
    times.sort((a, b) => a - b);
    this.orders = times.map((t, k) => {
      const r = rng(); if (!this.houses.length || !this.restaurants.length) return null;
      const house = this.houses[Math.floor(r * this.houses.length)];
      const rest = this.restaurants.slice().sort((a, b) => manhattan(a.doorP, house.doorP) - manhattan(b.doorP, house.doorP) || a.i - b.i)[0];
      return { id: 'O' + String(k + 1).padStart(2, '0'), house, restaurant: rest, createdAt: Math.round(t * 2) / 2, deadline: Math.round(t * 2) / 2 + O.patience,
        status: 'scheduled', robot: null, pickedAt: null, doneAt: null, unreachable: false, checkAt: 0 };
    }).filter(Boolean);
  }

  agent(type, k, cellIndex, layer) {
    const p = this.P(cellIndex);
    return { id: { robot: 'K', rat: 'R', person: 'P' }[type] + '-' + String(k + 1).padStart(2, '0'), type, x: p.x, y: p.y, layer,
      move: null, busy: 0, busyKind: null, state: type === 'robot' ? 'idle' : type === 'rat' ? 'nest' : 'wander', path: [], heading: 0,
      icon: null, iconUntil: 0, distance: 0, order: null, wait: 0, carrying: false, target: null, since: 0, dir: k % 4, home: null, trail: [{ x: p.x, y: p.y, layer }] };
  }
  spawn() {
    this.agents = [];
    // Distribution rule 1: robots start at restaurant doors, round-robin.
    for (let k = 0; k < RULES.robot.count && this.restaurants.length; k++) this.agents.push(this.agent('robot', k, this.restaurants[k % this.restaurants.length].door, 'surface'));
    // Distribution rule 2: people start at the doors of uniformly chosen houses (without replacement).
    const pool = this.houses.slice();
    for (let k = 0; k < RULES.person.count && pool.length; k++) { const h = pool.splice(Math.floor(this.rng() * pool.length), 1)[0]; this.agents.push(this.agent('person', k, h.door, 'surface')); }
    // Distribution rule 3: rats aggregate in the nest under each restaurant, perRestaurant each, with staggered hunger.
    let k = 0;
    for (const r of this.restaurants) {
      const nest = r.cells.filter(j => this.nests.has(j));
      for (let m = 0; m < RULES.rat.perRestaurant && nest.length; m++) {
        const a = this.agent('rat', k++, nest[m % nest.length], 'under'); a.home = r.id;
        a.busy = 5 + this.rng() * RULES.rat.restMax; a.busyKind = 'rest'; this.agents.push(a);
      }
    }
  }
  get robots() { return this.agents.filter(a => a.type === 'robot'); }
  get rats() { return this.agents.filter(a => a.type === 'rat'); }
  get people() { return this.agents.filter(a => a.type === 'person'); }

  event(type, text, actors = [], at = null) {
    const e = { id: ++this.serial, time: this.time, type, text, actors: actors.map(a => a.id), at };
    this.events.unshift(e); if (this.events.length > 80) this.events.length = 80; return e;
  }
  icon(a, text, d = 2) { a.icon = text; a.iconUntil = this.time + d; }

  /* Occupied cell: the destination counts once the agent is past half the step. */
  cellOf(a) { if (a.move && a.move.t / a.move.dur >= 0.5) return { x: a.move.tx, y: a.move.ty, layer: a.move.tl }; return { x: a.x, y: a.y, layer: a.layer }; }
  pos(a) {
    const ground = (x, y, l) => this.map.elev[this.idx(x, y)] - (l === 'under' ? RULES.groundDepth : 0);
    if (!a.move) return { x: a.x, y: a.y, z: ground(a.x, a.y, a.layer), layer: a.layer };
    const m = a.move, f = Math.min(1, m.t / m.dur);
    const z0 = ground(m.fx, m.fy, m.fl), z1 = ground(m.tx, m.ty, m.tl);
    return { x: m.fx + (m.tx - m.fx) * f, y: m.fy + (m.ty - m.fy) * f, z: z0 + (z1 - z0) * f, layer: f < 0.5 ? m.fl : m.tl, f };
  }

  /* ---- Movement cost (seconds per one-cell step) ---- */
  surfaceCost(type, a, b, speed) {
    if (!this.walkable(b)) return Infinity;
    const sa = this.map.surface[a], sb = this.map.surface[b], structure = STRUCT[sa] || STRUCT[sb];
    // Bridges and their stairs are entered and left only along the bridge axis (north-south).
    if (structure && sa !== sb && (a % this.w) !== (b % this.w)) return Infinity;
    const s = this.slope(a, b), R = RULES[type === 'rat' ? 'rat' : type];
    if (type !== 'rat' && !structure && Math.abs(s) > R.maxSlope) return Infinity;
    let t = RULES.cellSize / speed * (1 + 3 * Math.max(0, s) + 0.6 * Math.max(0, -s));
    if (type === 'robot' && sb === 'grass') t *= RULES.robot.grassFactor;
    return t;
  }
  underCost(b) {
    const k = this.under[b]; if (k === 'rock' || k === 'water') return Infinity;
    return RULES.cellSize / (k === 'soil' ? RULES.rat.digSpeed : RULES.rat.tunnelSpeed);
  }
  robotRisk(i) { return this.learning ? this.fleet.risk[i] + this.fleet.holeField[i] : 0; }

  search(start, cost, isGoal, maxCost = Infinity) {
    if (isGoal(start)) return { goal: start, cost: 0, path: [] };
    const dist = new Float64Array(this.n).fill(Infinity), prev = new Int32Array(this.n).fill(-1), heap = new Heap();
    dist[start] = 0; heap.push(0, start);
    while (heap.size) {
      const [d, i] = heap.pop(); if (d > dist[i]) continue; if (d > maxCost) return null;
      if (isGoal(i)) { const path = []; for (let k = i; k !== start; k = prev[k]) path.push(k); return { goal: i, cost: d, path: path.reverse() }; }
      for (const j of this.neighbors(i)) { const c = cost(i, j); if (!Number.isFinite(c)) continue; const nd = d + c; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(nd, j); } }
    }
    return null;
  }
  robotPath(a, goal, blocked = -1) {
    // Rats in sight right now add a short-lived penalty on top of the learned fleet map.
    const near = new Set();
    if (a.carrying) for (const r of this.visibleSurfaceAgents(a, 'rat', RULES.robot.vision, RULES.robot.eye)) { const c = this.cellOf(r); for (const j of [this.idx(c.x, c.y), ...this.neighbors(this.idx(c.x, c.y))]) near.add(j); }
    return this.search(this.idx(a.x, a.y), (i, j) => j === blocked ? Infinity : this.surfaceCost('robot', i, j, RULES.robot.speed) * (a.carrying ? 1 + RULES.robot.riskWeight * this.robotRisk(j) + (near.has(j) && j !== goal ? 6 : 0) : 1), i => i === goal);
  }
  ratSurfacePath(a, isGoal, maxCost) {
    return this.search(this.idx(a.x, a.y), (i, j) => this.surfaceCost('rat', i, j, RULES.rat.surfaceSpeed) * (1 + 0.6 * this.colony.danger[j]), isGoal, maxCost);
  }
  ratUnderPath(a, isGoal, maxCost) { return this.search(this.idx(a.x, a.y), (i, j) => this.underCost(j), isGoal, maxCost); }

  startMove(a, j, dur, layer = a.layer) {
    const p = this.P(j);
    a.move = { fx: a.x, fy: a.y, fl: a.layer, tx: p.x, ty: p.y, tl: layer, t: 0, dur: Math.max(0.25, dur) };
    if (p.x !== a.x || p.y !== a.y) a.heading = Math.atan2(p.y - a.y, p.x - a.x);
  }
  arrive(a) {
    const m = a.move; if (m.fl === 'surface' && m.tl === 'surface') a.distance += RULES.cellSize;
    a.x = m.tx; a.y = m.ty; a.layer = m.tl; a.move = null;
    const i = this.idx(a.x, a.y);
    if (a.layer === 'under' && this.under[i] === 'soil') this.under[i] = 'tunnel';
    const last = a.trail[a.trail.length - 1];
    if (!last || last.x !== a.x || last.y !== a.y || last.layer !== a.layer) { a.trail.push({ x: a.x, y: a.y, layer: a.layer }); if (a.trail.length > 400) a.trail.shift(); }
  }
  climb(a, toLayer) { this.startMove(a, this.idx(a.x, a.y), RULES.rat.climbTime, toLayer); }

  /* ---- Perception: range in cells, line of sight blocked by buildings and by terrain above the eye line ---- */
  canSee(a, tx, ty, range, eye) {
    const dx = tx - a.x, dy = ty - a.y; if (Math.hypot(dx, dy) > range + 0.5) return false;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)); if (!steps) return true;
    const h0 = this.map.elev[this.idx(a.x, a.y)] + eye, h1 = this.map.elev[this.idx(tx, ty)] + 0.3;
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = Math.round(a.x + dx * t), y = Math.round(a.y + dy * t), i = this.idx(x, y);
      if (BUILDING[this.map.surface[i]]) return false;
      if (this.map.elev[i] > h0 + (h1 - h0) * t) return false;
    }
    return true;
  }
  visibleSurfaceAgents(a, type, range, eye) {
    return this.agents.filter(b => b.type === type && b.layer === 'surface' && (!b.move || b.move.tl === 'surface') && this.canSee(a, this.cellOf(b).x, this.cellOf(b).y, range, eye));
  }
  visibleHoles(a, range, eye) { const out = []; for (const [i, h] of this.holes) if (this.canSee(a, h.x, h.y, range, eye)) out.push(i); return out; }

  bump(arr, i, v, radius, cap) {
    const c = this.P(i);
    for (let y = c.y - radius; y <= c.y + radius; y++) for (let x = c.x - radius; x <= c.x + radius; x++) {
      if (!this.inside(x, y)) continue; const d = Math.abs(x - c.x) + Math.abs(y - c.y); if (d > radius) continue;
      const j = this.idx(x, y); arr[j] = Math.min(cap, arr[j] + v / (1 + d));
    }
  }
  rebuildHoleField() {
    const f = this.fleet.holeField; f.fill(0);
    for (const i of this.fleet.knownHoles) { const c = this.P(i);
      for (let y = c.y - 2; y <= c.y + 2; y++) for (let x = c.x - 2; x <= c.x + 2; x++) { if (!this.inside(x, y)) continue; const d = Math.abs(x - c.x) + Math.abs(y - c.y); if (d <= 2) f[this.idx(x, y)] += 2 / (1 + d); } }
  }
  senseRobot(a) {
    const R = RULES.robot; let changed = false;
    for (const r of this.visibleSurfaceAgents(a, 'rat', R.vision, R.eye)) { const c = this.cellOf(r); this.bump(this.fleet.risk, this.idx(c.x, c.y), 0.5, 1, RULES.learn.riskCap); this.fleet.sightings++; }
    for (const i of this.visibleHoles(a, R.vision, R.eye)) if (!this.fleet.knownHoles.has(i)) { this.fleet.knownHoles.add(i); changed = true; }
    for (const i of [...this.fleet.knownHoles]) { const p = this.P(i); if (!this.holes.has(i) && this.canSee(a, p.x, p.y, R.vision, R.eye)) { this.fleet.knownHoles.delete(i); changed = true; } }
    if (changed) this.rebuildHoleField();
  }

  /* ---- Orders and dispatch ---- */
  finishOrder(o, status) {
    o.status = status; o.doneAt = this.time;
    if (o.robot) { const r = this.agents.find(a => a.id === o.robot); if (r && r.order === o) { r.order = null; r.state = 'idle'; r.path = []; r.carrying = false; } }
  }
  updateOrders() {
    for (const o of this.orders) {
      if (o.status === 'scheduled' && this.time >= o.createdAt) { o.status = 'waiting'; this.event('order', o.id + ' new order · ' + o.house.name + ' ← ' + o.restaurant.name, [], o.house.doorP); }
      if ((o.status === 'waiting' || o.status === 'assigned' || o.status === 'carrying') && this.time >= o.deadline) {
        this.finishOrder(o, 'timeout'); this.event('timeout', o.id + ' timed out · order failed', [], o.house.doorP);
      }
    }
    for (const o of this.orders) {
      if (o.status !== 'waiting' || this.time < o.checkAt) continue;
      const idle = this.robots.filter(r => !r.order).sort((a, b) => manhattan(a, o.restaurant.doorP) - manhattan(b, o.restaurant.doorP) || (a.id < b.id ? -1 : 1));
      let assigned = false;
      for (const r of idle) {
        if (this.robotPath(r, o.restaurant.door) && this.search(o.restaurant.door, (i, j) => this.surfaceCost('robot', i, j, 1), i => i === o.house.door)) {
          o.status = 'assigned'; o.robot = r.id; o.unreachable = false; r.order = o; r.state = 'toRestaurant'; r.path = []; assigned = true;
          this.event('assign', r.id + ' takes ' + o.id, [r]); break;
        }
      }
      if (!assigned) { if (idle.length) o.unreachable = true; o.checkAt = this.time + 5; }
    }
  }

  /* ---- Agent decisions; called only when an agent is between cells and not busy ---- */
  thinkRobot(a) {
    const here = this.idx(a.x, a.y), o = a.order;
    let goal = null;
    if (o && a.state === 'toRestaurant') goal = o.restaurant.door;
    else if (o && a.state === 'delivering') goal = o.house.door;
    else if (!o) { const near = this.restaurants.slice().sort((p, q) => manhattan(a, p.doorP) - manhattan(a, q.doorP))[0]; goal = near ? near.door : null; a.state = 'idle'; }
    if (goal == null) { a.busy = RULES.tick; a.busyKind = 'wait'; return; }
    if (here === goal) {
      if (o && a.state === 'toRestaurant') { a.busy = RULES.robot.prepTime; a.busyKind = 'pickup'; this.icon(a, '🍱 PICKUP', 2); }
      else if (o && a.state === 'delivering') {
        o.status = 'delivered'; o.doneAt = this.time; a.order = null; a.carrying = false; a.state = 'idle';
        this.icon(a, '✓ DELIVERED', 2); this.event('delivery', a.id + ' delivered ' + o.id + ' in ' + Math.round(o.doneAt - o.createdAt) + 's', [a], o.house.doorP);
      } else { a.busy = 1; a.busyKind = 'wait'; }
      return;
    }
    const occupied = new Set(this.people.map(p => { const c = this.cellOf(p); return this.idx(c.x, c.y); }));
    let plan = this.robotPath(a, goal, a.wait > RULES.robot.yieldLimit ? a.blockedCell : -1);
    if (!plan) plan = this.robotPath(a, goal);
    if (!plan || !plan.path.length) { a.busy = 1; a.busyKind = 'stuck'; a.path = []; return; }
    a.path = plan.path; const next = plan.path[0];
    if (occupied.has(next)) { // Rule: robots yield to pedestrians.
      if (a.wait === 0) this.stats.yields++;
      a.wait += RULES.tick; a.blockedCell = next; a.busy = RULES.tick; a.busyKind = 'yield'; if (a.wait <= RULES.tick) this.icon(a, '⏸ YIELD', 1.2); return;
    }
    a.wait = 0; a.startCell = here;
    const boost = 1;
    this.startMove(a, next, this.surfaceCost('robot', here, next, RULES.robot.speed * boost));
  }
  finishRobotBusy(a) {
    if (a.busyKind === 'pickup' && a.order && a.order.status === 'assigned') {
      a.order.status = 'carrying'; a.order.pickedAt = this.time; a.carrying = true; a.state = 'delivering';
      this.event('pickup', a.id + ' picked up ' + a.order.id, [a]);
    }
  }

  thinkPerson(a) {
    const R = RULES.person, here = this.idx(a.x, a.y);
    // Perception: rats first (chase), then holes (plug).
    const rats = this.visibleSurfaceAgents(a, 'rat', R.vision, R.eye).filter(r => r.state !== 'flee');
    if (rats.length && a.state !== 'chase') { const r = rats.sort((p, q) => euclid(a, this.cellOf(p)) - euclid(a, this.cellOf(q)))[0]; a.state = 'chase'; a.target = r.id; a.since = this.time; this.icon(a, '👀 RAT!', 1.2); }
    if (a.state === 'chase') {
      const r = this.agents.find(b => b.id === a.target);
      if (!r || r.layer !== 'surface' || r.state === 'flee' || this.time - a.since > R.chaseGiveUp) { a.state = 'wander'; a.target = null; }
      else {
        const c = this.cellOf(r), goal = this.idx(c.x, c.y), plan = this.search(here, (i, j) => this.surfaceCost('person', i, j, R.chaseSpeed), i => i === goal, 60);
        if (plan && plan.path.length) { a.path = plan.path; this.startMove(a, plan.path[0], this.surfaceCost('person', here, plan.path[0], R.chaseSpeed)); return; }
        a.state = 'wander';
      }
    }
    if (a.state !== 'toHole') {
      const holes = this.visibleHoles(a, R.vision, R.eye);
      if (holes.length) { a.state = 'toHole'; a.target = holes.sort((p, q) => euclid(a, this.P(p)) - euclid(a, this.P(q)))[0]; this.icon(a, '🕳 HOLE!', 1.2); }
    }
    if (a.state === 'toHole') {
      if (!this.holes.has(a.target)) { a.state = 'wander'; a.target = null; }
      else if (here === a.target) { a.busy = R.plugTime; a.busyKind = 'plug'; this.icon(a, '🧱 PLUG', R.plugTime); return; }
      else {
        const goal = a.target, plan = this.search(here, (i, j) => this.surfaceCost('person', i, j, R.speed), i => i === goal, 120);
        if (plan && plan.path.length) { a.path = plan.path; this.startMove(a, plan.path[0], this.surfaceCost('person', here, plan.path[0], R.speed)); return; }
        a.state = 'wander'; a.target = null;
      }
    }
    // Random walk with momentum: keep heading 70% of the time, avoid reversing unless at a dead end.
    const opts = DIRS.map((d, k) => ({ k, j: this.inside(a.x + d[0], a.y + d[1]) ? this.idx(a.x + d[0], a.y + d[1]) : -1 }))
      .filter(o => o.j >= 0 && Number.isFinite(this.surfaceCost('person', here, o.j, R.speed)));
    if (!opts.length) { a.busy = 1; a.busyKind = 'wait'; return; }
    const forward = opts.find(o => o.k === a.dir), noBack = opts.filter(o => o.k !== (a.dir + 2) % 4);
    const pick = forward && this.rng() < 0.7 ? forward : (noBack.length ? noBack : opts)[Math.floor(this.rng() * (noBack.length ? noBack.length : opts.length))];
    a.dir = pick.k; a.path = [pick.j];
    this.startMove(a, pick.j, this.surfaceCost('person', here, pick.j, R.speed));
  }
  finishPersonBusy(a) {
    if (a.busyKind === 'plug' && this.holes.has(a.target)) {
      const h = this.holes.get(a.target); this.holes.delete(a.target); this.stats.holesPlugged++;
      this.plugLog.push({ x: h.x, y: h.y, at: this.time }); if (this.plugLog.length > 40) this.plugLog.shift();
      this.event('plug', a.id + ' plugged a hole at (' + h.x + ',' + h.y + ')', [a], h);
      a.state = 'wander'; a.target = null;
    }
  }

  nearestRestaurantInSmell(a) {
    return this.restaurants.map(r => ({ r, d: euclid(a, r) })).filter(o => o.d <= RULES.rat.smell).sort((p, q) => p.d - q.d)[0]?.r || null;
  }
  chooseDigSite(a, rest) {
    const R = RULES.rat, c = rest.doorP; let best = -1, score = Infinity;
    for (let y = c.y - R.digRadius; y <= c.y + R.digRadius; y++) for (let x = c.x - R.digRadius; x <= c.x + R.digRadius; x++) {
      if (!this.inside(x, y)) continue; const i = this.idx(x, y);
      if (!this.diggable(i) || this.holes.has(i)) continue;
      const s = Math.abs(manhattan({ x, y }, c) - 3) + 2 * this.colony.danger[i] - 1.5 * this.colony.food[i] + this.rng() * 0.8;
      if (s < score) { score = s; best = i; }
    }
    return best;
  }
  thinkRat(a) {
    const R = RULES.rat, here = this.idx(a.x, a.y);
    if (a.layer === 'under') {
      if (a.state === 'nest' || a.state === 'home') {
        if (this.nests.has(here) && a.state === 'home') { a.state = 'nest'; a.carrying = false; a.busy = R.restMin + this.rng() * (R.restMax - R.restMin); a.busyKind = 'rest'; return; }
        const rest = a.state === 'nest' ? this.nearestRestaurantInSmell(a) : null;
        if (rest) { // Smells a restaurant: nearest hole first, otherwise dig one near the restaurant door.
          a.target = rest.id; a.home = rest.id;
          const hole = this.ratUnderPath(a, i => this.holes.has(i) && euclid(this.P(i), rest) <= R.smell, 90);
          if (hole) { a.state = 'toHole'; a.goal = hole.goal; }
          else { const site = this.chooseDigSite(a, rest); if (site < 0) { a.busy = 10; a.busyKind = 'rest'; return; } a.state = 'toDig'; a.goal = site; }
        } else { // Aggregation rule: wander back to the nearest nest.
          const plan = this.ratUnderPath(a, i => this.nests.has(i), 400);
          if (plan && plan.path.length) { a.state = 'home'; this.startMove(a, plan.path[0], this.underCost(plan.path[0])); return; }
          a.state = 'nest'; a.busy = R.restMin; a.busyKind = 'rest'; return;
        }
      }
      if (a.state === 'toHole' || a.state === 'toDig') {
        if (a.state === 'toHole' && !this.holes.has(a.goal)) { this.bump(this.colony.danger, a.goal, 1.5, 1, 6); a.state = 'nest'; return this.thinkRat(a); }
        if (here === a.goal) {
          if (a.state === 'toHole') { a.state = 'forage'; a.anchor = this.P(here); a.forageUntil = this.time + R.forageTime; this.climb(a, 'surface'); return; }
          a.busy = R.holeDigTime; a.busyKind = 'dig'; this.icon(a, '⛏ DIG', R.holeDigTime); return;
        }
        const goal = a.goal, plan = this.ratUnderPath(a, i => i === goal, 600);
        if (!plan || !plan.path.length) { a.state = 'nest'; a.busy = 5; a.busyKind = 'rest'; return; }
        this.startMove(a, plan.path[0], this.underCost(plan.path[0])); return;
      }
      a.state = 'home'; return;
    }
    // On the surface.
    if (a.state === 'flee' || a.state === 'return') {
      if (this.holes.has(here)) { a.state = 'home'; this.climb(a, 'under'); return; }
      const plan = this.ratSurfacePath(a, i => this.holes.has(i), a.state === 'flee' ? R.fleeMaxCost : 200);
      if (plan && plan.path.length) { const sp = a.state === 'flee' ? R.fleeSpeed : R.surfaceSpeed; this.startMove(a, plan.path[0], this.surfaceCost('rat', here, plan.path[0], sp)); return; }
      if (this.diggable(here)) { a.busy = R.emergencyDigTime; a.busyKind = 'edig'; this.icon(a, '⛏ DIG!', R.emergencyDigTime); return; }
      const step = this.neighbors(here).filter(j => this.walkable(j)).sort((p, q) => euclid(this.P(q), a.threat || a) - euclid(this.P(p), a.threat || a))[0];
      if (step != null) { this.startMove(a, step, this.surfaceCost('rat', here, step, R.fleeSpeed)); return; }
      a.busy = 1; a.busyKind = 'wait'; return;
    }
    // Forage: chase a meal-carrying robot inside smell range, otherwise loiter near the restaurant door.
    if (a.carrying || this.time > a.forageUntil) { a.state = 'return'; return this.thinkRat(a); }
    const prey = this.robots.filter(r => r.carrying && r.layer === 'surface').map(r => ({ r, c: this.cellOf(r) })).filter(o => euclid(a, o.c) <= R.huntRange).sort((p, q) => euclid(a, p.c) - euclid(a, q.c))[0];
    if (prey) {
      const goal = this.idx(prey.c.x, prey.c.y); this.bump(this.colony.food, goal, 0.15, 0, 6);
      const plan = this.ratSurfacePath(a, i => i === goal, 60);
      if (plan && plan.path.length) { a.mode = 'hunt'; this.startMove(a, plan.path[0], this.surfaceCost('rat', here, plan.path[0], R.surfaceSpeed)); return; }
    }
    a.mode = 'loiter';
    // Loiter around the hole it came out of (rats keep an escape route close), drawn toward learned food spots.
    const anchor = a.anchor || (this.restaurants.find(r => r.id === a.home) || this.restaurants[0]).doorP;
    const opts = this.neighbors(here).filter(j => this.walkable(j) && !this.restaurantDoors.has(j));
    if (!opts.length) { a.busy = 1; a.busyKind = 'wait'; return; }
    const score = j => -manhattan(this.P(j), anchor) * (manhattan(a, anchor) > 2 ? 1.5 : 0.2) + this.colony.food[j] - this.colony.danger[j] + this.rng() * 1.2;
    const pick = opts.sort((p, q) => score(q) - score(p))[0];
    this.startMove(a, pick, this.surfaceCost('rat', here, pick, R.surfaceSpeed) * 1.4);
  }
  finishRatBusy(a) {
    const here = this.idx(a.x, a.y);
    if (a.busyKind === 'dig' || a.busyKind === 'edig') {
      if (!this.holes.has(here)) { this.holes.set(here, { x: a.x, y: a.y, by: a.id, at: this.time }); this.stats.holesDug++; this.event('dig', a.id + (a.busyKind === 'edig' ? ' dug an emergency hole' : ' dug a new hole') + ' (' + a.x + ',' + a.y + ')', [a], { x: a.x, y: a.y }); }
      if (a.busyKind === 'dig') { a.state = 'forage'; a.anchor = { x: a.x, y: a.y }; a.forageUntil = this.time + RULES.rat.forageTime; this.climb(a, 'surface'); }
      else { a.state = 'home'; this.climb(a, 'under'); }
    }
  }

  /* ---- Contacts: Manhattan distance ≤ 1 on the surface, once per pair until cooldown ---- */
  touching(a, b) { const p = this.cellOf(a), q = this.cellOf(b); return p.layer === 'surface' && q.layer === 'surface' && manhattan(p, q) <= RULES.contact.range; }
  ready(id) { const t = this.contacts.get(id); return t == null || this.time >= t; }
  interactions() {
    for (const p of this.people) for (const r of this.rats) {
      const id = 'shoo:' + p.id + ':' + r.id;
      if (r.state === 'flee' || r.busyKind === 'edig' || !this.ready(id) || !this.touching(p, r)) continue;
      this.contacts.set(id, this.time + RULES.contact.cooldown);
      const c = this.cellOf(r); r.state = 'flee'; r.threat = { x: p.x, y: p.y }; r.mode = null;
      if (r.busy > 0 && r.busyKind !== 'edig') { r.busy = 0; r.busyKind = null; }
      this.bump(this.colony.danger, this.idx(c.x, c.y), 3, 1, 6);
      p.state = 'wander'; p.target = null; this.stats.shoos++;
      this.icon(p, '👊 SHOO', 1.5); this.icon(r, '💨 RUN!', 2);
      this.event('shoo', p.id + ' shoos ' + r.id + ' · rat runs for a hole', [p, r], c);
    }
    for (const d of this.robots) for (const r of this.rats) {
      const id = 'steal:' + r.id + ':' + d.id;
      if (!d.carrying || r.state !== 'forage' || r.carrying || !this.ready(id) || !this.touching(d, r)) continue;
      const o = d.order, c = this.cellOf(d), i = this.idx(c.x, c.y);
      if (this.restaurantDoors.has(i)) continue; // Staff guard the doorstep: no theft on a restaurant door cell.
      this.contacts.set(id, this.time + RULES.contact.cooldown);
      this.finishOrder(o, 'stolen'); r.carrying = true; this.stats.thefts++;
      this.bump(this.fleet.risk, i, 3, 2, RULES.learn.riskCap); this.bump(this.colony.food, i, 3, 1, 6);
      this.icon(d, '🍱 STOLEN!', 2.4); this.icon(r, '🍱 +1', 2.4);
      this.event('theft', r.id + ' stole ' + d.id + '’s ' + o.id + ' · order failed', [r, d], c);
    }
  }

  step(dt = RULES.tick) {
    if (this.done) return;
    const n = Math.max(1, Math.round(dt / RULES.tick));
    for (let k = 0; k < n && !this.done; k++) this.tick();
  }
  tick() {
    const dt = RULES.tick; this.time = Math.round((this.time + dt) * 100) / 100;
    this.updateOrders();
    for (const a of this.robots) if (a.layer === 'surface') this.senseRobot(a);
    for (const a of this.agents) {
      if (a.busy > 0) {
        a.busy -= dt;
        if (a.busy <= 1e-9) { a.busy = 0; const kind = a.busyKind; if (a.type === 'robot') this.finishRobotBusy(a); else if (a.type === 'person') this.finishPersonBusy(a); else this.finishRatBusy(a); if (a.busyKind === kind) a.busyKind = null; }
        else continue;
      }
      if (a.move) { a.move.t += dt; if (a.move.t >= a.move.dur - 1e-9) this.arrive(a); else continue; }
      if (!a.move && a.busy <= 0) { if (a.type === 'robot') this.thinkRobot(a); else if (a.type === 'person') this.thinkPerson(a); else this.thinkRat(a); }
    }
    this.interactions();
    const fr = Math.pow(0.5, dt / RULES.learn.robotHalfLife), cr = Math.pow(0.5, dt / RULES.learn.ratHalfLife);
    for (let i = 0; i < this.n; i++) { this.fleet.risk[i] *= fr; this.colony.food[i] *= cr; this.colony.danger[i] *= cr; }
    const allIn = this.orders.every(o => this.time >= o.createdAt);
    if ((allIn && this.orders.every(o => FINAL[o.status])) || this.time >= RULES.maxTime) {
      for (const o of this.orders) if (!FINAL[o.status]) this.finishOrder(o, 'timeout');
      this.done = true; this.event('end', 'Round over · success ' + pct(this.summary().successRate), []);
    }
  }
  runToEnd() { while (!this.done) this.tick(); return this.summary(); }

  summary() {
    const by = s => this.orders.filter(o => o.status === s).length;
    const delivered = by('delivered'), stolen = by('stolen'), timeout = by('timeout'), finished = delivered + stolen + timeout;
    const times = this.orders.filter(o => o.status === 'delivered').map(o => o.doneAt - o.createdAt);
    return { time: this.time, total: this.orders.length, delivered, stolen, timeout, finished,
      active: this.orders.filter(o => o.status === 'waiting' || o.status === 'assigned' || o.status === 'carrying').length,
      successRate: finished ? delivered / finished : null,
      avgTime: times.length ? times.reduce((s, t) => s + t, 0) / times.length : null,
      holesOpen: this.holes.size, ...this.stats, robotDistance: this.robots.reduce((s, r) => s + r.distance, 0), done: this.done,
      houses: this.houses.length, restaurants: this.restaurants.length };
  }
  describeCell(x, y) {
    const i = this.idx(x, y), flat = k => this.map.surface[k] === 'road' || this.map.surface[k] === 'grass', slopes = flat(i) ? this.neighbors(i).filter(flat).map(j => Math.abs(this.slope(i, j))) : [];
    return { x, y, surface: this.map.surface[i], elevation: this.map.elev[i], maxSlope: Math.max(0, ...slopes), underground: this.under[i],
      hole: this.holes.has(i), robotRisk: +this.robotRisk(i).toFixed(2), robotKnowsHole: this.fleet.knownHoles.has(i),
      ratFood: +this.colony.food[i].toFixed(2), ratDanger: +this.colony.danger[i].toFixed(2),
      building: this.buildingAt.get(i) || null };
  }
}
const FINAL = { delivered: true, stolen: true, timeout: true };
const pct = v => v == null ? '—' : Math.round(v * 100) + '%';

/* ---------- Evaluation and automated evolution ---------- */
function fitness(m) { return m.successRate == null ? -Infinity : m.successRate * 100 - (m.avgTime ?? RULES.order.patience) / 10; }
function evaluate(map, { orderSeeds = [7, 8], learning = true } = {}) {
  const runs = orderSeeds.map(s => new LabSim(map, { orderSeed: s, agentSeed: s + 4, learning }).runToEnd());
  const sum = k => runs.reduce((s, r) => s + (r[k] || 0), 0);
  const delivered = sum('delivered'), finished = sum('finished');
  const times = runs.filter(r => r.avgTime != null);
  const out = { runs: runs.length, delivered, stolen: sum('stolen'), timeout: sum('timeout'), finished,
    successRate: finished ? delivered / finished : null,
    avgTime: times.length ? times.reduce((s, r) => s + r.avgTime * r.delivered, 0) / Math.max(1, times.reduce((s, r) => s + r.delivered, 0)) : null,
    holesDug: sum('holesDug'), holesPlugged: sum('holesPlugged'), thefts: sum('thefts') };
  out.fitness = fitness(out); return out;
}
/* Hill-climbing: epoch 0 generates a map; each later epoch mutates the best map so far, evaluates it, keeps it if fitter. */
function* evolve({ seed = 1, epochs = 10, orderSeeds = [7, 8], relief = 6, start = null, learning = true } = {}) {
  let best = start ? cloneMap(start) : generateMap(seed, { relief }), bestScore = evaluate(best, { orderSeeds, learning });
  yield { epoch: 0, map: best, metrics: bestScore, accepted: true, best, bestMetrics: bestScore };
  for (let e = 1; e < epochs; e++) {
    const cand = mutateMap(best, seed * 1000 + e), m = evaluate(cand, { orderSeeds, learning }), accepted = m.fitness > bestScore.fitness;
    if (accepted) { best = cand; bestScore = m; }
    yield { epoch: e, map: cand, metrics: m, accepted, best, bestMetrics: bestScore };
  }
}

const api = { RULES, INFLUENCES, TOWN, LabSim, townMap, generateMap, mutateMap, cloneMap, blankMap, roadsConnected, walkConnected, paintBlocks, flattenBlocks, protectNests, evaluate, evolve, fitness, mulberry32, MUTATIONS, pct };
if (typeof module !== 'undefined') module.exports = api; else root.BluehavenLab = api;
})(typeof window !== 'undefined' ? window : globalThis);
