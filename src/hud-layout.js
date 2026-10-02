const overlaps=(a,b,gap=8)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;

// Labels never displace the HUD or cover another label. Distant names belong to the chart.
export function arrangeWorldLabels(candidates, obstacles, {width,height,limit=2,top=125,bottom=170}) {
  const placed=[];
  for(const candidate of [...candidates].sort((a,b)=>b.priority-a.priority||a.distance-b.distance)) {
    if(placed.length>=limit)break;
    const left=Math.max(8,Math.min(width-candidate.width-8,candidate.x-candidate.width/2));
    const rect={left,right:left+candidate.width,top:candidate.y-candidate.height,bottom:candidate.y};
    if(rect.top<top||rect.bottom>height-bottom||rect.left<0||rect.right>width)continue;
    if([...obstacles,...placed.map(p=>p.rect)].some(other=>overlaps(rect,other)))continue;
    placed.push({...candidate,rect,x:left+candidate.width/2});
  }
  return placed;
}
