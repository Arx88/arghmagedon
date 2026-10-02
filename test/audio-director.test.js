import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { AudioDirector, AUDIO_EVENTS, AUDIO_DEFAULTS, spatialMix, chooseMusicScene } from '../src/audio-director.js';

class Param {
  constructor(value = 1) { this.value = value; this.calls = []; }
  setValueAtTime(value, at) { this.value = value; this.calls.push(['set', value, at]); }
  setTargetAtTime(value, at, time) { this.value = value; this.calls.push(['target', value, at, time]); }
  linearRampToValueAtTime(value, at) { this.value = value; this.calls.push(['ramp', value, at]); }
  cancelScheduledValues(at) { this.calls.push(['cancel', at]); }
}
class Node {
  constructor() { this.gain = new Param(); this.pan = new Param(0); this.playbackRate = new Param(); }
  connect(next) { return next; }
  disconnect() {}
  start(...args) { this.started = args; }
  stop() { this.stopped = true; }
}
class Context {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = new Node(); this.sources = []; }
  createGain() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createDynamicsCompressor() { const node = new Node(); for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param(); return node; }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  decodeAudioData(bytes) { return Promise.resolve({ duration: 4, path: new TextDecoder().decode(bytes) }); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture(options = {}) {
  const context = new Context(), data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const fetcher = async path => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(path).buffer });
  const director = new AudioDirector({ contextFactory: () => context, fetcher, storage, random: () => 0, ...options });
  return { director, context, storage };
}

test('no context or effects before an explicit gesture; unlocking prepares real sample beds', async () => {
  const { director, context } = fixture();
  assert.equal(director.context, null); assert.equal(director.play('cannon.iron'), false);
  assert.equal(await director.unlock(), true); await flush();
  assert.equal(context.state, 'running'); assert.ok(director.status.decoded >= 10);
  assert.ok(context.sources.some(source => source.loop && source.buffer.path.includes('exploration.ogg')));
  assert.ok(context.sources.some(source => source.loop && source.buffer.path.includes('waves.ogg')));
  director.dispose();
});

test('four buses retain their own clamped persistent volumes through pause/resume', async () => {
  const { director, context, storage } = fixture(); await director.unlock();
  director.setVolumes({ master: .5, music: 2, ambience: -.1, effects: .7 });
  assert.deepEqual(director.volumes, { master: .5, music: 1, ambience: 0, effects: .7 });
  assert.equal(JSON.parse(storage.getItem('pirate-tides.audio')).effects, .7);
  await director.pause(); assert.equal(director.play('coin'), false); assert.equal(context.state, 'suspended');
  await director.unlock(); assert.equal(context.state, 'suspended'); assert.equal(director.paused, true);
  await director.resume(); assert.equal(context.state, 'running'); assert.equal(director.volumes.master, .5);
  director.setVolumes({ master: 0 }); assert.equal(director.play('coin'), false);
  director.dispose();
});

test('spatial effects attenuate and pan; out of range calls allocate no voice', async () => {
  assert.deepEqual(spatialMix(null), { gain: 1, pan: 0, distance: 0 });
  assert.equal(spatialMix({ x: 180, z: 0 }).gain, 0);
  assert.ok(spatialMix({ x: 60, z: 0 }).pan > 0); assert.ok(spatialMix({ x: -60, z: 0 }).pan < 0);
  assert.ok(spatialMix({ x: 80, z: 0 }).gain < spatialMix({ x: 30, z: 0 }).gain);
  const { director } = fixture(); await director.unlock();
  assert.equal(director.play('cannon.iron', { position: { x: 190, z: 0 } }), false);
  assert.equal(director.status.voices, 0); director.dispose();
});

test('voice budget protects cannon/alert sounds from decorative footsteps', async () => {
  const { director, context } = fixture({ maxVoices: 6 }); await director.unlock(); await flush();
  for (let i = 0; i < 6; i++) { context.currentTime += .1; director.play('cannon.iron'); await flush(); }
  assert.equal(director.status.voices, 6);
  const protectedVoices = [...director.voices]; context.currentTime += 1;
  director.play('crew.step'); await flush();
  assert.equal(director.status.voices, 6); assert.ok(protectedVoices.every(voice => director.voices.includes(voice)));
  context.currentTime += 1; director.play('island.invasion'); await flush();
  assert.equal(director.status.voices, 6); assert.ok(director.voices.some(voice => voice.id === 'island.invasion'));
  director.dispose();
});

test('sample families avoid repeating the same variation and respect cooldowns', async () => {
  const { director, context } = fixture(); await director.unlock();
  assert.equal(director.play('crew.step'), true); assert.equal(director.play('crew.step'), false); await flush();
  const first = director.voices.find(voice => voice.id === 'crew.step').source.buffer.path;
  context.currentTime += 1; director.play('crew.step'); await flush();
  const paths = director.voices.filter(voice => voice.id === 'crew.step').map(voice => voice.source.buffer.path);
  assert.notEqual(paths.at(-1), first); assert.equal(director.play('unknown'), false); director.dispose();
});

test('combat wins over harbor music and holds seven seconds before fading back', async () => {
  assert.equal(chooseMusicScene({ combat: true, inPort: true }), 'combat');
  const { director, context } = fixture(); await director.unlock();
  director.setScene({ inPort: true, combat: true }); await flush(); assert.equal(director.status.music, 'combat');
  context.currentTime = 2; director.setScene({ combat: false }); assert.equal(director.status.music, 'combat');
  context.currentTime = 8; director.setScene({ combat: false }); assert.equal(director.status.music, 'port');
  director.setScene({ climate: 'storm', burning: 1 }); await flush();
  assert.ok(director.beds.has('ambience/rain.ogg')); assert.ok(director.beds.has('ambience/fire.ogg'));
  director.dispose(); assert.equal(context.state, 'closed'); assert.equal(director.play('coin'), false);
});

test('missing recordings produce a diagnosable silent failure without rejecting unlock', async () => {
  const { director } = fixture({ fetcher: async () => ({ ok: false, status: 404 }) });
  assert.equal(await director.unlock(), true); await flush(); assert.ok(Object.keys(director.status.errors).length);
  director.play('loot.coin'); await flush(); assert.equal(director.status.voices, 0); director.dispose();
});

test('all recipes resolve to existing, licensed runtime assets', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/audio/manifest.json', import.meta.url)));
  for (const recipe of Object.values(AUDIO_EVENTS)) for (const layer of recipe.layers) for (const variant of layer) {
    assert.ok(existsSync(new URL('../public/assets/audio/' + variant.file, import.meta.url)), variant.file);
    assert.ok(manifest.files.some(file => file.path === variant.file && file.license === 'CC0-1.0'), variant.file);
  }
  assert.equal(Object.keys(AUDIO_DEFAULTS).length, 4);
});
