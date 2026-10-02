import * as THREE from 'three';
import { definitions, icon, matchArtwork, compassArtwork, ropeArtwork } from './hud-art.js';
import { chartTransform } from './chart-geometry.js';
import { coastRadius } from './coastline.js';
import './hud-reference.css';
import './hud-polish.css';

const $ = id => document.getElementById(id);

export function mountNauticalHUD() {
  document.body.classList.add('game-hud');
  document.body.insertAdjacentHTML('afterbegin', definitions);
  document.querySelector('.brand-icon').innerHTML = icon('anchor');
  document.querySelector('.loading-mark').innerHTML = icon('anchor');
  document.querySelector('.match').innerHTML = `${matchArtwork()}<span class="team blue"><span class="team-full">VELAS AZULES</span><span class="team-compact" aria-hidden="true">AZULES</span><b id="blue-score">A SALVO</b></span><span class="match-center"><span id="timer">00:00</span><small>CONQUISTA</small></span><span class="team red"><span class="team-full">CORSARIOS ROJOS</span><span class="team-compact" aria-hidden="true">CORSARIOS</span><b id="red-score">A SALVO</b></span>`;
  $('sound').innerHTML = icon('note'); $('settings').innerHTML = icon('gear');
  document.querySelector('.voyage').innerHTML = `<div class="cargo"><span>BOTÍN A BORDO</span><div class="treasure-counts"><strong title="Oro a bordo">${icon('coin')}<span id="cargo">0</span></strong><strong title="Cofres a bordo">${icon('chest')}<span id="chest-count">0</span></strong></div><div id="cargo-hint">Llévalo a puerto para asegurarlo.</div><div class="bank-balance">EN CAJA <b id="bank">200</b> <span>oro</span></div></div>`;
  document.querySelector('.ship-card').innerHTML = `<img class="ship-card-art" src="/assets/pirate-ui/ship-panel-v3.png" alt=""><div class="ship-emblem"><img id="ship-portrait" alt="Bergantín La Indomable"><span class="rank-medal" id="rank-medal" title="Rango del capitán">1</span></div><div class="ship-details"><div class="ship-name"><h2>La Indomable</h2><span id="ship-level">RANGO 1 · 0/80 EXP</span></div><div class="experience-track"><i id="experience-bar"></i></div><div class="hull-stats">${icon('shield')}<div><div class="health-row"><span>CASCO</span><b id="health-text">160 / 160</b></div><div class="health-track"><div id="health-bar"></div></div></div></div><div class="crew-stats">${icon('crew')}<div><div class="crew-line"><span><b id="crew">12</b> / <span id="max-crew">12</span> TRIPULANTES</span></div><span class="crew-dots" id="crew-dots"></span></div></div></div>`;
  const actions = [['fire','cannon','ESPACIO'],['board','hook','Q'],['loot','chest','E'],['greek-fire','fire','R']];
  for(const [id, name, key] of actions) {
    const button=$(id); button.querySelector('.action-glyph').innerHTML=icon(name,'action-art');
    button.querySelector('kbd').textContent=key;
    button.insertAdjacentHTML('afterbegin','<span class="action-medal" aria-hidden="true"><i class="cooldown-ring"></i></span>');
  }
  $('fire').insertAdjacentHTML('beforeend','<span class="side-guns" aria-hidden="true"><i id="gun-port"></i><i id="gun-starboard"></i></span>');
  $('board').querySelector('strong').textContent='Abordar';
  $('board').title='Q · Lanza un garfio para atrapar y abordar. Pulsa otra vez para soltar.';
  $('fire').title='Mantén Espacio o el botón para disparar. Z cambia la munición.';
  $('loot').title='E · Desembarcar y saquear la isla cercana';
  $('greek-fire').title='R · Deja combustible ardiendo tras el barco';
  $('upgrades').innerHTML=`${icon('anchor')}<strong>Astillero</strong><kbd>B</kbd>`;
  for (const button of document.querySelectorAll('[data-upgrade]')) {
    button.querySelector('span').innerHTML = icon({hull:'shield',cannons:'cannon',crew:'crew'}[button.dataset.upgrade]);
  }
  document.querySelector('.map-panel').innerHTML=`<div class="compass">${compassArtwork()}<canvas id="minimap" width="640" height="640" aria-label="Carta náutica: islas descubiertas, flota y rumbo"></canvas></div><button id="map-mode" aria-label="Cambiar entre mapa cercano y archipiélago">M</button><strong class="map-port">PUERTO RON RON</strong>`;
  $('map-mode').title='M · Ver mapa cercano';$('map-mode').setAttribute('aria-pressed','true');
  const portStatus=$('port-status'); document.querySelector('.map-panel').appendChild(portStatus);
  $('weapon').classList.add('ammunition-selector');
  $('settings-dialog').setAttribute('aria-label','Ajustes del juego');
  const settings=$('settings-dialog');
  settings.querySelector('h2').textContent='Antes de zarpar';
  const controls=document.createElement('details');controls.className='control-guide';
  controls.innerHTML='<summary>Cómo se navega</summary><div class="control-grid"><p><kbd>W S</kbd><span>Avanzar y frenar</span></p><p><kbd>A D</kbd><span>Girar el timón</span></p><p><kbd>SHIFT</kbd><span>Acelerar mientras lo mantienes</span></p><p><kbd>ESPACIO</kbd><span>Disparar salvas</span></p><p><kbd>Q</kbd><span>Garfio; otra vez para soltar</span></p><p><kbd>E</kbd><span>Desembarcar o retirar piratas</span></p><p><kbd>R</kbd><span>Dejar fuego griego</span></p><p><kbd>V</kbd><span>Sofocar fuego a bordo</span></p><p><kbd>C</kbd><span>Una ronda de ron</span></p><p><kbd>Z</kbd><span>Cambiar munición</span></p><p><kbd>F</kbd><span>Compras del puerto</span></p><p><kbd>TAB</kbd><span>Carta y rutas</span></p><p><kbd>J</kbd><span>Defensas de tu isla</span></p></div><p class="control-mouse">Clic en el mar: poner rumbo. Clic en un rival: fijar objetivo. Clic derecho: disparo manual. Rueda: acercar la cámara. El oro se deposita al volver a tu puerto.</p>';
  settings.querySelector('p').replaceWith(controls);
  settings.querySelector('.close').setAttribute('aria-label','Cerrar ajustes');
  $('upgrade-dialog').setAttribute('aria-label','Astillero de Puerto Ron Ron');
  $('pause').setAttribute('aria-pressed','false'); $('sound').setAttribute('aria-pressed','false');
  const sailing=document.createElement('div');sailing.id='sailing-tools';sailing.innerHTML=`<button id="sprint" class="sprint-control" aria-label="Acelerar a toda vela" title="Mantén Shift o este botón para acelerar; suelta para volver a crucero"><kbd>SHIFT</kbd><span><b>¡A TODA VELA!</b><span class="sprint-track"><i id="sprint-fill"></i></span></span></button><button id="rum" title="C · Una ronda de ron: 7 segundos de moral y recarga más rápida">${icon('rum')}<span><b>RON <kbd>C</kbd></b><small id="rum-status">3 raciones</small></span></button>`;document.body.appendChild(sailing);
  const dialogue=document.createElement('aside');dialogue.id='crew-dialogue';dialogue.setAttribute('aria-live','polite');dialogue.innerHTML='<img class="dialogue-art" src="/assets/pirate-ui/v2/dialogue.webp" alt=""><img id="dialogue-avatar" alt=""><div class="dialogue-copy"><small id="dialogue-role"></small><strong id="dialogue-name"></strong><p id="dialogue-message"></p></div><button id="dialogue-close" aria-label="Cerrar mensaje">×</button>';document.body.appendChild(dialogue);
}

