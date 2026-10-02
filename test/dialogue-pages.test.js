import test from 'node:test';
import assert from 'node:assert/strict';
import { DialoguePages, DialogueQueue } from '../src/dialogue-pages.js';
import { Director, contextualQuip } from '../src/director.js';

const fitsWords = count => text => text.split(/\s+/).length <= count;
function complete(queue) { queue.current.pages.fit(() => true); return queue.advance(); }

test('resizing reflows only unconsumed words; every word is eventually delivered exactly once', () => {
  const message = Array.from({ length: 24 }, (_, i) => 'word' + i).join(' '), pages = new DialoguePages(message), read = [];
  pages.fit(fitsWords(6)); read.push(pages.text); pages.advance();
  assert.equal(pages.cursor, 6);
  pages.fit(fitsWords(3)); assert.equal(pages.text, 'word6 word7 word8'); assert.equal(pages.cursor, 6);
  pages.fit(fitsWords(9)); assert.ok(pages.text.startsWith('word6 ')); assert.equal(pages.cursor, 6);
  read.push(pages.text); pages.advance();
  while (!pages.done) { pages.fit(fitsWords(4)); read.push(pages.text); pages.advance(); }
  assert.equal(read.join(' '), message);
});

test('an invasion interrupts a discovery without replaying consumed pages or losing the unfinished page', () => {
  const queue = new DialogueQueue();
  queue.enqueue({ role: 'lookout', message: 'uno dos tres cuatro cinco seis siete ocho', priority: 2, key: 'report:calavera' });
  queue.current.pages.fit(fitsWords(3)); queue.advance(); queue.current.pages.fit(fitsWords(3));
  const interrupted = queue.current;
  assert.equal(interrupted.pages.cursor, 3);
  assert.equal(queue.enqueue({ role: 'boatswain', message: '¡Defiende Ron Ron!', priority: 3, key: 'invasion:1' }).interrupted, true);
  assert.equal(queue.current.priority, 3); complete(queue);
  assert.equal(queue.current, interrupted); assert.equal(queue.current.pages.cursor, 3);
  queue.current.pages.fit(fitsWords(2)); assert.equal(queue.current.pages.text, 'cuatro cinco');
});

test('the news queue preserves many discoveries in stable order and deduplicates event keys', () => {
  const queue = new DialogueQueue();
  for (let i = 0; i < 11; i++) assert.equal(queue.enqueue({ role: 'lookout', message: 'Isla ' + i, priority: 2, key: 'report:' + i }).accepted, true);
  assert.equal(queue.enqueue({ role: 'sailor', message: 'Una broma', priority: 0 }).accepted, false);
  assert.equal(queue.enqueue({ role: 'lookout', message: 'Isla duplicada', priority: 2, key: 'report:4' }).accepted, false);
  const reports = [];
  while (queue.current) { reports.push(queue.current.key); complete(queue); }
  assert.deepEqual(reports, Array.from({ length: 11 }, (_, i) => 'report:' + i));
  assert.equal(queue.idle, true);
  assert.equal(queue.enqueue({ role: 'lookout', message: 'Repetida después', priority: 2, key: 'report:4' }).accepted, false);
});

function fixture() {
  let clock = 0;
  const elements = new Map();
  const make = id => {
    const classes = new Set(); const node = { id, textContent: '', dataset: {}, attrs: {}, listeners: new Map(),
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(key, value) { this.listeners.set(key, value); }, removeEventListener(key) { this.listeners.delete(key); },
      prepend() {}, remove() {},
    }; elements.set(id, node); return node;
  };
  for (const id of ['dialogue-close', 'crew-dialogue', 'dialogue-avatar', 'dialogue-role', 'dialogue-name', 'dialogue-message', 'announcement', 'battle-log']) make(id);
  const copy = { clientWidth: 120, clientHeight: 40,
    get scrollHeight() { return 20 + 10 * Math.ceil((elements.get('dialogue-message').textContent.split(/\s+/).filter(Boolean).length) / 3); } };
  const doc = { getElementById: id => elements.get(id), querySelector: selector => selector === '.dialogue-copy' ? copy : null, createElement: () => make('log' + elements.size) };
  const events = [], win = { addEventListener() {}, removeEventListener() {} };
  const director = new Director({ document: doc, window: win, now: () => clock, onEvent: event => events.push(event) });
  const player = { team: 'blue', x: 0, z: 0, hp: 160, maxHp: 160, crew: 8, gold: 0 };
  return { director, copy, elements, events, player, setClock: value => { clock = value; } };
}

test('DOM fitting uses the current cursor after resize and expiry advances a page instead of discarding news', () => {
  const { director, copy, elements, player, setClock } = fixture();
  director.speak('lookout', 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince', { priority: 2, key: 'long' });
  assert.equal(elements.get('dialogue-message').textContent, 'uno dos tres cuatro cinco seis');
  elements.get('dialogue-close').listeners.get('click')();
  assert.equal(director.currentSpeech.pages.cursor, 6);
  copy.clientHeight = 30; director.fitSpeech(); assert.equal(elements.get('dialogue-message').textContent, 'siete ocho nueve');
  copy.clientHeight = 40; director.fitSpeech(); assert.equal(elements.get('dialogue-message').textContent, 'siete ocho nueve diez once doce');
  assert.equal(director.speeches.length, 0);
  setClock(director.speechUntil); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 12); assert.equal(elements.get('dialogue-message').textContent, 'trece catorce quince');
  setClock(director.speechUntil); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech, null); assert.equal(elements.get('crew-dialogue').classList.contains('show'), false);
});

