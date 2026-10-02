import * as THREE from 'three';

// A tracer has to read as a streak of hot metal, not as a beam of light. Width
// stays near the ball's own diameter (0.18) and the palette stays dark enough
// that additive blending lifts it off the water instead of blowing it to white.
const TRAIL_COLOR = [0xb9c6cb, 0x7fc9de, 0xe08a3c, 0xd2603a];
const TRAIL_WIDTH = [.1, .085, .15, .19];
// Peak alpha per gun. Iron stays the faintest on purpose: it is the gun you fire
// most often, and a bright ribbon on every ball paints a white bar across the sea
// and makes all four read the same. The firepot and the bomb earn their weight
// because they are meant to look like they are burning.
const TRAIL_ALPHA = [.3, .24, .38, .36];
// The halo is the only thing marking a shot while it is in the air, and it used to
// be a dim grey-blue barely half a unit across — on a dark sea at gameplay range
// that is a few pixels, so a salvo had nothing to follow. These are hot enough to
// lift off the water without swallowing the ribbon they sit behind.
const GLOW_COLOR = [0x8a9aa4, 0x9fd8ea, 0xe09a48, 0xd4783f];
const GLOW_SIZE = [.9, 1, 1.35, 1.6];
// How hard each halo pulses, and how fast. A steady disc is the same disc whatever
// fired it; the firepot wavers like a flame and the bomb beats like a fuse, which
// is what separates the two at a glance while both are still in the air.
const GLOW_BEAT = [0, 0, .16, .3];
const GLOW_RATE = [0, 0, 17, 9];

/** Seconds a spent trail keeps dissolving after its shot has left the air. */
export const TRAIL_FADE = .42;

/**
 * Screen-facing tracer ribbons and a bloom around every shot in flight.
 *
 * A cannonball used to be a bare sphere with a handful of smoke puffs behind it,
 * which made a salvo impossible to read: you saw impacts but not where your own
 * fire was going. The ribbon is one pooled mesh, so the whole battery of shots on
 * screen still costs a single draw call.
 */