// One transparent snapshot of the actual ship, not a second continuously running
// scene. Geometry and materials belong to the game and must not be disposed here.
let portraitRenderer;
export function renderModelPortrait(source, size=288, {aspect=1}={}) {
  const preview = new THREE.Scene();
  const copy = source => {
    let object;
    if(source.isInstancedMesh){object=new THREE.InstancedMesh(source.geometry,source.material,source.count);object.instanceMatrix=source.instanceMatrix;object.instanceColor=source.instanceColor;}
    else object=source.isMesh ? new THREE.Mesh(source.geometry,source.material) : source.isLine ? new THREE.Line(source.geometry,source.material) : new THREE.Group();
    object.position.copy(source.position);object.quaternion.copy(source.quaternion);object.scale.copy(source.scale);object.visible=source.visible;
    for(const child of source.children){
      if(!child.visible)continue;
      // Volumetric beams are atmospheric effects, not part of a ship's silhouette.
      if(child.material?.uniforms?.strength||child.material?.blending===THREE.AdditiveBlending)continue;
      object.add(copy(child));
    }
    return object;
  };
  const model = copy(source); model.position.set(0,0,0); model.rotation.set(0,-.35,0); model.scale.setScalar(1);model.visible=true;
  preview.add(model, new THREE.HemisphereLight(0xffefd1,0x355561,2.4));
  const light=new THREE.DirectionalLight(0xffdb93,3); light.position.set(-12,24,18); preview.add(light);
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,300); camera.position.copy(center).add(new THREE.Vector3(35,24,48)); camera.lookAt(center);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3(),corner=new THREE.Vector3();
  model.traverseVisible(object=>{
    if(!object.geometry)return;
    if(object.isInstancedMesh)object.computeBoundingBox();else if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
    const box=object.isInstancedMesh?object.boundingBox:object.geometry.boundingBox;
    if(!box||box.isEmpty())return;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      corner.set(x,y,z).applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);projected.expandByPoint(corner);
    }
  });
  const framing=projected.getCenter(new THREE.Vector3()),width=projected.max.x-projected.min.x,height=projected.max.y-projected.min.y;
  const span=Math.max(1,Math.max(width/aspect,height)*.54);
  camera.left=framing.x-span*aspect;camera.right=framing.x+span*aspect;camera.top=framing.y+span;camera.bottom=framing.y-span;camera.updateProjectionMatrix();
  const renderer = portraitRenderer??=new THREE.WebGLRenderer({alpha:true,antialias:true}); renderer.setSize(size,Math.round(size/aspect)); renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.render(preview,camera);
  return renderer.domElement.toDataURL('image/png');
}
export function renderShipPortrait(ship){$('ship-portrait').src=renderModelPortrait(ship.object);}

