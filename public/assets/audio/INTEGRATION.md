# AudioDirector integration

```js
import { AudioDirector } from './audio-director.js';
const audio = new AudioDirector();

// Both keyboard and pointer are valid first gestures. AudioContext creation and
// resume happen before the first asynchronous fetch in unlock().
const startAudio = () => audio.unlock();
window.addEventListener('pointerdown', startAudio, { once: true });
window.addEventListener('keydown', startAudio, { once: true });

audio.setScene({
  listener: { x: player.x, z: player.z, heading: player.heading },
  climate: { mode: weather.mode, storm: weather.storm },
  inPort: inPort(), combat: time - player.lastHit < 7,
  speed: player.speed, burning: player.burnTime > 0 ? 1 : 0, time,
});
audio.play('cannon.chain', { position: origin, gain: .8 });
audio.setVolumes({ music: .35, effects: .8 });
```

Call `setScene()` during the update loop. Gameplay audio events should be emitted at the actual transition, not on every frame. Music changes over 2.6 seconds; combat stays active for seven seconds after the last shot or creature event. Event sounds use four simultaneous fetch/decode slots, a maximum of 18 effect voices, priority replacement, event cooldowns and non-repeating variants. Sounds attenuate from 25 to 180 world units and pan relative to the listener heading.

`pause()` suspends the single context, preserving bed positions. `resume()` resumes the same context. `dispose()` aborts loads, stops sources, disconnects voices and closes the context. Master, music, ambience and effects controls are independent and persist under `pirate-tides.audio`. For mute, save the previous master value in the UI and set master to zero; restore it when unmuting. Effects played before unlock, during pause, when muted, beyond hearing range or after dispose allocate no audible voice.

Use `audio.status` for QA. It reports unlock state, pause state, decoded buffers, active voices, current music choice and failed assets. Failed fetch/decode requests resolve silently with an error in this record, rather than rejecting the game loop. A later request can retry a failed recording.

Event IDs are exported as `AUDIO_EVENTS`. Old `cannon`, `coin`, `impact` and `rum` IDs remain aliases. Distinct weapon IDs are `cannon.iron`, `cannon.chain`, `cannon.fire` and `cannon.bomb`. Distinct impacts are `impact.wood`, `impact.metal`, `impact.stone` and `impact.water`.

Use `island.discovered`, `island.captured`, `island.invasion`, `ship.sink`, `hook.launch/hit/reel/release`, `fire.ignite`, `loot.chest/coin/deposit`, `crew.step/rum/hire`, `creature.roar/hit`, `sail.trim`, `boost.start`, `boarding.clash`, `upgrade.install`, `ui.open/close/select/error`, `notice`, `victory` and `defeat` at their matching events.

Verification: run `node --test test/audio-director.test.js`. Unit tests cover gesture locking, volume persistence, pause/resume, distance and pan, priority limits, cooldown/variation, combat transitions, missing samples and recipe/license coverage. Media files were probed and decoded with FFmpeg. Browser playback and the final perceptual mix still need to be listened to after integration; metadata and mocks cannot establish that subjective result.