export class ShotEffects {
  constructor(scene, { trails = 40, samples = 9, glows = 48, minStep = .26, length = 2.2 } = {}) {
    this.samples = samples;
    this.minStep = minStep;
    this.length = length;
    this.cursor = 0;
    this.glowCursor = 0;
    this.slots = Array.from({ length: trails }, () => ({
      active: false, kind: 0, released: false, fade: 1,
      points: Array.from({ length: samples }, () => new THREE.Vector3()),
    }));

    const vertices = trails * samples * 2;
    this.positions = new Float32Array(vertices * 3);
    this.alphas = new Float32Array(vertices);
    this.colors = new Float32Array(vertices * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('trailAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('trailColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let slot = 0; slot < trails; slot++) {
      const base = slot * samples * 2;
      for (let i = 0; i < samples - 1; i++) { const a = base + i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float trailAlpha;attribute vec3 trailColor;varying float trailA;varying vec3 trailC;
        void main(){trailA=trailAlpha;trailC=trailColor;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float trailA;varying vec3 trailC;
        void main(){if(trailA<.008)discard;gl_FragColor=vec4(trailC,trailA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);

    // The halo rides the same lifecycle as the ribbon but fades by darkening,
    // since an additive quad only dims when its colour dims. It needs a radial
    // falloff of its own: a plain quad draws its corners, and sixteen lit squares
    // hanging off the cannonballs look like debug markers, not muzzle heat.
    this.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 glowUv;varying vec3 tint;void main(){glowUv=uv;tint=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 glowUv;varying vec3 tint;void main(){float r=length(glowUv-.5)*2.;if(r>1.)discard;float a=pow(1.-r,2.4);gl_FragColor=vec4(tint,a);}',
    }), glows);
    this.glows.frustumCulled = false;
    this.glows.renderOrder = 4;
    this.glowSlots = Array.from({ length: glows }, () => ({ active: false, kind: 0, released: false, fade: 1, point: new THREE.Vector3() }));
    this.dummy = new THREE.Object3D();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const black = new THREE.Color(0x000000);
    for (let i = 0; i < glows; i++) { this.glows.setMatrixAt(i, hidden); this.glows.setColorAt(i, black); }
    scene.add(this.glows);

    this.direction = new THREE.Vector3();
    this.view = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.clock = 0;
  }

  /** Claims a slot for a shot that has just left a gun. */
  begin(point, kind = 0) {
    const slot = this.slots[this.cursor++ % this.slots.length];
    slot.active = true; slot.kind = kind; slot.released = false; slot.fade = 1;
    for (const p of slot.points) p.copy(point);
    const glow = this.glowSlots[this.glowCursor++ % this.glowSlots.length];
    glow.active = true; glow.kind = kind; glow.released = false; glow.fade = 1; glow.point.copy(point);
    slot.glow = glow;
    return slot;
  }

  /**
   * Records where the shot is now. The ribbon is held to a fixed length in world
   * units, not to a sample count: a sample count only bounds the trail when the
   * samples are a fixed distance apart, and they are not — a fast shot or a long
   * frame moves them further, which is how a cannonball grew a streak of sea
   * paint twenty units behind it.
   */
  advance(slot, point) {
    if (!slot || !slot.active || slot.released) return;
    const points = slot.points;
    // A slow shot that has barely moved only updates its head; shifting anyway
    // would compress the whole ribbon onto one point and the trail would vanish.
    if (points[0].distanceToSquared(point) >= this.minStep * this.minStep) {
      const recycled = points.pop();
      recycled.copy(point);
      points.unshift(recycled);
    } else points[0].copy(point);

    // `head` is re-read after the shift on purpose: the unshift moves the previous
    // head down one slot, so a reference taken before it points at the wrong sample
    // and the ribbon gets laid out from a point the ball has already left.
    const head = points[0], last = points.length - 1;
    const span = this.direction.subVectors(points[last], head).length();
    if (span > this.length) {
      // Too long: lay the tail out straight behind the head so it reads as one
      // clean streak instead of a smear of everywhere the shot has been.
      this.direction.multiplyScalar(1 / span);
      for (let i = 1; i <= last; i++) {
        points[i].copy(head).addScaledVector(this.direction, Math.min(this.length, span * i / last));
      }
    }
    slot.glow.point.copy(point);
  }

  /** The shot landed: the ribbon stops growing and dissolves from the tail. */
  release(slot) {
    if (!slot || !slot.active) return;
    slot.released = true; slot.glow.released = true;
  }

  update(dt, camera) {
    this.clock += dt;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      if (slot.released) {
        slot.fade = Math.max(0, slot.fade - dt / TRAIL_FADE);
        if (slot.fade <= 0) { slot.active = false; slot.glow.active = false; }
      }
    }

    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s], base = s * this.samples * 2;
      if (!slot.active) { for (let i = 0; i < this.samples * 2; i++) this.alphas[base + i] = 0; continue; }
      const color = new THREE.Color(TRAIL_COLOR[slot.kind] ?? TRAIL_COLOR[0]);
      const width = TRAIL_WIDTH[slot.kind] ?? TRAIL_WIDTH[0];
      for (let i = 0; i < this.samples; i++) {
        const p = slot.points[i], next = slot.points[Math.min(this.samples - 1, i + 1)];
        this.direction.subVectors(p, next);
        if (this.direction.lengthSq() < 1e-8) this.direction.set(0, 1, 0);
        this.view.subVectors(p, camera.position).normalize();
        this.side.crossVectors(this.direction, this.view);
        if (this.side.lengthSq() < 1e-8) this.side.set(1, 0, 0); else this.side.normalize();
        const t = i / (this.samples - 1);
        const half = width * Math.pow(1 - t, 1.15) * slot.fade;
        for (let edge = 0; edge < 2; edge++) {
          const sign = edge ? 1 : -1, v = base + i * 2 + edge;
          this.positions[v * 3] = p.x + this.side.x * half * sign;
          this.positions[v * 3 + 1] = p.y + this.side.y * half * sign;
          this.positions[v * 3 + 2] = p.z + this.side.z * half * sign;
          this.alphas[v] = Math.pow(1 - t, 1.9) * (TRAIL_ALPHA[slot.kind] ?? TRAIL_ALPHA[0]) * slot.fade;
          this.colors[v * 3] = color.r; this.colors[v * 3 + 1] = color.g; this.colors[v * 3 + 2] = color.b;
        }
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.trailAlpha.needsUpdate = true;
    this.mesh.geometry.attributes.trailColor.needsUpdate = true;

    for (let i = 0; i < this.glowSlots.length; i++) {
      const glow = this.glowSlots[i];
      if (!glow.active) continue;
      const size = GLOW_SIZE[glow.kind] ?? GLOW_SIZE[0];
      // The beat rides the same clock for every shot, so a broadside of bombs
      // throbs in unison and still reads as one salvo rather than as noise.
      const beat = 1 + (GLOW_BEAT[glow.kind] ?? 0) * Math.sin(this.clock * (GLOW_RATE[glow.kind] || 1));
      this.dummy.position.copy(glow.point);
      this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.setScalar(size * (.35 + .65 * glow.fade) * beat);
      this.dummy.updateMatrix();
      this.glows.setMatrixAt(i, this.dummy.matrix);
      this.glows.setColorAt(i, new THREE.Color(GLOW_COLOR[glow.kind] ?? GLOW_COLOR[0]).multiplyScalar(glow.fade * beat));
    }
    this.glows.instanceMatrix.needsUpdate = true;
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;
  }
}