export function updateNauticalHUD({player,rank,xp,greekCooldown,greekTotal,greekActive=0,grapple,boarding,invasion,lootProgress,paused,gameOver=false,voyage,weaponIndex,guns,firefight=0}) {
  $('chest-count').textContent=Math.ceil(player.gold/35);
  $('rank-medal').textContent=rank;
  $('rank-medal').title=`Rango ${rank} · ${xp}/${rank*80} experiencia`;
  $('sprint').setAttribute('aria-pressed',String(!!voyage?.boosting));
  $('experience-bar').style.width=`${Math.min(100,xp/(rank*80)*100)}%`;
  $('ship-level').textContent=`RANGO ${rank} · ${xp}/${rank*80} EXP`;
  $('fire').style.setProperty('--ready',Math.max(0,1-player.cooldown/player.cooldownTotal));
  $('greek-fire').style.setProperty('--ready',Math.max(0,1-greekCooldown/greekTotal));
  $('board').style.setProperty('--ready',boarding ? Math.min(1,boarding.progress/4):1);
  $('loot').style.setProperty('--ready',lootProgress ? lootProgress.progress:1);
  const unavailable=!!player.dead||paused||gameOver;
  $('fire').disabled=unavailable||!!boarding||player.cooldown>0;
  $('board').disabled=unavailable||!!lootProgress;
  $('greek-fire').disabled=unavailable||greekCooldown>0;
  const setAction=(id,state,progress,reason='')=>{
    progress=Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):0;
    const button=$(id);button.dataset.state=state;
    button.style.setProperty('--ready',Math.min(1,Math.max(0,progress)));
    const ring=button.querySelector('.cooldown-ring');ring.setAttribute('role','progressbar');ring.setAttribute('aria-label',`${button.querySelector('strong').textContent}: ${reason||state}`);ring.setAttribute('aria-valuemin','0');ring.setAttribute('aria-valuemax','100');ring.setAttribute('aria-valuenow',String(Math.round(progress*100)));ring.hidden=!['active','cooldown'].includes(state);
  };
  setAction('fire',unavailable||boarding?'blocked':player.cooldown>0?'cooldown':'ready',1-player.cooldown/Math.max(.01,player.cooldownTotal),player.cooldown>0?'Recargando':'Cañones listos');
  setAction('greek-fire',unavailable?'blocked':greekActive>0?'active':greekCooldown>0?'cooldown':'ready',1-greekCooldown/Math.max(.01,greekTotal),greekActive>0?'Combustible encendido':greekCooldown>0?'Recargando':'Fuego griego listo');
  const grappleProgress=boarding?boarding.progress/4:grapple?.phase==='ready'?1:grapple?.state?Math.min(.85,grapple.state.age/8):0;
  setAction('board',unavailable||lootProgress?'blocked':grapple?.active?'active':'ready',grappleProgress,grapple?.active?'Pulsa Q para soltar el cabo':'Lanza el garfio');
  const landing=invasion?.source===player?invasion:null;
  setAction('loot',unavailable||grapple?.active?'blocked':lootProgress||landing?'active':'ready',lootProgress?.progress??(landing?landing.progress/landing.duration:1),landing?'Pulsa E para retirar la tripulación':lootProgress?'Pulsa E para regresar':'Desembarcar');
  $('loot').disabled=unavailable||!!grapple?.active;
  $('loot').querySelector('strong').textContent=lootProgress||landing?'Retirar':'Saquear';
  if(landing)$('loot-hint').textContent=landing.contested?'Costa disputada':`Conquistando · ${Math.max(0,Math.ceil(landing.duration-landing.progress))} s`;
  $('sprint').disabled=unavailable;
  document.querySelector('.ship-card').classList.toggle('hull-critical',player.hp/player.maxHp<.3);
  $('pause').setAttribute('aria-pressed',String(paused));
  $('pause').textContent=paused?'▷':'Ⅱ';
  $('pause').setAttribute('aria-label',paused?'Continuar':'Pausar');
  if(voyage){$('sprint-fill').style.width=`${voyage.stamina}%`;document.body.classList.toggle('sprinting',voyage.boosting);$('rum-status').textContent=voyage.rumTime>0?'¡Salud, bribones!':voyage.rumCooldown>0?`${Math.ceil(voyage.rumCooldown)} s · ${voyage.rumCharges} ron`:`${voyage.rumCharges} raciones`;$('rum').disabled=unavailable||voyage.rumCooldown>0||voyage.rumCharges<=0;$('rum').classList.toggle('active',voyage.rumTime>0);$('rum').title=`C · ${$('rum-status').textContent}. Moral y recarga rápida durante 7 segundos`; }
  if(guns)for(const [id,g] of [['gun-port',guns.port],['gun-starboard',guns.starboard]]){
    const pip=$(id);if(!pip)continue;
    pip.style.setProperty('--ready',g.total?Math.max(0,1-g.left/g.total):1);
    pip.classList.toggle('loaded',g.left<=0);
    pip.title=`${id==='gun-port'?'Babor':'Estribor'}: ${g.left>0?'recargando':'listo'}`;
  }
  document.body.classList.toggle('firefight-ready',player.burning>0&&firefight<=0);
  const ammunitionIcon=['cannon','chain','fire','bomb'][weaponIndex??0];
  const ammunitionSource=`/assets/pirate-ui/${['cannon','fire'].includes(ammunitionIcon)?'v2/':''}${ammunitionIcon}.webp`;
  const ammunitionImage=$('fire').querySelector('.action-glyph .hud-icon');
  if(ammunitionImage.getAttribute('src')!==ammunitionSource)ammunitionImage.src=ammunitionSource;
}

