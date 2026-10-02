import {battleWinner,getHomeBase,opposingTeam,worldBounds} from './battlefield.js';
import {upgradeCost} from './navigation.js';

/** Explicit fixtures are separate from the pilot, which only issues ordinary player actions. */
export const qaFixtures=Object.freeze([
  ['funds','Oro insuficiente'],['crew-full','Tripulación completa'],['max-upgrades','Mejoras máximas'],
  ['notices','Avisos simultáneos'],['invasion','Invasión'],['combat-hook','Combate / gancho'],
  ['greek-fire','Marea Roja'],['fire-trail','Rastro en llamas'],['victory','Victoria visual'],['defeat','Derrota visual'],
  ['portrait-sailor','Aviso · Marinero'],['portrait-harpooner','Aviso · Arponero'],
  ['portrait-boatswain','Aviso · Contramaestre'],['portrait-lookout','Aviso · Vigía'],['portrait-carpenter','Aviso · Carpintero'],
  ['fleet-purchases','Flota · compras y mejora'],['fleet-designs','Flota · tres diseños'],
]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// A throttled background tab still advances the explicit QA clock at the chosen rate.
// Production play retains its own conservative frame clamp; QA caps work at 240 fixed substeps.
// Quarter speed exists because a muzzle flash lives for a quarter of a second: at 1x
// it is already gone before a screenshot is encoded, so it can never be reviewed.
const QA_SPEEDS=[.25,1,4];
export function qaSimulationDelta(wallDt,speed=1){
  if(!Number.isFinite(wallDt)||wallDt<=0)return 0;
  return Math.min(wallDt*(QA_SPEEDS.includes(speed)?speed:1),4);
}
const berth=i=>({x:i.x+i.r*.35,z:i.z+i.r*.72+9});
const steps=[['sail','Navegar a una cala'],['loot','Sacar 100 oro'],['deposit','Depositar en el puerto'],['provision','12 piratas · 2 cañones · 1 casco'],['defend','Defender la base'],['tower','Romper la torre rival'],['capture','Conquistar la base rival']];

/**
 * ctx.getState(): {player,islands,ships,bank,time,lootIsland,boarding,grappleActive,locked,gameOver,winner}.
 * ctx.campaign is the real Campaign; setCourse(point,island?), stopCourse(), loot(), cancelLoot(),
 * fire(target), optional startInvasion(island), cancelInvasion(island), prepareRun(), setSpeed(.25|1|4).
 * No health, gold, ownership, damage, discovery or victory is written by this pilot.
 */
export function createQAPilot(ctx,{timeout=1800,navigationTimeout=150,captureTimeout=150}={}){
  const state={status:'idle',phase:'idle',elapsed:0,cycles:0,deaths:0,message:'Sin recorrido activo.',steps:Object.fromEntries(steps.map(([id])=>[id,false])),log:[],failure:null};
  let phaseAge=0,commandClock=0,fireClock=0,target=null,nav=null,depositCargo=0,lootCargo=0,deathAge=0,wasDead=false,defenseParticipated=false,guardTarget=null,guardAge=0,captureAge=0,landingAge=0,lastCaptureProgress=0,captureStall=0;
  const note=message=>{state.message=message;state.log.push({time:Math.round(state.elapsed),phase:state.phase,message});if(state.log.length>30)state.log.shift();};
  const phase=(id,message)=>{state.phase=id;phaseAge=0;commandClock=0;nav=null;note(message);};
  const evidence=s=>({time:s.time,bank:s.bank,player:{x:s.player.x,z:s.player.z,hp:s.player.hp,maxHp:s.player.maxHp,crew:s.player.crew,gold:s.player.gold,dead:s.player.dead,upgrades:{...s.player.upgrades}},bases:s.islands.filter(i=>i.homeTeam).map(i=>({name:i.name,homeTeam:i.homeTeam,owner:i.owner,towerHp:i.tower?.hp,invasion:i.invasion?{team:i.invasion.team,progress:i.invasion.progress,duration:i.invasion.duration,contested:i.invasion.contested}:null}))});
  const cancel=()=>{ctx.cancelLoot?.();const s=ctx.getState();for(const i of s.islands)if(i.invasion?.source===s.player)(ctx.cancelInvasion??(island=>ctx.campaign.cancelInvasion(island)))(i);ctx.stopCourse?.();};
  const fail=(message,s)=>{state.status='failed';state.failure={reason:message,evidence:evidence(s)};note(message);ctx.stopCourse?.();ctx.setSpeed?.(1);};
  const finish=s=>{state.steps.capture=true;state.status='passed';state.phase='complete';note(`Victoria real verificada en ${Math.round(state.elapsed)} s; ${state.cycles} depósitos, ${state.deaths} hundimientos.`);ctx.stopCourse?.();ctx.setSpeed?.(1);};
  const go=(point,island,s,arrival=5)=>{
    if(distance(s.player,point)<=arrival){ctx.stopCourse?.();nav=null;return true;}
    if(!nav||distance(nav.point,point)>3){nav={point:{...point},age:0,stationary:0,last:{x:s.player.x,z:s.player.z},retry:0};commandClock=0;}
    nav.age+=tickDt;
    const moved=distance(s.player,nav.last);nav.stationary=moved<.015?nav.stationary+tickDt:0;nav.last={x:s.player.x,z:s.player.z};
    if(nav.age>navigationTimeout){fail(`La ruta a ${island?.name??'la maniobra'} no llegó tras ${Math.round(nav.age)} s.`,s);return false;}
    if(nav.stationary>18){
      if(nav.retry>=2){fail(`El barco quedó inmóvil al navegar a ${island?.name??'la maniobra'}.`,s);return false;}
      nav.retry++;nav.stationary=0;commandClock=0;note(`Reintentando rumbo (${nav.retry}/2): ${island?.name??'maniobra'}.`);
    }
    if(commandClock<=0){ctx.setCourse({...point},island);commandClock=3;}
    return false;
  };
  const fire=(enemy,s)=>{if(enemy&&!enemy.dead&&!enemy.destroyed&&distance(s.player,enemy)<49&&fireClock<=0){fireClock=.25;return ctx.fire(enemy)!==false;}return false;};
  const enemies=(s,base)=>s.ships.filter(ship=>ship.team!==s.player.team&&!ship.dead&&!ship.destroyed&&(!base||distance(ship,base)<base.r+65)).sort((a,b)=>distance(s.player,a)-distance(s.player,b));
  const ready=p=>p.crew>=12&&(p.upgrades.cannons??0)>=2&&(p.upgrades.hull??0)>=1&&(p.roles?.repairers??0)>=1;
  const selectLoot=s=>s.islands.filter(i=>!i.homeTeam&&i.gold===100&&i.available&&!i.defenders&&!i.invasion&&!i.lootSource&&(!i.tower||i.tower.dead)&&(i.owner==='neutral'||i.owner===s.player.team)).sort((a,b)=>distance(s.player,a)-distance(s.player,b))[0];
  const retreat=(base,s)=>{
    const home=getHomeBase(s.islands,s.player.team),preferred=Math.atan2(home.z-base.z,home.x-base.x),candidates=[];
    for(let n=0;n<24;n++){const angle=preferred+n*Math.PI/12,point={x:base.x+Math.cos(angle)*(base.r+25),z:base.z+Math.sin(angle)*(base.r+25)};
      if(point.x<worldBounds.minX+6||point.x>worldBounds.maxX-6||point.z<worldBounds.minZ+6||point.z>worldBounds.maxZ-6)continue;
      if(s.islands.some(i=>Math.hypot(point.x-i.x,(point.z-i.z)/.72)<i.r+7))continue;
      candidates.push(point);
    }
    return candidates.sort((a,b)=>distance(s.player,a)-distance(s.player,b))[0]??berth(base);
  };
  const provision=s=>{
    if(ready(s.player)){state.steps.provision=true;phase(state.steps.defend?'assault':'guard',state.steps.defend?'Provisiones listas. Rumbo a la base rival.':'Provisiones listas. Esperando un ataque real contra el puerto.');return;}
    if(commandClock>0)return;
    const p=s.player;
    const order=(p.upgrades.hull??0)<1?'ship:hull':!(p.roles?.repairers??0)&&p.crew<p.maxCrew?'repairer':p.crew<12&&p.crew<p.maxCrew?'recruit':p.maxCrew<12?'ship:crew':(p.upgrades.cannons??0)<2?'ship:cannons':null;
    if(!order){fail('No hay plaza para contratar al reparador: la tripulación se llenó sin especialistas.',s);return;}
    const cost=order==='repairer'?45:order==='recruit'?15:upgradeCost(order.slice(5),p.upgrades[order.slice(5)]??0);
    if(s.bank<cost){target=selectLoot(s);phase(target?'sail':'wait-loot',target?`Faltan provisiones. A por otros 100 oro en ${target.name}.`:'Las calas están agotadas u ocupadas. Esperando su botín real.');return;}
    const before=JSON.stringify({crew:p.crew,maxCrew:p.maxCrew,roles:p.roles,upgrades:p.upgrades,bank:s.bank});ctx.campaign.purchase(order);commandClock=1;
    const after=ctx.getState();if(before===JSON.stringify({crew:after.player.crew,maxCrew:after.player.maxCrew,roles:after.player.roles,upgrades:after.player.upgrades,bank:after.bank}))fail(`Campaign.purchase rechazó ${order} con ${s.bank} oro estando en puerto.`,after);
    else note(`Compra normal: ${order}.`);
  };
  let tickDt=0;
  function start(){
    ctx.prepareRun?.();const s=ctx.getState();
    Object.assign(state,{status:'running',phase:'idle',elapsed:0,cycles:0,deaths:0,message:'',steps:Object.fromEntries(steps.map(([id])=>[id,false])),log:[],failure:null});phaseAge=0;commandClock=0;fireClock=0;target=null;nav=null;wasDead=false;deathAge=0;defenseParticipated=false;guardTarget=null;guardAge=0;captureAge=0;landingAge=0;captureStall=0;lastCaptureProgress=0;
    if(!getHomeBase(s.islands,s.player.team)||!getHomeBase(s.islands,opposingTeam(s.player.team))){fail('Falta una de las dos bases reales.',s);return state;}
    if(s.gameOver||battleWinner(s.islands)){fail('La partida ya terminó. Restaura antes del recorrido.',s);return state;}
    if(s.locked){fail('La partida está detenida por un menú o una pausa.',s);return state;}
    target=selectLoot(s);phase(target?'sail':'wait-loot',target?`Recorrido real: navegar a ${target.name}.`:'Esperando una cala de 100 oro disponible.');return state;
  }
  function update(dt){
    if(state.status!=='running')return state;
    try{
      tickDt=dt;const s=ctx.getState(),p=s.player,home=getHomeBase(s.islands,p.team),rival=getHomeBase(s.islands,opposingTeam(p.team));
      if(home.owner!==p.team){fail('La base propia cayó durante el recorrido.',s);return state;}
      if(rival.owner===p.team){if(state.steps.deposit&&state.steps.provision&&state.steps.defend&&state.steps.tower)finish(s);else fail('La base rival cambió antes de completar las verificaciones del recorrido.',s);return state;}
      if(s.gameOver){fail(`La pantalla declaró ${s.winner??'un resultado'} pero la base rival no fue conquistada.`,s);return state;}
      if(!(dt>0))return state;
      state.elapsed+=dt;phaseAge+=dt;commandClock-=dt;fireClock-=dt;
      if(state.elapsed>timeout){fail('El recorrido superó su límite de tiempo real de juego.',s);return state;}
      if(p.dead){if(!wasDead){state.deaths++;note(`Hundimiento real ${state.deaths}. Esperando reaparición.`);}wasDead=true;deathAge+=dt;if(state.deaths>3||deathAge>12)fail('Demasiados hundimientos o reaparición bloqueada.',s);return state;}
      if(wasDead){wasDead=false;deathAge=0;target=null;phase('recover','Reaparición normal: reparar y reponer la tripulación.');}
      if(s.locked){if(phaseAge>15)fail('Un menú o una pausa detuvo el piloto.',s);return state;}
      if(home.invasion&&home.invasion.team!==p.team){
        if(state.phase!=='defend'){ctx.cancelLoot?.();for(const i of s.islands)if(i.invasion?.source===p)(ctx.cancelInvasion??(island=>ctx.campaign.cancelInvasion(island)))(i);target=null;phase('defend','Ataque real contra la base: defender antes de buscar botín.');}
        const attacker=home.invasion.source;
        if(attacker&&!attacker.dead&&distance(p,attacker)<49){defenseParticipated=fire(attacker,s)||defenseParticipated;ctx.stopCourse?.();}
        else go(berth(home),home,s);
        if(phaseAge>180)fail('La defensa de la base no resolvió la invasión en tres minutos.',s);return state;
      }
      if(state.phase==='defend'){
        if(defenseParticipated){state.steps.defend=true;note('Invasión repelida; la bandera propia sigue en pie.');}
        phase('recover','Defensa terminada. Volver a reparar y comprar.');
      }
      if(p.hp<p.maxHp*.36&&state.phase!=='recover'){
        ctx.cancelLoot?.();for(const i of s.islands)if(i.invasion?.source===p)(ctx.cancelInvasion??(island=>ctx.campaign.cancelInvasion(island)))(i);phase('recover','Casco bajo: retirar el bote y volver al puerto sin regalar el barco.');
      }
      if(state.phase==='recover'||state.phase==='deposit'||state.phase==='provision'){
        if(distance(p,home)>=home.r+11){go(berth(home),home,s);return state;}
        ctx.stopCourse?.();
        if(state.phase==='deposit'){
          if(p.gold>0){if(phaseAge>20)fail('El oro llegó al puerto pero el depósito automático no sucedió.',s);return state;}
          if(depositCargo>0){state.cycles++;state.steps.deposit=true;note(`Depósito real ${state.cycles}: ${depositCargo} oro transportado.`);depositCargo=0;}
          phase('recover','Oro a salvo. Reparar antes de comprar.');
        }
        if(p.hp<p.maxHp*.94){if(phaseAge>90)fail('La reparación normal del puerto no recuperó el casco.',s);return state;}
        if(state.phase!=='provision')phase('provision','Contratar y mejorar con el banco real.');provision(ctx.getState());return state;
      }
      if(state.phase==='wait-loot'){
        target=selectLoot(s);if(target){phase('sail',`Nuevo botín disponible: ${target.name}.`);return state;}
        go(berth(home),home,s);if(phaseAge>200)fail('Ninguna cala de 100 oro quedó disponible durante 200 s.',s);return state;
      }
      if(state.phase==='sail'){
        if(!target||!target.available||target.lootSource&&target.lootSource!==p||target.owner!=='neutral'&&target.owner!==p.team){target=selectLoot(s);if(!target){phase('wait-loot','El botín fue ocupado antes de llegar. Buscando otra oportunidad real.');return state;}}
        if(go(berth(target),target,s)){state.steps.sail=true;lootCargo=p.gold;phase('loot',`Desembarcar y saquear ${target.name} mediante E.`);}return state;
      }
      if(state.phase==='loot'){
        if(p.gold>lootCargo){state.steps.loot=true;depositCargo=p.gold;phase('deposit',`Llevar ${p.gold} oro al puerto; todavía no está en caja.`);return state;}
        if(s.lootIsland&&s.lootIsland!==target){ctx.cancelLoot?.();fail(`E saqueó ${s.lootIsland.name} en vez de la cala seleccionada.`,s);return state;}
        if(!s.lootIsland&&commandClock<=0){ctx.loot();commandClock=2;}
        if(phaseAge>28)fail('El saqueo no produjo carga física de oro en 28 s.',s);return state;
      }
      if(state.phase==='guard'){
        guardAge+=dt;
        // Defending successfully can stop a raider at sea before it ever lands.
        // Take part in actual naval combat, then verify that the threat died or withdrew.
        if(guardTarget&&(guardTarget.dead||guardTarget.destroyed||distance(guardTarget,home)>home.r+70)&&defenseParticipated){
          state.steps.defend=true;guardTarget=null;phase('recover','Amenaza naval repelida con disparos reales; la base sigue a salvo.');return state;
        }
        const threat=guardTarget&&!guardTarget.dead&&!guardTarget.destroyed?guardTarget:enemies(s,home).find(ship=>!ship.support);
        if(threat){
          guardTarget=threat;
          if(distance(p,threat)<44){ctx.stopCourse?.();defenseParticipated=fire(threat,s)||defenseParticipated;}
          else go({x:threat.x,z:threat.z},null,s,35);
        }else go(berth(home),home,s);
        if(guardAge>230)fail('No apareció una amenaza naval comprobable para verificar la defensa.',s);return state;
      }
      if(state.phase==='assault'){
        const tower=rival.tower;
        if(!tower||tower.dead||tower.hp<=0){state.steps.tower=true;captureAge=0;landingAge=0;captureStall=0;lastCaptureProgress=0;phase('capture','Torre rival destruida por combate real. Desembarcar.');return state;}
        if(distance(p,tower)>=47){go(berth(rival),rival,s);return state;}
        ctx.stopCourse?.();fire(tower,s);if(phaseAge>220)fail(`La torre rival sigue en pie (${Math.round(tower.hp)} HP) tras 220 s de combate.`,s);return state;
      }
      if(state.phase==='capture'){
        const inv=rival.invasion;
        if(inv?.source===p){
          captureAge+=dt;
          captureStall=inv.progress>lastCaptureProgress+.01?0:captureStall+dt;lastCaptureProgress=inv.progress;
          const retreatPoint=retreat(rival,s);if(distance(p,retreatPoint)>5)go(retreatPoint,rival,s);else ctx.stopCourse?.();
          const enemy=enemies(s,rival)[0];fire(enemy,s);
          if(captureStall>70||captureAge>captureTimeout)fail(`Conquista bloqueada: ${Math.round(inv.progress)}/${Math.round(inv.duration)} s, ${inv.contested?'defensores contestando':'sin progreso'}, ${enemies(s,rival).length} barcos rivales cerca.`,s);
        }else{
          if(distance(p,rival)>=rival.r+21){landingAge=0;go(berth(rival),rival,s);return state;}
          landingAge+=dt;
          if(commandClock<=0){(ctx.startInvasion??(island=>ctx.campaign.startInvasion(island,p)))(rival);commandClock=2;}
          if(landingAge>20)fail('El desembarco sobre la base rival fue rechazado pese a romper su torre.',s);
        }
      }
    }catch(error){const s=ctx.getState();fail(`Error real del piloto: ${error.message}`,s);}
    return state;
  }
  function stop(){if(state.status==='running'){cancel();state.status='stopped';note('Recorrido detenido por el operador.');ctx.setSpeed?.(1);}return state;}
  return {state,start,update,stop};
}

/** Visible, query-gated QA controls. Fixture state changes belong to explicit ctx callbacks. */
export function mountQABench(ctx){
  const search=ctx.search??globalThis.location?.search??'';if(new URLSearchParams(search).get('qa')!=='1')return null;
  const doc=ctx.document??globalThis.document;if(!doc)return null;
  const panel=doc.createElement('details');panel.id='qa-bench';panel.dataset.qa='explicit';
  panel.innerHTML=`<summary>QA · reglas y recorrido</summary><div class="qa-body"><p>Fixtures artificiales para revisar estados. El recorrido usa la partida y sus reglas reales.</p><div class="qa-fixtures">${qaFixtures.map(([id,label])=>`<button type="button" data-qa-fixture="${id}">${label}</button>`).join('')}<button type="button" data-qa-fixture="restore">Restaurar</button></div><div class="qa-run"><button type="button" data-qa-action="run">Recorrido completo</button><button type="button" data-qa-action="stop">Detener</button><label>Reloj <select data-qa-speed aria-label="Velocidad del reloj de QA"><option value="1">1×</option><option value="0.25">¼×</option><option value="4">4×</option></select></label></div><output data-qa-result role="status" aria-live="polite">Sin recorrido activo.</output><p data-qa-live></p><ol data-qa-steps>${steps.map(([id,label])=>`<li data-qa-step="${id}">${label}</li>`).join('')}</ol><pre data-qa-evidence></pre></div>`;
  const style=doc.createElement('style');style.textContent='#qa-bench{position:fixed;left:14px;top:110px;z-index:10000;width:min(330px,calc(100vw - 28px));font:12px/1.4 system-ui;color:#f9e9c6;background:#092531f5;border:1px solid #c39552;border-radius:6px;box-shadow:0 6px 22px #001b26aa}#qa-bench summary{cursor:pointer;padding:9px 12px;color:#ffc66a;font-weight:700}#qa-bench .qa-body{padding:0 12px 12px;max-height:65vh;overflow:auto}#qa-bench p{margin:0 0 9px}#qa-bench .qa-fixtures{display:grid;grid-template-columns:1fr 1fr;gap:6px}#qa-bench button,#qa-bench select{font:inherit;color:inherit;background:#173b48;border:1px solid #7c714e;border-radius:3px;min-height:32px;padding:5px 7px;cursor:pointer}#qa-bench button:hover{background:#255264}#qa-bench button:focus-visible,#qa-bench select:focus-visible{outline:2px solid #f8c976;outline-offset:2px}#qa-bench .qa-run{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 8px}#qa-bench .qa-run label{display:flex;gap:6px;align-items:center}#qa-bench output{display:block;overflow-wrap:anywhere;border-top:1px solid #997b48;padding-top:8px}#qa-bench li{margin:3px 0}#qa-bench li[data-complete="true"]{color:#96e8b5}#qa-bench li[data-complete="true"]::after{content:" ✓"}#qa-bench pre{font:11px/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto}';
  doc.head.appendChild(style);doc.body.appendChild(panel);
  const pilot=createQAPilot(ctx);let fixtureActive=false,clock=0;
  const result=panel.querySelector('[data-qa-result]'),proof=panel.querySelector('[data-qa-evidence]');
  const render=()=>{const s=pilot.state,live=ctx.getState();panel.dataset.status=s.status;panel.dataset.phase=s.phase;panel.dataset.realRun=String(!fixtureActive);panel.dataset.elapsed=String(Math.round(s.elapsed));result.textContent=`${s.status} · ${s.phase} · ${Math.round(s.elapsed)} s — ${s.message}`;panel.querySelector('[data-qa-live]').textContent=`${live.bank} oro en caja · ${live.player.gold} a bordo · ${live.player.crew}/${live.player.maxCrew} piratas · ${Math.ceil(live.player.hp)}/${live.player.maxHp} casco · posición ${live.player.x.toFixed(1)}, ${live.player.z.toFixed(1)}`;for(const [id] of steps)panel.querySelector(`[data-qa-step="${id}"]`).dataset.complete=String(s.steps[id]);proof.textContent=s.failure?JSON.stringify(s.failure,null,2):s.log.slice(-4).map(line=>`${line.time}s ${line.message}`).join('\n');};
  const click=async event=>{
    const button=event.target.closest('button');if(!button||!panel.contains(button))return;event.stopPropagation();
    try{
      if(button.dataset.qaFixture){pilot.stop();const id=button.dataset.qaFixture;if(id==='restore'){await ctx.restore();fixtureActive=false;pilot.state.status='idle';pilot.state.phase='idle';pilot.state.message='Fixture restaurado. Puedes iniciar un recorrido real.';}else{await ctx.runFixture(id);fixtureActive=true;pilot.state.status='fixture';pilot.state.phase=id;pilot.state.message=`Fixture artificial: ${button.textContent}. Restaura antes del recorrido.`;}pilot.state.failure=null;}
      else if(button.dataset.qaAction==='run'){if(fixtureActive){pilot.state.message='Restaura el fixture antes del recorrido; sus resultados no son una partida real.';}else pilot.start();}
      else if(button.dataset.qaAction==='stop')pilot.stop();
    }catch(error){pilot.state.status='failed';pilot.state.message=`QA: ${error.message}`;}
    render();
  };
  const speed=event=>{const value=Number(event.target.value);if([.25,1,4].includes(value))ctx.setSpeed?.(value);};
  panel.addEventListener('click',click);panel.addEventListener('keydown',event=>event.stopPropagation());panel.querySelector('[data-qa-speed]').addEventListener('change',speed);render();
  return {panel,pilot,runFixture:id=>ctx.runFixture?.(id),update(dt){pilot.update(dt);clock+=dt;if(clock>.2||pilot.state.status!=='running'){clock=0;render();}},dispose(){pilot.stop();panel.removeEventListener('click',click);panel.remove();style.remove();}};
}
