const BASE = '/assets/audio/';
const sample = (name, gain = 1, rate = 1, delay = 0, duration) => ({ file: `sfx/${name}.ogg`, gain, rate, delay, duration });
const variants = (...names) => names.map(name => sample(name));

// A recipe is made of recorded samples, never generated oscillator tones.
export const AUDIO_EVENTS = Object.freeze({
  'cannon.iron': { priority: 3, cooldown: .045, gain: .68, layers: [variants('cannon'), variants('creak1', 'creak2', 'creak3')] },
  'cannon.chain': { priority: 3, cooldown: .055, gain: .58, layers: [[sample('cannon', .9, 1.14)], [sample('winch-0', .42, 1.3, .05, .8)]] },
  'cannon.fire': { priority: 3, cooldown: .055, gain: .63, layers: [[sample('cannon', .85, .94)], [sample('impactGlass_light_000', .4, .95, .04)]] },
  'cannon.bomb': { priority: 4, cooldown: .06, gain: .76, layers: [[sample('cannon', 1, .78)], [sample('impact-metal', .35, .82, .05, 2)]] },
  'cannon.ready': { priority: 1, cooldown: .5, gain: .3, layers: [[sample('winch-1', .5, 1.35, 0, .5)], [sample('metalClick', .35, 1.1, .04)]] },
  'fire.suppress': { priority: 2, cooldown: .4, gain: .5, layers: [variants('splash'), [sample('winch-0', .3, 1.2, .1, .8)]] },
  'impact.wood': { priority: 3, cooldown: .08, gain: .6, layers: [variants('impact-wood'), variants('impactWood_heavy_000', 'impactWood_heavy_001', 'impactWood_heavy_002')] },
  'impact.stone': { priority: 3, cooldown: .1, gain: .6, layers: [variants('impact-stone')] },
  'impact.metal': { priority: 3, cooldown: .1, gain: .55, layers: [variants('impact-metal')] },
  'impact.water': { priority: 2, cooldown: .1, gain: .58, layers: [variants('splash')] },
  'ship.sink': { priority: 5, cooldown: 1, gain: .76, layers: [variants('sink')] },
  'ship.ram': { priority: 3, cooldown: .75, gain: .6, layers: [variants('ram')] },
  'impact.crit': { priority: 4, cooldown: .06, gain: .62, layers: [variants('impact-wood'), variants('impactBell_heavy_000', 'impactBell_heavy_001')] },
  'combat.heartbeat': { priority: 2, cooldown: .5, gain: .5, layers: [[sample('grunt_01', .8, .6, 0, .5)], [sample('grunt_02', .6, .55, .3, .5)]] },
  'ship.creak': { priority: 0, cooldown: 2.8, gain: .15, layers: [variants('creak1', 'creak2', 'creak3')] },
  'sail.trim': { priority: 1, cooldown: .6, gain: .28, layers: [variants('cloth1', 'cloth2', 'cloth3')] },
  'boost.start': { priority: 2, cooldown: .6, gain: .36, layers: [variants('cloth1', 'cloth2'), [sample('winch-1', .2, 1.2, .06, .7)]] },
  'hook.launch': { priority: 3, cooldown: .15, gain: .5, layers: [variants('knifeSlice', 'knifeSlice2'), [sample('winch-0', .55, 1.18, .04, 1.1)]] },
  'hook.hit': { priority: 3, cooldown: .15, gain: .52, layers: [variants('impactMetal_medium_000', 'impactMetal_medium_001', 'impactMetal_medium_002'), [sample('creak2', .6, .9, .03)]] },
  'hook.reel': { priority: 1, cooldown: 1.2, gain: .35, layers: [[sample('winch-2', 1, .95, 0, 1.5)]] },
  'hook.release': { priority: 2, cooldown: .15, gain: .36, layers: [variants('metalLatch', 'metalClick'), variants('cloth1', 'cloth2')] },
  'boarding.clash': { priority: 2, cooldown: .2, gain: .38, layers: [variants('drawKnife1', 'drawKnife2'), variants('impactMetal_medium_000', 'impactMetal_medium_001')] },
  'fire.ignite': { priority: 3, cooldown: .4, gain: .48, layers: [[sample('cannon', .32, 1.32, 0, .8)], [sample('impactGlass_light_001', .4)]] },
  'loot.chest': { priority: 2, cooldown: .25, gain: .5, layers: [variants('doorOpen_1', 'doorOpen_2'), [sample('handleCoins', .65, 1, .12)]] },
  'loot.coin': { priority: 2, cooldown: .18, gain: .45, layers: [variants('handleCoins', 'handleCoins2')] },
  'loot.deposit': { priority: 3, cooldown: .6, gain: .54, layers: [variants('handleCoins2'), [sample('confirmation_001', .3, .88, .18)]] },
  'crew.step': { priority: 0, cooldown: .12, gain: .23, layers: [variants('footstep_wood_000', 'footstep_wood_001', 'footstep_wood_002')] },
  'crew.rum': { priority: 2, cooldown: .5, gain: .34, layers: [variants('impactGlass_light_000', 'impactGlass_light_001'), [sample('burp_01', .28, 1, .6)]] },
  'crew.hire': { priority: 2, cooldown: .3, gain: .42, layers: [variants('handleCoins', 'handleCoins2'), [sample('cloth3', .4, 1, .08)]] },
  'creature.roar': { priority: 3, cooldown: 3, gain: .6, layers: [variants('roar_01', 'roar_02', 'roar_03')] },
  'creature.hit': { priority: 2, cooldown: .35, gain: .45, layers: [variants('grunt_01', 'grunt_02')] },
  'island.discovered': { priority: 3, cooldown: .5, gain: .35, layers: [[sample('impactBell_heavy_000', .6, 1.3)], [sample('bookFlip1', .5, 1, .1)]] },
  'island.captured': { priority: 4, cooldown: 1, gain: .5, layers: [[sample('impactBell_heavy_001', .6, 1.05)], [sample('confirmation_002', .4, .86, .25)]] },
  'island.invasion': { priority: 5, cooldown: 3, gain: .57, layers: [[sample('impactBell_heavy_000', .6, .82)], [sample('impactBell_heavy_000', .5, .82, .65)]] },
  'upgrade.install': { priority: 2, cooldown: .3, gain: .45, layers: [[sample('impactWood_heavy_001', .75)], [sample('metalLatch', .7, 1, .16)], [sample('confirmation_001', .3, 1, .32)]] },
  'ui.open': { priority: 1, cooldown: .08, gain: .2, layers: [variants('bookFlip1', 'bookFlip2')] },
  'ui.close': { priority: 1, cooldown: .08, gain: .2, layers: [variants('close_001')] },
  'ui.select': { priority: 1, cooldown: .045, gain: .22, layers: [variants('click_001', 'click_002')] },
  'ui.error': { priority: 2, cooldown: .35, gain: .25, layers: [variants('error_001')] },
  'notice': { priority: 2, cooldown: .2, gain: .22, layers: [variants('pluck_001')] },
  'victory': { priority: 5, cooldown: 2, gain: .5, layers: [[sample('impactBell_heavy_001', .6, 1)], [sample('confirmation_002', .6, .88, .35)]] },
  'defeat': { priority: 5, cooldown: 2, gain: .45, layers: [[sample('impactBell_heavy_000', .6, .65)], [sample('creak3', .4, .8, .4)]] },
});

