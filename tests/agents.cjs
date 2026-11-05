const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Simulation,RULES,distance}=require('../agents.js');
// Read exactly the same town layout as the interactive game, without starting WebGL.
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),elements=new Map();
const defaults={speed:'650',semantic:'restaurant',object:'robot',target:'r1',frame:'world',distanceFrom:'robot',distanceTo:'point',ax:'15',ay:'11',bx:'16',by:'21',qx:'16',qy:'21'};
function element(id){if(!elements.has(id))elements.set(id,{value:defaults[id]||'',style:{},checked:true,setAttribute(){},classList:{toggle(){}},click(){this.onclick?.()}});return elements.get(id)}
const context={document:{getElementById:element,querySelector:()=>element('side')},window:{},Math,console,setInterval:()=>1,clearInterval(){}};vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
const town=context.window.citySimulation;
const create=()=>new Simulation({world:town.world,places:town.places,blocks:town.campusBlocks});
let s=create();assert.deepEqual(s.summary().counts,{dogs:3,rats:5,people:8});assert.equal(s.summary().onboard,9);assert(s.dogs.every(a=>a.inventory===3));
for(const a of s.agents){assert(a.known.size>0&&a.known.size<100,'Limited initial knowledge');assert(s.free(a,a.radius));}
assert.notStrictEqual(s.agents[0].known,s.agents[1].known);
const a=s.dogs[0];a.x=16;a.y=21;a.heading=-Math.PI/2;
assert(s.sees(a,{x:16,y:19}));assert(!s.sees(a,{x:16,y:23}),'No rear vision');assert(!s.sees(a,{x:16,y:10}),'Range limit');assert(!s.lineOfSight({x:16,y:16},{x:16,y:11}),'Walls occlude');
// Learning a single hidden destination cannot grant an omniscient path to it.
a.known=new Map([['16,21','road']]);a.landmarks.clear();a.landmarks.set('c3',{...town.places.find(p=>p.id==='c3')});s.plan(a);assert.equal(a.goal,null);assert.equal(a.path.length,0);
// Love changes speed, expires on simulation time, and does not stack from sustained contact.
s=create().demo('boost');let dog=s.dogs[0],person=s.people[0];s.interactions();assert.equal(dog.boostUntil,6);assert.equal(dog.delivered,0);for(let i=0;i<10;i++)s.interactions();assert.equal(s.events.filter(e=>e.type==='boost'&&e.actors[0]===dog.id).length,1);s.time=7;assert(dog.boostUntil<s.time);
// Theft deducts one carried meal, leaves completed score intact, and re-arms only after separation/cooldown.
s=create().demo('theft');dog=s.dogs[0];const rat=s.rats[0];dog.delivered=4;s.interactions();assert.equal(dog.inventory,2);assert.equal(dog.delivered,4);assert.equal(rat.stolen,1);for(let i=0;i<100;i++)s.interactions();assert.equal(dog.inventory,2);s.time=7;s.interactions();assert.equal(dog.inventory,2);rat.y=18;s.interactions();rat.y=20.2;s.interactions();assert.equal(dog.inventory,1);s.time=14;rat.y=18;s.interactions();dog.inventory=0;rat.y=20.2;s.interactions();assert.equal(dog.inventory,0);
// Pedestrian attack produces icons and a genuine escape route; attack takes priority over theft.
s=create().demo('chase');s.interactions();const fleeing=s.rats[0];assert.equal(fleeing.state,'Fleeing');assert.equal(fleeing.fleeUntil,5);assert(fleeing.icon.includes('RUN'));assert(s.people[0].icon.includes('SHOO'));s.plan(fleeing);assert(fleeing.path.length);const before=distance(fleeing,s.people[0]);s.step(.7);assert(distance(fleeing,s.people[0])>before);assert(fleeing.runDistance>0);
// Delivery and refill obey capacity; the primary score counts deliveries only.
s=create();dog=s.dogs[0];let customer=town.places.find(p=>p.id==='c1');Object.assign(dog,{x:customer.x,y:customer.y,goal:{...customer}});s.service(dog);assert.equal(dog.inventory,2);assert.equal(dog.delivered,1);s.time=2;const restaurant=town.places.find(p=>p.id==='r1');Object.assign(dog,{x:restaurant.x,y:restaurant.y,inventory:0,goal:{...restaurant}});s.service(dog);assert.equal(dog.inventory,3);assert.equal(s.totalRefilled,3);
// Touch cannot occur through a wall even when centers are within the requested contact radius.
s=create();let count=0;s.contact({id:'a',x:12,y:13},{id:'b',x:14,y:13},'test',3,()=>count++);assert.equal(count,0);
// A deterministic multi-agent run discovers knowledge, uses remembered landmarks, delivers, and never enters a building.
s=create();const eventTypes=new Set();for(let i=0;i<7200;i++){
 s.step(1/30);for(const a of s.agents){assert(Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.z));assert(s.free(a,a.radius),a.id+' entered a wall at '+a.x+','+a.y);assert(a.inventory>=0&&a.inventory<=3);}
 for(let x=0;x<s.agents.length;x++)for(let y=x+1;y<s.agents.length;y++){const a=s.agents[x],b=s.agents[y];if(a.z>.2||b.z>.2)continue;assert(distance(a,b)>=a.radius+b.radius-.015,'Bodies overlap: '+JSON.stringify({a:{id:a.id,x:a.x,y:a.y,z:a.z,jump:a.jump},b:{id:b.id,x:b.x,y:b.y,z:b.z,jump:b.jump},time:s.time}));}
 for(const e of s.events)eventTypes.add(e.type);
 if(i%300===0){const q=s.summary();assert.equal(q.onboard+q.delivered+q.stolen,9+q.refilled,'Meal conservation');}
}
assert(s.summary().delivered>0,'Dogs must deliver autonomously');assert(s.dogs.some(a=>a.landmarkUses>0));assert(s.agents.some(a=>a.known.size>100));assert(eventTypes.has('boost'));assert(eventTypes.has('theft'));assert(eventTypes.has('chase'));
const replay=create();replay.step(2);const replay2=create();replay2.step(2);assert.deepEqual(replay.snapshot(),replay2.snapshot());
const summary=s.summary();s.reset();assert.equal(s.summary().delivered,0);assert.equal(s.summary().stolen,0);assert.equal(s.summary().onboard,9);assert.equal(s.events.length,0);
console.log('PASS: 3 dogs / 5 rats / 8 people, finite occluded vision, private memory, no hidden routes, love boost, theft accounting/cooldowns, shoo/flee, deliveries/refill, 240s wall clearance, conservation, replay and reset.');console.log(JSON.stringify({summary,eventTypes:[...eventTypes]}));
