import './combat-juice.css';
import { comboTier } from './combat-feel.js';

const ARROWS = 6;
const MARKERS = 14;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/** Where a bearing lands on the elliptical ring that frames the ship. */
const bearingPoint = (angle, radius) => ({ x: 50 + Math.sin(angle) * radius, y: 50 - Math.cos(angle) * radius });

/**
 * Screen-space battle feedback. Everything here is decorative and pooled, so a
 * long fight allocates nothing and the layer never intercepts a click.
 */
export function mountCombatJuice(doc = document) {
  const root = doc.createElement('div');
  root.id = 'combat-juice';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `<div class="juice-layer juice-hurt"></div><div class="juice-layer juice-low"></div>
    <div class="juice-layer juice-crit"></div><div class="juice-arrows"></div><div class="juice-markers"></div>
    <div class="juice-target"><b></b><span></span><i><em></em></i></div>
    <div class="juice-combo"><b></b><small></small></div>
    <div class="juice-banner"><b></b><small></small></div>`;
  doc.body.appendChild(root);
  const pick = selector => root.querySelector(selector);
  const layers = { hurt: pick('.juice-hurt'), low: pick('.juice-low'), crit: pick('.juice-crit') };
  const comboEl = pick('.juice-combo'), comboValue = comboEl.querySelector('b'), comboTitle = comboEl.querySelector('small');
  const bannerEl = pick('.juice-banner'), bannerTitle = bannerEl.querySelector('b'), bannerSub = bannerEl.querySelector('small');
  const targetEl = pick('.juice-target'), targetName = targetEl.querySelector('b'), targetState = targetEl.querySelector('span'), targetFill = targetEl.querySelector('em');
  const arrowsEl = pick('.juice-arrows'), markersEl = pick('.juice-markers');

  const arrows = Array.from({ length: ARROWS }, () => {
    const el = doc.createElement('b'); const tag = doc.createElement('u');
    el.appendChild(tag); arrowsEl.appendChild(el); return { el, tag };
  });
  const markers = Array.from({ length: MARKERS }, () => { const el = doc.createElement('i'); markersEl.appendChild(el); return { el, life: 0 }; });
  let markerCursor = 0;

  const levels = { hurt: 0, threat: 0, crit: 0, low: 0, combo: 0, banner: 0 };
  let comboTone = 'salvo', comboPulse = 0, targetVisible = false, lastTargetName = '';

  function place(el, x, y) { el.style.left = `${x}px`; el.style.top = `${y}px`; }

  return {
    /** Directional damage vignette. `angle` is a screen bearing in radians. */
    hurt(angle, strength = 1) {
      const point = bearingPoint(angle, 26);
      layers.hurt.style.setProperty('--jx', `${point.x}%`);
      layers.hurt.style.setProperty('--jy', `${point.y}%`);
      layers.hurt.classList.remove('threat');
      levels.hurt = clamp(Math.max(levels.hurt, strength), 0, 1);
    },
    /** A rival volley is in the air: same bearing, amber instead of blood. */
    threat(angle) {
      const point = bearingPoint(angle, 20);
      layers.hurt.style.setProperty('--jx', `${point.x}%`);
      layers.hurt.style.setProperty('--jy', `${point.y}%`);
      layers.hurt.classList.add('threat');
      levels.threat = 1;
    },
    critical() { levels.crit = 1; },
    marker(x, y, crit = false) {
      const marker = markers[markerCursor++ % markers.length];
      marker.life = crit ? .45 : .3; marker.el.classList.toggle('crit', crit);
      place(marker.el, x, y);
    },
    combo(count, multiplier = 1) {
      if (count < 2) return;
      levels.combo = 1; comboPulse = 1;
      comboValue.textContent = `×${count}`;
      const tier = comboTier(count);
      comboTone = tier?.tone ?? 'salvo';
      comboTitle.textContent = tier?.title ?? `RACHA · +${Math.round((multiplier - 1) * 100)}% DAÑO`;
    },
    banner(title, subtitle = '', tone = '') {
      bannerTitle.textContent = title;
      bannerSub.textContent = subtitle;
      bannerEl.className = `juice-banner ${tone}`;
      levels.banner = 1;
    },
    target(info) {
      if (!info) { if (targetVisible) { targetEl.style.opacity = '0'; targetVisible = false; } return; }
      targetVisible = true;
      place(targetEl, info.x, info.y);
      targetEl.style.opacity = '1';
      targetEl.classList.toggle('burning', info.burning);
      if (info.name !== lastTargetName) { targetName.textContent = info.name.toUpperCase(); lastTargetName = info.name; }
      targetState.textContent = `${Math.ceil(info.hp)} / ${info.maxHp}${info.burning ? ' · ARDE' : ''}`;
      targetFill.style.width = `${clamp(info.hp / Math.max(1, info.maxHp), 0, 1) * 100}%`;
    },
    /** Off-screen threats, nearest first, as bearings relative to the ship. */
    arrows(list) {
      for (let i = 0; i < ARROWS; i++) {
        const arrow = arrows[i], item = list[i];
        if (!item) { if (arrow.el.classList.contains('on')) arrow.el.classList.remove('on'); continue; }
        const point = bearingPoint(item.angle, 38);
        arrow.el.style.left = `${point.x}%`;
        arrow.el.style.top = `${point.y}%`;
        arrow.el.style.setProperty('--d', `${item.angle * 180 / Math.PI}deg`);
        arrow.el.classList.toggle('creature', item.kind === 'creature');
        if (arrow.tag.textContent !== item.name) arrow.tag.textContent = item.name;
        arrow.el.classList.add('on');
      }
    },
    /**
     * Per-frame decay. `lowHull` is 0..1 danger from `lowHullLevel`.
     */
    frame(dt, { combo = 0, lowHull = 0 } = {}) {
      levels.hurt = Math.max(0, levels.hurt - dt * 2.4);
      levels.threat = Math.max(0, levels.threat - dt * 1.8);
      levels.crit = Math.max(0, levels.crit - dt * 3.2);
      levels.combo = combo > 0 ? 1 : Math.max(0, levels.combo - dt * .5);
      levels.banner = Math.max(0, levels.banner - dt * .8);
      comboPulse = Math.max(0, comboPulse - dt * 5);

      layers.hurt.style.opacity = String(Math.max(levels.hurt, levels.threat * .55));
      layers.crit.style.opacity = String(levels.crit * .8);
      layers.low.style.opacity = String(Math.max(lowHull * (.42 + Math.sin(performance.now() / 260) * .16), 0));
      comboEl.className = `juice-combo ${comboTone}`;
      comboEl.style.opacity = String(levels.combo);
      comboEl.style.transform = `translateY(${-comboPulse * 8}px) scale(${1 + comboPulse * .12})`;
      bannerEl.style.opacity = String(levels.banner);
      bannerEl.style.transform = `translateY(${(1 - levels.banner) * -14}px) scale(${1 + (1 - levels.banner) * .06})`;

      for (const marker of markers) {
        if (marker.life <= 0) continue;
        marker.life -= dt;
        if (marker.life <= 0) { marker.el.style.opacity = '0'; continue; }
        const t = marker.life / .45;
        marker.el.style.opacity = String(Math.min(1, t * 1.6));
        marker.el.style.transform = `scale(${1 + (1 - t) * .5}) rotate(${45 * (1 - t)}deg)`;
      }
    },
    destroy() { root.remove(); },
  };
}