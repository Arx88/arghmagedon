import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL_COLOR, BALL_SCALE, BALL_SPIN, WAKE_PUFF, WAKE_GAP, WAKE_GROWTH, WAKE_SIZE, WAKE_LIFE,
} from '../src/projectile-look.js';

const GUNS = 4;
const tables = { BALL_COLOR, BALL_SPIN, WAKE_PUFF, WAKE_GAP, WAKE_GROWTH, WAKE_SIZE, WAKE_LIFE };

test('every gun has an entry in every look table', () => {
  for (const [name, table] of Object.entries(tables)) {
    assert.equal(table.length, GUNS, `${name} covers ${table.length} guns, not ${GUNS}`);
  }
  assert.equal(BALL_SCALE.length, GUNS);
  for (const scale of BALL_SCALE) assert.equal(scale.length, 3, 'a body needs three axes');
});

test('no two guns share a body colour', () => {
  // The regression: iron and the bomb were both near-black, so on dark water a
  // salvo showed two shades of the same invisible dot.
  assert.equal(new Set(BALL_COLOR).size, GUNS, `guns share a body colour: ${BALL_COLOR}`);
});

test('no two guns share a body shape', () => {
  const shapes = BALL_SCALE.map(s => s.join(','));
  assert.equal(new Set(shapes).size, GUNS, `guns share a body shape: ${shapes}`);
  assert.ok(BALL_SCALE[1][0] > BALL_SCALE[1][1], 'chain shot is a bar, not a ball');
});

test('no two guns share a spin rate', () => {
  assert.equal(new Set(BALL_SPIN).size, GUNS, `guns share a spin rate: ${BALL_SPIN}`);
});

test('the wake is not two effects for four guns', () => {
  // Cold guns may share smoke; a gun that is meant to look like it is burning
  // must not trail the same grey a round shot does.
  assert.equal(new Set(WAKE_PUFF.slice(0, 2)).size, 1, 'iron and chain both trail smoke, that is fine');
  assert.equal(new Set(WAKE_PUFF.slice(2)).size, 2, `fire and soot collapsed into one effect: ${WAKE_PUFF}`);
  assert.notEqual(WAKE_PUFF[3], WAKE_PUFF[2], 'the bomb is a shell going up, not a pot already alight');
});

test('the bomb throws soot, not fire, and trails heavier than the pot', () => {
  assert.equal(WAKE_PUFF[3], 'soot');
  assert.ok(WAKE_SIZE[2] > WAKE_SIZE[0], 'the pot must trail fatter than iron');
  assert.ok(WAKE_GAP[2] < WAKE_GAP[1], 'the pot must trail denser than chain');
  assert.ok(WAKE_LIFE[2] > WAKE_LIFE[0], 'the pot must hang longer in the air');
});

test('no wake leaves gaps between its puffs', () => {
  // The regression this guards: puffs spaced on a timer instead of on distance
  // end up most of a unit apart at these speeds, so the wake reads as a dotted
  // line. The gap has to close against the puff's grown size, and growth differs
  // by type — smoke billows, fire shrinks — so judging every gun against one
  // number breaks whichever kind does not match it.
  for (const kind of [0, 1, 2, 3]) {
    const grown = WAKE_SIZE[kind] * WAKE_GROWTH[kind];
    assert.ok(WAKE_GAP[kind] < grown,
      `gun ${kind} drops a puff every ${WAKE_GAP[kind]} units but it only ever reaches ${grown.toFixed(2)} across`);
  }
});