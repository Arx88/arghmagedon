import * as THREE from 'three';
import { box, rod, mesh } from './world.js';
import { batchPaint } from './batch.js';
import { coastRadius } from './coastline.js';

// Dockside scenery belongs to its island so fog never reveals an undiscovered coast.
// These small, furled fishing boats stay beside the pier and do not join combat.
function fishingBoat(color) {
  const boat = new THREE.Group();
  boat.name = 'bote-pesquero-amarrado';
  const sections = [[-2.2, .04], [-1.6, .6], [-.5, .83], [.8, .76], [1.7, .55]];
  const vertices = [], indices = [];
  for (const [z, width] of sections) {
    vertices.push(-width * .48, -.16, z, width * .48, -.16, z,
      -width, .42, z, width, .42, z);
  }
  for (let i = 0; i < sections.length - 1; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a, b, a + 2, b, b + 2, a + 2,
      a + 1, a + 3, b + 1, b + 1, a + 3, b + 3,
      a, a + 1, b, a + 1, b + 1, b);
  }
  indices.push(16, 18, 17, 17, 18, 19);
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  hull.setIndex(indices); hull.computeVertexNormals();
  mesh(hull, new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide }), boat);
  box(boat, 1.03, .08, 2.65, 0x775334, 0, .03, -.04);
  for (const z of [-1.05, .12, 1.1]) box(boat, 1.25, .09, .29, 0xc99d5a, 0, .35, z);
  for (const side of [-1, 1]) {
    for (let i = 0; i < sections.length - 1; i++) {
      const [z, w] = sections[i], [nextZ, nextW] = sections[i + 1];
      rod(boat, [side * w, .45, z], [side * nextW, .45, nextZ], .055, 0xe4b66c);
    }
    const oar = new THREE.Group(); boat.add(oar);
    oar.position.set(side * .45, .53, .1); oar.rotation.y = side * .18;
    rod(oar, [0, 0, -1.5], [0, 0, 1.4], .035, 0xd3ac70);
    box(oar, .17, .055, .55, 0xd3ac70, 0, 0, 1.45);
  }
  rod(boat, [0, .08, -.7], [0, 2.8, -.7], .046, 0x835733);
  // A rolled sail and baskets distinguish civilian hulls from purchasable units.
  rod(boat, [-.68, 2.5, -.7], [.68, 2.5, -.7], .055, 0xab8050);
  rod(boat, [-.57, 2.42, -.7], [.57, 2.42, -.7], .115, 0xe9dbb8, 8);
  for (const x of [-.35, .35]) box(boat, .04, .24, .24, 0x6e7355, x, 2.42, -.7);
  mesh(new THREE.CylinderGeometry(.28, .22, .38, 8), 0xbb8d52, boat, .23, .25, .72);
  for (let i = 0; i < 5; i++) {
    rod(boat, [-.65, .53, .28 + i * .14], [-.4, .08, .28 + i * .14], .015, 0xb2b497);
  }
  batchPaint(boat, true);
  return boat;
}

export function createCoastalLife(islands) {
  const boats = [];
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  for (const island of islands) {
    const count = island.homeTeam ? 2 : island.pair === 'cove' ? 1 : 0;
    for (let n = 0; n < count; n++) {
      const side = n ? -1 : 1, dockX = island.r * .35, dockZ = island.r * .65;
      const boat = fishingBoat(n ? 0xb76742 : 0x397c82);
      const x = dockX + side * 2.65;
      let z = dockZ + 3.5 + n * 1.1;
      // Keep the entire hull beyond the procedural beach, including irregular coves.
      while (Math.hypot(x, (z - 2.2) / .72) < island.r * coastRadius(Math.atan2((z - 2.2) / .72, x), island.x, island.z) + .7) z += .3;
      boat.position.set(x, -.08, z);
      island.group.add(boat);
      const points = new Float32Array([dockX + side * 1.2, 1.23, dockZ + 4.8, x, .2, z - 1.2]);
      const rope = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)),
        new THREE.LineBasicMaterial({ color: 0xc5b486 }));
      rope.name = 'amarra-pesquera'; island.group.add(rope);
      const ripple = new THREE.Mesh(new THREE.RingGeometry(.89, 1, 32), new THREE.MeshBasicMaterial({ color: 0xb9fff0, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide }));
      ripple.rotation.x = -Math.PI / 2; ripple.scale.set(1.1, 2.15, 1); ripple.position.set(x, -.09, z);
      island.group.add(ripple);
      boats.push({ boat, rope, ripple, phase: boats.length * 1.7 });
    }
  }
  return {
    boats,
    update(time) {
      const t = reducedMotion?.matches ? 0 : time;
      for (const { boat, rope, ripple, phase } of boats) {
        if (!boat.parent.visible) continue;
        boat.position.y = -.08 + Math.sin(t * 1.5 + phase) * .055;
        boat.rotation.z = Math.sin(t * 1.1 + phase) * .025;
        boat.rotation.x = Math.sin(t * 1.3 + phase + 1) * .012;
        rope.geometry.attributes.position.setY(1, boat.position.y + .37);
        rope.geometry.attributes.position.needsUpdate = true;
        ripple.material.opacity = .1 + (1 + Math.sin(t * 1.5 + phase)) * .035;
      }
      for (const island of islands) if (island.group.visible && island.canopyWind) island.canopyWind.value = t;
    },
  };
}
