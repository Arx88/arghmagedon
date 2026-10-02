import { icon as baseIcon } from './hud-art.js';
const icon = baseIcon;
import { renderModelPortrait } from './hud.js';
import { upgradeCost, upgradeDefinitions } from './navigation.js';
import { balance, garrisons, garrisonCost, towerCost, weaponCost, scoutUpgradeCost, lootDuration, purchaseBlockReason,crewSpecialties,marinerCount,cannonReload } from './campaign-rules.js';
import { weaponProfiles } from './voyage-feel.js';
import { greekFireRules } from './greek-fire.js';
import { grappleDefaults } from './grappling.js';
import './harbor-ui.css';
import './crew-ui.css';

const $ = id => document.getElementById(id);
const characterArt = Object.freeze({
  'harbor-hero':'harbor-hero-character-style',
  'repairer-card':'repairer-card-character-style',
  'looter-card':'looter-card-character-style',
  'mariner-card':'mariner-card-character-style',
  'boarder-card':'boarder-card-style-locked-v4',
});
const fleetArt=Object.freeze({'explorer-card':'explorer-card-spyglass-v2','guard-card':'guard-card-tower-v2'});
const art = name => `/assets/harbor-art/${characterArt[name] ?? fleetArt[name] ?? name}.png`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roman = n => ['I','II','III','IV'][Math.min(3,n)];
const tabs = [['ship','Barco','ship'],['crew','Tripulación','crew'],['weapons','Arsenal','swords'],['fleet','Flota','fleet'],['island','Isla','island']];
const titles = {ship:'Un barco. Cero buenas excusas.',crew:'Una tripulación. Muchas malas ideas.',weapons:'Un arsenal. Muchas malas ideas.',fleet:'Amplía tu flota. Más ideas en el mar.',island:'Tu bandera. Tu pequeño imperio.'};
const quips = {ship:'El mar no acepta devoluciones.',crew:'Aquí nadie pide referencias. Por suerte.',weapons:'La diferencia entre una buena idea y una mala: mayor distancia.',fleet:'Contrata ojos en el horizonte. Y molestias para el rival.',island:'Los corsarios presumen de disciplina. Nosotros tenemos un faro.'};

