import * as THREE from 'three';

export const grappleDefaults = Object.freeze({
  range: 32,
  breakRange: 42,
  boardingRange: 12.5,
  flightSpeed: 44,
  flightArc: 1.8,
  tightenTime: .22,
  reelSpeed: 7,
  timeout: 12,
  sourcePullShare: .5,
});

const point = p => ({ x: p.x, y: p.y ?? 2.3, z: p.z });
const alive = p => p && p.alive !== false && !p.dead && !p.destroyed && (p.hp == null || p.hp > 0);
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const anchor = p => point(p.anchor ?? p);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const noPull = () => ({ source: { x: 0, z: 0 }, target: { x: 0, z: 0 } });

/** Plain positions make flight, tension and reel behavior testable without a renderer. */
export function createGrappleState(source, target, options = {}) {
  const config = { ...grappleDefaults, ...options };
  if (!alive(source) || !alive(target)) return { ok: false, reason: 'invalid-target', state: null };
  if (![source.x, source.z, target.x, target.z].every(Number.isFinite)) return { ok: false, reason: 'invalid-position', state: null };
  const gap = distance(source, target);
  if (gap > config.range) return { ok: false, reason: 'out-of-range', state: null };
  const from = anchor(source), to = anchor(target);
  const flightDistance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  return { ok: true, state: {
    phase: 'flying', age: 0, flightAge: 0, phaseAge: 0, tension: 0,
    flightDuration: Math.max(.22, flightDistance / Math.max(1, config.flightSpeed)),
    launchPoint: from, hook: { ...from }, config, reason: null,
  } };
}

export function cancelGrappleState(state, reason = 'cancelled') {
  return state ? { ...state, phase: 'released', reason, tension: 0 } : null;
}

/** Returns bounded displacement instead of snapping the ships into boarding range. */
export function advanceGrappleState(previous, source, target, dt) {
  const pull = noPull();
  if (!previous || previous.phase === 'released') return { state: previous, event: null, pull };
  const elapsed = Math.max(0, Math.min(.25, Number.isFinite(dt) ? dt : 0));
  const state = { ...previous, hook: { ...previous.hook }, age: previous.age + elapsed, phaseAge: previous.phaseAge + elapsed };
  const released = reason => ({ state: cancelGrappleState(state, reason), event: 'released', reason, pull });
  if (!alive(source) || !alive(target)) return released('target-lost');
  const gap = distance(source, target), config = state.config;
  if (!Number.isFinite(gap)) return released('invalid-position');
  if (gap > config.breakRange) return released('rope-broken');
  if (state.age > config.timeout) return released('timeout');
  const endpoint = anchor(target);
  let event = null;

  if (state.phase === 'flying') {
    state.flightAge += elapsed;
    const progress = Math.min(1, state.flightAge / state.flightDuration);
    state.hook = lerp(state.launchPoint, endpoint, progress);
    state.hook.y += Math.sin(progress * Math.PI) * config.flightArc;
    if (progress >= 1) {
      state.phase = 'tightening'; state.phaseAge = 0; event = 'hit';
    }
  } else {
    state.hook = endpoint;
    if (state.phase === 'tightening') {
      state.tension = Math.min(1, state.phaseAge / Math.max(.001, config.tightenTime));
      if (state.tension >= 1) { state.phase = 'reeling'; state.phaseAge = 0; }
    } else if (state.phase === 'reeling') {
      state.tension = 1;
      const remaining = Math.max(0, gap - config.boardingRange);
      const travel = Math.min(remaining, config.reelSpeed * elapsed * (1 - Math.exp(-state.phaseAge * 7)));
      if (gap > .001 && travel > 0) {
        const nx = (target.x - source.x) / gap, nz = (target.z - source.z) / gap;
        const share = Math.max(.2, Math.min(.8, config.sourcePullShare));
        pull.source = { x: nx * travel * share, z: nz * travel * share };
        pull.target = { x: -nx * travel * (1 - share), z: -nz * travel * (1 - share) };
      }
      if (remaining - travel <= .04) { state.phase = 'boarding'; state.phaseAge = 0; event = 'ready'; }
    }
  }
  return { state, event, pull };
}

function actorSnapshot(actor, other) {
  const gap = Math.max(.001, distance(actor, other)), scale = actor.scale ?? 1;
  const edge = Math.min(2.05 * scale, gap * .25);
  const y = (actor.object?.position.y ?? 0) + 2.25 * scale;
  return {
    x: actor.x, z: actor.z, y, alive: !actor.dead && !actor.destroyed && (actor.hp == null || actor.hp > 0) && actor.object?.visible !== false,
    anchor: { x: actor.x + (other.x - actor.x) / gap * edge, y, z: actor.z + (other.z - actor.z) / gap * edge },
  };
}

function makeHook() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xa4afa7, metalness: .72, roughness: .34, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xcf9853, metalness: .35, roughness: .5 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 1.25, 7), metal);
  shaft.position.y = .3; group.add(shaft);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(.21, .055, 5, 12), metal);
  eye.position.y = -.43; group.add(eye);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .55, 0),
      new THREE.Vector3(Math.cos(angle) * .32, .62, Math.sin(angle) * .32),
      new THREE.Vector3(Math.cos(angle) * .62, .38, Math.sin(angle) * .62),
      new THREE.Vector3(Math.cos(angle) * .5, -.02, Math.sin(angle) * .5),
      new THREE.Vector3(Math.cos(angle) * .27, .1, Math.sin(angle) * .27),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, .075, 5, false), metal));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.105, .3, 5), metal);
    tip.position.set(Math.cos(angle) * .25, .13, Math.sin(angle) * .25); group.add(tip);
  }
  for (let i = 0; i < 4; i++) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(.125, .025, 4, 9), gold);
    wrap.rotation.x = Math.PI / 2; wrap.position.y = -.17 + i * .09; group.add(wrap);
  }
  group.scale.setScalar(1.25);
  return group;
}

