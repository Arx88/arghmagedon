import * as THREE from 'three';

/** A destination anchored in world space; it follows the actual navigable route endpoint. */
export class NavigationMarker {
  constructor(scene, wave = () => 0) {
    this.wave = wave;
    this.object = new THREE.Group();
    this.object.name = 'destino-de-navegacion';
    const material = new THREE.MeshBasicMaterial({ color: 0xffda87, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.65, 1.76, 48), material);
    this.ring.rotation.x = -Math.PI / 2; this.object.add(this.ring);
    this.inner = new THREE.Mesh(new THREE.RingGeometry(.42, .55, 4), material);
    this.inner.rotation.x = -Math.PI / 2; this.inner.rotation.z = Math.PI / 4; this.object.add(this.inner);
    // Four small bearings give the marker a navigational silhouette, distinct from a target lock.
    for (let n = 0; n < 4; n++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(.12, .55), material);
      const angle = n * Math.PI / 2;
      tick.rotation.x = -Math.PI / 2; tick.rotation.z = -angle;
      tick.position.set(Math.sin(angle) * 2.1, 0, Math.cos(angle) * 2.1); this.object.add(tick);
    }
    this.object.visible = false; scene.add(this.object);
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }
  update(player, time, hidden) {
    this.object.visible = !!player.target && !player.dead && !hidden;
    if (!this.object.visible) return;
    const matchesRoute = player.routeGoal && Math.hypot(player.routeGoal.x - player.target.x, player.routeGoal.z - player.target.z) < 5;
    const goal = matchesRoute && player.route?.length ? player.route[player.route.length - 1] : player.target;
    this.object.position.set(goal.x, this.wave(goal.x, goal.z, time) + .11, goal.z);
    this.ring.scale.setScalar(this.reducedMotion?.matches ? 1 : 1 + Math.sin(time * 2.5) * .055);
    this.object.userData.destination = goal;
  }
}
