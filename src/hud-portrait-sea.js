import * as THREE from 'three';

/** One tiny quad, throttled to 12 fps. The ship itself remains a cached model portrait. */
export class HudPortraitSea {
  constructor(container) {
    this.clock = 1; this.dirty = true; this.disposed = false; this.lastTime = -1;
    this.uniforms = { uTime: { value: 0 }, uSpeed: { value: 0 }, uDamage: { value: 0 }, uRepair: { value: 0 } };
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power', depth: false, stencil: false });
    } catch { return; } // The CSS sea is a complete fallback if a context is unavailable.
    const canvas = this.renderer.domElement;
    canvas.className = 'flagship-sea'; canvas.setAttribute('aria-hidden', 'true');
    container.prepend(canvas);
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `varying vec2 vUv;
        uniform float uTime;uniform float uSpeed;uniform float uDamage;uniform float uRepair;
        float noise(vec2 p){return sin(p.x*3.7+sin(p.y*2.1))*.5+.5;}
        void main(){
          vec2 p=vUv*vec2(1.,1.35);float t=uTime*(.24+uSpeed*.012);
          float broad=noise(p*4.+vec2(t*.15,-t*.3));
          vec3 sea=mix(vec3(.025,.105,.15),vec3(.045,.255,.29),broad*.7);
          float waves=sin(p.y*55.+sin(p.x*19.+t)*1.1+t*2.);
          float glint=smoothstep(.89,.99,waves)*smoothstep(.55,.85,noise(p*18.-t));
          sea+=vec3(.10,.18,.18)*glint*.27;
          float light=1.-smoothstep(.1,.86,length((vUv-vec2(.5,.65))*vec2(1.,.8)));
          sea*=.6+light*.5;
          sea=mix(sea,vec3(.56,.15,.09),uDamage*.34);
          sea+=vec3(.035,.11,.065)*uRepair;
          gl_FragColor=vec4(sea,1.);
        }`,
    });
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
    this.resize(112, 134);
  }
  resize(width, height) {
    if (!this.renderer || this.disposed || width < 1 || height < 1) return;
    this.renderer.setSize(Math.ceil(width), Math.ceil(height), false); this.dirty = true;
  }
  setState({ speed, condition }, impact = 0) {
    const values = {uSpeed:speed,uRepair:condition === 'repairing' ? 1 : 0,uDamage:impact};
    for(const [key,value] of Object.entries(values))if(this.uniforms[key].value!==value){this.uniforms[key].value=value;this.dirty=true;}
  }

  frame(time, dt, { reduced = false, lowQuality = false, visible = true } = {}) {
    if (!this.renderer || this.disposed || !visible) return;
    this.clock += dt;
    if(this.lastDamage!==this.uniforms.uDamage.value){this.dirty=true;this.lastDamage=this.uniforms.uDamage.value;}
    const t = reduced ? 0 : time;
    if (!this.dirty && (this.lastTime === t || this.clock < (lowQuality ? .25 : 1 / 12))) return;
    if (this.clock < (lowQuality ? .25 : 1 / 12) && this.lastTime >= 0) return;
    this.clock = 0; this.dirty = false; this.lastTime = t;
    this.uniforms.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.geometry?.dispose(); this.material?.dispose(); this.renderer?.dispose();
  }
}
