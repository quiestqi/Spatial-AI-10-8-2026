// node tests/lab.cjs — Environment Lab engine checks.
const assert = require('assert');
const L = require('../lab-engine.js');
const { RULES, LabSim, generateMap, mutateMap, evaluate, evolve, roadsConnected, cloneMap } = L;
let passed = 0; const ok = (name, fn) => { fn(); passed++; console.log('✓', name); };

ok('original town: 28 buildings, 5 restaurants, canal with two stair bridges, flat ground', () => {
  const m = L.townMap(), s = new LabSim(m);
  assert.strictEqual(m.w, 32); assert.strictEqual(m.h, 38); assert.strictEqual(m.blocks.length, 28);
  assert.deepStrictEqual(s.restaurants.map(r => r.name).sort(), [...L.TOWN.restaurants].sort());
  assert.strictEqual(m.surface.filter(x => x === 'bridge').length, 6); assert.strictEqual(m.surface.filter(x => x === 'stairs').length, 12);
  assert.ok(m.surface.every((x, i) => x === 'bridge' || x === 'stairs' || m.elev[i] === 0));
  assert.ok(roadsConnected(m)); for (const b of s.buildings) assert.ok(b.door != null, b.name + ' has a door');
});

ok('seeded variations are deterministic, keep the town and add hills away from the canal', () => {
  const a = generateMap(12), b = generateMap(12), c = generateMap(13);
  assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a.elev, c.elev);
  for (const sd of [1, 2, 3, 12, 27, 99]) {
    const m = generateMap(sd); assert.ok(roadsConnected(m)); assert.strictEqual(m.blocks.length, 28);
    assert.strictEqual(m.blocks.filter(b => b.role === 'restaurant').length, 5);
    assert.ok(Math.max(...m.elev.filter((e, i) => m.surface[i] === 'road')) > 2, 'has hills');
    for (let y = 18; y <= 22; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (m.surface[i] === 'road') assert.strictEqual(m.elev[i], 0, 'canal banks level'); }
    for (const blk of m.blocks) { const z = m.elev[blk.y * m.w + blk.x]; for (let y = blk.y; y < blk.y + blk.d; y++) for (let x = blk.x; x < blk.x + blk.w; x++) assert.strictEqual(m.elev[y * m.w + x], z, 'building pad level'); }
  }
});

ok('canal and bridges: water blocks everyone and every tunnel; bridges are entered only along their axis', () => {
  const s = new LabSim(L.townMap()), at = (x, y) => s.idx(x, y);
  assert.ok(!Number.isFinite(s.surfaceCost('rat', at(3, 19), at(3, 20), 1)));
  assert.ok(!Number.isFinite(s.underCost(at(3, 20))));
  assert.ok(Number.isFinite(s.surfaceCost('robot', at(8, 18), at(8, 19), 1)), 'robot climbs stairs');
  assert.ok(Number.isFinite(s.surfaceCost('robot', at(8, 19), at(8, 20), 1)), 'stairs to deck');
  assert.ok(!Number.isFinite(s.surfaceCost('person', at(6, 19), at(7, 19), 1)), 'no side entry onto stairs');
  assert.ok(!s.diggable(at(8, 19)) && !s.diggable(at(8, 20)));
  const p = s.search(at(8, 10), (i, j) => s.surfaceCost('robot', i, j, 1), i => i === at(8, 32)); assert.ok(p && p.path.some(i => s.map.surface[i] === 'bridge'));
});

ok('distribution rules: 0 holes, rats in nests under restaurants, people at house doors, robots at restaurant doors', () => {
  const s = new LabSim(generateMap(12));
  assert.strictEqual(s.holes.size, 0);
  assert.strictEqual(s.rats.length, s.restaurants.length * RULES.rat.perRestaurant);
  for (const r of s.rats) { assert.strictEqual(r.layer, 'under'); assert.ok(s.nests.has(s.idx(r.x, r.y))); }
  const houseDoors = new Set(s.houses.map(h => h.door)), restDoors = new Set(s.restaurants.map(r => r.door));
  assert.strictEqual(s.people.length, RULES.person.count);
  for (const p of s.people) assert.ok(houseDoors.has(s.idx(p.x, p.y)));
  for (const r of s.robots) assert.ok(restDoors.has(s.idx(r.x, r.y)));
});

