import { drawNauticalMap,renderModelPortrait } from './hud.js';

const islandTales={
  'Puerto Ron Ron':'El único lugar donde tu oro está a salvo. Tu dignidad se queda en la puerta.',
  'Bastión del Mal Aliento':'Cinco guardianes, un tesoro y ninguna intención de lavarse los dientes.',
  'El Último Amarre':'Un naufragio se volvió monumento. Sus dueños aún discuten la factura.',
  'Cayo del Contrabando':'Casitas de colores, muelles torcidos y negocios perfectamente sospechosos.',
  'Las Calderas del Diablo':'El suelo hierve. Los cofres, por suerte, no tienen piernas.',
  'Fuerte del Diente Roto':'Una fortaleza corsaria: destruye la torre antes de desembarcar.',
  'Isla de las Malas Decisiones':'Tiene taberna, ruinas y oro. Exactamente en ese orden.',
  'Los Colmillos del Norte':'Nieve en las botas y tesoros congelados. Trae ron por motivos científicos.',
};

// Routes are ordinary player commands; exploration still governs what can be seen.
export class Expeditions {
  constructor(ctx){
    Object.assign(this,ctx);this.destination=null;this.portraits=new Map();this.clock=0;
    const dialog=document.createElement('dialog');dialog.id='chart-dialog';dialog.setAttribute('aria-label','Carta de expediciones');
    dialog.innerHTML='<button class="close" aria-label="Cerrar carta">×</button><div class="eyebrow">LAS NOTAS DE PEPA CATALEJOS</div><h2>El mar no guarda secretos.</h2><p>Tu base se defiende. La rival se conquista. El resto, que lo descubra Pepa.</p><div class="chart-layout"><canvas id="voyage-map" width="800" height="800" aria-label="Archipiélago descubierto"></canvas><div id="chart-destinations"></div></div>';
    document.body.appendChild(dialog);dialog.querySelector('.close').onclick=()=>dialog.close();
    const open=document.createElement('button');open.id='chart-open';open.textContent='Tab';open.title='Abrir la carta de expediciones';open.setAttribute('aria-label','Abrir la carta de expediciones');document.querySelector('.map-panel').insertBefore(open,document.getElementById('map-mode'));
    open.onclick=()=>this.open();
    const status=document.createElement('p');status.id='route-status';status.setAttribute('role','status');document.querySelector('.map-panel').appendChild(status);
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-destination]');if(b){const i=this.islands[Number(b.dataset.destination)];dialog.close();this.setCourse(i);}});
    window.addEventListener('keydown',e=>{if(e.code==='Tab'&&!e.target.closest('dialog')&&!this.locked()){e.preventDefault();this.open();}});
  }
  open(){if(this.player.dead)return;this.clearInput();this.render();document.getElementById('chart-dialog').showModal();}
  setCourse(island){
    if(!island?.discovered||this.locked()||this.player.dead)return;
    if(this.islands.some(i=>i.invasion?.source===this.player)||this.isBusy())return this.toast('Termina el desembarco antes de poner otro rumbo.');
    this.destination=island;
    // The berth remains beyond the collision envelope even for the largest hull.
    this.player.target={x:island.x+island.r*.35,z:island.z+island.r*.72+9};
    this.toast(island.type==='port'?'Rumbo a Ron Ron. El tabernero ya está contando tus monedas.':`Rumbo a ${island.name}. ¡Que el tesoro nos encuentre trabajando!`);
    this.engage();
  }
  render(){
    const list=document.getElementById('chart-destinations');
    list.innerHTML=this.islands.filter(i=>i.discovered).sort((a,b)=>(a.type==='port'?-1:b.type==='port'?1:Math.hypot(a.x-this.player.x,a.z-this.player.z)-Math.hypot(b.x-this.player.x,b.z-this.player.z))).map(i=>{
      const portraitKey=[i.name,i.owner,i.garrisonLevel,i.artRevision??0].join(':');if(!this.portraits.has(portraitKey))this.portraits.set(portraitKey,renderModelPortrait(i.group,240));
      const dist=Math.round(Math.hypot(i.x-this.player.x,i.z-this.player.z));
      const reward=i.homeTeam?i.homeTeam===this.player.team?'Tu base · depositar y reparar':'Base rival · objetivo final':i.available?(i.treasureKnown?`${i.gold} oro`:'Tesoro por confirmar'):'Cofres agotados';
      const owner=i.owner==='blue'?'⚓ Velas Azules':i.owner==='red'?'⚔ Corsarios Rojos':'Costa neutral';
      return `<button class="destination ${i.homeTeam?'home-destination':''}" data-owner="${i.owner}" data-destination="${this.islands.indexOf(i)}"><img src="${this.portraits.get(portraitKey)}" alt=""><span><strong>${i.name}</strong><small>${dist} m · ${reward}<br>${owner}${i.defenders?' · '+i.defenders+' guardianes':''}${i.tower&&!i.tower.dead?' · Torre':''}</small></span></button>`;
    }).join('');
    drawNauticalMap(document.getElementById('voyage-map').getContext('2d'),{...this.mapState(),overview:true});
  }
  update(dt){
    this.clock+=dt;if(this.clock<.35)return;this.clock=0;
    const status=document.getElementById('route-status'),i=this.destination;
    if(!i){status.textContent='';return;}
    const d=Math.hypot(this.player.x-i.x,this.player.z-i.z);
    if(this.player.target){status.textContent=`Rumbo: ${i.name} · ${Math.round(d)} m`;return;}
    if(d>i.r+17){status.textContent='Timonel a tus órdenes · control manual';this.destination=null;return;}
    const inv=i.invasion;
    status.textContent=i.type==='port'?'Ron Ron: oro a salvo':inv?`Desembarco · ${Math.ceil(inv.duration-inv.progress)} s`:i.owner==='blue'?'E: saquear · J: defender':'E: desembarcar y conquistar';
    if(!i.arrivalSpoken){i.arrivalSpoken=true;this.director.speak('lookout',islandTales[i.name]??'Tierra firme. Cofres dudosos. ¡Y nadie cobrando entrada!',{priority:1,key:'arrival:'+i.name});}
  }
}