export const AUDIO_DEFAULTS = Object.freeze({ master: .8, music: .38, ambience: .48, effects: .85 });
const MUSIC = { exploration: 'music/exploration.ogg', port: 'music/port.ogg', combat: 'music/combat.ogg' };
const ALIASES = { cannon: 'cannon.iron', coin: 'loot.coin', impact: 'impact.wood', rum: 'crew.rum' };
const clip = (value, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

export function spatialMix(position, listener = {}) {
  if (!position) return { gain: 1, pan: 0, distance: 0 };
  const dx = (position.x ?? 0) - (listener.x ?? 0), dz = (position.z ?? 0) - (listener.z ?? 0);
  const distance = Math.hypot(dx, dz);
  const gain = distance <= 25 ? 1 : distance >= 180 ? 0 : Math.pow(1 - (distance - 25) / 155, 1.8);
  const heading = listener.heading ?? 0;
  return { gain, pan: clip((dx * Math.cos(heading) - dz * Math.sin(heading)) / Math.max(20, distance), -.85, .85), distance };
}

export function chooseMusicScene({ combat = false, inPort = false } = {}) {
  return combat ? 'combat' : inPort ? 'port' : 'exploration';
}

function readVolumes(storage) {
  try {
    const saved = JSON.parse(storage?.getItem('pirate-tides.audio') ?? '{}');
    return Object.fromEntries(Object.entries(AUDIO_DEFAULTS).map(([key, value]) => [key, clip(saved[key] ?? value)]));
  } catch { return { ...AUDIO_DEFAULTS }; }
}

/** One lazily unlocked Web Audio graph, with sample beds and bounded effect voices. */
export class AudioDirector {
  constructor({ contextFactory, fetcher, storage, random = Math.random, maxVoices = 18 } = {}) {
    this.contextFactory = contextFactory ?? (() => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)());
    this.fetcher = fetcher ?? globalThis.fetch?.bind(globalThis);
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    this.volumes = readVolumes(this.storage); this.random = random; this.maxVoices = Math.max(6, maxVoices);
    this.context = null; this.unlocked = false; this.paused = false; this.disposed = false;
    this.buffers = new Map(); this.pending = new Map(); this.errors = new Map(); this.voices = [];
    this.cooldowns = new Map(); this.variants = new Map(); this.beds = new Map(); this.bedTargets = new Map();
    this.scene = { climate: 'clear', combat: false, inPort: false, listener: { x: 0, z: 0, heading: 0 }, time: 0 };
    this.combatUntil = 0; this.controller = new AbortController(); this.requests = []; this.loadingCount = 0;
  }

  async unlock() {
    if (this.disposed) return false;
    // A second first-gesture listener must not resume a deliberately paused game.
    if (this.unlocked) return true;
    try {
      if (!this.context) {
        this.context = this.contextFactory();
        const context = this.context;
        this.master = context.createGain(); this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -12; this.compressor.knee.value = 16;
        this.compressor.ratio.value = 5; this.compressor.attack.value = .004; this.compressor.release.value = .22;
        this.master.connect(this.compressor).connect(context.destination);
        this.buses = Object.fromEntries(['music', 'ambience', 'effects'].map(name => {
          const bus = context.createGain(); bus.connect(this.master); return [name, bus];
        }));
        this._applyVolumes();
      }
      // Creation/resume occur directly in the gesture call, before any fetch awaits.
      await this.context.resume(); this.unlocked = true; this.paused = false;
      this._reconcileScene();
      const essential = [MUSIC.exploration, MUSIC.port, MUSIC.combat, 'ambience/waves.ogg', 'ambience/wind.ogg',
        'sfx/cannon.ogg', 'sfx/impact-wood.ogg', 'sfx/splash.ogg', 'sfx/handleCoins.ogg', 'sfx/click_001.ogg'];
      await Promise.allSettled(essential.map(file => this._load(file)));
      this._reconcileScene(); return !this.disposed;
    } catch (error) { this.errors.set('unlock', String(error)); return false; }
  }

  _load(file) {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file));
    if (this.pending.has(file)) return this.pending.get(file);
    if (this.disposed || !this.context || !this.fetcher) return Promise.resolve(null);
    const promise = new Promise(resolve => this.requests.push({ file, resolve }));
    this.pending.set(file, promise); this._drain(); return promise;
  }

  _drain() {
    while (!this.disposed && this.loadingCount < 4 && this.requests.length) {
      const { file, resolve } = this.requests.shift(); this.loadingCount++;
      Promise.resolve().then(() => this.fetcher(BASE + file, { signal: this.controller.signal }))
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
        .then(bytes => this.context.decodeAudioData(bytes))
        .then(buffer => { if (!this.disposed) { this.buffers.set(file, buffer); this.errors.delete(file); } resolve(buffer); })
        .catch(error => { if (!this.disposed) this.errors.set(file, String(error)); resolve(null); })
        .finally(() => { this.pending.delete(file); this.loadingCount--; this._drain(); });
    }
  }

  setVolumes(values = {}) {
    for (const key of Object.keys(AUDIO_DEFAULTS)) if (Object.hasOwn(values, key)) this.volumes[key] = clip(Number(values[key]));
    try { this.storage?.setItem('pirate-tides.audio', JSON.stringify(this.volumes)); } catch { /* Private browsing still allows audio. */ }
    this._applyVolumes(); return { ...this.volumes };
  }

  _applyVolumes() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, now, .05);
    for (const name of ['music', 'ambience', 'effects']) this.buses[name].gain.setTargetAtTime(this.volumes[name], now, .05);
  }

  play(id, { position, gain = 1, variation, priority } = {}) {
    if (!this.unlocked || this.paused || this.disposed || !this.context || !this.volumes.master || !this.volumes.effects) return false;
    id = ALIASES[id] ?? id; const recipe = AUDIO_EVENTS[id]; if (!recipe) return false;
    const now = this.context.currentTime;
    if ((this.cooldowns.get(id) ?? -Infinity) > now) return false;
    const spatial = spatialMix(position, this.scene.listener); if (spatial.gain < .008) return false;
    this.cooldowns.set(id, now + recipe.cooldown);
    const level = Math.max(0, Math.min(2, gain)) * recipe.gain * spatial.gain;
    if (level <= 0) return false;
    const eventPriority = priority ?? recipe.priority;
    if (id.startsWith('cannon.') || id.startsWith('creature.')) this.combatUntil = Math.max(this.combatUntil, now + 7);
    recipe.layers.forEach((choices, layerIndex) => {
      let index = Number.isInteger(variation) ? Math.abs(variation + layerIndex) % choices.length : Math.floor(this.random() * choices.length);
      const key = `${id}:${layerIndex}`, previous = this.variants.get(key);
      if (choices.length > 1 && index === previous) index = (index + 1) % choices.length;
      this.variants.set(key, index); const selected = choices[index];
      const buffer = this.buffers.get(selected.file);
      const start = ready => {
        if (!ready || this.disposed || this.paused || this.context.currentTime - now > .4) return;
        this._startVoice(id, selected, ready, level, spatial.pan, eventPriority);
      };
      if (buffer) start(buffer); else this._load(selected.file).then(start);
    });
    if (eventPriority >= 3) this._duckMusic(.86, .5);
    return true;
  }

  _startVoice(id, selected, buffer, level, pan, priority) {
    const context = this.context, now = context.currentTime;
    if (this.voices.length >= this.maxVoices) {
      const weakest = this.voices.reduce((result, voice) => !result || voice.priority < result.priority ||
        (voice.priority === result.priority && voice.started < result.started) ? voice : result, null);
      if (weakest.priority > priority) return;
      this._stopVoice(weakest);
    }
    const source = context.createBufferSource(), envelope = context.createGain(), panner = context.createStereoPanner();
    const rate = selected.rate * (.97 + this.random() * .06);
    source.buffer = buffer; source.playbackRate.value = rate; panner.pan.value = pan;
    const start = now + selected.delay, duration = Math.min(selected.duration ?? buffer.duration, buffer.duration);
    const end = start + duration / rate, amplitude = level * selected.gain;
    envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(amplitude, start + .005);
    envelope.gain.setValueAtTime(amplitude, Math.max(start + .005, end - .04)); envelope.gain.linearRampToValueAtTime(0, end);
    source.connect(envelope).connect(panner).connect(this.buses.effects);
    const voice = { source, envelope, panner, priority, id, started: start };
    this.voices.push(voice); source.onended = () => this._cleanVoice(voice);
    source.start(start, 0, duration); return voice;
  }

  _cleanVoice(voice) {
    const index = this.voices.indexOf(voice); if (index >= 0) this.voices.splice(index, 1);
    voice.source.disconnect(); voice.envelope.disconnect(); voice.panner.disconnect();
  }

  _stopVoice(voice) {
    const now = this.context.currentTime;
    voice.envelope.gain.cancelScheduledValues(now); voice.envelope.gain.setTargetAtTime(0, now, .012);
    try { voice.source.stop(now + .04); } catch { /* It may have naturally ended. */ }
    const index = this.voices.indexOf(voice); if (index >= 0) this.voices.splice(index, 1);
  }

  _duckMusic(level, duration) {
    const param = this.buses.music.gain, now = this.context.currentTime;
    param.cancelScheduledValues(now); param.setTargetAtTime(this.volumes.music * level, now, .04);
    param.setTargetAtTime(this.volumes.music, now + duration, .35);
  }

  setScene(values = {}) {
    this.scene = { ...this.scene, ...values, listener: values.listener ? { ...this.scene.listener, ...values.listener } : this.scene.listener };
    if (this.unlocked && !this.paused && !this.disposed) this._reconcileScene();
  }

  _reconcileScene() {
    if (!this.context || this.disposed || this.paused || !this.unlocked) return;
    const now = this.context.currentTime, { inPort, climate, combat, burning = 0 } = this.scene;
    if (combat) this.combatUntil = Math.max(this.combatUntil, now + 7);
    const music = chooseMusicScene({ inPort, combat: !!combat || now < this.combatUntil });
    for (const [name, file] of Object.entries(MUSIC)) this._bed(file, 'music', name === music ? .88 : 0, 2.6);
    const mode = typeof climate === 'string' ? climate : climate?.mode ?? 'clear';
    const storm = clip(typeof climate === 'object' ? climate.storm ?? (mode === 'storm' ? 1 : 0) : mode === 'storm' ? 1 : mode === 'snow' ? .35 : .08);
    this._bed('ambience/waves.ogg', 'ambience', inPort ? .24 : .36 + storm * .23, 2);
    this._bed('ambience/wind.ogg', 'ambience', .045 + storm * .26 + clip(this.scene.speed ?? 0, 0, 18) * .004, 2);
    this._bed('ambience/rain.ogg', 'ambience', mode === 'storm' ? .4 : 0, 2.4);
    this._bed('ambience/fire.ogg', 'ambience', Math.min(.45, Math.max(0, Number(burning) || 0) * .3), .55);
  }

  _bed(file, bus, target, fade) {
    const previous = this.bedTargets.get(file);
    if (previous !== undefined && Math.abs(previous - target) < .015) return;
    this.bedTargets.set(file, target);
    const existing = this.beds.get(file);
    if (existing) {
      const now = this.context.currentTime;
      existing.envelope.gain.cancelScheduledValues(now); existing.envelope.gain.setTargetAtTime(target, now, fade / 3);
      return;
    }
    if (target <= 0) return;
    this._load(file).then(buffer => {
      if (!buffer || this.disposed || this.beds.has(file) || !this.unlocked) return;
      const currentTarget = this.bedTargets.get(file) ?? 0; if (currentTarget <= 0) return;
      const context = this.context, source = context.createBufferSource(), envelope = context.createGain();
      source.buffer = buffer; source.loop = true; source.connect(envelope).connect(this.buses[bus]);
      envelope.gain.setValueAtTime(0, context.currentTime); envelope.gain.setTargetAtTime(currentTarget, context.currentTime, fade / 3);
      source.start(); this.beds.set(file, { source, envelope, bus });
    });
  }

  pause() { this.paused = true; if (this.context?.state === 'running') return this.context.suspend(); return Promise.resolve(); }
  async resume() { if (!this.unlocked || this.disposed) return false; await this.context.resume(); this.paused = false; this._applyVolumes(); this._reconcileScene(); return true; }

  get status() { return { unlocked: this.unlocked, paused: this.paused, decoded: this.buffers.size, voices: this.voices.length,
    music: chooseMusicScene({ inPort: this.scene.inPort, combat: this.scene.combat || (this.context?.currentTime ?? 0) < this.combatUntil }), errors: Object.fromEntries(this.errors) }; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.controller.abort();
    for (const request of this.requests.splice(0)) request.resolve(null);
    this.pending.clear();
    for (const voice of [...this.voices]) { try { voice.source.stop(); } catch {} this._cleanVoice(voice); }
    for (const bed of this.beds.values()) { try { bed.source.stop(); } catch {} bed.source.disconnect(); bed.envelope.disconnect(); }
    this.beds.clear(); this.buffers.clear(); this.context?.close();
  }
}