ok('grid-by-grid: every move is one 4-neighbour cell or a layer change through a hole; robots never cross >20% slopes', () => {
  const s = new LabSim(generateMap(5)); const last = new Map(s.agents.map(a => [a.id, { x: a.x, y: a.y, layer: a.layer }]));
  for (let k = 0; k < 1600 && !s.done; k++) {
    s.tick();
    for (const a of s.agents) {
      const p = last.get(a.id), d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y);
      assert.ok(d <= 1, a.id + ' jumped ' + d);
      if (a.layer !== p.layer) { assert.strictEqual(d, 0); }
      if (d === 1 && a.layer === 'surface') {
        const i = s.idx(p.x, p.y), j = s.idx(a.x, a.y); assert.ok(s.walkable(j), a.id + ' entered a building');
        const structure = ['bridge', 'stairs'].includes(s.map.surface[i]) || ['bridge', 'stairs'].includes(s.map.surface[j]);
        if (structure && s.map.surface[i] !== s.map.surface[j]) assert.strictEqual(p.x, a.x, 'bridges are entered along their axis');
        if (a.type === 'robot' && !structure) assert.ok(Math.abs(s.slope(i, j)) <= RULES.robot.maxSlope + 1e-9, 'robot slope');
        if (a.type === 'person' && !structure) assert.ok(Math.abs(s.slope(i, j)) <= RULES.person.maxSlope + 1e-9, 'person slope');
      }
      if (d === 1 && a.layer === 'under') assert.notStrictEqual(s.under[s.idx(a.x, a.y)], 'rock');
      last.set(a.id, { x: a.x, y: a.y, layer: a.layer });
    }
  }
});

ok('layer changes only start on hole cells', () => {
  const s = new LabSim(generateMap(42)); let changes = 0; const orig = s.startMove.bind(s);
  s.startMove = (a, j, dur, layer = a.layer) => { if (layer !== a.layer) { changes++; assert.ok(s.holes.has(s.idx(a.x, a.y)), a.id + ' changed layer off-hole'); assert.strictEqual(j, s.idx(a.x, a.y)); } return orig(a, j, dur, layer); };
  s.runToEnd(); assert.ok(changes > 4, 'rats surfaced and returned');
});

ok('rats dig holes near restaurants; people plug holes; shoo makes rats flee to holes', () => {
  let dug = 0, plugged = 0, shoos = 0, near = 0, all = 0;
  for (const seed of [1, 2, 3, 42]) {
    const s = new LabSim(generateMap(seed)); s.runToEnd(); const m = s.summary();
    dug += m.holesDug; plugged += m.holesPlugged; shoos += m.shoos;
    for (const e of s.events.filter(e => e.type === 'dig' && e.text.includes('挖出新洞口'))) { all++; if (s.restaurants.some(r => Math.abs(r.doorP.x - e.at.x) + Math.abs(r.doorP.y - e.at.y) <= RULES.rat.digRadius * 2)) near++; else console.log('far dig', e.at); }
  }
  assert.ok(dug > 10 && plugged > 5 && shoos > 10, JSON.stringify({ dug, plugged, shoos }));
  assert.strictEqual(near, all);
});

ok('theft fails the order and teaches both learning maps; plug removes the hole', () => {
  const s = new LabSim(generateMap(12)), r = s.robots[0], rat = s.rats[0], o = s.orders[0];
  const people = s.people; s.agents = s.agents.filter(a => a.type !== 'person'); // keep pedestrians out of reach (shoo has priority)
  const cell = s.restaurants[0].doorP, road = s.neighbors(s.idx(cell.x, cell.y)).find(j => s.diggable(j) && !s.restaurantDoors.has(j));
  const P = s.P(road);
  Object.assign(r, { x: P.x, y: P.y, move: null, carrying: true, order: o, state: 'delivering' }); Object.assign(o, { status: 'carrying', robot: r.id, createdAt: 0, deadline: 999 });
  Object.assign(rat, { x: P.x, y: P.y, layer: 'surface', state: 'forage', busy: 0, move: null, carrying: false });
  s.interactions();
  assert.strictEqual(o.status, 'stolen'); assert.strictEqual(r.carrying, false); assert.strictEqual(rat.carrying, true);
  assert.ok(s.fleet.risk[road] > 2 && s.colony.food[road] > 2);
  s.interactions(); assert.strictEqual(s.stats.thefts, 1, 'cooldown prevents repeat');
  // plugging
  s.holes.set(road, { x: P.x, y: P.y, by: rat.id, at: 0 }); const p = people[0]; s.agents.push(p); rat.layer = 'under';
  Object.assign(p, { x: P.x, y: P.y, move: null, busy: 0, state: 'toHole', target: road });
  s.thinkPerson(p); assert.strictEqual(p.busyKind, 'plug'); for (let k = 0; k < 8; k++) s.tick();
  assert.ok(!s.holes.has(road)); assert.ok(s.stats.holesPlugged >= 1);
});

