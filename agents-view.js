/* UI and 3D layer for the autonomous dog / rat / pedestrian simulation. */
(function(){'use strict';
window.attachAgentsView=function({T,city,sim,bot,rat,pedestrians,CX,CZ,tiles,buildings,sites,legacyGroups,focus}){
 const $=id=>document.getElementById(id),engine=new SpatialAgents.Simulation({world:sim.world,places:sim.places,blocks:sim.campusBlocks});
 const app={enabled:true,running:false,selected:'K-01',engine};window.agentsApp=app;
 const group=new T.Group(),overlays=new T.Group();city.add(group,overlays);const models=new Map(),colors={dog:'#285ca2',rat:'#9a6b99',person:'#328d80'};
 const templates={dog:bot,rat,person:[...pedestrians.values()][0].group};let uiAt=-Infinity,overlayAt=-Infinity;
 function tag(){const c=document.createElement('canvas');c.width=512;c.height=128;const tx=new T.CanvasTexture(c),material=new T.SpriteMaterial({map:tx,depthTest:false});const s=new T.Sprite(material);s.scale.set(2.9,.72,1);s.renderOrder=20;s.userData.canvas=c;s.userData.texture=tx;return s;}
 function updateTag(s,text,color){if(s.userData.text===text)return;s.userData.text=text;const c=s.userData.canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);ctx.fillStyle='#fffffff2';ctx.beginPath();ctx.roundRect(4,4,504,120,24);ctx.fill();ctx.fillStyle=color;ctx.font='600 36px system-ui, Apple Color Emoji';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,66,480);s.userData.texture.needsUpdate=true;}
 for(const a of engine.agents){const model=templates[a.type].clone(true);model.visible=true;model.traverse(o=>{if(o.isSprite)o.visible=false;});if(a.type==='dog')model.scale.setScalar(1.35);if(a.type==='rat')model.scale.setScalar(.72);group.add(model);const name=tag(),bubble=tag();name.scale.set(2.1,.52,1);bubble.scale.set(2.4,.6,1);group.add(name,bubble);const mesh={model,name,bubble,legs:[]};if(a.type==='dog'){mesh.legs=model.children.filter(o=>o.isGroup);const originalParcelIndex=bot.children.findIndex(o=>o.isMesh&&o.geometry?.parameters?.height===.22&&o.position.y===.86);mesh.parcel=model.children[originalParcelIndex];}models.set(a.id,mesh);}
 const selectedRing=new T.Mesh(new T.RingGeometry(.7,.78,40),new T.MeshBasicMaterial({color:'#198e7b',side:T.DoubleSide,depthTest:false}));selectedRing.rotation.x=-Math.PI/2;selectedRing.renderOrder=8;group.add(selectedRing);
 $('agentSelect').innerHTML=engine.agents.map(a=>'<option value="'+a.id+'">'+a.id+' · '+{dog:'Delivery dog',rat:'Rat',person:'Pedestrian'}[a.type]+'</option>').join('');
 $('agentSelect').onchange=()=>{app.selected=$('agentSelect').value;uiAt=overlayAt=-Infinity;};
 const previous={play:$('play').onclick,step:$('step').onclick,reset:$('reset').onclick,speed:$('speed').onchange};
 function speed(){return $('speed').value==='160'?2.2:$('speed').value==='1200'?.6:1;}
 function control(){if(!app.enabled)return;const q=engine.summary();$('play').textContent=app.running?'Pause':'Start';$('play').disabled=false;$('step').disabled=app.running;$('gameHud').textContent='Delivered '+q.delivered+' · Onboard '+q.onboard+' · Stolen '+q.stolen;$('gameGoal').textContent='3 dogs · 5 rats · 8 pedestrians · '+Math.floor(q.time)+'s';}
 function setMode(enabled){app.enabled=enabled;app.running=false;group.visible=overlays.visible=enabled;sim.pause();document.body.classList.toggle('agents-mode',enabled);$('modeSwitch').textContent=enabled?'Position workshop':'Spatial agents';$('agentPanel').hidden=!enabled;uiAt=overlayAt=-Infinity;if(enabled){control();}else{sim.setDestination(sim.navigation()||{x:sim.snapshot().x,y:sim.snapshot().y});window.city3D?.sync();}}
 $('modeSwitch').onclick=()=>setMode(!app.enabled);
 $('play').onclick=()=>{if(!app.enabled)return previous.play();app.running=!app.running;control();};
 $('step').onclick=()=>{if(!app.enabled)return previous.step();app.running=false;engine.step(.65);uiAt=overlayAt=-Infinity;control();};
 $('reset').onclick=()=>{if(!app.enabled)return previous.reset();engine.reset();app.running=false;app.selected='K-01';$('agentSelect').value=app.selected;uiAt=overlayAt=-Infinity;control();};
 $('speed').onchange=()=>{if(!app.enabled)previous.speed();};
 for(const [id,kind]of [['demoLove','boost'],['demoSteal','theft'],['demoChase','chase']])$(id).onclick=()=>{engine.demo(kind);app.selected=kind==='chase'?'R-01':'K-01';$('agentSelect').value=app.selected;app.running=true;uiAt=overlayAt=-Infinity;focus(engine.agents.find(a=>a.id===app.selected));control();};
 for(const id of ['agentVision','agentPaths','agentHeat','agentFog'])$(id).onchange=()=>{overlayAt=-Infinity;};
 function selected(){return engine.agents.find(a=>a.id===app.selected)||engine.agents[0]}
 function clearOverlay(){overlays.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});overlays.clear();}
 function line(points,color,opacity=1){const l=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity,depthTest:false}));l.renderOrder=6;overlays.add(l);}
 const pos=(p,h=.1)=>new T.Vector3(p.x-CX,h,p.y-CZ);
 function drawOverlay(a){clearOverlay();const fog=$('agentFog').checked;
  for(const tile of tiles){const p=tile.userData.cell,k=p.x+','+p.y;tile.visible=!fog||a.known.has(k);}
  for(const b of buildings)b.visible=!fog||b.userData.cells.some(k=>a.known.has(k));
  for(const site of sites)site.visible=!fog||a.landmarks.has(site.userData.id);
  if($('agentVision').checked){const range=SpatialAgents.RULES.visionRange,half=SpatialAgents.RULES.visionAngle/2,fan=[pos(a,.12)],outline=[pos(a,.14)];for(let i=0;i<=24;i++){const angle=a.heading-half+i/24*half*2;let last={x:a.x,y:a.y};for(let d=.1;d<=range;d+=.15){const p={x:a.x+Math.cos(angle)*d,y:a.y+Math.sin(angle)*d};if(!engine.road(p))break;last=p;}fan.push(pos(last,.12));outline.push(pos(last,.14));}outline.push(pos(a,.14));line(outline,colors[a.type],.9);
   const vs=[];for(let i=1;i<fan.length-1;i++)vs.push(...fan[0].toArray(),...fan[i].toArray(),...fan[i+1].toArray());const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs,3));overlays.add(new T.Mesh(geo,new T.MeshBasicMaterial({color:colors[a.type],transparent:true,opacity:.13,side:T.DoubleSide,depthWrite:false})));
  }
  if($('agentPaths').checked)for(const agent of engine.agents){if(fog&&agent.id!==a.id)continue;if(agent.trail.length>1)line(agent.trail.map(p=>pos(p,.13)),colors[agent.type],agent.id===a.id?.95:.35);}
  if($('agentHeat').checked){const heat=new Map();for(const agent of engine.agents)for(const m of agent.landmarks.values()){if(m.type==='obstacle')continue;const k=Math.round(m.x)+','+Math.round(m.y);heat.set(k,(heat.get(k)||0)+1);}
   for(const [k,n]of heat){const [x,y]=k.split(',').map(Number);if(fog&&!a.known.has(k))continue;const marker=new T.Mesh(new T.CircleGeometry(.35+n*.025,20),new T.MeshBasicMaterial({color:'#e79830',transparent:true,opacity:.22+n/25,side:T.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(pos({x,y},.15));overlays.add(marker);}
  }
 }
 function drawKnowledge(a){const canvas=$('agentKnowledge'),ctx=canvas.getContext('2d'),scale=6;ctx.fillStyle='#182b46';ctx.fillRect(0,0,canvas.width,canvas.height);for(const [k,kind]of a.known){const [x,y]=k.split(',').map(Number);ctx.fillStyle=kind==='road'?(a.visible.has(k)?'#b0e1d8':'#d4deed'):'#57739a';ctx.fillRect(x*scale,y*scale,scale-1,scale-1);}for(const m of a.landmarks.values())if(m.type!=='obstacle'){ctx.fillStyle=m.type==='restaurant'?'#d39635':m.type==='customer'?'#2478d1':'#a25ac1';ctx.fillRect(m.x*scale-2,m.y*scale-2,5,5);}for(const m of a.seenActors.values())if(a.visible.has(Math.round(m.x)+','+Math.round(m.y))&&engine.time-m.time<.3){ctx.fillStyle=colors[m.type];ctx.beginPath();ctx.arc(m.x*scale,m.y*scale,2,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f36c8b';ctx.beginPath();ctx.arc(a.x*scale,a.y*scale,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ef5079';ctx.beginPath();ctx.moveTo(a.x*scale,a.y*scale);ctx.lineTo(a.x*scale+Math.cos(a.heading)*10,a.y*scale+Math.sin(a.heading)*10);ctx.stroke();}
 function ui(){const a=selected(),q=engine.summary();control();$('agentScores').innerHTML=engine.dogs.map(d=>'<span><b>'+d.id+'</b> '+d.delivered+' delivered · '+d.inventory+'/3 meals'+(d.boostUntil>engine.time?' · ♥ BOOST':'')+'</span>').join('');$('agentState').textContent=a.id+' · '+a.state+(a.fleeUntil>engine.time?' · FLEEING':'')+(a.boostUntil>engine.time?' · speed ×1.6 ('+Math.ceil(a.boostUntil-engine.time)+'s)':'');
  $('agentFacts').textContent='Known '+a.known.size+'/'+(engine.W*engine.H)+' cells · Landmarks '+a.landmarks.size+' · Plans via memory '+a.landmarkUses+(a.type==='rat'?' · Stolen '+a.stolen:a.type==='person'?' · Shop visits '+a.visits:'');
  $('agentLandmarks').textContent=[...a.landmarks.values()].filter(m=>m.type!=='obstacle').map(m=>m.id.toUpperCase()+' ('+m.type+')').join(' · ')||'No service landmarks discovered yet.';
  $('agentEvents').innerHTML=engine.events.slice(0,5).map(e=>'<li>'+e.time.toFixed(1)+'s · '+e.message+'</li>').join('');drawKnowledge(a);
 }
 setMode(true);
 return {active:()=>app.enabled,selected,engine,frame(now,dt){
  if(app.running)engine.step(Math.min(dt,.1)*speed());const a=selected();group.visible=overlays.visible=true;
  for(const agent of engine.agents){const m=models.get(agent.id);m.model.position.set(agent.x-CX,agent.z,agent.y-CZ);m.model.rotation.y=-agent.heading-Math.PI/2;const moving=Math.hypot(agent.vx,agent.vy)>.1;if(moving&&!agent.jump)m.model.position.y=Math.abs(Math.sin(engine.time*12))*.025;m.legs.forEach((leg,i)=>leg.rotation.x=agent.jump?Math.sin(agent.z)*(i<2?-.5:.5):moving?Math.sin(engine.time*13+i%2*Math.PI)*.4:0);
   const seen=!$('agentFog').checked||agent.id===a.id||a.visible.has(Math.round(agent.x)+','+Math.round(agent.y));m.model.visible=seen;m.name.visible=seen&&(agent.id===a.id||agent.type==='dog');m.name.renderOrder=agent.id===a.id?24:20;m.bubble.renderOrder=25;m.bubble.visible=seen&&agent.iconUntil>engine.time;m.name.position.set(agent.x-CX,agent.z+(agent.type==='dog'?2.1:agent.type==='rat'?1.4:1.7),agent.y-CZ);m.bubble.position.set(agent.x-CX,m.name.position.y+.85,agent.y-CZ);if(m.parcel)m.parcel.visible=agent.inventory>0;
   updateTag(m.name,agent.id+(agent.type==='dog'?' · '+agent.inventory+'/3':agent.type==='rat'?' · '+agent.stolen+' stolen':''),colors[agent.type]);if(m.bubble.visible)updateTag(m.bubble,agent.icon,agent.type==='dog'?'#ce6486':agent.type==='rat'?'#ad7446':'#328d80');
  }
  selectedRing.position.copy(pos(a,.11));if(now-overlayAt>250){drawOverlay(a);overlayAt=now;}if(now-uiAt>200){ui();uiAt=now;}return a;
 },hide(){group.visible=overlays.visible=false;for(const t of tiles)t.visible=true;},pick(ray){const hits=ray.intersectObjects([...models.values()].map(m=>m.model),true);if(!hits.length)return false;let o=hits[0].object;for(const [id,m]of models){let p=o;while(p){if(p===m.model){app.selected=id;$('agentSelect').value=id;uiAt=overlayAt=-Infinity;return true;}p=p.parent;}}return false;}};
};
})();
