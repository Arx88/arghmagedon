import * as THREE from 'three';

export class FaunaCombat {
  constructor(scene, creatures, ships, fx, damage, director, player) {
    Object.assign(this,{scene,creatures,ships,fx,damage,director,player});
    for (const [i,c] of creatures.entries()) {
      c.attackCooldown=6+i;c.attackRange=[23,15,21,29][i];c.attackDamage=[20,14,17,22][i];c.attackRadius=[6,5,4.5,5][i];c.passive=i===1;
      c.warning=new THREE.Mesh(new THREE.RingGeometry(.86,1,48),new THREE.MeshBasicMaterial({color:i===3?0xffa568:0xd78e80,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));c.warning.rotation.x=-Math.PI/2;c.warning.visible=false;scene.add(c.warning);
    }
  }
  update(dt,time) {
    for(const c of this.creatures){
      if(c.dead){c.warning.visible=false;c.attack=null;continue;}
      c.attackCooldown-=dt;
      const targets=this.ships.filter(s=>!s.dead&&Math.hypot(s.x-c.x,s.z-c.z)<c.attackRange&&(!c.passive||c.provokedUntil>time));
      if(!c.attack&&c.attackCooldown<=0&&targets.length){
        const target=targets.sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z))[0];
        c.attack={x:target.x+target.vx*.65,z:target.z+target.vz*.65,left:2.6};c.attackCooldown=9+Math.random()*3;
        if(target===this.player)this.director.log(`${c.name} prepara un ataque. ¡Aparta la quilla!`);
      }
      if(!c.attack){c.warning.visible=false;continue;}
      const a=c.attack;a.left-=dt;c.warning.position.set(a.x,.15,a.z);c.warning.scale.setScalar(c.attackRadius*(.8+(2.6-a.left)/2.6*.2));c.warning.material.opacity=.35+Math.sin(time*9)*.16;c.warning.visible=c.object.visible;
      c.object.rotation.x=Math.sin((2.6-a.left)/2.6*Math.PI)*.08;
      if(a.left<=0){
        const point=new THREE.Vector3(a.x,.2,a.z);this.fx.impact(point);this.fx.impact(point.clone().add(new THREE.Vector3(1,0,0)));
        if(c.name.startsWith('Barbacoa'))for(let i=0;i<32;i++)this.fx.emit('fire',point,{x:(Math.random()-.5)*6,y:1+Math.random()*3,z:(Math.random()-.5)*6},.25+Math.random()*.35,.6+Math.random()*.4);
        for(const s of this.ships)if(!s.dead&&Math.hypot(s.x-a.x,s.z-a.z)<c.attackRadius+1)this.damage(s,c.attackDamage,point,c);
        c.attack=null;c.warning.visible=false;c.object.rotation.x=0;
      }
    }
  }
}