ok('restaurant doorstep is guarded', () => {
  const s = new LabSim(generateMap(12)), r = s.robots[0], rat = s.rats[0], o = s.orders[0], d = s.restaurants[0].door, P = s.P(d);
  s.agents = s.agents.filter(a => a.type !== 'person');
  Object.assign(r, { x: P.x, y: P.y, move: null, carrying: true, order: o }); Object.assign(o, { status: 'carrying', robot: r.id });
  Object.assign(rat, { x: P.x, y: P.y, layer: 'surface', state: 'forage', move: null });
  s.interactions(); assert.strictEqual(o.status, 'carrying');
});

ok('shoo: person contact makes rat flee and marks danger', () => {
  const s = new LabSim(generateMap(12)), p = s.people[0], rat = s.rats[0];
  Object.assign(rat, { x: p.x, y: p.y, layer: 'surface', state: 'forage', move: null, busy: 0 });
  s.interactions(); assert.strictEqual(rat.state, 'flee'); assert.ok(s.colony.danger[s.idx(p.x, p.y)] >= 3);
});

ok('robot learning map steers carrying robots around known risk', () => {
  const m = generateMap(12), s = new LabSim(m), r = s.robots[0];
  const goal = s.houses[s.houses.length - 1].door; r.carrying = true;
  const base = s.robotPath(r, goal).path;
  for (const j of base.slice(2, -2)) s.fleet.risk[j] = 6;
  const avoid = s.robotPath(r, goal).path;
  const overlap = avoid.filter(j => s.fleet.risk[j] > 0).length;
  assert.ok(overlap < base.length - 4, 'path changed to avoid risk');
  const off = new LabSim(m, { learning: false }); off.robots[0].carrying = true; for (const j of base.slice(2, -2)) off.fleet.risk[j] = 6;
  assert.deepStrictEqual(off.robotPath(off.robots[0], goal).path, base);
});

ok('orders: countdown → timeout counts as failure; success rate excludes nothing else', () => {
  const s = new LabSim(generateMap(7)); const m = s.runToEnd();
  assert.strictEqual(m.finished, m.total); assert.strictEqual(m.delivered + m.stolen + m.timeout, m.total);
  assert.ok(Math.abs(m.successRate - m.delivered / m.total) < 1e-12);
  for (const o of s.orders) { if (o.status === 'timeout') assert.ok(o.doneAt >= o.deadline - 1e-9 || o.doneAt >= RULES.maxTime); if (o.status === 'delivered') assert.ok(o.doneAt <= o.deadline + 1e-9); }
});

ok('deterministic replay and fair A/B seeds', () => {
  const m = generateMap(27); const a = new LabSim(m, { orderSeed: 9 }).runToEnd(), b = new LabSim(m, { orderSeed: 9 }).runToEnd();
  assert.deepStrictEqual(a, b);
  const x = new LabSim(generateMap(1), { orderSeed: 9 }), y = new LabSim(generateMap(2), { orderSeed: 9 });
  assert.deepStrictEqual(x.orders.map(o => o.createdAt), y.orders.map(o => o.createdAt));
});

ok('mutation keeps maps valid and records lineage', () => {
  let m = generateMap(4);
  for (let k = 0; k < 25; k++) { const n = mutateMap(m, k); assert.ok(roadsConnected(n)); assert.ok(n.surface.includes('restaurant')); assert.ok(n.lineage.length >= m.lineage.length); assert.strictEqual(n.blocks.length, 28); m = n; }
  const c = cloneMap(m); c.surface[0] = 'road'; assert.notStrictEqual(m.surface, c.surface);
});

ok('automated evolution: epochs = environments evaluated; best fitness never decreases', () => {
  const out = [...evolve({ seed: 12, epochs: 6, orderSeeds: [7] })];
  assert.strictEqual(out.length, 6);
  for (let k = 1; k < out.length; k++) assert.ok(out[k].bestMetrics.fitness >= out[k - 1].bestMetrics.fitness);
  const e = evaluate(out[out.length - 1].best, { orderSeeds: [7] });
  assert.ok(Math.abs(e.fitness - out[out.length - 1].bestMetrics.fitness) < 1e-9);
});

ok('terrain blocks line of sight', () => {
  const m = L.blankMap(); for (let x = 0; x < m.w; x++) m.surface[5 * m.w + x] = 'road';
  m.surface[3 * m.w + 3] = 'restaurant'; const s0 = new LabSim(m), p = { x: 2, y: 5 };
  m.surface[5 * m.w + 9] = 'house'; assert.ok(!new LabSim(m).canSee(p, 12, 5, 12, 1.6), 'buildings block sight'); m.surface[5 * m.w + 9] = 'road';
  assert.ok(s0.canSee(p, 6, 5, 4, 1.6));
  m.elev[5 * m.w + 4] = 4; const s1 = new LabSim(m); assert.ok(!s1.canSee(p, 6, 5, 4, 1.6));
});

console.log(passed + ' lab tests passed');
