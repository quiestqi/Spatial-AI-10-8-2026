/* Spatial Agents: deterministic simulation, separate from rendering and the legacy workshop.
   Navigation reads each agent's discovered map. The true world is used only for sensing/physics. */
(function(root){'use strict';
const key=p=>Math.round(p.x)+','+Math.round(p.y),cell=p=>({x:Math.round(p.x),y:Math.round(p.y)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const RULES=Object.freeze({dogs:3,rats:5,people:8,capacity:3,boostDuration:6,boostMultiplier:1.6,contactCooldown:6,visionRange:6,visionAngle:Math.PI*2/3});
class Simulation{
 constructor({world,places,blocks=[],seed=20261105}){this.world=world;this.W=world[0].length;this.H=world.length;this.places=places;this.blocks=blocks;this.seed=seed;this.generation=0;this.reset()}
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296}
 road(p){return this.world[Math.round(p.y)]?.[Math.round(p.x)]==='road'}
 neighbors(p){return DIRECTIONS.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>q.x>=0&&q.y>=0&&q.x<this.W&&q.y<this.H)}
 free(p,r=.25){if(p.x<-.5+r||p.y<-.5+r||p.x>this.W-.5-r||p.y>this.H-.5-r)return false;
  for(let y=Math.floor(p.y-r+.5);y<=Math.floor(p.y+r+.5);y++)for(let x=Math.floor(p.x-r+.5);x<=Math.floor(p.x+r+.5);x++)if(this.world[y]?.[x]==='building'){
   const dx=Math.max(x-.5-p.x,0,p.x-x-.5),dy=Math.max(y-.5-p.y,0,p.y-y-.5);if(dx*dx+dy*dy<=r*r)return false;
  }return true;
 }
 segment(a,b,r=.25){const n=Math.max(1,Math.ceil(distance(a,b)/.08));for(let i=0;i<=n;i++){const t=i/n;if(!this.free({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},r))return false}return true}
 lineOfSight(a,b){const n=Math.max(1,Math.ceil(distance(a,b)/.12));for(let i=1;i<n;i++){const t=i/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(!this.road(p)&&key(p)!==key(b))return false}return true}
 sees(a,p){const d=distance(a,p);if(d>RULES.visionRange)return false;if(d>.35){const angle=Math.atan2(p.y-a.y,p.x-a.x),delta=Math.atan2(Math.sin(angle-a.heading),Math.cos(angle-a.heading));if(Math.abs(delta)>RULES.visionAngle/2)return false}return this.lineOfSight(a,p)}
 make(type,i,p,heading){return {id:(type==='dog'?'K-0':type==='rat'?'R-0':'P-0')+(i+1),type,x:p[0],y:p[1],z:0,heading,radius:type==='dog'?.3:type==='rat'?.26:.22,speed:type==='dog'?1.3:type==='rat'?1.55:.9,vx:0,vy:0,inventory:type==='dog'?3:0,delivered:0,stolen:0,visits:0,distance:0,known:new Map(),visible:new Set(),landmarks:new Map(),seenActors:new Map(),visited:new Map(),trail:[{x:p[0],y:p[1]}],path:[],goal:null,state:'Discovering',senseAt:0,planAt:0,blocked:0,boostUntil:0,fleeUntil:0,fleeFrom:null,safeUntil:0,lastDelivery:new Map(),lastService:-Infinity,icon:null,iconUntil:0,jump:null,jumpReady:0,landmarkUses:0,runDistance:0,lastFleeDistance:0};}
 reset(){this.rng=this.seed;this.time=0;this.generation++;this.events=[];this.eventSerial=0;this.jumpSerial=0;this.contacts=new Map();this.totalRefilled=0;
  this.agents=[...[[16,21],[12,26],[20,5]].map((p,i)=>this.make('dog',i,p,[-Math.PI/2,Math.PI/2,0][i])),...[[16,20],[14,25],[25,32],[20,6],[6,16]].map((p,i)=>this.make('rat',i,p,Math.PI/2)),...[[14,21],[18,22],[12,27],[22,5],[7,16],[25,34],[16,24],[12,5]].map((p,i)=>this.make('person',i,p,(i%4)*Math.PI/2))];
  for(const a of this.agents)this.sense(a);return this;
 }
 get dogs(){return this.agents.filter(a=>a.type==='dog')}
 get rats(){return this.agents.filter(a=>a.type==='rat')}
 get people(){return this.agents.filter(a=>a.type==='person')}
 event(type,message,actors){const e={id:++this.eventSerial,time:this.time,type,message,actors:actors.map(a=>a.id)};this.events.unshift(e);this.events.length=Math.min(this.events.length,60);return e}
 icon(a,text,duration=2){a.icon=text;a.iconUntil=this.time+duration}
 sense(a){a.visible.clear();const origin=cell(a);a.known.set(key(origin),this.world[origin.y][origin.x]);a.visible.add(key(origin));
  for(let y=Math.max(0,origin.y-6);y<=Math.min(this.H-1,origin.y+6);y++)for(let x=Math.max(0,origin.x-6);x<=Math.min(this.W-1,origin.x+6);x++){const p={x,y};if(this.sees(a,p)){const k=key(p);a.visible.add(k);a.known.set(k,this.world[y][x]);}}
  // Facts enter memory only when visible, never from another agent's private map.
  for(const p of this.places)if(this.sees(a,p)){const old=a.landmarks.get(p.id);a.landmarks.set(p.id,{...p,firstSeen:old?.firstSeen??this.time,lastSeen:this.time,visits:old?.visits||0});}
  for(const b of this.blocks){if(!a.landmarks.has('building:'+b.name)&&[...a.visible].some(k=>{const [x,y]=k.split(',').map(Number);return x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.d})){a.landmarks.set('building:'+b.name,{id:'building:'+b.name,name:b.name,type:'obstacle',firstSeen:this.time,x:b.x,y:b.y,visits:0});}}
  for(const other of this.agents)if(other!==a&&this.sees(a,other))a.seenActors.set(other.id,{id:other.id,type:other.type,x:other.x,y:other.y,inventory:other.inventory,time:this.time});
  for(const [id,m]of a.seenActors)if(this.time-m.time>4)a.seenActors.delete(id);
  a.senseAt=this.time+.18;
 }
 // Returns paths only through this agent's own known road cells.
 search(a){const start=cell(a),q=[start],prev=new Map([[key(start),null]]),byKey=new Map([[key(start),start]]);
  for(let i=0;i<q.length;i++)for(const n of this.neighbors(q[i])){const k=key(n);if(a.known.get(k)==='road'&&!prev.has(k)){prev.set(k,key(q[i]));byKey.set(k,n);q.push(n)}}
  return {q,path:p=>{let k=key(p);if(!prev.has(k))return null;const path=[];while(prev.get(k)!==null){path.push(byKey.get(k));k=prev.get(k)}return path.reverse()}};
 }
 plan(a){const search=this.search(a);a.path=[];a.goal=null;
  if(a.type==='rat'&&a.fleeUntil>this.time){a.state='Fleeing';const threat=a.fleeFrom;
   const candidates=search.q.filter(p=>distance(p,a)<7).sort((p,q)=>distance(q,threat)-distance(p,threat));a.goal=candidates[0];a.path=search.path(a.goal)||[];
  }else{
   if(a.type==='rat'&&a.safeUntil<=this.time){const targets=[...a.seenActors.values()].filter(m=>m.type==='dog'&&m.inventory>0).sort((p,q)=>distance(a,p)-distance(a,q));for(const m of targets){const path=search.path(m);if(path){a.goal={...cell(m),id:m.id};a.path=path;a.state='Seeking food';break}}}
   if(a.type==='person'){const rat=[...a.seenActors.values()].filter(m=>m.type==='rat'&&distance(a,m)<3).sort((p,q)=>distance(a,p)-distance(a,q))[0];if(rat){const path=search.path(rat);if(path){a.goal={...cell(rat),id:rat.id};a.path=path;a.state='Chasing rat';}}}
   if(!a.goal&&a.type!=='rat'){
    const category=a.type==='dog'?(a.inventory?'customer':'restaurant'):'restaurant';
    const known=[...a.landmarks.values()].filter(m=>m.type===category&&(a.lastDelivery.get(m.id)||-Infinity)<this.time-5).map(m=>({m,path:search.path(m)})).filter(x=>x.path!==null).sort((x,y)=>x.path.length-y.path.length||(x.m.visits-y.m.visits));
    if(known.length){const {m,path}=known[0];a.goal={...m};a.path=path;a.state=a.type==='dog'?(a.inventory?'Delivering':'Refilling'):'Visiting a shop';a.landmarkUses++;}
   }
   if(!a.goal){a.state=a.type==='rat'?'Searching for food':'Exploring';const choices=search.q.filter(p=>this.neighbors(p).some(n=>!a.known.has(key(n))));
    let best=null,score=-Infinity;for(const p of choices){const d=distance(a,p);if(d<.6)continue;const unknown=this.neighbors(p).filter(n=>!a.known.has(key(n))).length,seen=a.visited.get(key(p))||0;const value=unknown*2-d*.3-seen*.7+this.random()*.7;if(value>score){score=value;best=p}}
    if(!best){const roads=search.q.filter(p=>distance(p,a)>.8);roads.sort((p,q)=>(a.visited.get(key(p))||0)-(a.visited.get(key(q))||0));best=roads[Math.floor(this.random()*Math.min(roads.length,8))]||null;}
    if(best){a.goal={...best};a.path=search.path(best)||[];}
   }
  }
  a.planAt=this.time+.8;
 }
 contact(a,b,type,range,act){const id=type+':'+a.id+':'+b.id,d=distance(a,b);let c=this.contacts.get(id);if(!c){c={inside:false,ready:0};this.contacts.set(id,c)}if(d>range+.55)c.inside=false;
  if(d<=range&&!c.inside&&this.time>=c.ready&&this.lineOfSight(a,b)){c.inside=true;c.ready=this.time+RULES.contactCooldown;act();}
 }
 interactions(){
  // A person's touch takes priority over a rat stealing in the same simulation step.
  for(const p of this.people)for(const r of this.rats)this.contact(p,r,'shoo',1.15,()=>{r.fleeUntil=this.time+5;r.fleeFrom={x:p.x,y:p.y};r.safeUntil=this.time+5;r.path=[];r.planAt=0;r.state='Fleeing';this.icon(p,'👊 SHOO!',2.4);this.icon(r,'💨 RUN!',3);this.event('chase',p.id+' drives away '+r.id,[p,r]);});
  for(const d of this.dogs){for(const p of this.people)this.contact(d,p,'love',1.05,()=>{d.boostUntil=this.time+RULES.boostDuration;this.icon(d,'♥ 1.6×',3);this.icon(p,'♥',2);this.event('boost',d.id+' meets '+p.id+' · speed ×1.6 for 6s',[d,p]);});
   for(const r of this.rats)this.contact(r,d,'steal',.9,()=>{if(r.fleeUntil>this.time||r.safeUntil>this.time||d.inventory<=0||d.z>.7)return;d.inventory--;r.stolen++;r.safeUntil=this.time+2;this.icon(d,'🍱 −1',2.4);this.icon(r,'🍱 +1',2.4);d.planAt=0;this.event('theft',r.id+' stole 1 meal from '+d.id+' · '+d.inventory+' left',[r,d]);});
  }
 }
 service(a){if(!a.goal?.id||distance(a,a.goal)>.48||this.time-a.lastService<1)return;
  const place=this.places.find(p=>p.id===a.goal.id);if(!place)return;
  if(a.type==='dog'&&place.type==='customer'&&a.inventory>0){a.inventory--;a.delivered++;a.lastDelivery.set(place.id,this.time);a.lastService=this.time;this.icon(a,'✓ DELIVERED',2);this.event('delivery',a.id+' delivered a meal · score '+a.delivered,[a]);}
  else if(a.type==='dog'&&place.type==='restaurant'&&a.inventory===0){a.inventory=3;this.totalRefilled+=3;a.lastService=this.time;this.icon(a,'🍱 REFILL 3',2);this.event('refill',a.id+' refilled 3 meals at '+place.id.toUpperCase(),[a]);}
  else if(a.type==='person'&&place.type==='restaurant'){a.visits++;a.lastDelivery.set(place.id,this.time+8);a.lastService=this.time;this.icon(a,'✓ VISIT',1.5);}
  else return;
  const m=a.landmarks.get(place.id);if(m)m.visits++;a.goal=null;a.path=[];a.planAt=0;
 }
 tryJump(a){if(a.type!=='dog'||a.jump||this.time<a.jumpReady||a.path.length<2)return;
  const from={x:a.x,y:a.y},to=a.path[1],n=a.path[0],dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy);if(len<1.6||len>2.3||Math.abs(dx)>.08&&Math.abs(dy)>.08||!this.segment(from,to,a.radius))return;
  const r=this.rats.find(r=>{const t=((r.x-from.x)*dx+(r.y-from.y)*dy)/(len*len),side=Math.abs((r.x-from.x)*dy-(r.y-from.y)*dx)/len;return t>.2&&t<.8&&side<.5&&this.sees(a,r)});
  if(!r||this.agents.some(b=>b!==a&&(distance(b,to)<a.radius+b.radius+.22||b.jump&&distance(b.jump.to,to)<a.radius+b.radius+.22)))return;
  a.jump={id:++this.jumpSerial,from,to:{...to},over:{x:r.x,y:r.y},ratId:r.id,start:this.time,duration:len*1.4/(a.speed*(a.boostUntil>this.time?1.6:1)),previousAlong:null,crossed:false,above:false};a.path.splice(0,2);a.jumpReady=this.time+3;this.icon(a,'! JUMP',1);this.event('jump',a.id+' jumps near '+r.id,[a,r]);
 }
 move(a,dt){if(a.jump){const j=a.jump,t=Math.min(1,(this.time-j.start)/j.duration),old={x:a.x,y:a.y},r=this.rats.find(r=>r.id===j.ratId);const travel=Math.max(0,Math.min(1,(t-.2)/.6));a.x=j.from.x+(j.to.x-j.from.x)*travel;a.y=j.from.y+(j.to.y-j.from.y)*travel;a.z=t<.2?Math.sin(t/.2*Math.PI/2)*1.9:t>.8?Math.cos((t-.8)/.2*Math.PI/2)*1.9:1.9;
   const dx=j.to.x-j.from.x,dy=j.to.y-j.from.y,len=distance(j.from,j.to),along=((a.x-r.x)*dx+(a.y-r.y)*dy)/len,lateral=Math.abs((a.x-r.x)*dy-(a.y-r.y)*dx)/len;
   if(a.z>=1.05&&distance(a,r)<=.7)j.above=true;if(j.previousAlong!==null&&j.previousAlong<0&&along>=0&&a.z>=1.05&&lateral<=.7)j.crossed=true;j.previousAlong=along;
   a.distance+=distance(old,a);a.vx=(a.x-old.x)/dt;a.vy=(a.y-old.y)/dt;if(t===1){a.z=0;a.jump=null;if(j.crossed&&j.above&&along>.3)this.event('over',a.id+' verified Over '+r.id+' and landed',[a,r]);}return;
  }
  this.tryJump(a);if(a.jump)return;
  let point=a.path[0];if(point&&distance(a,point)<.04){a.path.shift();point=a.path[0];}
  if(!point){a.vx=a.vy=0;a.heading+=dt*.9;return;}
  const dx=point.x-a.x,dy=point.y-a.y,angle=Math.atan2(dy,dx);a.heading=angle;
  const speed=a.speed*(a.type==='dog'&&a.boostUntil>this.time?1.6:1)*(a.fleeUntil>this.time?1.8:1),step=Math.min(distance(a,point),speed*dt),candidate={x:a.x+Math.cos(angle)*step,y:a.y+Math.sin(angle)*step};
  let blocked=false;for(const other of this.agents){if(other===a)continue;const min=a.radius+other.radius+.035;if(other.jump&&distance(candidate,other.jump.to)<min+.22){blocked=true;break;}if(other.z>.7)continue;if(distance(candidate,other)<min&&distance(candidate,other)<distance(a,other)-1e-6){blocked=true;break;}}
  const old={x:a.x,y:a.y};if(!blocked&&this.segment(a,candidate,a.radius)){a.x=candidate.x;a.y=candidate.y;a.blocked=0;}else{a.blocked+=dt;a.vx=a.vy=0;
   // Yield and sidestep only through already discovered, physically free road cells.
   if(a.blocked>.6){const sides=this.neighbors(cell(a)).filter(p=>a.known.get(key(p))==='road'&&this.segment(a,p,a.radius)&&this.agents.every(b=>b===a||distance(p,b)>a.radius+b.radius+.1));if(sides.length){const side=sides[Math.floor(this.random()*sides.length)];a.path=[side];a.planAt=this.time+1;}else a.heading+=Math.PI/2;a.blocked=0;}return;
  }
  a.vx=(a.x-old.x)/dt;a.vy=(a.y-old.y)/dt;a.distance+=distance(old,a);
  if(a.fleeUntil>this.time)a.runDistance+=distance(old,a);
 }
 step(dt){if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,2);const n=Math.ceil(dt/(1/30)),h=dt/n;
  for(let i=0;i<n;i++){this.time+=h;for(const a of this.agents){if(this.time>=a.senseAt)this.sense(a);if(!a.jump&&this.time>=a.planAt)this.plan(a);}this.interactions();for(const a of this.agents){this.move(a,h);if(!a.jump)this.service(a);const k=key(a);if(k!==a.lastCell){a.visited.set(k,(a.visited.get(k)||0)+1);a.lastCell=k;}if(!a.trail.length||distance(a,a.trail[a.trail.length-1])>.25){a.trail.push({x:a.x,y:a.y});if(a.trail.length>800)a.trail.shift();}}}
 }
 demo(kind){this.reset();const d=this.dogs[0],r=this.rats[0],p=this.people[0];if(kind==='boost'){d.x=16;d.y=21;p.x=16.8;p.y=21;r.x=24;r.y=21;}if(kind==='theft'){d.x=16;d.y=21;r.x=16;r.y=20.2;p.x=12;p.y=21;}if(kind==='chase'){r.x=16;r.y=21;p.x=15.1;p.y=21;d.x=20;d.y=21;}
  for(const a of this.agents){a.known.clear();a.landmarks.clear();a.seenActors.clear();a.visible.clear();a.path=[];a.goal=null;a.trail=[{x:a.x,y:a.y}];a.planAt=0;this.sense(a);}return this;
 }
 summary(){return {time:this.time,delivered:this.dogs.reduce((n,a)=>n+a.delivered,0),onboard:this.dogs.reduce((n,a)=>n+a.inventory,0),stolen:this.rats.reduce((n,a)=>n+a.stolen,0),refilled:this.totalRefilled,counts:{dogs:this.dogs.length,rats:this.rats.length,people:this.people.length}}}
 snapshot(){return {generation:this.generation,...this.summary(),events:this.events.map(e=>({...e})),agents:this.agents.map(a=>({...a,known:[...a.known],visible:[...a.visible],landmarks:[...a.landmarks.values()].map(m=>({...m})),seenActors:[...a.seenActors.values()].map(m=>({...m})),visited:[...a.visited],trail:a.trail.map(p=>({...p})),path:a.path.map(p=>({...p})),lastDelivery:[...a.lastDelivery]}))}}
}
const api={Simulation,RULES,distance};if(typeof module!=='undefined')module.exports=api;else root.SpatialAgents=api;
})(typeof window!=='undefined'?window:globalThis);