/** Reusable scene component. Call update after navigation and before rendering. */
export class GrapplingHook {
  constructor(scene, options = {}) {
    this.options = options; this.state = null; this.source = null; this.target = null; this.disposed = false;
    this.group = new THREE.Group(); this.group.name = 'boarding-grappling-hook'; this.group.visible = false; scene.add(this.group);
    this.hook = makeHook(); this.group.add(this.hook);
    this.segments = 32;
    const positions = new Float32Array((this.segments + 1) * 3);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rope = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffd995 }));
    this.rope.frustumCulled = false; this.group.add(this.rope);
    this.cable = new THREE.InstancedMesh(new THREE.CylinderGeometry(.066, .066, 1, 5), new THREE.MeshStandardMaterial({ color: 0xbd914f, roughness: .88 }), this.segments);
    this.cable.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.cable.frustumCulled = false; this.group.add(this.cable);
    this.transform = new THREE.Object3D(); this.start = new THREE.Vector3(); this.end = new THREE.Vector3();
    this.direction = new THREE.Vector3(); this.axis = new THREE.Vector3(0, 1, 0); this.previousHook = new THREE.Vector3();
  }

  get active() { return !!this.state && this.state.phase !== 'released'; }
  get phase() { return this.state?.phase ?? 'idle'; }
  get range() { return this.options.range ?? grappleDefaults.range; }

  launch(source, target) {
    if (this.disposed) return { ok: false, reason: 'disposed' };
    if (this.active) return { ok: false, reason: 'busy' };
    if (!source || !target || source === target || target.isCreature || source.team && source.team === target.team) return { ok: false, reason: 'invalid-target' };
    const result = createGrappleState(actorSnapshot(source, target), actorSnapshot(target, source), this.options);
    if (!result.ok) return result;
    this.source = source; this.target = target; this.state = result.state;
    this.previousHook.set(this.state.hook.x, this.state.hook.y, this.state.hook.z);
    this.group.visible = true; this.draw(); this.options.onLaunch?.(source, target, { ...this.state.hook });
    return { ok: true, target };
  }

  update(dt) {
    if (!this.active) return null;
    const result = advanceGrappleState(this.state, actorSnapshot(this.source, this.target), actorSnapshot(this.target, this.source), dt);
    this.state = result.state;
    if (result.event === 'released') {
      const target = this.target; this.group.visible = false;
      this.options.onRelease?.(result.reason, target);
      return { event: 'released', target, reason: result.reason };
    }
    const braking = Math.exp(-Math.max(0, dt) * 4);
    for (const [actor, delta] of [[this.source, result.pull.source], [this.target, result.pull.target]]) {
      actor.x += delta.x; actor.z += delta.z;
      if (this.phase !== 'flying') {
        actor.vx = (actor.vx ?? 0) * braking; actor.vz = (actor.vz ?? 0) * braking;
        actor.speed = (actor.speed ?? 0) * braking;
      }
      if (actor.object) { actor.object.position.x = actor.x; actor.object.position.z = actor.z; }
    }
    this.draw();
    if (result.event === 'hit') this.options.onHit?.(this.target, { ...this.state.hook });
    if (result.event === 'ready') this.options.onReady?.(this.target);
    return result.event ? { event: result.event, target: this.target } : null;
  }

  draw() {
    if (!this.active) return;
    const from = actorSnapshot(this.source, this.target).anchor;
    this.start.set(from.x, from.y, from.z);
    this.end.set(this.state.hook.x, this.state.hook.y, this.state.hook.z);
    this.hook.position.copy(this.end);
    this.direction.subVectors(this.end, this.previousHook);
    if (this.phase !== 'flying') this.direction.subVectors(this.start, this.end);
    if (this.direction.lengthSq() > .00001) this.hook.quaternion.setFromUnitVectors(this.axis, this.direction.normalize());
    this.previousHook.copy(this.end);
    const attr = this.rope.geometry.attributes.position;
    const sag = this.phase === 'flying' ? .45 : .9 * (1 - this.state.tension) + .08;
    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      attr.setXYZ(i, this.start.x + (this.end.x - this.start.x) * t,
        this.start.y + (this.end.y - this.start.y) * t - Math.sin(t * Math.PI) * sag,
        this.start.z + (this.end.z - this.start.z) * t);
    }
    attr.needsUpdate = true;
    for (let i = 0; i < this.segments; i++) {
      this.start.fromBufferAttribute(attr, i); this.end.fromBufferAttribute(attr, i + 1);
      this.direction.subVectors(this.end, this.start);
      const length = this.direction.length();
      this.transform.position.copy(this.start).add(this.end).multiplyScalar(.5);
      this.transform.quaternion.setFromUnitVectors(this.axis, this.direction.multiplyScalar(1 / (length || 1)));
      this.transform.scale.set(1, Math.max(.001, length), 1); this.transform.updateMatrix();
      this.cable.setMatrixAt(i, this.transform.matrix);
    }
    this.cable.instanceMatrix.needsUpdate = true;
  }

  cancel(reason = 'cancelled') {
    const wasActive = this.active, target = this.target;
    this.state = cancelGrappleState(this.state, reason); this.group.visible = false;
    if (wasActive) this.options.onRelease?.(reason, target);
    return wasActive ? { event: 'released', reason, target } : null;
  }

  dispose() {
    if (this.disposed) return;
    this.cancel('disposed'); this.group.removeFromParent();
    const geometries = new Set(), materials = new Set();
    this.group.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.cable.dispose();
    this.disposed = true; this.source = this.target = null;
  }
}