/** Native text and controls sit above unwarped raster artwork. Purchase rules stay in Campaign. */
export function createHarborUI(c) {
  const tools=document.createElement('div');tools.className='captain-tools';
  tools.innerHTML='<button id="company" title="F · Puerto"><kbd>F</kbd> Puerto</button><button id="territory" title="J · Defensas de la isla"><kbd>J</kbd> Isla</button><button id="station" title="G · Dejar un guardacostas en este lugar"><kbd>G</kbd> Fijar guardia</button>';
  document.body.appendChild(tools);
  for(const id of ['campaign-status','invasion-alert']){const el=document.createElement('div');el.id=id;el.setAttribute('role','status');document.body.appendChild(el);}
  const dialog=document.createElement('dialog');dialog.id='captain-dialog';dialog.setAttribute('aria-labelledby','company-title');
  dialog.innerHTML=`<aside class="harbor-illustration" aria-hidden="true"><img src="${art('harbor-hero')}" alt=""><div class="harbor-brand">${icon('anchor')}<span>PIRATE TIDES</span></div><blockquote><span>PUERTO RON RON</span><p id="company-quip"></p></blockquote></aside><section class="harbor-main"><button class="close" aria-label="Cerrar puerto">×</button><header class="harbor-heading"><div class="eyebrow">LOS TRATOS DE PUERTO RON RON</div><h2 id="company-title"></h2><img class="harbor-scene" alt="Puerto Ron Ron"><div id="company-wallet"></div></header><nav class="company-tabs" role="tablist" aria-label="Compras del puerto">${tabs.map(([id,label,glyph])=>`<button id="company-tab-${id}" data-tab="${id}" role="tab" aria-controls="company-content">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav><div id="company-content" role="tabpanel" tabindex="0"></div><footer id="company-note" role="status"></footer></section>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.addEventListener('click', e=>{
    const tab=e.target.closest('[role="tab"][data-tab]');if(tab){c.currentTab=tab.dataset.tab;c.renderPanel();$('company-content').scrollTop=0;}
    const selection=e.target.closest('[data-weapon]');if(selection){c.selectedWeapon=selection.dataset.weapon;const top=$('company-content').scrollTop;c.renderPanel();$('company-content').scrollTop=top;$('company-content').querySelector(`[data-weapon="${c.selectedWeapon}"]`)?.focus();}
    const order=e.target.closest('[data-order]');
    if(order&&!order.disabled){
      const top=$('company-content').scrollTop,id=order.dataset.order,name=order.closest('.harbor-card')?.querySelector('h3')?.textContent??order.getAttribute('aria-label'),before=c.getBank(),crewBefore=c.player.crew;
      c.purchase(id);$('company-content').scrollTop=top;
      if(c.getBank()<before){c.feedback=`Trato cerrado · ${name}`;$('company-note').textContent=c.feedback;}
      if(id.startsWith('dismiss:')&&c.player.crew<crewBefore){c.feedback=`${name} en tierra · plaza libre · sin reembolso`;$('company-note').textContent=c.feedback;}
      const next=dialog.querySelector(`[data-order="${id}"]`);
      if(next&&!next.disabled)next.focus({preventScroll:true});
      else{const card=next?.closest('article')??$('company-content');card.tabIndex=-1;card.focus({preventScroll:true});}
    }
  });
  dialog.querySelector('.company-tabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...dialog.querySelectorAll('[data-tab]')],i=buttons.indexOf(e.target);if(i<0)return;
    e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();
  });
  $('company').onclick=()=>c.open('fleet');$('territory').onclick=()=>c.open('island');$('station').onclick=()=>c.stationGuard();
  window.addEventListener('keydown',e=>{if(e.repeat||e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;if(e.code==='KeyF')c.open('fleet');if(e.code==='KeyJ')c.open('island');if(e.code==='KeyG'&&!c.locked())c.stationGuard();});
  const help=document.createElement('small');help.id='survey-status';document.querySelector('.map-panel').appendChild(help);
}

function purchase(c,id,label,cost,options={}) {
  const reason=purchaseBlockReason({docked:options.land?true:c.inPort(),money:c.getBank(),cost,...options});
  return `<div class="harbor-purchase">${options.inlinePrice?'':`<span class="harbor-price">${options.maxed?'<span class="harbor-max">Mejora completa</span>':`${icon('coin')}<b>${esc(cost)}</b><small>oro</small>`}</span>`}<button class="harbor-buy" data-order="${esc(id)}" ${reason?'disabled':''} aria-label="${esc(label+(options.name?' '+options.name:''))}">${options.inlinePrice&&!options.maxed?`${icon('coin')}${esc(label)} · ${esc(cost)} oro`:esc(options.maxed?'Completado':label)}</button></div><div class="harbor-lock ${reason?'':'harbor-lock-empty'}">${esc(reason||'Disponible en tu puerto')}</div>`;
}
function card(c,{id,title,desc,image,glyph,badge,benefit,cost,label='Comprar',options={}}) {
  return `<article class="harbor-card" data-item="${esc(id)}"><div class="harbor-card-art ${image?'':'harbor-cutout'}"><img src="${image||`/assets/pirate-ui/${glyph}.webp`}" alt="" loading="eager">${badge?`<span class="harbor-badge">${esc(badge)}</span>`:''}</div><div class="harbor-card-copy"><h3>${esc(title)}</h3><p>${esc(desc)}</p>${benefit?`<div class="harbor-benefit">${esc(benefit)}</div>`:''}${purchase(c,id,label,cost,{...options,name:title})}</div></article>`;
}
function section(title,right='') {return `<div class="harbor-section-heading"><h3>${esc(title)}</h3>${right?`<span>${esc(right)}</span>`:''}</div>`;}
function stat(label,value,ratio,glyph) {return `<div class="arsenal-stat">${icon(glyph)}<span>${esc(label)}</span><div><i style="width:${Math.max(3,Math.min(100,ratio*100))}%"></i></div><b>${esc(value)}</b></div>`;}

