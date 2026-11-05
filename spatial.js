/* Spatial predicates use world x/y on the ground and z for height.
   The same sampled positions drive the visible dog and the observer. */
(function(root){'use strict';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const bounds=b=>({l:b.x-.5,r:b.x+b.w-.5,t:b.y-.5,b:b.y+b.d-.5});
function between(p,blocks,walkable){
 if(!walkable(p))return null;
 for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){
  const a=bounds(blocks[i]),b=bounds(blocks[j]);let corridor=null;
  if(a.r<b.l&&p.x>a.r+.22&&p.x<b.l-.22&&p.y>=Math.max(a.t,b.t)&&p.y<=Math.min(a.b,b.b))corridor={axis:'x',a:{x:a.r,y:p.y},b:{x:b.l,y:p.y}};
  if(a.b<b.t&&p.y>a.b+.22&&p.y<b.t-.22&&p.x>=Math.max(a.l,b.l)&&p.x<=Math.min(a.r,b.r))corridor={axis:'y',a:{x:p.x,y:a.b},b:{x:p.x,y:b.t}};
  // An intervening building invalidates the open corridor.
  if(corridor){const n=Math.ceil(distance(corridor.a,corridor.b)*8);let clear=true;for(let k=1;k<n;k++){const t=k/n;if(!walkable({x:corridor.a.x+(corridor.b.x-corridor.a.x)*t,y:corridor.a.y+(corridor.b.y-corridor.a.y)*t})){clear=false;break}}if(clear)return {...corridor,names:[blocks[i].name,blocks[j].name]};}
 }return null;
}
function relative(p,c){const dx=p.x-c.x,dy=p.y-c.y,f=c.facing,forward=dx*f.x+dy*f.y,lateral=Math.abs(dx*f.y-dy*f.x),d=distance(p,c);return d<=3.5&&lateral<=1.15?(forward>=.65?'In front of':forward<=-.65?'Behind':null):null}
function above(dog,rat,jump){return !!jump&&dog.z>=1.05&&distance(dog,rat)<=.7}
class Observer{
 constructor(customers,blocks,walkable){this.customers=customers;this.blocks=blocks;this.walkable=walkable;this.reset()}
 reset(){this.prev=null;this.positions=[];this.events=[];this.active=new Set();this.track=null;this.seen=new Set();this.serial=0;this.lastToward=-Infinity;this.lastFrameTime=null;this.trail=[];this.pulse=null}
 emit(type,detail,time){const e={id:++this.serial,type,detail,time};this.events.unshift(e);this.events.length=Math.min(30,this.events.length);this.seen.add(type);this.pulse={...e,until:time+2.4};return e}
 update(dog,rat,jump,time){
  // A backgrounded tab must not synthesize a crossing or infer a jump from two distant samples.
  const gap=this.lastFrameTime!==null&&time-this.lastFrameTime>.2;this.lastFrameTime=time;
  if(gap){this.track=null;this.prev=null;this.trail=[]}
  const positions=[],b=between(dog,this.blocks,this.walkable);if(b)positions.push({type:'Between',detail:b.names.join(' / '),geometry:b});
  for(const c of this.customers){const r=relative(dog,c);if(r)positions.push({type:r,detail:c.id.toUpperCase(),customer:c})}
  if(above(dog,rat,jump))positions.push({type:'Above',detail:'Rat',rat:{...rat}});
  const active=new Set(positions.map(p=>p.type+':'+p.detail));for(const p of positions)if(!this.active.has(p.type+':'+p.detail))this.emit(p.type,p.detail,time);this.active=active;this.positions=positions;
  if(this.prev){
   const dt=time-this.prev.time,moved=distance(dog,this.prev.dog),ground=this.walkable(dog)&&this.walkable(this.prev.dog);
   for(const c of this.customers){const before=distance(this.prev.dog,c),after=distance(dog,c);
    // Delivery Zones are clipped to walkable paths; use a .08 boundary band to avoid jitter.
    const old=this.prev.zones[c.id];let inside=old;
    if(ground&&dog.z<.2){if(after<1.42)inside=true;else if(after>1.58)inside=false;
     if(old!==inside)this.emit(inside?'Into':'Out of',c.id.toUpperCase()+' Delivery Zone',time);
    }this.zones[c.id]=inside;
    if(dt>0&&dt<=.2&&moved>.0001&&before-after>moved*.65&&(before-after)/dt>.15&&after<8&&after>1.5&&time-this.lastToward>1.8){this.emit('Toward',c.id.toUpperCase()+' · distance decreasing',time);this.lastToward=time}
   }
  }else this.zones=Object.fromEntries(this.customers.map(c=>[c.id,this.walkable(dog)&&distance(dog,c)<1.5]));
  if(jump){
   const dx=jump.to.x-jump.from.x,dy=jump.to.y-jump.from.y,len=Math.hypot(dx,dy);
   const along=len>.01?((dog.x-rat.x)*dx+(dog.y-rat.y)*dy)/len:0;
   if(!this.track||this.track.id!==jump.id){const initial=len>.01?((jump.from.x-rat.x)*dx+(jump.from.y-rat.y)*dy)/len:0;this.track={id:jump.id,valid:len>=1.5&&initial<-.3,start:{...dog},crossed:false,near:false,previous:null,len}}
   const tr=this.track;
   if(above(dog,rat,jump))tr.near=true;
   if(!gap&&tr.previous&&tr.previous.along<0&&along>=0){const q=tr.previous.along/(tr.previous.along-along),z=tr.previous.z+(dog.z-tr.previous.z)*q,lateral=Math.abs((dog.x-rat.x)*dy-(dog.y-rat.y)*dx)/(len||1);if(z>=1.05&&lateral<=.7)tr.crossed=true}
   tr.previous={along,z:dog.z};tr.endAlong=along;
   this.trail.push({...dog});if(this.trail.length>90)this.trail.shift();
  }else if(this.track){const tr=this.track;if(tr.valid&&tr.near&&tr.crossed&&tr.endAlong>.3&&dog.z<.2&&distance(dog,tr.start)>=1.5)this.emit('Over','Rat · crossed with clearance and landed',time);this.track=null;this.trail=[]}
  this.prev={dog:{...dog},time,zones:{...this.zones}};if(this.pulse&&time>this.pulse.until)this.pulse=null;
  return {positions:this.positions,events:this.events,seen:[...this.seen],pulse:this.pulse,trail:this.trail};
 }
}
const api={Observer,between,relative,above,distance};if(typeof module!=='undefined')module.exports=api;else root.SpatialRelations=api;
})(typeof window!=='undefined'?window:globalThis);
