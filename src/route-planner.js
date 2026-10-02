// Coast-aware visibility graph. Computed once per destination, not per frame.
export function planRoute(start,end,islands){
  const obstacles=islands.map(i=>({x:i.x,z:i.z,rx:i.r*1.2+4,rz:(i.r*1.2+4)*.72}));
  const goal={...end};
  for(const o of obstacles){const x=(goal.x-o.x)/o.rx,z=(goal.z-o.z)/o.rz,d=Math.hypot(x,z);if(d<1.05){const a=d>.001?Math.atan2(z,x):Math.atan2(start.z-o.z,start.x-o.x);goal.x=o.x+Math.cos(a)*o.rx*1.08;goal.z=o.z+Math.sin(a)*o.rz*1.08;}}
  const clear=(a,b)=>obstacles.every(o=>{const x=(a.x-o.x)/o.rx,z=(a.z-o.z)/o.rz,dx=(b.x-a.x)/o.rx,dz=(b.z-a.z)/o.rz,t=Math.max(0,Math.min(1,-(x*dx+z*dz)/(dx*dx+dz*dz||1)));if(a.x===start.x&&a.z===start.z&&Math.hypot(x,z)<1)return x*dx+z*dz>=0&&Math.hypot(x+dx,z+dz)>1;return Math.hypot(x+dx*t,z+dz*t)>=.998;});
  if(clear(start,goal))return [goal];
  const nodes=[{x:start.x,z:start.z},goal];
  for(const o of obstacles)for(let n=0;n<16;n++){const a=n*Math.PI/8;nodes.push({x:o.x+Math.cos(a)*(o.rx+3),z:o.z+Math.sin(a)*(o.rz+3)});}
  const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();costs[0]=0;
  for(let k=0;k<nodes.length;k++){
    let current=-1;for(let n=0;n<nodes.length;n++)if(!visited.has(n)&&(current<0||costs[n]<costs[current]))current=n;
    if(current===1||!Number.isFinite(costs[current]))break;visited.add(current);
    for(let n=1;n<nodes.length;n++){if(visited.has(n)||!clear(nodes[current],nodes[n]))continue;const cost=costs[current]+Math.hypot(nodes[n].x-nodes[current].x,nodes[n].z-nodes[current].z);if(cost<costs[n]){costs[n]=cost;previous[n]=current;}}
  }
  if(previous[1]<0)return [goal];const route=[];for(let n=1;n>0;n=previous[n])route.unshift(nodes[n]);return route;
}