let fullChart=true;
export function toggleChart(){fullChart=!fullChart;$('map-mode').textContent='M';$('map-mode').title=fullChart?'M · Ver mapa cercano':'M · Ver todo el archipiélago';$('map-mode').setAttribute('aria-pressed',String(fullChart));}
export function drawNauticalMap(ctx,{bounds,islands,ships,creatures,player,sources,time=0,overview=fullChart}) {
  const size=320, center=160;
  ctx.save();const resolution=ctx.canvas.width/size;ctx.setTransform(resolution,0,0,resolution,0,0);
  const {scale,point}=chartTransform(bounds,player,overview,size);
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#082a3a';ctx.fillRect(0,0,size,size);
  for(const source of sources){const [x,y]=point(source),r=source.radius*scale;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#3f78853a');g.addColorStop(1,'#3f788500');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  ctx.strokeStyle='#6eabbd23';ctx.lineWidth=.8;
  for(const r of [38,76,114,151]){ctx.beginPath();ctx.arc(center,center,r,0,Math.PI*2);ctx.stroke();}
  for(let a=0;a<Math.PI;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(center+Math.cos(a)*160,center+Math.sin(a)*160);ctx.lineTo(center-Math.cos(a)*160,center-Math.sin(a)*160);ctx.stroke();}
  islands.forEach((island,index)=>{
    if(!island.discovered)return;const [x,y]=point(island),radius=Math.max(5,island.r*scale);if(Math.hypot(x-center,y-center)>150+radius)return;
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#28798888';ctx.beginPath();ctx.ellipse(0,0,radius+2,radius*.72+2,0,0,Math.PI*2);ctx.fill();
    const outline=ratio=>{ctx.beginPath();for(let n=0;n<=48;n++){const a=n/48*Math.PI*2,r=radius*coastRadius(a,island.x,island.z)*ratio;const px=Math.cos(a)*r,py=Math.sin(a)*r*.72;n?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();};
    outline(1);ctx.fillStyle=island.biome==='snow'?'#cad9cc':'#c9b56b';ctx.fill();outline(.72);ctx.fillStyle=island.biome==='volcano'?'#706653':'#57784a';ctx.fill();
    for(let n=0;n<8;n++){const a=n*2.4,rr=radius*.5;ctx.fillStyle=n%2?'#a1ad71':'#355b43';ctx.fillRect(Math.cos(a)*rr,Math.sin(a)*rr*.65,Math.max(2,radius*.19),Math.max(2,radius*.15));}
    if(island.owner!=='neutral'){outline(1.12);ctx.lineWidth=island.homeTeam?2.5:1.7;ctx.strokeStyle=island.owner==='blue'?'#85d6e3':'#f39a75';ctx.stroke();}
    if(island.biome==='volcano'){ctx.fillStyle='#394f4b';ctx.beginPath();ctx.ellipse(-1,-1,radius*.3,radius*.23,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#edaa56';ctx.beginPath();ctx.ellipse(-1,-1,radius*.14,radius*.09,0,0,Math.PI*2);ctx.fill();}
    if(island.type==='fort'){ctx.fillStyle='#d5d4b3';ctx.fillRect(-radius*.2,-radius*.25,radius*.4,radius*.4);ctx.fillStyle='#52655a';ctx.fillRect(-radius*.1,-radius*.1,radius*.2,radius*.2);}
    const crest=mapCrests[island.owner];if(crest?.complete&&crest.naturalWidth){const s=island.homeTeam?17:12;ctx.fillStyle='#092937';ctx.beginPath();ctx.arc(0,-radius*.6,s*.64,0,Math.PI*2);ctx.fill();ctx.drawImage(crest,-s/2,-radius*.6-s/2,s,s);}
    if(island.available&&(island.treasureKnown||island.potentialTreasure)&&island.type!=='port'){ctx.save();ctx.translate(radius*.7,-radius*.5);ctx.fillStyle='#102936';ctx.strokeStyle='#ffe0a0';ctx.lineWidth=1.6;ctx.beginPath();ctx.rect(-4,-3,8,6);ctx.fill();ctx.stroke();if(island.treasureKnown){ctx.fillStyle='#ffda7b';ctx.fillRect(-2,-1,4,2);}else{ctx.fillStyle='#ffda7b';ctx.font='bold 9px Georgia';ctx.textAlign='center';ctx.fillText('?',0,3);}ctx.restore();}
    if(time-(island.reportedAt??-100)<14){const pulse=((time-island.reportedAt)%2)/2;ctx.strokeStyle=`rgba(255,214,114,${1-pulse})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,radius+4+pulse*18,radius*.72+4+pulse*18,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  });
  if(player.target){const [x,y]=point(player.target),[px,py]=point(player);ctx.strokeStyle='#ecd393aa';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.stroke();}
  for(const s of ships){if(s.dead||!s.object.visible)continue;const [x,y]=point(s);ctx.save();ctx.translate(x,y);ctx.rotate(-s.heading);ctx.fillStyle=s===player?'#f4fbeb':s.team==='blue'?'#7bc4df':'#e85344';ctx.strokeStyle='#0b2832';ctx.lineWidth=1.3;
    const k=s===player?1.45:1;ctx.scale(k,k);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4.5,5);ctx.lineTo(0,2);ctx.lineTo(-4.5,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  for(const creature of creatures){if(creature.dead||!creature.discovered)continue;const [x,y]=point(creature);ctx.strokeStyle='#d6a3c7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
const mapCrests={};if(typeof Image!=='undefined')for(const [team,file]of [['blue','anchor.webp'],['red','v2/swords.webp']]){const artwork=new Image();artwork.src='/assets/pirate-ui/'+file;mapCrests[team]=artwork;}
