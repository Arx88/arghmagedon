import * as THREE from 'three';
import { damp } from './navigation.js';
import { seaHeight } from './sea-state.js';

export const climates = {
  clear: { name: 'Brisa corsaria', subtitle: 'Mar tranquilo. Conciencia discutible.', storm: 0, snow: 0, sun: 2.4, ambient: 1.6, color: 0xffe7ae, water: [1, 1, 1] },
  golden: { name: 'Último ron del sol', subtitle: 'La hora dorada de las malas decisiones.', storm: .08, snow: 0, sun: 2.65, ambient: 1.45, color: 0xffbd78, water: [1.1, .95, .82] },
  storm: { name: 'La rabieta de Neptuno', subtitle: 'El cielo también trae cañones.', storm: 1, snow: 0, sun: .85, ambient: 1, color: 0x9db9d3, water: [.62, .78, .88] },
  snow: { name: 'Aliento del Norte', subtitle: 'Se congela el ron. Eso sí es una tragedia.', storm: .35, snow: 1, sun: 1.55, ambient: 1.55, color: 0xdbeaff, water: [.78, .98, 1.06] },
  night: { name: 'Turno de los fantasmas', subtitle: 'Si brilla debajo del agua, no es propina.', storm: .12, snow: 0, sun: .65, ambient: .65, color: 0x9eb5e7, water: [.45, .64, .8] },
};
export class Weather {
  constructor(scene, sun, ambient, ocean, announce) {
    Object.assign(this, { scene, sun, ambient, ocean, announce }); this.mode = 'clear'; this.storm = 0; this.snow = 0; this.precipitation = 0; this.flash = 0; this.lightningIn = 10; this.time = 0;
    const positions = new Float32Array(700 * 6); this.drops = Array.from({ length: 700 }, () => ({ x: (Math.random() - .5) * 150, y: Math.random() * 50, z: (Math.random() - .5) * 120 }));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc5e1e4, transparent: true, opacity: 0, depthWrite: false })); this.rain.frustumCulled = false; scene.add(this.rain);
    const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(450 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.flakes = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false })); this.flakes.frustumCulled = false; scene.add(this.flakes);
    this.bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xedfaff, transparent: true, opacity: 0, toneMapped: false })); this.bolt.frustumCulled = false; scene.add(this.bolt);
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  set(mode) { if (!climates[mode]) return; this.mode = mode; this.announce(climates[mode].name, climates[mode].subtitle, 'weather'); }
  cycle() { const modes = Object.keys(climates); this.set(modes[(modes.indexOf(this.mode) + 1) % modes.length]); }
  update(dt, focus) {
    this.time += dt; const target = climates[this.mode]; this.storm = damp(this.storm, target.storm, .8, dt); this.snow = damp(this.snow, target.snow, .8, dt);
    this.sun.intensity = damp(this.sun.intensity, target.sun + this.flash * 3, 3, dt); this.ambient.intensity = damp(this.ambient.intensity, target.ambient + this.flash * .6, 2, dt);
    this.sun.color.lerp(new THREE.Color(target.color), 1 - Math.exp(-dt * .8));
    const cloudTint = new THREE.Color({ clear: 0xffffff, golden: 0xffe1b5, storm: 0x77909e, snow: 0xc7d9e1, night: 0x56758e }[this.mode]);
    this.scene.userData.clouds?.forEach(c => c.material.color.lerp(cloudTint, 1 - Math.exp(-dt * .8)));
    this.ocean.lightTint.value.lerp(new THREE.Color(...target.water), 1 - Math.exp(-dt * .8)); this.ocean.storm.value = this.storm;
    this.precipitation = damp(this.precipitation, this.mode === 'storm' ? 1 : 0, .8, dt);
    const rain = this.rain.geometry.attributes.position, snow = this.flakes.geometry.attributes.position;
    this.rain.visible = this.precipitation > .02; this.flakes.visible = this.snow > .02;
    this.rain.material.opacity = this.precipitation * .42; this.flakes.material.opacity = this.snow * .9;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i]; d.y -= dt * (this.snow > .5 ? 3.5 : 32); d.x -= dt * (this.snow > .5 ? 1.5 : 8);
      if (d.y < 0) d.y += 50; if (d.x < -75) d.x += 150;
      rain.setXYZ(i * 2, focus.x + d.x, d.y, focus.z + d.z); rain.setXYZ(i * 2 + 1, focus.x + d.x + .35, d.y + 1.8, focus.z + d.z);
      if (i < 450) snow.setXYZ(i, focus.x + d.x + Math.sin(this.time + i) * .65, d.y, focus.z + d.z);
    }
    rain.needsUpdate = snow.needsUpdate = true;
    this.flash = Math.max(0, this.flash - dt * 3.3); this.lightningIn -= dt;
    if (this.mode === 'storm' && this.lightningIn <= 0 && !this.reducedMotion) {
      this.lightningIn = 9 + Math.random() * 9; this.flash = .8;
      const x = focus.x + (Math.random() - .5) * 80, z = focus.z - 30;
      const points = []; for (let i = 0; i < 9; i++) points.push(new THREE.Vector3(x + (Math.random() - .5) * 4, 38 - i * 4.6, z + (Math.random() - .5) * 2));
      this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }
    this.bolt.material.opacity = this.flash; document.getElementById('lightning').style.opacity = String(this.flash * .22);
    document.getElementById('weather-name').textContent = target.name;
  }
  wave(x, z, t) { return seaHeight(x,z,t,this.storm,this.ocean.islands.value); }
}


