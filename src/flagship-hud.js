import { icon } from './hud-art.js';
import { flagshipState, flagshipChange } from './flagship-state.js';
import { HudPortraitSea } from './hud-portrait-sea.js';
import './flagship-hud.css';

export function mountFlagshipHUD(host) {
  host.id = 'flagship-hud'; host.setAttribute('aria-label', 'Estado de tu barco');
  host.innerHTML = `
    <div class="flagship-body">
      <div class="flagship-portrait-frame">
        <div class="flagship-portrait-window" aria-hidden="true"><img id="ship-portrait" alt=""></div>
        <div class="flagship-rank"><small>RANGO</small><b id="rank-medal">1</b></div>
      </div>
      <div class="flagship-instruments">
        <header class="flagship-heading"><span>TU BERGANTÍN<span class="flagship-compact-rank"> · RANGO <b id="flagship-compact-rank">1</b></span></span><h2 id="flagship-name">La Indomable</h2></header>
        <div class="flagship-hull">
          <div class="flagship-stat-line"><span>${icon('shield')} CASCO</span><strong id="health-text">160 <small>/ 160</small></strong></div>
          <div id="flagship-hull-meter" class="flagship-health-track" role="progressbar" aria-label="Integridad del casco" aria-valuemin="0" aria-valuemax="160" aria-valuenow="160"><i id="flagship-health-echo"></i><i id="health-bar"></i></div>
          <div class="flagship-condition-line"><span id="flagship-condition">Listo para zarpar</span><b id="flagship-delta" aria-hidden="true"></b></div>
        </div>
        <div class="flagship-crew"><div class="flagship-stat-line"><span>${icon('crew')} TRIPULACIÓN</span><strong><b id="crew">8</b><small> / <span id="max-crew">12</span></small></strong></div><div id="crew-dots" class="flagship-roster" aria-hidden="true"></div></div>
      </div>
    </div>
    <footer class="flagship-footer">
      <div class="flagship-rig"><span>VELAS</span><b id="flagship-rig">100<small>%</small></b></div>
      <div class="flagship-experience"><div><span class="flagship-label-full">EXPERIENCIA</span><span class="flagship-label-short" aria-label="Experiencia">EXP.</span><b id="ship-level">0 / 80</b></div><div class="flagship-experience-track"><i id="experience-bar"></i></div></div>
      <div class="flagship-speed"><span>NUDOS</span><b id="flagship-speed">0.0</b></div>
    </footer>
    <span class="flagship-hit-sheen" aria-hidden="true"></span><span class="flagship-rank-shine" aria-hidden="true"></span>
    <span class="flagship-announcement" role="status" aria-live="polite"></span>`;
  const find = id => host.querySelector(`#${id}`);
  const portrait = find('ship-portrait'), seaContainer = host.querySelector('.flagship-portrait-window');
  const sea = new HudPortraitSea(seaContainer), motion = matchMedia('(prefers-reduced-motion: reduce)');
  const refs = Object.fromEntries(['flagship-name','health-text','health-bar','flagship-health-echo','flagship-hull-meter','flagship-condition','flagship-delta','crew','max-crew','crew-dots','rank-medal','flagship-compact-rank','flagship-rig','ship-level','experience-bar','flagship-speed'].map(id=>[id,find(id)]));
  let previous, state, rosterKey = '', impact = 0, deltaAnimation, hitAnimation, rankAnimation, repairAnnounced = false;
  const observer = new ResizeObserver(() => {
    document.body.style.setProperty('--flagship-height', `${host.getBoundingClientRect().height}px`);
    const box = seaContainer.getBoundingClientRect(); sea.resize(box.width, box.height);
  });
  observer.observe(host);
  function text(id, value) { const element = refs[id]; if (element.textContent !== String(value)) element.textContent = value; }
  function animateChange(change) {
    if (!change) return;
    if (change.kind === 'damage') {
      impact = 1;
      text('flagship-delta', `−${change.value}`); refs['flagship-delta'].dataset.kind = 'damage';
      deltaAnimation?.cancel();
      deltaAnimation = refs['flagship-delta'].animate(motion.matches ? [{opacity:1},{opacity:0}] : [{opacity:1,transform:'translateY(2px)'},{opacity:1,offset:.55,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}], {duration:1100,fill:'both'});
      if (!motion.matches) {
        hitAnimation?.cancel();
        hitAnimation = host.querySelector('.flagship-hit-sheen').animate([{opacity:.38},{opacity:0}],{duration:430,easing:'ease-out'});
      }
    } else if (change.kind === 'rank') {
      host.querySelector('.flagship-announcement').textContent = `Nuevo rango: ${change.value}`;
      if (!motion.matches) {
        rankAnimation?.cancel();
        rankAnimation = host.querySelector('.flagship-rank-shine').animate([{transform:'translateX(-120%)',opacity:0},{opacity:.55,offset:.25},{transform:'translateX(180%)',opacity:0}],{duration:1200,easing:'ease-out'});
        refs['rank-medal'].animate([{transform:'scale(1)'},{transform:'scale(1.22)',offset:.35},{transform:'scale(1)'}],{duration:560});
      }
    }
  }
  return {
    update(player, options) {
      state = flagshipState(player, options);
      const change = flagshipChange(previous, state);
      host.dataset.condition = state.condition;
      text('flagship-name', state.name); refs['flagship-name'].title = state.name;
      // Native text owns the numbers; the ornamental portrait cannot overlap them.
      const hpText = `${Math.ceil(state.hp)} / ${state.maxHp}`;
      if (refs['health-text'].dataset.value !== hpText) { refs['health-text'].innerHTML = `${Math.ceil(state.hp)} <small>/ ${state.maxHp}</small>`; refs['health-text'].dataset.value = hpText; }
      for (const id of ['health-bar','flagship-health-echo']) refs[id].style.transform = `scaleX(${state.hull})`;
      if(!previous||state.hp!==previous.hp||state.maxHp!==previous.maxHp)refs['flagship-health-echo'].classList.toggle('instant', !previous || state.hp > previous.hp || state.maxHp !== previous.maxHp);
      refs['flagship-hull-meter'].setAttribute('aria-valuemax', state.maxHp);
      refs['flagship-hull-meter'].setAttribute('aria-valuenow', Math.ceil(state.hp));
      refs['flagship-hull-meter'].setAttribute('aria-valuetext', `${Math.ceil(state.hp)} de ${state.maxHp} de casco`);
      text('flagship-condition', state.label); refs['flagship-condition'].title = state.label;
      if (previous && previous.condition !== state.condition && ['critical','burning','sunk'].includes(state.condition)) host.querySelector('.flagship-announcement').textContent = state.label;
      text('crew', state.crew); text('max-crew', state.maxCrew);
      const key = `${state.crew}:${state.maxCrew}`;
      if (key !== rosterKey) {
        rosterKey = key; const slots = Math.min(32, state.maxCrew);
        const filled = state.maxCrew <= 32 ? state.crew : state.crew / state.maxCrew * slots;
        refs['crew-dots'].innerHTML = Array.from({length:slots},(_,i)=>`<i style="--occupied:${Math.max(0,Math.min(1,filled-i))}"></i>`).join('');
      }
      text('rank-medal', state.rank); text('flagship-compact-rank', state.rank); refs['rank-medal'].title = `Rango ${state.rank}`;
      if (!previous || Math.round(previous.rig*100) !== Math.round(state.rig*100)) refs['flagship-rig'].innerHTML = `${Math.round(state.rig*100)}<small>%</small>`;
      refs['flagship-rig'].dataset.damaged = String(state.rig < .35);
      text('ship-level', `${state.xp} / ${state.xpGoal}`);
      refs['experience-bar'].style.transform = `scaleX(${state.experience})`;
      text('flagship-speed', state.speed.toFixed(1));
      if (state.condition === 'repairing' && !repairAnnounced) { repairAnnounced = true; host.querySelector('.flagship-announcement').textContent = 'Reparando el casco en puerto'; }
      if (state.condition !== 'repairing') repairAnnounced = false;
      animateChange(change); sea.setState(state, impact); previous = state;
    },
    frame(time, dt, { lowQuality = false, visible = true } = {}) {
      if (!state) return;
      impact = Math.max(0, impact - dt * 2.6);
      sea.uniforms.uDamage.value = motion.matches ? 0 : impact;
      sea.frame(time, dt, { reduced: motion.matches, lowQuality, visible });
      if (!visible) return;
      const t = motion.matches || state.condition === 'sunk' ? 0 : time;
      portrait.style.transform = `translateY(${Math.sin(t*1.2)*1.25}px) rotate(${Math.sin(t*.75)*.65}deg)`;
    },
    dispose() { observer.disconnect(); sea.dispose(); deltaAnimation?.cancel(); hitAnimation?.cancel(); rankAnimation?.cancel(); },
  };
}
