import * as THREE from 'three';
import { renderModelPortrait } from './hud.js';
import { createHarborUI, renderHarbor } from './harbor-ui.js';
import { createShip } from './pixel-art.js';
import { box, rod, palette, pirate } from './world.js';
import { batchPaint } from './batch.js';
import { dressShips, animatePirate } from './world-detail.js';
import { upgradeCost,purchaseUpgrade } from './navigation.js';
import { getHomeBase,opposingTeam,isTeamDocked } from './battlefield.js';
import { autopilot } from './navigation.js';
import { Exploration } from './exploration.js';
import {applyFleetSails} from './fleet-appearance.js';
import { createGarrison,animateGarrison } from './garrison-renderer.js';
import { balance, garrisons, garrisonCost, towerCost, weaponCost, scoutUpgradeCost, crewSpecialties, hireRole, dismissRole, reconcileRoles, invasionDuration, stepInvasion, canScoutLoot, lootDuration, purchaseBlockReason, rigRules } from './campaign-rules.js';

const $ = id => document.getElementById(id);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const teamColor = team => team === 'blue' ? 0x428eac : team === 'red' ? 0xb75542 : 0x887b59;
const berth = island => ({ x: island.x + island.r * .35, z: island.z + island.r * .72 + 8 });

export class Campaign {
  constructor(ctx) {
    Object.assign(this, ctx); this.towers = []; this.scoutLevel = 1; this.weaponLevels = [0, 0, 0, 0]; this.greekLevel = 0;
    this.nextRaid = 80; this.aiBanks={blue:200,red:200}; this.time = 0; this.serial = 0; this.hudClock = 0; this.currentTab = 'fleet'; this.selectedIsland = null;
    this.fog = new Exploration(this.scene, this.bounds);
    for(const ship of this.ships)ship.roles??={repairers:0,looters:0};
    for (const island of this.islands) {
      // Home identity survives capture and does not depend on the island's architecture.
      if(!island.homeTeam&&island===this.port)island.homeTeam='blue';
      if(!island.homeTeam&&island.name==='Fuerte del Diente Roto')island.homeTeam='red';
      island.owner=island.homeTeam??'neutral';
      island.garrisonLevel=island.homeTeam?2:0;
      island.defenders=island.initialDefenders??(island.homeTeam?8:island.type==='fort'?5:0);
      island.towerUpgrades={damage:0,range:0,rate:0};island.discovered=!!island.homeTeam;island.treasureKnown=false;
      if(island.homeTeam){island.gold=0;island.available=false;island.treasure.visible=false;}
      const flag = new THREE.Group(); flag.position.set(island.r * .45, .65, 2); island.group.add(flag);
      rod(flag, [0, 0, 0], [0, 3.1, 0], .06, palette.wood);
      island.claimFlag = box(flag, 1.3, .65, .03, teamColor(island.owner), .65, 2.6, 0);
      island.claimFlag.material = island.claimFlag.material.clone();island.claimFlag.visible=false;
      island.soldiers = createGarrison();
      island.soldiers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); island.soldiers.frustumCulled = false; island.group.add(island.soldiers);
      if(island.homeTeam||island.initialTower)this.buildTower(island);
    }
    this.dummy = new THREE.Object3D(); this.createUI(); this.updateVision(.4);
  }
  living(role) { return this.ships.filter(s => s.team===this.player.team && s.support === role && !s.dead && !s.destroyed); }
  nearestIsland() { return this.islands.filter(i => i.discovered && distance(this.player, i) < i.r + 22).sort((a,b) => distance(this.player,a)-distance(this.player,b))[0]; }
  createUI() { createHarborUI(this); }
  selectIsland() { return this.inPort()?getHomeBase(this.islands,this.player.team):this.nearestIsland(); }
  open(tab) { if (this.player.dead) return; this.clearInput(); this.currentTab = tab; this.selectedIsland = this.selectIsland(); this.renderPanel(); $('company-content').scrollTop=0;$('captain-dialog').showModal(); }
  renderPanel() { renderHarbor(this); }
  purchase(order) {
    if(order.startsWith('ship:')){if(this.buyShipUpgrade?.(order.slice(5))){this.onPurchase?.(order);this.renderPanel();}return;}
    const island=this.selectedIsland,isLand=['garrison','reinforce','tower'].includes(order)||order.startsWith('tower:');
    if(this.player.dead||(isLand?!island||island.owner!==this.player.team||distance(this.player,island)>=island.r+22||island.invasion:!order.startsWith('recall:')&&!this.inPort()))return;
    let cost=0,action=null;
    if(order==='scout'&&this.living('scout').length<balance.scoutLimit){cost=balance.scoutCost;action=()=>this.spawnSupport('scout');}
    if(order==='guard'&&this.living('guard').length<balance.guardLimit){cost=balance.guardCost;action=()=>this.spawnSupport('guard');}
    if(order==='scout-up'&&this.scoutLevel<3&&this.living('scout').length){cost=scoutUpgradeCost(this.scoutLevel);action=()=>{this.scoutLevel++;for(const scout of this.living('scout'))applyFleetSails(scout,this.scoutLevel);this.director.log(`Los vigías ya son de categoría ${this.scoutLevel}. Y cobran igual.`,'victory');};}
    const specialty=crewSpecialties.find(role=>role.id===order);
    if(specialty&&this.player.crew<this.player.maxCrew){cost=specialty.cost;action=()=>hireRole(this.player,specialty.key);}
    if(order.startsWith('dismiss:')){
      const role=crewSpecialties.find(item=>item.id===order.slice(8));
      if(role&&dismissRole(this.player,role.key)){this.refreshHUD?.();this.onPurchase?.('crew-dismiss');this.renderPanel();this.toast('En tierra. Sin reembolso: el fiado también tiene límites.');}
      return;
    }
    if(order==='recruit'&&this.player.crew<this.player.maxCrew){cost=15;action=()=>this.player.crew++;}
    if(order==='rum'&&this.voyage.rumCharges<3){cost=35;action=()=>this.voyage.rumCharges=3;}
    if(order.startsWith('weapon:')){const i=Number(order.split(':')[1]);if(Number.isInteger(i)&&i>=0&&i<4&&this.weaponLevels[i]<3){cost=weaponCost(this.weaponLevels[i]);action=()=>this.weaponLevels[i]++;}}
    if(order==='greek'&&this.greekLevel<3){cost=weaponCost(this.greekLevel);action=()=>this.greekLevel++;}
    if(order==='garrison'&&island.garrisonLevel<4){cost=garrisonCost(island.garrisonLevel);action=()=>{island.garrisonLevel++;island.defenders=garrisons[island.garrisonLevel];};}
    if(order==='reinforce'&&island.defenders<garrisons[island.garrisonLevel]){cost=Math.max(0,garrisons[island.garrisonLevel]-island.defenders)*8;action=()=>island.defenders=garrisons[island.garrisonLevel];}
    if(order==='tower'&&(!island.tower||island.tower.dead)){cost=110;action=()=>this.buildTower(island);}
    if(order.startsWith('tower:')){const key=order.split(':')[1];if(Object.hasOwn(island.towerUpgrades,key)&&island.towerUpgrades[key]<3&&island.tower&&!island.tower.dead){cost=towerCost(island.towerUpgrades[key]);action=()=>island.towerUpgrades[key]++;}}
    if(order.startsWith('recall:')){const ship=this.ships.find(s=>s.id===order.split(':')[1]&&s.support==='guard'&&!s.dead);if(ship){ship.anchor=null;this.toast(`${ship.name} vuelve a seguirte.`);}this.renderPanel();return;}
    if(!action||!this.charge(cost))return;
    action();this.onPurchase?.(order);this.refreshHUD?.();this.renderPanel();this.toast('Trato cerrado. El oro no se iba a gastar solo.');
  }
  spawnSupport(role) {
    const n=++this.serial, p=berth(this.port);
    const ship=this.makeShip(role==='scout'?`Ojo de Gaviota ${n}`:`Mosquito ${n}`,'blue',p.x+4+(n-1)%3*6,p.z+6+Math.floor((n-1)/3)*8,Math.PI,.65,role);
    ship.id=`support-${n}`; ship.support=role; if(role==='scout')ship.scoutLevel=this.scoutLevel; ship.roles??={repairers:0,looters:0}; ship.maxSpeed=role==='scout'?balance.scoutSpeed:5.4; ship.hp=ship.maxHp=role==='scout'?65:95;
    ship.damage=role==='scout'?0:8;ship.reload=ship.cooldownTotal=4.8;ship.crew=ship.maxCrew=4;ship.visited=new Set();ship.scanClock=0;ship.lootClock=0;
    dressShips([ship]); ship.object.userData.flags.forEach(f=>f.material.color.set(role==='scout'?0xddc77e:0x3c7b9c));
    this.director.log(`${ship.name} ha zarpado. ${role==='scout'?'Promete volver con chismes.':'Pequeño barco, grandes molestias.'}`,'victory');
    return ship;
  }
  stationGuard() {
    const guard=this.living('guard').filter(s=>!s.anchor).at(-1);
    if(!guard)return this.toast('Compra un guardacostas o reagrúpalo desde Compañía.');
    guard.anchor={x:this.player.x,z:this.player.z};this.toast(`${guard.name}: guardia fijada. Protegerá esta zona.`);
    if(!guard.zone){guard.zone=new THREE.Mesh(new THREE.RingGeometry(19.7,20,64),new THREE.MeshBasicMaterial({color:0x92d8be,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));guard.zone.rotation.x=-Math.PI/2;this.scene.add(guard.zone);}
    guard.zone.position.set(guard.anchor.x,.1,guard.anchor.z);guard.zone.visible=true;
  }
  releaseLoot(ship) {
    if(ship.lootIsland?.lootSource===ship)ship.lootIsland.lootSource=null;
    ship.lootIsland=null;ship.lootClock=0;
  }
  supportOrders(ship,dt) {
    if(ship.dead||ship.destroyed){this.releaseLoot(ship);return {stop:true,throttle:0,turn:0};}
    if(ship.lootIsland&&(ship.lootIsland!==ship.routeIsland||ship.gold>0))this.releaseLoot(ship);
    if(ship.support==='guard') {
      const origin=ship.anchor??this.player, foe=this.ships.filter(s=>s.team==='red'&&!s.dead&&distance(s,origin)<25).sort((a,b)=>distance(a,ship)-distance(b,ship))[0];
      if(foe&&distance(ship,foe)<24)this.fire(ship,foe);
      const goal=foe&&ship.anchor?{x:origin.x+(foe.x-origin.x)*.35,z:origin.z+(foe.z-origin.z)*.35}:{x:origin.x+Math.sin(this.time*.12+ship.home.x)*8,z:origin.z+Math.cos(this.time*.12+ship.home.x)*6};
      if(ship.zone)ship.zone.visible=!!ship.anchor&&!ship.dead;return autopilot(ship,goal,this.islands);
    }
    if(ship.gold>0){ship.orderText='Volviendo al puerto';if(distance(ship,this.port)<this.port.r+12){this.credit(ship.gold);this.director.log(`${ship.name} aseguró ${ship.gold} oro.`,'victory');ship.gold=0;ship.routeIsland=null;}else return autopilot(ship,berth(this.port),this.islands);}
    if(!ship.routeIsland){
      const choices=this.islands.filter(i=>!i.homeTeam&&!ship.visited.has(i.name));
      if(!choices.length){ship.visited.clear();ship.orderText='Preparando otra ruta';return {stop:true,throttle:0,turn:0};}
      ship.routeIsland=choices.sort((a,b)=>distance(a,ship)-distance(b,ship))[0];ship.lootClock=0;
    }
    const island=ship.routeIsland, goal=berth(island);
    ship.orderText='Cartografiando';
    if(distance(ship,goal)>6){if(ship.lootIsland)this.releaseLoot(ship);return autopilot(ship,goal,this.islands);}
    island.discovered=true;this.director.reportIsland(island,ship,this.time);if(this.scoutLevel>=2)island.treasureKnown=true;
    if(canScoutLoot(island,this.scoutLevel,ship.team,ship)) {island.lootSource=ship;ship.lootIsland=island;ship.orderText='Saqueando';ship.lootClock+=dt;if(ship.lootClock<14)return {stop:true,throttle:0,turn:0};ship.gold+=island.gold;island.available=false;island.treasure.visible=false;island.readyAt=this.time+balance.lootRespawn;}
    this.releaseLoot(ship);
    ship.visited.add(island.name);ship.routeIsland=null;return {stop:true,throttle:0,turn:0};
  }
  buildTower(island) {
    if(island.tower){island.tower.object.removeFromParent();this.towers.splice(this.towers.indexOf(island.tower),1);}
    const root=new THREE.Group();root.position.set(island.x+island.r*.57,1.2,island.z+island.r*.2);this.scene.add(root);
    box(root,1.8,2.6,1.8,0x99a18c,0,1.3);box(root,2.2,.22,2.2,0xc1bea0,0,2.7);
    for(const x of [-.9,.9])for(const z of [-.9,.9])box(root,.45,.7,.45,0xaeb49a,x,3,z);
    const turret=new THREE.Group();turret.position.y=3;root.add(turret);box(turret,.8,.6,.8,0x746b4a);const cannon=rod(turret,[0,.1,0],[0,.1,-1.5],.18,0x354841);batchPaint(root,true);
    const tower={name:`Torre de ${island.name}`,object:root,turret,cannon,isTower:true,island,team:island.owner,x:root.position.x,z:root.position.z,heading:0,scale:1,hitWidth:1.3,hitLength:1.3,hp:180,maxHp:180,dead:0,vx:0,vz:0,cooldown:3};
    island.tower=tower;this.towers.push(tower);
  }
  startInvasion(island,ship) {
    if(island.owner===ship.team||island.invasion||ship.dead||ship.crew<=0||distance(ship,island)>island.r+22)return false;
    if(island.tower&&!island.tower.dead&&island.tower.team!==ship.team){if(ship===this.player)this.toast('La torre cubre el desembarco. Destrúyela primero.');return false;}
    island.invasion={source:ship,team:ship.team,attackers:ship.crew,duration:invasionDuration(ship.crew,island.defenders,Math.random()),progress:0,casualtyClock:0};
    const landing=new THREE.Group();this.scene.add(landing);landing.position.set(ship.x,.4,ship.z);landing.rotation.y=Math.atan2(ship.x-berth(island).x,ship.z-berth(island).z);
    box(landing,1.3,.45,3.4,0x735336,0,.1,0);box(landing,1.8,.2,2.7,0xaa8150,0,.4,0);
    for(const side of [-1,1])box(landing,.12,.32,2.8,0xc6a15f,side*.85,.56,0);
    const crew=[];for(let n=0;n<4;n++)crew.push(pirate(landing,n%2?.36:-.36,.55,Math.floor(n/2)*1.2-.6,teamColor(ship.team)));
    const oars=[];for(const side of [-1,1]){const oar=new THREE.Group();oar.position.set(side*.7,.75,0);landing.add(oar);rod(oar,[0,0,0],[side*1.6,-.25,0],.05,0xd2af71);box(oar,.55,.07,.3,0xad8d54,side*1.65,-.27,0);oars.push(oar);}
    batchPaint(landing,true);Object.assign(island.invasion,{landing,crew,oars,from:new THREE.Vector3(ship.x,.4,ship.z),age:0});
    if(ship===this.player)ship.target=null;
    if(ship===this.player||island.owner==='blue'||island.discovered&&distance(this.player,island)<65)this.director.announce(island.owner==='blue'?'¡Están invadiendo tu isla!':`Desembarco en ${island.name}`,`${Math.ceil(island.invasion.duration)} segundos. Todavía se puede discutir.`,island.owner==='blue'?'weather':'discovery');return true;
  }
  cancelInvasion(island){const inv=island.invasion;if(inv){inv.landing?.removeFromParent();inv.crew?.forEach(p=>p.removeFromParent());inv.source.raidIsland=null;island.invasion=null;}}
  moneyFor(team){return this.getTeamBank?.(team)??this.aiBanks[team]??0;}
  spendFor(team,amount){
    if(!Number.isFinite(amount)||amount<0||this.moneyFor(team)<amount)return false;
    if(this.chargeTeam)return this.chargeTeam(team,amount);
    this.aiBanks[team]-=amount;return true;
  }
  depositFor(team,amount,ship){
    if(!(amount>0))return;
    if(this.creditTeam)this.creditTeam(team,amount,ship);
    else{this.aiBanks[team]=(this.aiBanks[team]??0)+amount;if(team==='red')this.creditEnemy?.(amount);}
  }
  spendDepositedGold(ship){
    const team=ship.team,home=getHomeBase(this.islands,team);
    if(!isTeamDocked(ship,this.islands,team)||!home)return;
    ship.roles??={repairers:0,looters:0};
    // A fleet that returns with loot funds its defenses before its next raid.
    if(!home.invasion){
      const missing=Math.max(0,garrisons[home.garrisonLevel]-home.defenders);
      if(missing&&this.spendFor(team,missing*8))home.defenders+=missing;
      if((!home.tower||home.tower.dead)&&this.spendFor(team,110))this.buildTower(home);
    }
    if(ship.crew<ship.maxCrew&&!ship.roles.repairers&&this.spendFor(team,balance.roleCost))hireRole(ship,'repairers');
    const needed=Math.max(0,Math.min(11,ship.maxCrew)-ship.crew);
    if(needed&&this.spendFor(team,needed*15))ship.crew+=needed;
    const kind=ship.hp<ship.maxHp*.65&&ship.upgrades.hull<3?'hull':ship.upgrades.cannons<3?'cannons':ship.upgrades.hull<3?'hull':ship.upgrades.crew<3?'crew':null;
    if(kind){const cost=upgradeCost(kind,ship.upgrades[kind]);if(this.spendFor(team,cost)){purchaseUpgrade(ship,kind,cost,true);this.onAIUpgrade?.(ship,kind);}}
  }
  enemyOrders(ship,dt=0) {
    const team=ship.team,base=getHomeBase(this.islands,team),enemyBase=getHomeBase(this.islands,opposingTeam(team));
    if(ship.lootIsland&&(ship.dead||ship.destroyed||!base||base.owner!==team||ship.lootIsland!==ship.raidIsland||ship.lootIsland.owner!==team||!ship.lootIsland.available||ship.gold>0))this.releaseLoot(ship);
    if(ship.dead||ship.destroyed||!base||base.owner!==team)return {stop:true,turn:0,throttle:0};
    if(ship.gold>0){
      ship.raidIsland=null;
      if(isTeamDocked(ship,this.islands,team)){this.depositFor(team,ship.gold,ship);ship.gold=0;ship.lootClock=0;this.spendDepositedGold(ship);}
      else{
        const pursuer=this.ships.filter(s=>s.team===opposingTeam(team)&&!s.dead&&distance(s,ship)<28).sort((a,b)=>distance(a,ship)-distance(b,ship))[0];
        const goal=berth(base);
        if(ship.aiRole==='merchant'&&pursuer){const d=Math.max(1,distance(ship,pursuer));goal.x+=(ship.x-pursuer.x)/d*12;goal.z+=(ship.z-pursuer.z)/d*8;ship.orderText='Protegiendo el botín';}
        else ship.orderText='Volviendo a su base';
        return autopilot(ship,goal,this.islands);
      }
    }
    if(ship.hp<ship.maxHp*.3||ship.crew<3)ship.recovering=true;
    if(ship.recovering){
      if(ship.lootIsland)this.releaseLoot(ship);
      if(!isTeamDocked(ship,this.islands,team))return autopilot(ship,berth(base),this.islands);
      ship.hp=Math.min(ship.maxHp,ship.hp+dt*6);
      if(ship.crew<8){const count=Math.min(8-ship.crew,ship.maxCrew-ship.crew);if(this.spendFor(team,count*15))ship.crew+=count;}
      if(ship.hp>=ship.maxHp*.85&&ship.crew>=8)ship.recovering=false;
      else return {stop:true,turn:0,throttle:0};
    }
    if(base.invasion&&base.invasion.team!==team){
      if(ship.lootIsland)this.releaseLoot(ship);
      ship.raidIsland=base;
      const attacker=base.invasion.source;
      if(distance(ship,attacker)<40)this.fire(ship,attacker);
      // Pursue the landing ship: circling a fixed point inside the island made
      // defenders impossible to draw out of the capture perimeter.
      ship.orderText='Interceptando el desembarco';
      return autopilot(ship,{x:attacker.x,z:attacker.z},this.islands);
    }
    const threats=this.ships.filter(s=>s.team===opposingTeam(team)&&!s.dead&&!s.destroyed&&(ship.aiRole==='defender'?distance(s,base)<base.r+50:distance(s,ship)<36)).sort((a,b)=>distance(a,ship)-distance(b,ship));
    const committed=this.islands.some(i=>i.invasion?.source===ship);
    if(!committed&&ship.aiRole==='skirmisher'&&threats.length){
      if(ship.lootIsland)this.releaseLoot(ship);
      const rival=threats.find(s=>s.gold>0)??threats[0];ship.orderText=rival.gold?'Cazando un cargamento':'Hostigando';this.fire(ship,rival);
      return autopilot(ship,{x:rival.x+Math.cos(this.time*.23)*15,z:rival.z+Math.sin(this.time*.23)*12},this.islands);
    }
    if(!committed&&ship.aiRole==='defender'){
      const intruder=threats[0];
      if(intruder){if(ship.lootIsland)this.releaseLoot(ship);ship.orderText='Defendiendo la base';if(distance(ship,intruder)<40)this.fire(ship,intruder);return autopilot(ship,{x:intruder.x,z:intruder.z},this.islands);}
    }
    if(ship.aiRole==='defender'&&this.time<30){ship.orderText='Guardia del puerto';return {stop:true,turn:0,throttle:0};}
    const localCay=i=>!i.homeTeam&&i.autoLootEligible&&!i.defenders&&(!i.tower||i.tower.dead)&&(i.owner==='neutral'||i.owner===team)&&distance(i,base)<base.r+70;
    if(ship.aiRole==='defender'&&ship.raidIsland&&!localCay(ship.raidIsland)){this.releaseLoot(ship);ship.raidIsland=null;}
    if(ship.aiRole==='merchant'&&ship.raidIsland?.homeTeam)ship.raidIsland=null;
    if(ship.raidIsland?.owner===team&&(!ship.raidIsland.available||ship.raidIsland.homeTeam))ship.raidIsland=null;
    if(!ship.raidIsland){
      const territories=this.islands.filter(i=>i.owner===team&&!i.homeTeam).length;
      if(ship.aiRole!=='defender'&&ship.aiRole!=='merchant'&&enemyBase&&enemyBase.owner!==team&&(this.time>=120||territories>=2))ship.raidIsland=enemyBase;
      else{
        const choices=this.islands.filter(i=>!i.homeTeam&&i.available&&(!i.lootSource||i.lootSource===ship)&&(!i.invasion||i.invasion.source===ship)&&(ship.aiRole!=='defender'||localCay(i)));
        const score=i=>distance(i,ship)+(ship.aiRole==='defender'?distance(i,base)*.3:0)+(ship.aiRole==='merchant'?this.ships.filter(s=>s.team===opposingTeam(team)&&!s.dead&&distance(s,i)<i.r+30).length*90:0);ship.raidIsland=choices.sort((a,b)=>score(a)-score(b))[0];
      }
      ship.lootClock=0;
    }
    if(!ship.raidIsland){if(ship.aiRole==='defender'){ship.orderText='Guardia del puerto';return autopilot(ship,berth(base),this.islands);}return {stop:true,turn:0,throttle:0};}
    const island=ship.raidIsland;
    if(island.owner===team){
      if(island.lootSource&&island.lootSource!==ship){ship.raidIsland=null;this.releaseLoot(ship);return {stop:true,turn:0,throttle:0};}
      if(distance(ship,island)>=island.r+13){if(ship.lootIsland)this.releaseLoot(ship);return autopilot(ship,berth(island),this.islands);}
      island.lootSource=ship;ship.lootIsland=island;
      ship.lootClock=(ship.lootClock??0)+dt;
      if(ship.lootClock>=lootDuration(ship.roles?.looters??0)&&island.available){ship.gold=island.gold;island.available=false;island.treasure.visible=false;island.readyAt=this.time+balance.lootRespawn;ship.raidIsland=null;this.releaseLoot(ship);}
      return {stop:true,turn:0,throttle:0};
    }
    if(distance(ship,island)<island.r+13){
      if(island.owner==='neutral'&&!island.defenders&&island.type!=='fort'&&(!island.tower||island.tower.dead)){island.owner=team;return {stop:true,turn:0,throttle:0};}
      if(island.tower&&!island.tower.dead){this.fire(ship,island.tower);return {stop:true,turn:0,throttle:0};}
      this.startInvasion(island,ship);return {stop:true,turn:0,throttle:0};
    }
    return autopilot(ship,berth(island),this.islands);
  }
  updateVision(dt) {
    const sources=[{...this.player,radius:this.player.dead?0:34}];if(this.port.owner===this.player.team)sources.push({...this.port,radius:24});
    for(const s of this.ships)if(s.team==='blue'&&!s.dead&&s!==this.player)sources.push({x:s.x,z:s.z,radius:s.support==='scout'?balance.scoutVision:18});
    for(const i of this.islands)if(i.owner==='blue')sources.push({x:i.x,z:i.z,radius:i.r+18});
    this.fog.reveal(sources,dt,this.time);
    for(const island of this.islands){if(this.fog.visible(island,island.r)){const discovering=this.living('scout').find(s=>distance(s,island)<balance.scoutVision+island.r);if(discovering&&island.type!=='port')this.director.reportIsland(island,discovering,this.time);island.discovered=true;if(distance(this.player,island)<38||discovering&&this.scoutLevel>=2)island.treasureKnown=true;}island.group.visible=island.discovered;this.ocean.islands.value[this.islands.indexOf(island)].z=island.discovered?island.r:0;}
    for(const ship of this.ships)ship.object.visible=!ship.destroyed&&(ship.team==='blue'||this.fog.visible(ship,5));
    for(const c of this.bestiary.entries){c.object.visible=!c.dead&&this.fog.visible(c,8);if(c.object.visible&&(distance(this.player,c)<34||this.living('scout').some(s=>this.scoutLevel>=2&&distance(s,c)<balance.scoutVision)))c.discovered=true;}
    for(const tower of this.towers)tower.object.visible=!tower.dead&&tower.island.discovered;
  }
  update(dt,time) {
    this.time=time;const p=this.player;reconcileRoles(p);
    for(const ship of this.ships){reconcileRoles(ship);if(ship!==p&&ship.lootIsland&&(ship.dead||ship.destroyed||(ship.support==='scout'?ship.routeIsland:ship.raidIsland)!==ship.lootIsland))this.releaseLoot(ship);if(!ship.dead&&time-(ship.lastHit??-20)>8)ship.hp=Math.min(ship.maxHp,ship.hp+(ship.roles?.repairers??0)*.18*dt);if(!ship.dead&&ship.rig!=null&&time-(ship.lastHit??-20)>8)ship.rig=Math.min(ship.maxRig,ship.rig+(ship.roles?.repairers??0)*rigRules.repairPerSecond*dt);}
    this.updateVision(dt);
    this.nextRaid-=dt;
    if(this.nextRaid<=0){this.nextRaid=110;const island=getHomeBase(this.islands,this.player.team),raider=this.ships.filter(s=>s.team===opposingTeam(this.player.team)&&!s.dead&&!s.support&&!s.gold&&!this.islands.some(i=>i.invasion?.source===s)).sort((a,b)=>distance(a,island)-distance(b,island))[0];if(island&&raider&&!island.invasion){raider.raidIsland=island;this.director.log(`El vigía vio corsarios rumbo a ${island.name}.`);}}
    for(const island of this.islands){
      island.claimFlag.material.color.set(teamColor(island.owner));island.claimFlag.rotation.y=Math.sin(time*2)*.13;
      animateGarrison(island,time,this.dummy,teamColor);
      const inv=island.invasion;if(!inv)continue;
      inv.age+=dt;const landingPoint=berth(island);inv.landing.position.lerpVectors(inv.from,new THREE.Vector3(landingPoint.x,.4,landingPoint.z-4),Math.min(1,inv.age/6));
      if(inv.age>6&&!inv.disembarked){inv.disembarked=true;inv.crew.forEach(p=>{p.userData.landingFrom=p.getWorldPosition(new THREE.Vector3());this.scene.add(p);p.position.copy(p.userData.landingFrom);});}
      if(inv.disembarked)inv.crew.forEach((p,n)=>{const age=Math.max(0,inv.age-6-n*.3),dock=new THREE.Vector3(island.x+island.r*.35+(n%2?-.35:.35),1,island.z+island.r*.65),beach=new THREE.Vector3(island.x+island.r*.25+(n%2?-.7:.7),.55,island.z+2+Math.floor(n/2)*1.2);if(age<4)p.position.lerpVectors(p.userData.landingFrom,dock,age/4);else p.position.lerpVectors(dock,beach,Math.min(1,(age-4)/5));p.rotation.y=Math.atan2(dock.x-beach.x,dock.z-beach.z);p.position.y+=Math.abs(Math.sin(time*7+n))*.055;});
      inv.oars.forEach((o,n)=>o.rotation.y=Math.sin(time*3+n*Math.PI)*.4);inv.crew.forEach((p,n)=>{p.visible=n<inv.attackers;animatePirate(p,time+n,.6);});inv.landing.visible=island.discovered;
      if(inv.source.dead||distance(inv.source,island)>island.r+35){this.cancelInvasion(island);this.director.log(`Desembarco cancelado en ${island.name}.`);continue;}
      const contested=this.ships.some(s=>!s.dead&&s.team===island.owner&&distance(s,island)<island.r+22);
      const result=stepInvasion(inv,dt,contested);inv.contested=contested;
      if(!contested){inv.casualtyClock+=dt;if(inv.casualtyClock>5&&island.defenders>0){inv.casualtyClock=0;const losses=Math.max(1,Math.floor(island.defenders/Math.max(1,inv.attackers)*1.3+Math.random()));inv.attackers=Math.max(0,inv.attackers-losses);inv.source.crew=Math.max(1,inv.source.crew-losses);island.defenders=Math.max(0,island.defenders-Math.max(1,Math.floor(inv.attackers/8+Math.random())));}}
      if(result==='repelled'){this.director.log(`¡${island.name} resistió el desembarco!`,'victory');this.cancelInvasion(island);}
      if(result==='captured'){island.owner=inv.team;island.defenders=0;island.garrisonLevel=0;this.cancelInvasion(island);if(island.tower)island.tower.team=inv.team;this.onIslandCaptured?.(island,inv.team);if(inv.source===this.player||island.discovered&&distance(this.player,island)<65)this.director.announce(`${island.name} cambia de bandera`,inv.team==='blue'?'Ya puedes saquear y construir defensas.':'Los corsarios se quedaron con la llave.','victory');if(island.homeTeam)this.onBaseCaptured?.(inv.team,island);else if(inv.source===this.player&&island.available)this.beginLoot();}
    }
    for(const tower of this.towers){
      if(tower.dead)continue;tower.cooldown-=dt;const u=tower.island.towerUpgrades,range=27+u.range*5;
      const enemy=this.ships.filter(s=>s.team!==tower.team&&!s.dead&&distance(s,tower)<range).sort((a,b)=>distance(a,tower)-distance(b,tower))[0];
      if(!enemy)continue;tower.turret.rotation.y=Math.atan2(tower.x-enemy.x,tower.z-enemy.z);
      if(tower.cooldown<=0){tower.cooldown=Math.max(2.5,5.5-u.rate*.8);this.towerShot(tower,enemy,6+u.damage*3);}
    }
    this.hudClock+=dt;if(this.hudClock>.25){this.hudClock=0;this.updateHUD();}
  }
  updateHUD() {
    const own=this.islands.filter(i=>i.owner==='blue'&&i.type!=='port').length;
    $('campaign-status').textContent=`${own} islas · ${this.living('scout').length} exploradores · ${this.living('guard').length} guardias`;
    $('survey-status').textContent=`${this.fog.percent}% cartografiado`;
    const island=this.islands.find(i=>i.invasion&&(i.owner==='blue'||i.invasion.source===this.player));
    $('invasion-alert').classList.toggle('show',!!island);$('invasion-alert').hidden=!island;
    if(island){const inv=island.invasion;$('invasion-alert').textContent=`${island.owner==='blue'?'¡INVADEN TU ISLA!':'DESEMBARCO'} · ${island.name} · ${inv.contested?'DISPUTADA':Math.ceil(inv.duration-inv.progress)+' s'}`;}
  }
}



