import * as THREE from 'three';
import { box } from './world.js';
import { batchPaint } from './batch.js';

/** Sculpted small voxels, batched by articulated body part. */
export function sculpt(parent, radii, color, position = [0, 0, 0], cell = .3, underside = null) {
  const voxels = [], base = new THREE.Color(color), lower = new THREE.Color(underside ?? color);
  for (let x = -radii[0]; x <= radii[0]; x += cell) for (let y = -radii[1]; y <= radii[1]; y += cell) for (let z = -radii[2]; z <= radii[2]; z += cell) {
    const d = (x / radii[0]) ** 2 + (y / radii[1]) ** 2 + (z / radii[2]) ** 2;
    if (d > 1 || d < .62) continue;
    const tint = (y < -radii[1] * .22 ? lower : base).clone().multiplyScalar(.87 + Math.sin(x * 4 + z * 2) * .045 + (y / radii[1] + 1) * .11);
    voxels.push({ x, y, z, tint });
  }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(cell * 1.03, cell * 1.03, cell * 1.03), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .86 }), voxels.length);
  const matrix = new THREE.Matrix4(); voxels.forEach((v, i) => { matrix.makeTranslation(v.x, v.y, v.z); inst.setMatrixAt(i, matrix); inst.setColorAt(i, v.tint); });
  inst.position.set(...position); inst.castShadow = true; inst.receiveShadow = true; parent.add(inst); return inst;
}
function eye(g, x, y, z, color = 0xffd366) { box(g, .43, .32, .18, 0x203c36, x, y, z); const e = box(g, .23, .19, .22, color, x, y, z + .06); e.material = new THREE.MeshBasicMaterial({ color }); box(g, .075, .17, .04, 0x152d2c, x, y, z + .19); }

function kraken() {
  const root = new THREE.Group(); sculpt(root, [3, 2.15, 2.65], 0x754856, [0, .8, 0], .27, 0x99777b);
  sculpt(root, [2.25, 1.1, 1.6], 0x8c6068, [0, 2.05, -.25], .3);
  eye(root, -1.35, 1.35, 2.55); eye(root, 1.35, 1.35, 2.55);
  const tentacles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }), 8 * 24 * 6);
  tentacles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tentacles.frustumCulled = false; tentacles.castShadow = true; root.add(tentacles);
  const dummy = new THREE.Object3D(), purple = new THREE.Color(0x936874), sucker = new THREE.Color(0xd6aa9c);
  for (let i = 0; i < tentacles.count; i++) tentacles.setColorAt(i, i % 6 === 5 ? sucker : purple.clone().multiplyScalar(.8 + (i % 3) * .12));
  return { root, animate(t, dt, fx) {
    let index = 0;
    for (let arm = 0; arm < 8; arm++) for (let j = 0; j < 24; j++) {
      const f = j / 23, angle = arm * Math.PI / 4 + Math.sin(t * .4 + arm) * .15 + f * f * .9;
      const radius = 2 + f * 5.9, thick = .78 * (1 - f) + .12;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, y = -.3 + Math.sin(f * Math.PI * 1.45 + t * .7 + arm * .5) * f * 2.8 + f * f * 1.4;
      for (let part = 0; part < 6; part++) {
        const offset = [[0, 0], [-.35, 0], [.35, 0], [0, -.35], [0, .35], [0, -.5]][part];
        dummy.position.set(x + offset[0] * thick, y + offset[1] * thick, z); dummy.rotation.set(0, -angle, 0);
        dummy.scale.set(thick * (part === 5 ? .36 : .65), thick * (part === 5 ? .15 : .7), .38); dummy.updateMatrix(); tentacles.setMatrixAt(index++, dummy.matrix);
      }
    }
    tentacles.instanceMatrix.needsUpdate = true;
  } };
}

function whale() {
  const root = new THREE.Group(); sculpt(root, [2.25, 1.7, 5.5], 0x426a77, [0, .25, 0], .26, 0xc1c7b0);
  sculpt(root, [2.2, 1.2, 2.2], 0x527d83, [0, .5, -3.3], .28);
  const tail = new THREE.Group(); tail.position.set(0, .3, 5); root.add(tail);
  sculpt(tail, [2.9, .25, 1.4], 0x355664, [0, 0, .8], .23);
  const flippers = [];
  for (const side of [-1, 1]) { const f = new THREE.Group(); f.position.set(side * 1.8, -.1, -.8); root.add(f); sculpt(f, [1.9, .2, .9], 0x426a77, [side * 1.2, 0, 0], .22); flippers.push(f); box(root, .18, .16, .24, 0x132f38, side * 2.06, .6, -2.9); }
  let spray = 0;
  return { root, animate(t, dt, fx) { tail.rotation.x = Math.sin(t * 1.1) * .27; flippers.forEach((f, i) => f.rotation.z = Math.sin(t + i) * .18); spray += dt; if (spray > 7) { spray = 0; const p = root.localToWorld(new THREE.Vector3(0, 1.8, -2)); for (let i = 0; i < 26; i++) fx.emit('foam', p, { x: (Math.random() - .5) * 1.6, y: 3 + Math.random() * 7, z: (Math.random() - .5) * 1.6 }, .11 + Math.random() * .12, .7 + Math.random() * .6); } } };
}

