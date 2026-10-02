import * as THREE from 'three';

export class Exploration {
  constructor(scene, bounds) {
    this.bounds = bounds; this.size = 128; this.sources = []; this.clock = 1;
    this.explored = new Uint8Array(this.size ** 2);
    this.pixels = new Uint8Array(this.size ** 2 * 4);
    this.texture = new THREE.DataTexture(this.pixels, this.size, this.size, THREE.RGBAFormat);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
    this.mapCanvas = document.createElement('canvas'); this.mapCanvas.width = this.mapCanvas.height = this.size;
    this.mapContext = this.mapCanvas.getContext('2d'); this.mapPixels = this.mapContext.createImageData(this.size, this.size);
    this.percent = 0;
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, uniforms: { survey: { value: this.texture }, time: { value: 0 } },
      vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D survey;uniform float time;varying vec2 v;void main(){vec4 s=texture2D(survey,vec2(v.x,1.-v.y));float cloud=sin(v.x*87.+time*.06)*sin(v.y*62.-time*.08)*.025;float a=(1.-s.r)*.62+s.r*(1.-s.g)*.12;gl_FragColor=vec4(vec3(.07,.32,.31)+cloud,a);}`,
    });
    const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    this.mesh.rotation.x = -Math.PI / 2; this.mesh.position.set((bounds.minX + bounds.maxX) / 2, .3, (bounds.minZ + bounds.maxZ) / 2); this.mesh.renderOrder = 8; scene.add(this.mesh); scene.userData.fog = this.mesh;
  }
  visible(p, extra = 0) { return this.sources.some(s => Math.hypot(p.x - s.x, p.z - s.z) < s.radius + extra); }
  reveal(sources, dt, time) {
    this.sources = sources; this.mesh.material.uniforms.time.value = time; this.clock += dt;
    if (this.clock < .35) return; this.clock = 0;
    const b = this.bounds, n = this.size; let explored = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = { x: b.minX + (x + .5) / n * (b.maxX - b.minX), z: b.minZ + (y + .5) / n * (b.maxZ - b.minZ) };
      let sight = 0;
      for (const s of sources) sight = Math.max(sight, Math.min(1, Math.max(0, (s.radius - Math.hypot(p.x - s.x, p.z - s.z)) / 6)));
      const i = y * n + x, k = i * 4;
      if (sight > .15) this.explored[i] = 1;
      explored += this.explored[i]; this.pixels[k] = this.explored[i] * 255; this.pixels[k + 1] = Math.round(sight * 255); this.pixels[k + 3] = 255;
      this.mapPixels.data[k] = 12; this.mapPixels.data[k + 1] = 37; this.mapPixels.data[k + 2] = 38; this.mapPixels.data[k + 3] = this.explored[i] ? Math.round((1 - sight) * 75) : 246;
    }
    this.percent = Math.round(explored / (n * n) * 100); this.texture.needsUpdate = true; this.mapContext.putImageData(this.mapPixels, 0, 0);
  }
}


