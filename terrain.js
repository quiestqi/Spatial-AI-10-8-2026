/* The canal and its two bridges share the walking surface map. */
(function (root) {
  'use strict';

  const canalRow = 20;
  const stepsPerCell = 4;
  const crossings = [
    {id:'west-bridge', name:'West arch bridge', x:8, width:3, height:1.08},
    {id:'canal-bridge', name:'Central arch bridge', x:16, width:3, height:1.08},
  ];
  function create(world) {
    const cells = new Map();
    const landmarks = [];
    const put = (x,y,detail) => {
      if (world[y]?.[x] === 'road') cells.set(x + ',' + y, {x,y,...detail});
    };
    for (let x = 0; x < world[canalRow].length; x++) {
      const crossing = crossings.find(bridge => Math.abs(x-bridge.x) < bridge.width/2);
      put(x,canalRow,crossing?{kind:'bridge',crossing}:{kind:'water'});
      if(crossing){
        put(x,canalRow-1,{kind:'stairs',crossing});
        put(x,canalRow+1,{kind:'stairs',crossing});
      }
    }
    for (const bridge of crossings) {
      landmarks.push({id:bridge.id,name:bridge.name,type:'bridge',x:Math.floor(bridge.x),y:canalRow});
    }

    const at = point => cells.get(Math.round(point.x) + ',' + Math.round(point.y));
    function elevation(point, surface = at(point)) {
      if (!surface?.crossing) return 0;
      const height=surface.crossing.height;
      if (surface.kind === 'bridge') return height;
      const progress=1.5-Math.abs(point.y-canalRow);
      const step=Math.max(1,Math.min(stepsPerCell,Math.ceil(progress*stepsPerCell)));
      return step*height/stepsPerCell;
    }

    // Bridge stairs are accessible from the banks at their ends.
    function connected(from,to,fromKind,toKind) {
      if (fromKind === 'water' || toKind === 'water') return false;
      if (!fromKind && !toKind) return true;
      if (from.x === to.x) return Math.abs(from.y-to.y) <= 1;
      return from.y === to.y && fromKind === toKind && Math.abs(from.x-to.x) === 1;
    }

    return {cells,at,elevation,connected,landmarks,stepsPerCell,
      tour:Array.from({length:4},(_,index)=>({x:17,y:canalRow-1+index}))};
  }

  const api = {create};
  if (typeof module !== 'undefined') module.exports = api;
  else root.BluehavenTerrain = api;
})(typeof window !== 'undefined' ? window : globalThis);
