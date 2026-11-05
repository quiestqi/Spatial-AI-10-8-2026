const assert=require('node:assert/strict');
const {Observer,above,relative,between}=require('../spatial.js');
const c={id:'c1',x:0,y:0,facing:{x:0,y:1}};
assert.equal(relative({x:0,y:2},c),'In front of');assert.equal(relative({x:0,y:-2},c),'Behind');
assert.equal(relative({x:2,y:0},c),null);assert.equal(relative({x:0,y:9},c),null);
assert.equal(relative({x:-2,y:0},{...c,facing:{x:-1,y:0}}),'In front of');
assert(above({x:0,y:0,z:1.5},{x:0,y:0},{id:1}));
assert(!above({x:0,y:0,z:0},{x:0,y:0},{id:1}));
assert(!above({x:0,y:0,z:1.5},{x:0,y:0},null));
assert(!above({x:2,y:0,z:1.5},{x:0,y:0},{id:1}));
const blocks=[{name:'A',x:0,y:0,w:2,d:3},{name:'B',x:4,y:0,w:2,d:3}];
const road=p=>!blocks.some(b=>p.x>=b.x-.5&&p.x<=b.x+b.w-.5&&p.y>=b.y-.5&&p.y<=b.y+b.d-.5);
assert(between({x:2.5,y:1},blocks,road));assert(!between({x:2.5,y:6},blocks,road));assert(!between({x:0,y:1},blocks,road));
assert(!between({x:2.5,y:1},blocks,()=>false));
let ob=new Observer([c],[],()=>true),time=0;const rat={x:50,y:50};
function sample(y,z=0){time+=.05;return ob.update({x:0,y,z},rat,null,time)}
sample(4);for(let y=3.9;y>=1.3;y-=.1)sample(y);for(let y=1.4;y<=4;y+=.1)sample(y);
assert(ob.seen.has('Toward'));assert(ob.seen.has('Into'));assert(ob.seen.has('Out of'));
assert.equal(ob.events.filter(e=>e.type==='Into').length,1);
// Stationary frames and lateral travel are not Toward. Initial occupancy is not Into.
ob=new Observer([c],[],()=>true);ob.update({x:0,y:0,z:0},rat,null,0);ob.update({x:0,y:0,z:0},rat,null,.05);assert(!ob.seen.has('Toward'));assert(!ob.seen.has('Into'));
// Inaccessible cells do not create entry/exit events.
ob=new Observer([c],[],()=>false);ob.update({x:0,y:3,z:0},rat,null,0);ob.update({x:0,y:1,z:0},rat,null,.05);assert(!ob.seen.has('Into'));
function jumpCase({stationary=false,offset=0,height=1.9,gap=false,moving=false}={}){
 const o=new Observer([],[],()=>true),j={id:1,from:{x:0,y:1},to:{x:0,y:stationary?1:-1}};
 let r={x:offset,y:0};o.update({x:0,y:1,z:0},r,null,0);
 for(let i=0;i<61;i++){const t=i/60,e=t*t*(3-2*t);r={x:offset+(moving?t*3:0),y:0};o.update({x:0,y:stationary?1:1-2*e,z:Math.sin(t*Math.PI)*height},r,j,.02+i*.01+(gap&&i>25?1:0))}
 o.update({x:0,y:stationary?1:-1,z:0},r,null,gap?1.64:.64);return o;
}
assert(jumpCase().seen.has('Above'));assert(jumpCase().seen.has('Over'));
assert(!jumpCase({stationary:true}).seen.has('Over'));assert(!jumpCase({offset:2}).seen.has('Over'));
assert(!jumpCase({height:.5}).seen.has('Over'));assert(!jumpCase({gap:true}).seen.has('Over'));assert(!jumpCase({moving:true}).seen.has('Over'));
const o=jumpCase();assert.equal(o.events.filter(e=>e.type==='Over').length,1);o.reset();assert.equal(o.events.length,0);assert.equal(o.seen.size,0);
console.log('PASS: customer frames, Between corridors, Above state, zone transitions, Toward, verified Over, negative jump cases, sample gaps and reset.');