function fleet(c) {
  const scouts=c.living('scout'),guards=c.living('guard'),active=[...scouts,...guards];
  let html=section('Barcos secundarios',`${active.length} / ${balance.scoutLimit+balance.guardLimit} en el mar`)+`<div class="harbor-card-grid">`;
  html+=card(c,{id:'scout',title:`Explorador ${roman(c.scoutLevel-1)}`,desc:c.scoutLevel>=3?'Revela costas y saquea calas despejadas. No combate.':c.scoutLevel>=2?'Revela costas y detecta tesoros y grandes criaturas. No combate.':'Revela costas y anuncia islas nuevas. No combate.',image:art(c.scoutLevel>=2?'explorer-ii-card':'explorer-card'),badge:`${scouts.length} / ${balance.scoutLimit} activos`,benefit:`${balance.scoutSpeed} nudos · cada isla queda marcada`,cost:balance.scoutCost,options:{restriction:scouts.length>=balance.scoutLimit?'Límite de 2 exploradores':''}});
  html+=card(c,{id:'scout-up',title:`Explorador ${roman(Math.min(2,c.scoutLevel))}`,desc:c.scoutLevel===1?'Detecta tesoros y grandes criaturas.':'Saquea calas despejadas y trae el oro.',image:art('explorer-ii-card'),badge:c.scoutLevel>=3?'Nivel máximo':'Mejora de la flota',benefit:c.scoutLevel===1?'Mejor información. Menos malas sorpresas.':'Sin enemigos · sin torre · con tesoro',cost:scoutUpgradeCost(c.scoutLevel),label:'Mejorar',options:{maxed:c.scoutLevel>=3,restriction:!scouts.length?'Contrata primero un explorador':''}});
  html+=card(c,{id:'guard',title:'Guardacostas',desc:'Custodia una zona hasta que lo reagrupas.',image:art('guard-card'),badge:`${guards.length} / ${balance.guardLimit} activos`,benefit:'8 daño · G fija su puesto',cost:balance.guardCost,options:{restriction:guards.length>=balance.guardLimit?'Límite de 3 guardacostas':''}});
  html+='</div>';
  if(active.length)html+=`<details class="harbor-active-fleet"${c.fleetExpanded?' open':''}><summary>Tu flota en el mar · ${active.length}</summary><div>${active.map(s=>`<article><span><strong>${esc(s.name)}</strong><small>${Math.ceil(s.hp)} / ${s.maxHp} casco · ${esc(s.support==='scout'?s.orderText||'Cartografiando':s.anchor?'En su puesto':'Te sigue')}</small></span>${s.support==='guard'&&s.anchor?`<button data-order="recall:${esc(s.id)}">Reagrupar</button>`:''}</article>`).join('')}</div></details>`;
  return html;
}
function crew(c) {
  const p=c.player,free=Math.max(0,p.maxCrew-p.crew),roles=p.roles,mariners=marinerCount(p),docked=c.inPort();
  const details=[
    {image:'repairer-card',glyph:'wrench',desc:'Mantienen el barco en forma. Los agujeros son suyos.',benefits:[['wrench','+0,18 casco / s por pirata'],['shield','Reparan fuera de combate']]},
    {image:'looter-card',glyph:'chest',desc:'Abren cofres y vuelven antes de que empiece la bronca.',benefits:[['chest','Saqueo más rápido'],['clock',`${lootDuration(roles.looters).toFixed(1).replace('.',',')} → ${lootDuration(roles.looters+1).toFixed(1).replace('.',',')} s al contratar`]]},
    {image:'boarder-card',glyph:'swords',desc:'Expertos en cruzar el cabo sin pedir permiso.',benefits:[['swords','Daño +10 % · tope 50 %'],['shield','Defensa +5 % · tope 25 %']]},
    {image:'mariner-card',glyph:'cannon',desc:'Puntería fina. Modales dudosos. Cargan los cañones.',benefits:[['cannon','Recargan más rápido'],['clock','Ritmo +3,5 % · tope 22 %']]},
  ];
  const cards=crewSpecialties.map((role,index)=>{
    const d=details[index],count=roles[role.key]??0,reason=purchaseBlockReason({docked,money:c.getBank(),cost:role.cost,full:free===0});
    const leaveReason=!docked?'Vuelve a tu puerto':!count?'No hay especialistas de este oficio':p.crew<=1?'El último pirata se queda a bordo':'';
    return `<article class="harbor-card crew-specialty" data-item="${role.id}"><div class="harbor-card-art"><img src="${art(d.image)}" alt="${role.name}" loading="eager"></div><div class="harbor-card-copy"><h3>${role.name}</h3><p>${d.desc}</p><div class="crew-benefits">${d.benefits.map(([glyph,text])=>`<div>${icon(glyph)}<span>${esc(text)}</span></div>`).join('')}</div><div class="crew-contract-price">${icon('coin')}<span>Contratar · <b>${role.cost}</b> oro</span></div><div class="crew-count-control"><button data-order="dismiss:${role.id}" aria-label="Desembarcar ${role.name}" title="${esc(leaveReason||'Desembarcar un especialista. Sin reembolso.')}" ${leaveReason?'disabled':''}>−</button><output aria-label="${role.name} a bordo">${count}</output><button data-order="${role.id}" aria-label="Contratar ${role.name}" aria-describedby="crew-lock-${role.id}" title="${esc(reason||`Contratar un especialista por ${role.cost} oro. Ocupa una plaza.`)}" ${reason?'disabled':''}>+</button></div><div id="crew-lock-${role.id}" class="crew-contract-lock" ${reason?'':'aria-hidden="true"'}>${esc(reason||'')}</div></div></article>`;
  }).join('');
  return `<div class="crew-canvas"><div class="crew-specialty-grid">${cards}</div><section class="crew-manifest" aria-label="Distribución de la tripulación"><div class="crew-manifest-title">${icon('crew')}<span><strong>Tripulación total</strong><small>Bonos por pirata. − desembarca sin reembolso.</small></span></div><div class="crew-capacity"><strong>${p.crew} <span>/ ${p.maxCrew}</span></strong><small>${mariners} ${mariners===1?"marinero":"marineros"} · ${free} ${free===1?"plaza libre":"plazas libres"}</small><progress aria-label="Plazas de tripulación" value="${p.crew}" max="${p.maxCrew}"></progress></div>${crewSpecialties.map((role,i)=>`<div class="crew-manifest-role">${icon(details[i].glyph)}<b>${roles[role.key]??0}</b><small>${role.name}</small></div>`).join('')}</section><details class="crew-provisions"${c.provisionsExpanded?' open':''}><summary>Provisiones · ron y marineros</summary><div class="crew-supplies"><div class="crew-general"><span><strong>Marineros</strong><small>Tripulación sin especialidad</small></span>${purchase(c,'recruit','Contratar',15,{name:'Marinero',full:free===0,inlinePrice:true})}</div><div class="crew-rum-supply">${icon('rum')}<span><strong>Ron de la casa</strong><small>${c.voyage.rumCharges} / 3 raciones · C: moral extra, 7 s</small></span>${purchase(c,'rum','Reponer',35,{restriction:c.voyage.rumCharges>=3?'Bodega de ron completa':'',inlinePrice:true})}</div></div></details></div>`;
}
function ship(c) {
  const p=c.player;
  return section('Preparado para otra mala idea',p.name)+`<div class="harbor-card-grid">${[
    {id:'hull',title:'Casco reforzado',desc:'Más madera entre tu tripulación y el fondo del mar.',image:art('guard-card'),benefit:p.upgrades.hull>=3?`${p.maxHp} casco · blindaje completo`:`${p.maxHp} → ${p.maxHp+35} casco · reparación completa`},
    {id:'cannons',title:'Cañones navales',desc:'Una andanada más contundente, con tiempo para que el rival se arrepienta.',image:art('cannon-upgrade-card'),benefit:p.upgrades.cannons>=3?`${p.damage} daño · cañones al máximo`:`${p.damage} → ${p.damage+upgradeDefinitions.cannons.damage} daño · recarga −6,5 %`},
    {id:'crew',title:'Una cubierta mayor',desc:'Cuatro plazas nuevas para piratas de dudosa reputación.',image:art('expanded-deck-card-v2'),benefit:p.upgrades.crew>=3?`${p.maxCrew} plazas · cubierta completa`:`${p.maxCrew} → ${p.maxCrew+4} plazas de tripulación`},
  ].map(x=>card(c,{...x,id:'ship:'+x.id,badge:`Nivel ${p.upgrades[x.id]} / 3`,cost:upgradeCost(x.id,p.upgrades[x.id]),label:'Mejorar',options:{maxed:p.upgrades[x.id]>=3}})).join('')}</div>`;
}
function weapons(c) {
  const names=['Cañones','Balas encadenadas','Brasas','Morteros','Fuego griego','Arpones'];
  const desc=['Andanada principal para destrozar cascos.','Rompen velas y reducen la velocidad enemiga.','Proyectiles ardientes para incendiar un casco.','Disparo en arco para castigar a distancia.','Crea zonas ardientes sobre el agua.','Atrapa un barco rival y acércalo para abordar.'];
  const glyph=['v2/cannon','chain','v2/fire','bomb','v2/fire','harpoon'];
  const weaponTiles=[0,1,2,3,2,5];
  const selected=Math.max(0,Math.min(5,Number(c.selectedWeapon??0))),level=selected<4?c.weaponLevels[selected]:selected===4?c.greekLevel:0,p=c.player;
  let stats='',next='';
  if(selected<4){const w=weaponProfiles[selected];stats=stat('Daño',(p.damage*w.damage*(1+level*.08)).toFixed(1),p.damage*w.damage*(1+level*.08)/70,'cannon')+stat('Alcance',w.range+' m',w.range/55,'spyglass')+stat('Recarga',cannonReload(p,w.reload).toFixed(2)+' s',1-w.reload/3,'wheel');next='+8 % del daño base de esta munición';if(selected===1)stats+=stat('Velas ralentizadas',(5+level)+' s',(5+level)/10,'chain');if(selected===2)stats+=stat('Incendio',(2+level*.5)+' daño / s',.4+level*.1,'fire');if(selected===3)stats+=stat('Radio de explosión','5,5 m',.65,'bomb');}
  else if(selected===4){stats=stat('Emisión',(4+level*.75).toFixed(2)+' s',.55+level*.1,'fire')+stat('Fuego sobre el agua',greekFireRules.linger+' s',.8,'rum')+stat('Daño de incendio',(greekFireRules.damage+level*.75).toFixed(2)+' / s',.55+level*.08,'fire')+stat('Recarga',(26-level*2)+' s',.5+level*.08,'wheel');next='+0,75 s de emisión · +0,75 daño / s · −2 s de recarga';}
  else{stats=stat('Alcance',grappleDefaults.range+' m',grappleDefaults.range/55,'spyglass')+stat('Atracción',grappleDefaults.reelSpeed+' m/s',.7,'hook')+stat('Cabo resistente',grappleDefaults.timeout+' s',.75,'wheel');next='Q lanza el garfio. Pulsa Q de nuevo para soltar.';}
  const list=names.map((name,i)=>{
    const itemLevel=i<4?c.weaponLevels[i]:i===4?c.greekLevel:0;
    return `<button data-weapon="${i}" aria-pressed="${i===selected}" class="${i===selected?'selected':''}"><span class="weapon-tile" aria-hidden="true" style="--tile-x:${weaponTiles[i]%3*50}%;--tile-y:${Math.floor(weaponTiles[i]/3)*100}%"></span><span class="arsenal-list-copy"><strong>${esc(name)}</strong><small>${esc(desc[i])}</small></span><span class="arsenal-list-level">${i===5?'A bordo':`Nivel ${roman(itemLevel)}`}</span><span class="arsenal-arrow" aria-hidden="true">›</span></button>`;
  }).join('');
  const action=selected===5?'<div class="harbor-equipped">Equipado · Q para lanzar</div>':purchase(c,selected<4?`weapon:${selected}`:'greek','Mejorar',weaponCost(level),{maxed:level>=3,inlinePrice:true});
  const heading=selected===5?'El cabo está listo':level>=3?'Arsenal completo':`Siguiente nivel (${roman(level+1)})`;
  const banner=selected===0?`<img src="${art('cannon-banner-reference-style')}" alt="">`:`<span class="weapon-tile" aria-hidden="true" style="--tile-x:${weaponTiles[selected]%3*50}%;--tile-y:${Math.floor(weaponTiles[selected]/3)*100}%"></span>`;
  return section('Mejorar arsenal')+`<div class="harbor-arsenal">
    <div class="arsenal-list" role="group" aria-label="Municiones">${list}</div>
    <article class="arsenal-detail"><div class="arsenal-hero ${selected===0?'':'arsenal-hero-icon'}">${banner}</div>
      <div class="arsenal-detail-copy"><div class="arsenal-detail-title"><h3>${esc(names[selected])}</h3><span class="harbor-badge">${selected===5?'A bordo':`Nivel ${roman(level)}`}</span></div>
        <p>${esc(desc[selected])}</p><div class="arsenal-stats">${stats}</div>
        <div class="arsenal-next"><h4>${heading}</h4><p>${level>=3?'Ahora el problema es del otro barco.':esc(next)}</p>${action}</div>
      </div>
    </article>
  </div>`;
}
function island(c) {
  const i=c.selectedIsland=c.selectIsland();if(!i)return '<div class="harbor-empty"><h3>Tierra a la vista. Primero.</h3><p>Acércate a una isla descubierta para visitar sus defensas.</p></div>';
  const own=i.owner===c.player.team,near=Math.hypot(c.player.x-i.x,c.player.z-i.z)<i.r+22,restriction=!own?(i.owner==='neutral'?'Conquista esta isla':'Esta isla pertenece al rival'):!near?'Acércate a esta costa':i.invasion?'Defiende el desembarco primero':'';
  c.art??={};const key=`island:${i.name}:${i.owner}:${i.artRevision??0}`;c.art[key]??=renderModelPortrait(i.group,700,{aspect:1.6});
  const cap=garrisons[i.garrisonLevel],missing=Math.max(0,cap-i.defenders),land={land:true,restriction};
  const reinforcement=missing?purchase(c,'reinforce','Reponer',missing*8,{...land,name:'Guarnición'}):'';
  return section(i.name,i.homeTeam?'Isla base':'Territorio')+`<div class="harbor-island-layout"><article class="harbor-island-view"><img src="${c.art[key]}" alt="${esc(i.name)}"><h3>${own?'Aquí ondea tu bandera':i.owner==='neutral'?'Sin reclamar':'Bandera rival'}</h3><p>${i.defenders} / ${cap} defensores · ${i.invasion?'Desembarco en curso':'Costa en calma'}</p></article><div class="harbor-defense-list"><article><div>${icon('crew')}<span><h3>Guarnición</h3><p>${i.defenders} / ${cap} piratas en tierra. No ocupan plazas del barco.</p></span><b>Nivel ${i.garrisonLevel} / 4</b></div><p class="harbor-benefit">${i.garrisonLevel>=4?'16 plazas máximas':`${garrisons[i.garrisonLevel+1]} plazas al mejorar`}</p>${purchase(c,'garrison','Mejorar',garrisonCost(i.garrisonLevel),{...land,maxed:i.garrisonLevel>=4,name:'Guarnición'})}${reinforcement}</article><article><div>${icon('shield')}<span><h3>Torre costera</h3><p>${i.tower&&!i.tower.dead?`${Math.ceil(i.tower.hp)} / ${i.tower.maxHp} casco`:'Sin torre operativa'} · protege el desembarco</p></span></div>${!i.tower||i.tower.dead?purchase(c,'tower','Construir',110,{...land,name:'Torre costera'}):`<div class="harbor-tower-upgrades">${[['damage','Daño',`${6+i.towerUpgrades.damage*3} → ${9+i.towerUpgrades.damage*3}`],['range','Alcance',`${27+i.towerUpgrades.range*5} → ${32+i.towerUpgrades.range*5} m`],['rate','Recarga',`${(5.5-i.towerUpgrades.rate*.8).toFixed(1)} → ${Math.max(2.5,4.7-i.towerUpgrades.rate*.8).toFixed(1)} s`]].map(([key,name,value])=>`<section><h4>${name} <small>${i.towerUpgrades[key]} / 3</small></h4><p>${value}</p>${purchase(c,'tower:'+key,'Mejorar',towerCost(i.towerUpgrades[key]),{...land,maxed:i.towerUpgrades[key]>=3,name:name+' de torre'})}</section>`).join('')}</div>`}</article></div></div>`;
}

