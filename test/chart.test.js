import test from 'node:test';
import assert from 'node:assert/strict';
import {chartTransform} from '../src/chart-geometry.js';

const bounds={minX:-172,maxX:172,minZ:-166,maxZ:140};

test('full chart keeps every world corner inside the compass',()=>{
  const {point}=chartTransform(bounds,{x:50,z:60},true);
  for(const x of [bounds.minX,bounds.maxX]) for(const z of [bounds.minZ,bounds.maxZ]) {
    const [px,py]=point({x,z});
    assert.ok(Math.hypot(px-160,py-160)<=148);
  }
});

test('map preserves equal distances on both axes and nearby mode tracks the captain',()=>{
  const player={x:-42,z:56};
  for(const full of [false,true]) {
    const {point}=chartTransform(bounds,player,full);
    const [x,y]=point(player),[east]=point({x:player.x+20,z:player.z});
    const [,south]=point({x:player.x,z:player.z+20});
    assert.ok(Math.abs((east-x)-(south-y))<1e-10);
    if(!full) assert.deepEqual([x,y],[160,160]);
  }
});