test('one notification per invasion instance; later attacks and discoveries remain queued', () => {
  const { director, player, events } = fixture();
  const island = { name: 'Ron Ron', type: 'port', owner: 'blue', x: 10, z: 0, r: 20, invasion: { team: 'red', duration: 30, progress: 0 } };
  for (let i = 0; i < 8; i++) director.update(player, [island], [], 0);
  assert.equal(events.filter(event => event.type === 'invasion').length, 1);
  assert.equal(director.currentSpeech.priority, 3);
  director.reportIsland({ name: 'Calavera', available: true, type: 'treasure' }, {}, 1);
  assert.ok(director.speeches.some(speech => speech.key === 'report:Calavera'));
  island.invasion = { team: 'red', duration: 32, progress: 0 }; director.update(player, [island], [], 0);
  assert.equal(events.filter(event => event.type === 'invasion').length, 2);
  assert.equal(director.announce('¡Están invadiendo tu isla!', '30 segundos', 'weather'), false);
  assert.equal(director.announce('Kraken', 'Peligro', 'creature'), false);
});

test('humor corresponds to current hull, loot, rum or location; carpenter uses the repaired portrait', () => {
  const player = { team: 'blue', x: 0, z: 0, hp: 160, maxHp: 160, gold: 0, crew: 8 };
  assert.equal(contextualQuip(player), null);
  assert.equal(contextualQuip({ ...player, hp: 40 })[0], 'carpenter');
  assert.match(contextualQuip({ ...player, gold: 160 })[1], /oro/);
  assert.match(contextualQuip(player, [], { rumCharges: 0 })[1], /ron/);
  assert.match(contextualQuip(player, [], { inPort: true })[1], /Ron Ron/);
  const { director, elements } = fixture();
  director.speak('carpenter', 'Ese casco necesita tablas.', { priority: 1 });
  assert.equal(elements.get('dialogue-avatar').src, '/assets/harbor-art/carpenter-restyled-v2.png');
});

test('opening a menu preserves the unread page and its remaining reading time', () => {
  const { director, elements, player, setClock } = fixture();
  director.speak('lookout', 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce', { priority: 2, key: 'report:long' });
  director.speak('lookout', 'Otra isla todavía espera su turno.', { priority: 2, key: 'report:next' });
  const firstPage = elements.get('dialogue-message').textContent;
  setClock(2000); director.setReadingPaused(true);
  setClock(62000); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 0);
  assert.equal(elements.get('dialogue-message').textContent, firstPage);
  assert.equal(director.speeches[0].key, 'report:next');
  director.setReadingPaused(false);
  setClock(64999); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 0);
  setClock(65000); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 6);
  assert.equal(elements.get('dialogue-message').textContent, 'siete ocho nueve diez once doce');
  assert.equal(director.speeches[0].key, 'report:next');
});

test('a message created or resized behind a menu receives its reading time after the menu closes', () => {
  const { director, copy, elements, player, setClock } = fixture();
  director.setReadingPaused(true);
  setClock(30000);
  director.speak('lookout', 'uno dos tres cuatro cinco seis siete ocho nueve', { priority: 2, key: 'report:hidden' });
  copy.clientHeight = 30; director.fitSpeech();
  assert.equal(elements.get('dialogue-message').textContent, 'uno dos tres');
  setClock(60000); director.setReadingPaused(false);
  setClock(64999); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 0);
  setClock(65000); director.update(player, [], [], 0);
  assert.equal(director.currentSpeech.pages.cursor, 3);
  assert.equal(elements.get('dialogue-message').textContent, 'cuatro cinco seis');
});

test('resolved invasions are removed while all suspended discovery pages remain available', () => {
  const { director, player, events } = fixture();
  const discovery = { name: 'Calavera', available: true, type: 'treasure' };
  director.reportIsland(discovery, {}, 1);
  director.advanceSpeech();
  const original = director.currentSpeech, consumed = original.pages.cursor;
  const island = { name: 'Ron Ron', owner: 'blue', x: 0, z: 0, r: 20,
    invasion: { team: 'red', source: { dead: 0 }, duration: 30, progress: 0 } };
  director.update(player, [island], [], 1);
  assert.equal(director.currentSpeech.priority, 3);
  director.reportIsland({ name: 'Otra cala', available: true, type: 'treasure' }, {}, 2);
  island.owner = 'red'; island.invasion = null;
  director.update(player, [island], [], 2);
  assert.equal(director.currentSpeech, original);
  assert.equal(director.currentSpeech.pages.cursor, consumed);
  assert.equal(director.speeches[0].key, 'report:Otra cala');
  assert.equal(events.filter(event => event.type === 'discovery').length, 2);
  assert.equal(events.filter(event => event.type === 'invasion').length, 1);
});

test('a queued invasion that ends or loses its attacking ship is never displayed later', () => {
  const { director, player } = fixture();
  const islands = ['Ron Ron', 'Cala azul'].map(name => ({ name, owner: 'blue', x: 0, z: 0, r: 20,
    invasion: { team: 'red', source: { dead: 0 }, duration: 30, progress: 0 } }));
  director.update(player, islands, [], 1);
  assert.equal(director.currentSpeech.key, 'invasion:1');
  assert.equal(director.speeches[0].key, 'invasion:2');
  assert.ok(director.speeches[0].message.includes(islands[1].name));
  assert.doesNotMatch(director.speeches[0].message, /\d+\s*segundos/);
  director.reportIsland({ name: 'Calavera', available: true, type: 'treasure' }, {}, 2);
  islands[1].invasion.source.dead = 1;
  director.update(player, islands, [], 2);
  assert.deepEqual(director.speeches.map(speech => speech.key), ['report:Calavera']);
  islands[0].invasion = null;
  director.update(player, islands, [], 3);
  assert.equal(director.currentSpeech.key, 'report:Calavera');
});
