import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake solid paint into vertex colors. Preserve groups used as animation joints.
export function batchPaint(parent, recursive = false, exclude = new Set()) {
  if (recursive) for (const child of [...parent.children]) if (child.isGroup && !exclude.has(child)) batchPaint(child, true, exclude);
  const batches = new Map();
  for (const child of [...parent.children]) {
    if (!child.isMesh || child.isInstancedMesh || exclude.has(child)) continue;
    const m = child.material;
    if (Array.isArray(m) || m.transparent || (!m.isMeshStandardMaterial && !m.isMeshBasicMaterial)) continue;
    const key = `${m.type}:${m.side}:${m.map?.uuid ?? ''}:${!!child.geometry.attributes.uv}`;
    let batch = batches.get(key);
    if (!batch) batches.set(key, batch = { material: m, parts: [], objects: [] });
    child.updateMatrix();
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(child.matrix);
    const n = geometry.attributes.position.count, colors = new Float32Array(n * 3), source = geometry.attributes.color;
    for (let i = 0; i < n; i++) {
      colors[i * 3] = m.color.r * (m.vertexColors && source ? source.getX(i) : 1);
      colors[i * 3 + 1] = m.color.g * (m.vertexColors && source ? source.getY(i) : 1);
      colors[i * 3 + 2] = m.color.b * (m.vertexColors && source ? source.getZ(i) : 1);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!m.map) geometry.deleteAttribute('uv');
    batch.parts.push(geometry); batch.objects.push(child);
  }
  for (const batch of batches.values()) {
    if (batch.parts.length < 2) { batch.parts.forEach(g => g.dispose()); continue; }
    const geometry = mergeGeometries(batch.parts);
    batch.parts.forEach(g => g.dispose());
    if (!geometry) continue;
    const material = batch.material.clone(); material.color.set(0xffffff); material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = batch.objects.some(o => o.castShadow); mesh.receiveShadow = batch.objects.some(o => o.receiveShadow);
    parent.add(mesh); batch.objects.forEach(o => parent.remove(o));
  }
}