export function renderHarbor(c) {
  const oldFleet=$('company-content').querySelector('.harbor-active-fleet');
  if(oldFleet)c.fleetExpanded=oldFleet.open;
  const oldProvisions=$('company-content').querySelector('.crew-provisions');
  if(oldProvisions)c.provisionsExpanded=oldProvisions.open;
  const p=c.player,active=c.living('scout').length+c.living('guard').length;
  $('captain-dialog').dataset.tab=c.currentTab;
  $('company-title').textContent=titles[c.currentTab];$('company-quip').textContent=quips[c.currentTab];
  document.querySelector('blockquote>span').textContent=c.currentTab==='weapons'?'EL ARSENAL':'PUERTO RON RON';
  document.querySelector('.harbor-scene').src=art('harbor-port');
  document.querySelector('.harbor-illustration>img').src=art(c.currentTab==='weapons'?'arsenal-hero-reference-style':'harbor-hero');
  $('company-wallet').innerHTML=`<span class="harbor-wallet-gold">${icon('coin')}<b>${c.getBank().toLocaleString('es-ES')}</b><span>oro en caja</span></span><span class="harbor-docked">${c.inPort()?'En tu puerto':'En alta mar'}</span><span class="harbor-wallet-crew">${icon('crew')}<b>${c.currentTab==='fleet'?`${active} / ${balance.scoutLimit+balance.guardLimit}`:`${p.crew} / ${p.maxCrew}`}</b><span>${c.currentTab==='fleet'?'barcos secundarios':'tripulantes'}</span></span>`;
  document.querySelectorAll('#captain-dialog [data-tab]').forEach(b=>{const yes=b.dataset.tab===c.currentTab;b.classList.toggle('selected',yes);b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1;});
  $('company-content').setAttribute('aria-labelledby','company-tab-'+c.currentTab);$('company-content').innerHTML=({ship,crew,weapons,fleet,island}[c.currentTab]??fleet)(c);
  $('company-note').textContent=c.feedback??'';
}