function serpent(dragon = false) {
  const root = new THREE.Group(), segments = [], color = dragon ? 0x816145 : 0x477d6c;
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); root.add(g); sculpt(g, [1.15 - i * .065, .9 - i * .055, 1.2], color, [0, 0, 0], .27, dragon ? 0xc49c64 : 0xa0b29a); if (i < 7) { const fin = box(g, .15, .8 - i * .065, .55, dragon ? 0xb78e4c : 0x96a467, 0, .9 - i * .07); fin.rotation.x = -.3; } segments.push(g); }
  const neck = new THREE.Group(); root.add(neck);
  for (let i = 0; i < 9; i++) sculpt(neck, [.6, .5, .64], color, [Math.sin(i * .16) * .8, i * .48, -i * .25], .25, 0xb0b795);
  const head = new THREE.Group(); head.position.set(.8, 4.05, -2.1); neck.add(head); sculpt(head, [.85, .58, 1.05], color, [0, 0, 0], .2); sculpt(head, [.62, .25, .7], 0xa6ab81, [0, -.29, -.6], .2);
  for (const side of [-1, 1]) { const e = box(head, .18, .18, .3, dragon ? 0xf3aa56 : 0xe7d887, side * .7, .1, -.4); e.material = new THREE.MeshBasicMaterial({ color: dragon ? 0xffb65a : 0xe7d887 }); if (dragon) { const horn = box(head, .2, 1.1, .25, 0xe7d6a0, side * .6, .75, .25); horn.rotation.z = -side * .35; } }
  const wings = [];
  if (dragon) for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * .6, .4, 2.8); root.add(wing);
    sculpt(wing, [2.4, .2, 1.55], 0xa87951, [side * 1.9, 0, .1], .26, 0xb8956b);
    for (let i = 0; i < 4; i++) {
      const spine = box(wing, 2.6, .13, .13, 0xe0c289, side * 1.5, .2, -.85 + i * .5); spine.rotation.y = side * (i - 1.5) * .13;
    }
    wings.push(wing);
  }
  let breath = 0;
  const mouth = new THREE.Vector3();
  return { root, animate(t, dt, fx) {
    segments.forEach((g, i) => { g.position.set(Math.sin(t * .65 - i * .55) * 1.2, Math.sin(t * .7 - i * .7) * 1.1 - .3, i * 1.75); g.rotation.y = Math.cos(t * .65 - i * .55) * .25; });
    neck.rotation.z = Math.sin(t * .6) * .07; neck.rotation.y = Math.sin(t * .4) * .22;
    wings.forEach((wing, i) => wing.rotation.z = (i ? 1 : -1) * (.25 + Math.sin(t * .8) * .3));
    breath += dt;
    if (dragon && breath > .14) {
      breath = 0; head.getWorldPosition(mouth); mouth.y -= .2;
      fx.emit('smoke', mouth, { x: -.15, y: .5, z: -.65 }, .18, 1.1);
    }
  } };
}

export function createBestiary(scene) {
  const entries = [
    { name: 'Don Tentáculos', epithet: 'OCHO BRAZOS. CERO MODALES.', model: kraken(), x: 9, z: -33, hp: 300, gold: 100, xp: 70, scale: 1.45, hitWidth: 4.8, hitLength: 4.8 },
    { name: 'Doña Ballesta', epithet: 'LA DUEÑA DEL CARRIL CENTRAL', model: whale(), x: 22, z: 32, hp: 210, gold: 75, xp: 45, scale: 1, hitWidth: 2.7, hitLength: 6 },
    { name: 'Nessi la Morosa', epithet: 'DEBE TRES SIGLOS DE AMARRE', model: serpent(), x: -52, z: -18, hp: 240, gold: 85, xp: 55, scale: 1, hitWidth: 2, hitLength: 10 },
    { name: 'Barbacoa del Abismo', epithet: 'NO ACEPTA DEVOLUCIONES', model: serpent(true), x: 57, z: -8, hp: 280, gold: 95, xp: 65, scale: 1.1, hitWidth: 2.4, hitLength: 10 },
  ];
  for (const c of entries) { c.object = c.model.root; c.object.scale.setScalar(c.scale); batchPaint(c.object, true); c.object.position.set(c.x, 0, c.z); c.heading = c.name.startsWith('Doña') ? -.8 : -.3; c.object.rotation.y = c.heading; c.maxHp = c.hp; c.team = 'wild'; c.isCreature = true; c.dead = 0; c.vx = c.vz = 0; c.home = { x: c.x, z: c.z }; scene.add(c.object); }
  return { entries, update(time, dt, fx) { for (const c of entries) { if (c.dead) { c.dead -= dt; c.object.position.y = -Math.min(15, ((c.respawnDuration ?? 90) - c.dead) * .5); if (c.dead <= 0) { c.dead = 0; c.hp = c.maxHp; } continue; } c.model.animate(time, dt, fx); c.object.position.y = Math.sin(time * .65 + c.x) * .16; if (c.name.startsWith('Doña')) { c.x = c.home.x + Math.sin(time * .045) * 7; c.z = c.home.z + Math.cos(time * .045) * 4; c.vx = Math.cos(time * .045) * .315; c.vz = -Math.sin(time * .045) * .18; c.object.position.x = c.x; c.object.position.z = c.z; c.heading = -.8 + Math.sin(time * .045) * .2; c.object.rotation.y = c.heading; } } } };
}


